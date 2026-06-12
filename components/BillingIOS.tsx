/**
 * Billing screen pro iOS — App Store In-App Purchase only (guideline 3.1.1).
 *
 * Na iOS neexistuje žádný Stripe/proforma/ceník mimo IAP:
 *  - nákup/upgrade předplatného = StoreKit (cena se zobrazuje výhradně
 *    lokalizovaná ze StoreKit, žádné vlastní ceníky)
 *  - zrušení/platební údaje = nativní Apple správa předplatných
 *  - fakturační údaje (IČO/DIČ) se na iOS nesbírají — účtenky vystavuje Apple
 *
 * Jedna Apple subscription pokrývá celý set LEADS zemí (productId kóduje
 * kombinaci malých/velkých trhů). Přidání země = upgrade (hned, proration),
 * odebrání = downgrade (k datu renewalu, backend drží pending scopes).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { endpoints, type BillingCycle, type BillingServiceRow } from "@/lib/endpoints";
import {
  fetchLeadsProduct,
  IapCancelledError,
  openManageSubscriptions,
  purchaseLeads,
  restoreLeadsPurchases,
} from "@/lib/iap";
import { API_BASE_URL } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const LOCALE_MAP: Record<string, string> = { cs: "cs-CZ", en: "en-GB", de: "de-DE" };

type TFn = ReturnType<typeof useI18n>["t"];

export default function BillingIOS() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const qc = useQueryClient();
  const dateLocale = LOCALE_MAP[locale] ?? "cs-CZ";

  const billingQuery = useQuery({
    queryKey: ["billing"],
    queryFn: () => endpoints.getBilling(),
    staleTime: 30 * 1000,
  });
  const iapQuery = useQuery({
    queryKey: ["iap-state"],
    queryFn: () => endpoints.getIapState(),
    staleTime: 30 * 1000,
  });
  const countriesQuery = useQuery({
    queryKey: ["leads-countries"],
    queryFn: () => endpoints.getLeadsCountries(),
    staleTime: 30 * 60 * 1000,
  });

  const [cycle, setCycle] = useState<BillingCycle | null>(null);
  const [busy, setBusy] = useState<null | "purchase" | "restore" | `remove-${string}`>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const services = billingQuery.data?.services ?? [];
  const leadsRows = services.filter((s) => s.service === "LEADS" && s.state !== "CANCELED");
  const otherRows = services.filter((s) => s.service !== "LEADS");
  const scopes = useMemo(
    () => leadsRows.map((s) => s.scope).filter((s): s is string => !!s),
    [leadsRows],
  );

  const iap = iapQuery.data?.current ?? null;
  const appleActive = !!iap?.active;
  // Cycle: u aktivní Apple subscription je daný produktem; jinak user volí
  // před nákupem (default z backend billingCycle).
  const effectiveCycle: BillingCycle =
    cycle ??
    (appleActive && iap?.productId
      ? iap.productId.endsWith(".y")
        ? "YEARLY"
        : "MONTHLY"
      : billingQuery.data?.billingCycle ?? "MONTHLY");

  // Quote + StoreKit cena pro aktuální set zemí (jen když není aktivní sub).
  const quoteEnabled = !appleActive && scopes.length > 0 && scopes.length <= 6;
  const quoteQuery = useQuery({
    queryKey: ["iap-quote", [...scopes].sort().join(","), effectiveCycle],
    queryFn: () => endpoints.getIapQuote(scopes, effectiveCycle),
    enabled: quoteEnabled,
    staleTime: 5 * 60 * 1000,
  });
  const productQuery = useQuery({
    queryKey: ["iap-product", quoteQuery.data?.productId],
    queryFn: () => fetchLeadsProduct(quoteQuery.data!.productId),
    enabled: !!quoteQuery.data?.productId,
    staleTime: 5 * 60 * 1000,
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["billing"] }),
      qc.invalidateQueries({ queryKey: ["iap-state"] }),
      qc.invalidateQueries({ queryKey: ["account-subscriptions"] }),
      qc.invalidateQueries({ queryKey: ["service", "leads"] }),
      qc.invalidateQueries({ queryKey: ["matches"] }),
    ]);
  }, [qc]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function subscribe() {
    const quote = quoteQuery.data;
    if (!quote) return;
    setBusy("purchase");
    setError(null);
    try {
      await purchaseLeads({
        productId: quote.productId,
        appAccountToken: quote.appAccountToken,
        scopes,
      });
      await refreshAll();
    } catch (e) {
      if (!(e instanceof IapCancelledError)) {
        setError(e instanceof Error && e.message !== "IAP not available"
          ? t("iap", "purchaseFailed")
          : t("iap", "notAvailable"));
      }
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    setError(null);
    try {
      const n = await restoreLeadsPurchases();
      if (n === -1) setError(t("iap", "restoreUnassigned"));
      else setNotice(n > 0 ? t("iap", "restoredOk") : t("iap", "restoredNone"));
      if (n > 0) await refreshAll();
    } catch {
      setError(t("iap", "purchaseFailed"));
    } finally {
      setBusy(null);
    }
  }

  function removeCountry(row: BillingServiceRow) {
    if (!row.scope || !iap) return;
    const remaining = scopes.filter((s) => s !== row.scope);
    if (remaining.length === 0) {
      // Poslední země — zrušení celého předplatného řeší Apple sheet.
      void openManageSubscriptions();
      return;
    }
    const countryLabel = countryLabelFor(row.scope);
    Alert.alert(
      t("iap", "removeCountryTitle"),
      t("iap", "removeCountryBody", { country: countryLabel }),
      [
        { text: t("settings", "cancel"), style: "cancel" },
        {
          text: t("iap", "removeCountryConfirm"),
          style: "destructive",
          onPress: async () => {
            setBusy(`remove-${row.scope}`);
            setError(null);
            try {
              const quote = await endpoints.getIapQuote(remaining, effectiveCycle);
              await purchaseLeads({
                productId: quote.productId,
                appAccountToken: quote.appAccountToken,
                scopes: remaining,
                currentScopes: scopes,
                mode: "downgrade",
              });
              setNotice(t("iap", "pendingDowngradeNote"));
              await refreshAll();
            } catch (e) {
              if (!(e instanceof IapCancelledError)) setError(t("iap", "purchaseFailed"));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  function countryLabelFor(code: string): string {
    const c = countriesQuery.data?.find((x) => x.code === code);
    if (!c) return code;
    return c.labels[locale as "cs" | "en" | "de"] ?? c.labels.en;
  }

  if (billingQuery.isPending || iapQuery.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textSubtle} />
      </View>
    );
  }

  const priceKey = effectiveCycle === "YEARLY" ? "priceYearly" : "priceMonthly";
  const priceText = productQuery.data?.displayPrice
    ? t("iap", priceKey, { price: productQuery.data.displayPrice })
    : quoteEnabled
      ? t("iap", "priceLoading")
      : null;

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Aktivní služby */}
        <Section styles={styles} title={t("settings", "billingServicesSection")}>
          {leadsRows.length === 0 && otherRows.length === 0 ? (
            <Text style={styles.emptyText}>{t("settings", "billingServicesEmpty")}</Text>
          ) : (
            <>
              {leadsRows.map((svc) => (
                <ServiceLine
                  key={`${svc.service}:${svc.scope ?? ""}`}
                  styles={styles}
                  t={t}
                  name={`${countryFlag(svc.scope)} ${countryLabelFor(svc.scope ?? "")}`}
                  meta={serviceMeta(svc, t, dateLocale)}
                  onRemove={
                    appleActive && scopes.length > 0 ? () => removeCountry(svc) : undefined
                  }
                  removing={busy === `remove-${svc.scope}`}
                />
              ))}
              {otherRows.map((svc) => (
                <ServiceLine
                  key={svc.service}
                  styles={styles}
                  t={t}
                  name={serviceLabel(svc.service, t)}
                  meta={serviceMeta(svc, t, dateLocale)}
                />
              ))}
            </>
          )}
          <Pressable
            onPress={() => router.push("/(onboarding)/countries")}
            style={({ pressed }) => [styles.addCountryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.addCountryText}>＋ {t("iap", "addCountry")}</Text>
          </Pressable>
        </Section>

        {/* Předplatné */}
        <Section styles={styles} title={t("iap", "sectionTitle")}>
          {appleActive ? (
            <>
              <Text style={styles.bodyText}>{t("iap", "activeNote")}</Text>
              {iap!.pendingScopes.length > 0 && (
                <Text style={styles.pendingNote}>{t("iap", "pendingDowngradeNote")}</Text>
              )}
              <Pressable
                onPress={() => void openManageSubscriptions()}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.primaryBtnText}>{t("iap", "manageCta")}</Text>
              </Pressable>
              <Text style={styles.fineprint}>{t("iap", "cancelInfo")}</Text>
            </>
          ) : (
            <>
              {scopes.length > 0 && scopes.length <= 6 ? (
                <>
                  {/* Cyklus se volí před nákupem */}
                  <View style={styles.segments}>
                    <Segment
                      styles={styles}
                      label={t("settings", "billingCycleMonthly")}
                      active={effectiveCycle === "MONTHLY"}
                      onPress={() => setCycle("MONTHLY")}
                    />
                    <Segment
                      styles={styles}
                      label={t("settings", "billingCycleYearly")}
                      active={effectiveCycle === "YEARLY"}
                      onPress={() => setCycle("YEARLY")}
                    />
                  </View>
                  {priceText && <Text style={styles.priceText}>{priceText}</Text>}
                  <Pressable
                    onPress={subscribe}
                    disabled={busy === "purchase" || !quoteQuery.data || !productQuery.data}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && { opacity: 0.85 },
                      (busy === "purchase" || !quoteQuery.data || !productQuery.data) &&
                        styles.btnDisabled,
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>
                      {busy === "purchase" ? t("iap", "subscribing") : t("iap", "subscribeCta")}
                    </Text>
                  </Pressable>
                </>
              ) : scopes.length > 6 ? (
                <Text style={styles.bodyText}>{t("iap", "tooManyCountries")}</Text>
              ) : (
                <Text style={styles.emptyText}>{t("settings", "billingServicesEmpty")}</Text>
              )}
            </>
          )}

          <Pressable
            onPress={restore}
            disabled={busy === "restore"}
            style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.linkBtnText}>
              {busy === "restore" ? t("iap", "restoring") : t("iap", "restoreCta")}
            </Text>
          </Pressable>
        </Section>

        {notice && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        )}

        {/* Apple vyžaduje u subscriptions odkazy na podmínky + privacy */}
        <View style={styles.legalRow}>
          <Pressable onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}/vop`)}>
            <Text style={styles.legalLink}>{t("iap", "legalTerms")}</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>·</Text>
          <Pressable onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}/gdpr`)}>
            <Text style={styles.legalLink}>{t("iap", "legalPrivacy")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const FLAGS: Record<string, string> = {
  CZ: "🇨🇿", SK: "🇸🇰", DE: "🇩🇪", AT: "🇦🇹", PL: "🇵🇱", FR: "🇫🇷",
  IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱", BE: "🇧🇪", PT: "🇵🇹", SE: "🇸🇪",
  FI: "🇫🇮", DK: "🇩🇰", NO: "🇳🇴", IE: "🇮🇪", GR: "🇬🇷", RO: "🇷🇴",
  BG: "🇧🇬", HU: "🇭🇺", HR: "🇭🇷", SI: "🇸🇮", LT: "🇱🇹", LV: "🇱🇻",
  EE: "🇪🇪", LU: "🇱🇺", CY: "🇨🇾", MT: "🇲🇹", CH: "🇨🇭", IS: "🇮🇸", MK: "🇲🇰",
};

function countryFlag(scope: string | null | undefined): string {
  return scope ? FLAGS[scope] ?? "🌐" : "🌐";
}

function serviceMeta(svc: BillingServiceRow, t: TFn, dateLocale: string): string {
  if (svc.state === "TRIAL" && svc.trialEndsAt) {
    return t("settings", "billingServiceTrialEnds", { date: fmtDate(svc.trialEndsAt, dateLocale) });
  }
  if (svc.tier === "PAID" && svc.paidUntil) {
    return t("settings", "billingServicePaidUntil", { date: fmtDate(svc.paidUntil, dateLocale) });
  }
  switch (svc.state) {
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

function serviceLabel(service: BillingServiceRow["service"], t: TFn): string {
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

function fmtDate(iso: string, dateLocale: string): string {
  return new Date(iso).toLocaleDateString(dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

function ServiceLine({
  styles,
  t,
  name,
  meta,
  onRemove,
  removing,
}: {
  styles: ReturnType<typeof makeStyles>;
  t: TFn;
  name: string;
  meta: string;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <View style={styles.serviceRow}>
      <View style={styles.serviceText}>
        <Text style={styles.serviceName}>{name}</Text>
        <Text style={styles.serviceMeta}>{meta}</Text>
      </View>
      {onRemove && (
        <Pressable
          onPress={onRemove}
          disabled={removing}
          style={({ pressed }) => [styles.warnBtn, pressed && { opacity: 0.6 }, removing && styles.btnDisabled]}
        >
          <Text style={styles.warnBtnText}>
            {removing ? t("iap", "subscribing") : t("iap", "removeCountryConfirm")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Segment({
  styles,
  label,
  active,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.segment,
        active && styles.segmentActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },

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

    serviceRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
    serviceText: { flex: 1, paddingRight: spacing.md },
    serviceName: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
    serviceMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },

    segments: {
      flexDirection: "row",
      backgroundColor: colors.bg,
      borderRadius: radius.full,
      padding: 2,
      borderWidth: 1,
      borderColor: colors.border,
      height: 30,
      alignSelf: "flex-start",
      marginBottom: spacing.md,
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

    priceText: { fontSize: fontSize.base, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
    bodyText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20, marginBottom: spacing.md },
    pendingNote: { fontSize: fontSize.xs, color: colors.warning, marginBottom: spacing.md, lineHeight: 16 },
    fineprint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.md, lineHeight: 16 },

    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
    },
    primaryBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
    btnDisabled: { opacity: 0.4 },
    linkBtn: { marginTop: spacing.md, paddingVertical: spacing.xs, alignItems: "center" },
    linkBtnText: { fontSize: fontSize.sm, color: colors.link, fontWeight: "500" },
    warnBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
    warnBtnText: { color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: "500", textDecorationLine: "underline" },

    addCountryBtn: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm + 2,
      alignItems: "center",
      borderRadius: radius.md,
      backgroundColor: colors.accent,
    },
    addCountryText: { fontSize: fontSize.sm, color: colors.accentForeground, fontWeight: "600" },

    emptyText: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center" },
    noticeBox: { marginTop: spacing.xs, marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.successBg, borderRadius: radius.md },
    noticeText: { fontSize: fontSize.sm, color: colors.success },
    errorBox: { marginTop: spacing.xs, marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.dangerBg, borderRadius: radius.md },
    errorBoxText: { fontSize: fontSize.sm, color: colors.danger },

    legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
    legalLink: { fontSize: fontSize.xs, color: colors.link, textDecorationLine: "underline" },
    legalSeparator: { fontSize: fontSize.xs, color: colors.textSubtle },
  });
