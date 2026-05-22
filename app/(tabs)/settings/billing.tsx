import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import {
  endpoints,
  type ApiServiceId,
  type BillingCycle,
  type BillingFullState,
  type BillingMode,
  type BillingProfileShape,
  type BillingServiceRow,
  type InvoiceRow,
} from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import CompanyLookupField from "@/components/CompanyLookupField";
import CountryPicker from "@/components/CountryPicker";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { useRouter } from "expo-router";

const LOCALE_MAP: Record<string, string> = { cs: "cs-CZ", en: "en-GB", de: "de-DE" };
const NUMBER_LOCALE_MAP: Record<string, string> = { cs: "cs-CZ", en: "en-US", de: "de-DE" };
const SAVE_DEBOUNCE_MS = 700;

type TFn = ReturnType<typeof useI18n>["t"];

export default function BillingScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dateLocale = LOCALE_MAP[locale] ?? "cs-CZ";
  const numberLocale = NUMBER_LOCALE_MAP[locale] ?? "cs-CZ";

  const [data, setData] = useState<BillingFullState | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileDraft, setProfileDraft] = useState<BillingProfileShape | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedAt, setProfileSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    null | "checkout" | "disconnect" | "proforma-create" | "proforma-delete" | "mode" | "cycle" | "currency"
  >(null);
  const [openingInvoiceId, setOpeningInvoiceId] = useState<string | null>(null);
  const [serviceBusy, setServiceBusy] = useState<ApiServiceId | null>(null);
  const qc = useQueryClient();
  const [manualMode, setManualMode] = useState(false);
  const profileSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [state, inv] = await Promise.all([
        endpoints.getBilling(),
        endpoints.getInvoices().catch(() => ({ invoices: [] as InvoiceRow[] })),
      ]);
      setData(state);
      setInvoices(inv.invoices);
      // Normalize country fallback (legacy profiles bez country = CZ)
      const profile: BillingProfileShape = {
        ...state.billingProfile,
        country: state.billingProfile.country || "CZ",
      };
      setProfileDraft(profile);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("settings", "loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Deep link handler — Stripe Checkout success/cancel.
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (!url.startsWith("tendero://billing/")) return;
      if (url.includes("/success")) {
        setError(null);
        void refresh();
      }
      if (url.includes("/cancel")) {
        setError(t("settings", "billingDeepLinkCancel"));
      }
    });
    return () => sub.remove();
  }, [refresh, t]);

  function scheduleProfileSave(next: BillingProfileShape) {
    setProfileDraft(next);
    if (profileSaveTimer.current) clearTimeout(profileSaveTimer.current);
    profileSaveTimer.current = setTimeout(() => {
      void saveProfile(next);
    }, SAVE_DEBOUNCE_MS);
  }

  function onCompanyResolved(
    taxId: string,
    name: string,
    address: string,
    vatNumber: string | null,
  ) {
    if (!profileDraft) return;
    const next: BillingProfileShape = {
      ...profileDraft,
      ico: taxId,
      name: name || profileDraft.name,
      address: address || profileDraft.address,
      // DIČ z VIES/ARES (CZ ARES vrací vatNumber="CZ12345678"). Pokud user už
      // má jiné DIČ vyplněné ručně, nepřepisujeme.
      dic: profileDraft.dic || vatNumber || profileDraft.dic,
    };
    setProfileDraft(next);
    void saveProfile(next);
  }

  function clearResolvedCompany() {
    if (!profileDraft) return;
    const next: BillingProfileShape = {
      ...profileDraft,
      ico: "",
      name: "",
      address: "",
      dic: "",
    };
    setProfileDraft(next);
    void saveProfile(next);
  }

  async function saveProfile(profile: BillingProfileShape) {
    setSavingProfile(true);
    setError(null);
    try {
      await endpoints.updateBilling({ billingProfile: profile });
      setProfileSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
    } finally {
      setSavingProfile(false);
    }
  }

  // Optimistic toggles — okamžitě překlopíme local state, API call fire-and-forget.
  // Při fail rollback + error. Bez await refresh() = instant UI feedback (countries
  // picker má stejný pattern, proto tam přepínání frčí).
  async function setMode(mode: BillingMode) {
    if (!data || data.billingMode === mode) return;
    const prev = data.billingMode;
    setData({ ...data, billingMode: mode });
    setError(null);
    try {
      await endpoints.updateBilling({ billingMode: mode });
    } catch (e) {
      setData((d) => (d ? { ...d, billingMode: prev } : d));
      setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
    }
  }

  async function setCurrency(currency: "CZK" | "EUR") {
    if (!data || data.invoiceCurrency === currency) return;
    const prev = data.invoiceCurrency;
    setData({ ...data, invoiceCurrency: currency });
    setError(null);
    try {
      await endpoints.updateBilling({ invoiceCurrency: currency });
    } catch (e) {
      setData((d) => (d ? { ...d, invoiceCurrency: prev } : d));
      setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
    }
  }

  async function setCycle(cycle: BillingCycle) {
    if (!data || data.billingCycle === cycle) return;
    const prev = data.billingCycle;
    setData({ ...data, billingCycle: cycle });
    setError(null);
    try {
      await endpoints.updateBilling({ billingCycle: cycle });
    } catch (e) {
      setData((d) => (d ? { ...d, billingCycle: prev } : d));
      setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
    }
  }

  async function connectCard() {
    setBusy("checkout");
    setError(null);
    try {
      const r = await endpoints.createBillingCheckout();
      await WebBrowser.openBrowserAsync(r.url);
      // Při návratu deep linkem (tendero://billing/success) refresh proběhne v
      // Linking listeneru. Bezpečnostní pojistka — refresh po close.
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("settings", "billingCheckoutFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function disconnectCard() {
    setBusy("disconnect");
    setError(null);
    try {
      await endpoints.disconnectCard();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function generateProforma() {
    if (!data?.billingCycle) return;
    setBusy("proforma-create");
    setError(null);
    try {
      const r = await endpoints.createProforma(data.billingCycle);
      await refresh();
      // Po úspěšném vystavení rovnou otevřít PDF v native viewer.
      void openInvoicePdf(r.invoiceId, r.invoiceNumber);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
    } finally {
      setBusy(null);
    }
  }

  function regenerateProforma() {
    Alert.alert(
      t("settings", "billingProformaSection"),
      t("settings", "billingProformaConfirmRegenerate"),
      [
        { text: t("settings", "cancel"), style: "cancel" },
        {
          text: t("settings", "billingProformaRegenerate"),
          style: "destructive",
          onPress: async () => {
            setBusy("proforma-create");
            setError(null);
            try {
              await endpoints.deleteProforma();
              if (data?.billingCycle) {
                const r = await endpoints.createProforma(data.billingCycle);
                await refresh();
                void openInvoicePdf(r.invoiceId, r.invoiceNumber);
              } else {
                await refresh();
              }
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  function deleteProforma() {
    Alert.alert(
      t("settings", "billingProformaSection"),
      t("settings", "billingProformaConfirmDelete"),
      [
        { text: t("settings", "cancel"), style: "cancel" },
        {
          text: t("settings", "billingProformaDelete"),
          style: "destructive",
          onPress: async () => {
            setBusy("proforma-delete");
            setError(null);
            try {
              await endpoints.deleteProforma();
              await refresh();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  async function toggleService(svc: BillingServiceRow) {
    setServiceBusy(svc.service);
    setError(null);
    try {
      if (svc.cancelAtPeriodEnd) {
        await endpoints.reactivateService(svc.service);
      } else {
        await endpoints.cancelService(svc.service);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
    } finally {
      setServiceBusy(null);
    }
  }

  async function deactivateService(svc: BillingServiceRow) {
    if (svc.service !== "LEADS") return; // zatím jen LEADS má mobile deact endpoint

    // Reaktivace: pokud cancelAtPeriodEnd=true, klik na tlačítko clearuje flag.
    // Bez potvrzovacího dialogu (akce je nedestruktivní).
    if (svc.cancelAtPeriodEnd) {
      setServiceBusy(svc.service);
      setError(null);
      try {
        await endpoints.reactivateLeadsService();
        await refresh();
        await qc.invalidateQueries({ queryKey: ["service", "leads"] });
        await qc.invalidateQueries({ queryKey: ["matches"] });
      } catch (e) {
        setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
      } finally {
        setServiceBusy(null);
      }
      return;
    }

    Alert.alert(
      t("settings", "billingServiceDeactivateConfirmTitle"),
      t("settings", "billingServiceDeactivateConfirmBody"),
      [
        {
          text: t("settings", "billingServiceDeactivateCancel"),
          style: "cancel",
        },
        {
          text: t("settings", "billingServiceDeactivateConfirm"),
          style: "destructive",
          onPress: async () => {
            setServiceBusy(svc.service);
            setError(null);
            try {
              await endpoints.deactivateLeadsService();
              await refresh();
              await qc.invalidateQueries({ queryKey: ["service", "leads"] });
              await qc.invalidateQueries({ queryKey: ["matches"] });
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t("settings", "billingSaveFailed"));
            } finally {
              setServiceBusy(null);
            }
          },
        },
      ],
    );
  }

  async function openInvoicePdf(invoiceId: string, invoiceNumber: string) {
    setOpeningInvoiceId(invoiceId);
    setError(null);
    try {
      const uri = await downloadInvoicePdf(invoiceId, invoiceNumber);
      router.push({
        pathname: "/(tabs)/settings/invoice-pdf",
        params: { uri, title: invoiceNumber },
      });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : (e as Error).message ?? t("settings", "billingSaveFailed"),
      );
    } finally {
      setOpeningInvoiceId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSubtle} />
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? t("settings", "loadFailed")}</Text>
        </View>
      </View>
    );
  }

  const primaryService = data.services.find((s) => s.service === "LEADS") ?? data.services[0] ?? null;
  const mode = data.billingMode;
  const cycle = data.billingCycle;
  const showCard = mode === "CARD";
  const showProforma = mode === "INVOICE";

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* PlanSummary skryt — info už je v "Aktivní služby" sekci níž a
              redundantní summary plan/state/cycle zbytečně zabíralo místo. */}

          {/* Fakturační údaje */}
          <Section styles={styles} title={t("settings", "billingProfileSection")}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t("profileComplete", "countryLabel")}</Text>
              <CountryPicker
                value={profileDraft?.country || "CZ"}
                onChange={(v) => {
                  if (!profileDraft) return;
                  scheduleProfileSave({ ...profileDraft, country: v });
                }}
              />
            </View>

            <Pressable
              onPress={() => setManualMode((v) => !v)}
              style={({ pressed }) => [styles.manualToggleRow, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.manualCheckbox, manualMode && styles.manualCheckboxOn]}>
                {manualMode && <Text style={styles.manualCheckmark}>✓</Text>}
              </View>
              <Text style={styles.manualToggleLabel}>
                {t("settings", "billingProfileManualToggle")}
              </Text>
            </Pressable>

            {!manualMode ? (
              <CompanyLookupField
                country={profileDraft?.country || "CZ"}
                value={profileDraft?.ico ?? ""}
                resolvedName={profileDraft?.name ?? ""}
                label={t("settings", "billingProfileCompany")}
                onResolve={({ taxId, name, address, vatNumber }) =>
                  onCompanyResolved(taxId, name, address, vatNumber ?? null)
                }
                onClear={clearResolvedCompany}
              />
            ) : (
              <>
                <ProfileField
                  styles={styles}
                  label={t("settings", "billingProfileName")}
                  value={profileDraft?.name ?? ""}
                  onChangeText={(v) =>
                    profileDraft && scheduleProfileSave({ ...profileDraft, name: v })
                  }
                />
                <ProfileField
                  styles={styles}
                  label={t("settings", "billingProfileIco")}
                  value={profileDraft?.ico ?? ""}
                  keyboardType="numbers-and-punctuation"
                  onChangeText={(v) =>
                    profileDraft && scheduleProfileSave({ ...profileDraft, ico: v })
                  }
                />
                <ProfileField
                  styles={styles}
                  label={t("settings", "billingProfileDic")}
                  value={profileDraft?.dic ?? ""}
                  onChangeText={(v) =>
                    profileDraft && scheduleProfileSave({ ...profileDraft, dic: v })
                  }
                />
                <ProfileField
                  styles={styles}
                  label={t("settings", "billingProfileAddress")}
                  value={profileDraft?.address ?? ""}
                  multiline
                  onChangeText={(v) =>
                    profileDraft && scheduleProfileSave({ ...profileDraft, address: v })
                  }
                />
              </>
            )}
            {savingProfile && (
              <Text style={styles.savingHint}>{t("settings", "billingSavingProfile")}</Text>
            )}
            {profileSavedAt && !savingProfile && Date.now() - profileSavedAt < 3000 && (
              <Text style={styles.savedHint}>{t("settings", "billingProfileSavedToast")}</Text>
            )}
          </Section>

          {/* Mode toggle + kontextová CTA podle volby */}
          <Section styles={styles} title={t("settings", "billingModeSection")}>
            <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
              <View style={styles.segments}>
                <Segment
                  styles={styles}
                  label={t("settings", "billingModeCard")}
                  active={mode === "CARD"}
                  disabled={busy === "mode"}
                  onPress={() => void setMode("CARD")}
                />
                <Segment
                  styles={styles}
                  label={t("settings", "billingModeInvoice")}
                  active={mode === "INVOICE"}
                  disabled={busy === "mode"}
                  onPress={() => void setMode("INVOICE")}
                />
              </View>
              {mode === "CARD" && !data.card && (
                <Pressable
                  onPress={connectCard}
                  disabled={busy === "checkout"}
                  style={({ pressed }) => [
                    styles.modeCtaBtn,
                    pressed && { opacity: 0.85 },
                    busy === "checkout" && styles.btnDisabled,
                  ]}
                >
                  <Text style={styles.modeCtaText}>
                    {busy === "checkout" ? t("settings", "billingCardConnecting") : t("settings", "billingCardConnect")}
                  </Text>
                </Pressable>
              )}
              {mode === "INVOICE" && !data.invoice && (
                <Pressable
                  onPress={generateProforma}
                  disabled={busy === "proforma-create" || !data.billingCycle}
                  style={({ pressed }) => [
                    styles.modeCtaBtn,
                    pressed && { opacity: 0.85 },
                    (busy === "proforma-create" || !data.billingCycle) && styles.btnDisabled,
                  ]}
                >
                  <Text style={styles.modeCtaText}>
                    {busy === "proforma-create" ? t("settings", "billingProformaGenerating") : t("settings", "billingProformaGenerate")}
                  </Text>
                </Pressable>
              )}
            </View>
          </Section>

          {/* Cycle + Currency toggle vedle sebe (compact pill, intrinsic width) */}
          <Section styles={styles} title={t("settings", "billingCycleSection")}>
            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              <View style={styles.segments}>
                <Segment
                  styles={styles}
                  label={t("settings", "billingCycleMonthly")}
                  active={cycle === "MONTHLY"}
                  disabled={busy === "cycle"}
                  onPress={() => void setCycle("MONTHLY")}
                />
                <Segment
                  styles={styles}
                  label={t("settings", "billingCycleYearly")}
                  active={cycle === "YEARLY"}
                  disabled={busy === "cycle"}
                  onPress={() => void setCycle("YEARLY")}
                />
              </View>
              <View style={styles.segments}>
                <Segment
                  styles={styles}
                  label="CZK"
                  active={(data.invoiceCurrency ?? "CZK") === "CZK"}
                  disabled={busy === "currency"}
                  onPress={() => void setCurrency("CZK")}
                />
                <Segment
                  styles={styles}
                  label="EUR"
                  active={data.invoiceCurrency === "EUR"}
                  disabled={busy === "currency"}
                  onPress={() => void setCurrency("EUR")}
                />
              </View>
            </View>
            {showProforma && (
              <Pressable
                onPress={data.invoice ? regenerateProforma : generateProforma}
                disabled={busy === "proforma-create"}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { marginTop: spacing.sm },
                  pressed && styles.btnPressed,
                  busy === "proforma-create" && styles.btnDisabled,
                ]}
              >
                <Text style={styles.secondaryBtnText}>
                  {data.invoice
                    ? t("settings", "billingProformaRegenerate")
                    : busy === "proforma-create"
                      ? t("settings", "billingProformaGenerating")
                      : t("settings", "billingProformaGenerate")}
                </Text>
              </Pressable>
            )}
          </Section>

          {/* Card / Proforma */}
          {showCard && (
            <Section styles={styles} title={t("settings", "billingCardSection")}>
              {data.card ? (
                <>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardBrand}>{data.card.brand.toUpperCase()}</Text>
                    <Text style={styles.cardLast4}>•••• {data.card.last4}</Text>
                  </View>
                  <Text style={styles.cardExp}>
                    {t("settings", "billingCardExp", {
                      month: String(data.card.expMonth).padStart(2, "0"),
                      year: String(data.card.expYear),
                    })}
                  </Text>
                  <Pressable
                    onPress={disconnectCard}
                    disabled={busy === "disconnect"}
                    style={({ pressed }) => [
                      styles.linkBtn,
                      pressed && styles.btnPressed,
                      busy === "disconnect" && styles.btnDisabled,
                    ]}
                  >
                    <Text style={styles.linkBtnText}>{t("settings", "billingCardDisconnect")}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={connectCard}
                  disabled={busy === "checkout"}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.btnPressed,
                    busy === "checkout" && styles.btnDisabled,
                  ]}
                >
                  <Text style={styles.primaryBtnText}>
                    {busy === "checkout"
                      ? t("settings", "billingCardConnecting")
                      : t("settings", "billingCardConnect")}
                  </Text>
                </Pressable>
              )}
            </Section>
          )}

          {/* Služby */}
          <Section styles={styles} title={t("settings", "billingServicesSection")}>
            {data.services.length === 0 ? (
              <Text style={styles.emptyText}>{t("settings", "billingServicesEmpty")}</Text>
            ) : (
              data.services.map((svc) => (
                <ServiceRow
                  key={`${svc.service}:${svc.scope ?? ""}`}
                  styles={styles}
                  service={svc}
                  t={t}
                  dateLocale={dateLocale}
                  numberLocale={numberLocale}
                  cycle={cycle}
                  busy={serviceBusy === svc.service}
                  onToggle={() => void toggleService(svc)}
                  onDeactivate={() => void deactivateService(svc)}
                />
              ))
            )}
            <Pressable
              onPress={() => router.push("/(onboarding)/countries")}
              style={({ pressed }) => [styles.addCountryBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.addCountryText}>＋ {t("settings", "billingAddCountry")}</Text>
            </Pressable>
          </Section>

          {/* Faktury */}
          <Section styles={styles} title={t("settings", "billingInvoicesSection")}>
            {invoices && invoices.length > 0 ? (
              invoices.map((inv) => (
                <InvoiceLine
                  key={inv.id}
                  styles={styles}
                  invoice={inv}
                  t={t}
                  dateLocale={dateLocale}
                  numberLocale={numberLocale}
                  opening={openingInvoiceId === inv.id}
                  onOpen={() => void openInvoicePdf(inv.id, inv.number)}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>{t("settings", "billingInvoicesEmpty")}</Text>
            )}
          </Section>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PlanSummary({
  styles,
  service,
  cycle,
  t,
  dateLocale,
}: {
  styles: ReturnType<typeof makeStyles>;
  service: BillingServiceRow;
  cycle: BillingCycle | null;
  t: TFn;
  dateLocale: string;
}) {
  const planLabel =
    service.tier === "PAID" ? t("settings", "billingPlanPaid") : t("settings", "billingPlanFree");
  return (
    <View style={styles.summary}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{t("settings", "billingPlanLabel")}</Text>
        <Text style={styles.summaryValue}>{planLabel}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{t("settings", "billingStateLabel")}</Text>
        <Text style={styles.summaryValue}>{stateLabel(service.state, t)}</Text>
      </View>
      {cycle && (
        <>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("settings", "billingCycleLabel")}</Text>
            <Text style={styles.summaryValue}>{cycleLabel(cycle, t)}</Text>
          </View>
        </>
      )}
      {service.state === "TRIAL" && service.trialEndsAt && (
        <>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("settings", "billingTrialEndsLabel")}</Text>
            <Text style={styles.summaryValue}>{formatDate(service.trialEndsAt, dateLocale)}</Text>
          </View>
        </>
      )}
      {service.tier === "PAID" && service.paidUntil && (
        <>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("settings", "billingPaidUntilLabel")}</Text>
            <Text style={styles.summaryValue}>{formatDate(service.paidUntil, dateLocale)}</Text>
          </View>
        </>
      )}
      {service.cancelAtPeriodEnd && (
        <View style={styles.summaryNotice}>
          <Text style={styles.summaryNoticeText}>{t("settings", "billingCancelNotice")}</Text>
        </View>
      )}
    </View>
  );
}


function Section({
  styles,
  title,
  children,
}: {
  styles: ReturnType<typeof makeStyles>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ProfileField({
  styles,
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
  autoCapitalize,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "numbers-and-punctuation";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function Segment({
  styles,
  label,
  active,
  disabled,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.segment,
        active && styles.segmentActive,
        pressed && styles.btnPressed,
        disabled && styles.btnDisabled,
      ]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ServiceRow({
  styles,
  service,
  t,
  dateLocale,
  numberLocale,
  cycle,
  busy,
  onToggle,
  onDeactivate,
}: {
  styles: ReturnType<typeof makeStyles>;
  service: BillingServiceRow;
  t: TFn;
  dateLocale: string;
  numberLocale: string;
  cycle: BillingCycle | null;
  busy: boolean;
  onToggle: () => void;
  onDeactivate: () => void;
}) {
  const canDeactivate = service.service === "LEADS" && service.state !== "CANCELED";
  const effCycle: BillingCycle = cycle ?? "MONTHLY";
  const priceVal =
    effCycle === "YEARLY" ? service.priceYearly : service.priceMonthly;
  const priceText =
    priceVal != null
      ? t(
          "settings",
          effCycle === "YEARLY"
            ? "billingServicePriceYearly"
            : "billingServicePriceMonthly",
          { price: formatMoney(priceVal, numberLocale) },
        )
      : null;

  const FLAGS: Record<string, string> = {
    CZ: "🇨🇿", SK: "🇸🇰", DE: "🇩🇪", AT: "🇦🇹", PL: "🇵🇱", FR: "🇫🇷",
    IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱", BE: "🇧🇪", PT: "🇵🇹", SE: "🇸🇪",
    FI: "🇫🇮", DK: "🇩🇰", NO: "🇳🇴", IE: "🇮🇪", GR: "🇬🇷", RO: "🇷🇴",
    BG: "🇧🇬", HU: "🇭🇺", HR: "🇭🇷", SI: "🇸🇮", LT: "🇱🇹", LV: "🇱🇻",
    EE: "🇪🇪", LU: "🇱🇺", CY: "🇨🇾", MT: "🇲🇹", CH: "🇨🇭", IS: "🇮🇸", MK: "🇲🇰",
  };
  const scopeLabel =
    service.service === "LEADS" && service.scope
      ? `${FLAGS[service.scope] ?? "🌐"} ${service.scope}`
      : null;
  return (
    <View style={styles.serviceRow}>
      <View style={styles.serviceText}>
        <Text style={styles.serviceName}>
          {serviceLabel(service.service, t)}
          {scopeLabel ? ` — ${scopeLabel}` : ""}
        </Text>
        <Text style={styles.serviceMeta}>
          {service.state === "TRIAL" && service.trialEndsAt
            ? t("settings", "billingServiceTrialEnds", { date: formatDate(service.trialEndsAt, dateLocale) })
            : service.tier === "PAID" && service.paidUntil
              ? t("settings", "billingServicePaidUntil", { date: formatDate(service.paidUntil, dateLocale) })
              : stateLabel(service.state, t)}
        </Text>
        {priceText && <Text style={styles.servicePrice}>{priceText}</Text>}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {service.tier === "PAID" && service.state === "ACTIVE" && (
          <Pressable
            onPress={onToggle}
            disabled={busy}
            style={({ pressed }) => [
              service.cancelAtPeriodEnd ? styles.secondaryBtn : styles.warnBtn,
              pressed && styles.btnPressed,
              busy && styles.btnDisabled,
            ]}
          >
            <Text
              style={
                service.cancelAtPeriodEnd ? styles.secondaryBtnText : styles.warnBtnText
              }
            >
              {service.cancelAtPeriodEnd
                ? t("settings", "billingServiceReactivate")
                : t("settings", "billingServiceCancel")}
            </Text>
          </Pressable>
        )}
        {canDeactivate && (
          <Pressable
            onPress={onDeactivate}
            disabled={busy}
            style={({ pressed }) => [
              service.cancelAtPeriodEnd ? styles.secondaryBtn : styles.warnBtn,
              pressed && styles.btnPressed,
              busy && styles.btnDisabled,
            ]}
          >
            <Text
              style={
                service.cancelAtPeriodEnd ? styles.secondaryBtnText : styles.warnBtnText
              }
            >
              {service.cancelAtPeriodEnd
                ? t("settings", "billingServiceReactivate")
                : t("settings", "billingServiceDeactivate")}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function InvoiceLine({
  styles,
  invoice,
  t,
  dateLocale,
  numberLocale,
  opening,
  onOpen,
}: {
  styles: ReturnType<typeof makeStyles>;
  invoice: InvoiceRow;
  t: TFn;
  dateLocale: string;
  numberLocale: string;
  opening: boolean;
  onOpen: () => void;
}) {
  return (
    <Pressable
      onPress={invoice.hasPdf ? onOpen : undefined}
      disabled={!invoice.hasPdf || opening}
      style={({ pressed }) => [styles.invoiceRow, pressed && invoice.hasPdf && { opacity: 0.7 }]}
    >
      <View style={styles.invoiceText}>
        <Text style={styles.invoiceNumber}>{invoice.number}</Text>
        <Text style={styles.invoiceMeta}>
          {invoice.kind === "PROFORMA"
            ? t("settings", "billingInvoicesKindProforma")
            : t("settings", "billingInvoicesKindTax")}
          {" · "}
          {formatDate(invoice.createdAt, dateLocale)}
          {" · "}
          {formatMoney(invoice.totalAmount, numberLocale)}
        </Text>
      </View>
      {invoice.hasPdf && (
        <Text style={styles.invoiceCta}>
          {opening ? t("settings", "billingInvoicesOpening") : t("settings", "billingInvoicesOpenPdf")}
        </Text>
      )}
    </Pressable>
  );
}

function stateLabel(state: BillingServiceRow["state"], t: TFn): string {
  switch (state) {
    case "TRIAL":
      return t("settings", "billingStateTrial");
    case "ACTIVE":
      return t("settings", "billingStateActive");
    case "PAST_DUE":
      return t("settings", "billingStatePastDue");
    case "SUSPENDED":
      return t("settings", "billingStateSuspended");
    case "CANCELED":
      return t("settings", "billingStateCanceled");
  }
}

function cycleLabel(cycle: BillingCycle, t: TFn): string {
  return cycle === "MONTHLY" ? t("settings", "billingCycleMonthly") : t("settings", "billingCycleYearly");
}

function serviceLabel(service: ApiServiceId, t: TFn): string {
  switch (service) {
    case "LEADS":
      return t("settings", "serviceLeads");
    case "PRICING":
      return t("settings", "servicePricing");
    case "PROCUREMENT":
      return t("settings", "serviceProcurement");
    case "MANAGEMENT":
      return t("settings", "serviceManagement");
  }
}

function formatDate(iso: string, dateLocale: string): string {
  return new Date(iso).toLocaleDateString(dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(amount: number, numberLocale: string): string {
  return new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(amount);
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },

    summary: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: spacing.lg,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    summaryLabel: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: "500" },
    summaryValue: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    summaryDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
    summaryNotice: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.warningBg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    summaryNoticeText: { fontSize: fontSize.xs, color: colors.warning, lineHeight: 16 },

    section: { marginBottom: spacing.lg },
    sectionTitle: {
      fontSize: fontSize.xs,
      fontWeight: "600",
      color: colors.textSubtle,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    sectionBody: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },

    field: { marginBottom: spacing.md },
    fieldLabel: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500", marginBottom: spacing.xs },
    input: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.base,
      color: colors.text,
    },
    inputMultiline: { minHeight: 60, paddingTop: spacing.sm + 2, textAlignVertical: "top" },
    savingHint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.xs },
    savedHint: { fontSize: fontSize.xs, color: colors.success, marginTop: spacing.xs },
    manualToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      marginBottom: spacing.xs,
    },
    manualCheckbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.borderHover,
      backgroundColor: colors.card,
      marginRight: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    manualCheckboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    manualCheckmark: { color: colors.accentForeground, fontSize: 12, fontWeight: "700" },
    manualToggleLabel: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    lookupRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.md },
    lookupHint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: -spacing.sm, marginBottom: spacing.md },
    lookupWarn: { fontSize: fontSize.xs, color: colors.warning, marginTop: -spacing.sm, marginBottom: spacing.md },

    // Compact pill segments — menší než default, vejdou se 2 na řádek vedle sebe.
    segments: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: radius.full,
      padding: 2,
      borderWidth: 1,
      borderColor: colors.border,
      height: 30,
      alignSelf: "flex-start",
    },
    segment: {
      paddingHorizontal: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.full,
    },
    segmentActive: { backgroundColor: colors.accent },
    segmentText: { fontSize: 12, color: colors.textSubtle, fontWeight: "500" },
    segmentTextActive: { color: colors.accentForeground, fontWeight: "600" },
    // Kontextová CTA vedle mode pillů (Připojit kartu / Vystavit zálohovou)
    modeCtaBtn: { backgroundColor: colors.accent, paddingHorizontal: spacing.md, height: 30, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
    modeCtaText: { fontSize: 12, color: colors.accentForeground, fontWeight: "600" },

    cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardBrand: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
    cardLast4: { fontSize: fontSize.base, color: colors.text, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
    cardExp: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.xs },
    proformaText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 18, marginBottom: spacing.md },
    proformaActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      alignSelf: "flex-start",
    },
    primaryBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
    secondaryBtn: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    secondaryBtnText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600" },
    // Deaktivační/zrušit akce — vizuálně tlumené (sekundární), aby nebyly výraznější
    // než primární CTA 'Přidat další zemi'.
    warnBtn: {
      backgroundColor: "transparent",
      borderWidth: 0,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    warnBtnText: { color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: "500", textDecorationLine: "underline" },
    dangerBtn: {
      backgroundColor: colors.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    dangerBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
    linkBtn: { marginTop: spacing.md, paddingVertical: spacing.xs },
    linkBtnText: { fontSize: fontSize.sm, color: colors.danger, fontWeight: "500" },
    btnDisabled: { opacity: 0.4 },
    btnPressed: { opacity: 0.7 },

    serviceRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    serviceText: { flex: 1, paddingRight: spacing.md },
    serviceName: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
    serviceMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    servicePrice: { fontSize: fontSize.xs, color: colors.text, fontWeight: "600", marginTop: 2 },

    invoiceRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    invoiceText: { flex: 1 },
    invoiceNumber: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
    invoiceMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    invoiceCta: { fontSize: fontSize.sm, color: colors.link, fontWeight: "600" },

    emptyText: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center" },
    // 'Přidat další zemi' — primární akce, výrazná (accent fill).
    addCountryBtn: { marginTop: spacing.md, paddingVertical: spacing.sm + 2, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.accent },
    addCountryText: { fontSize: fontSize.sm, color: colors.accentForeground, fontWeight: "600" },
    errorBox: {
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.dangerBg,
      borderRadius: radius.md,
    },
    errorBoxText: { fontSize: fontSize.sm, color: colors.danger },
    errorText: { fontSize: fontSize.sm, color: colors.danger, textAlign: "center" },
  });
