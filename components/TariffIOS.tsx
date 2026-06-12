/**
 * Billing screen pro iOS — tarifní model po vzoru eProtokol.
 *
 * V aplikaci NENÍ žádný platební mechanismus (App Store 3.1.1):
 * žádný Stripe, karty, faktury ani PDF. User jen vybere tarif (země řeší
 * countries screen, tady cyklus) a potvrdí — backend přepne billing na
 * fakturaci a zálohovou fakturu pošle e-mailem. Platba proběhne převodem
 * úplně mimo aplikaci.
 *
 * Ceny zobrazujeme z backendu (per-row priceMonthly/priceYearly už po
 * volume slevě, v měně uživatele) — stejně jako eProtokol ukazuje ceník
 * tarifů u tarifní změny.
 */
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { endpoints, type BillingCycle, type BillingServiceRow } from "@/lib/endpoints";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const LOCALE_MAP: Record<string, string> = { cs: "cs-CZ", en: "en-GB", de: "de-DE" };
const NUMBER_LOCALE_MAP: Record<string, string> = { cs: "cs-CZ", en: "en-US", de: "de-DE" };

type TFn = ReturnType<typeof useI18n>["t"];

export default function TariffIOS() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const qc = useQueryClient();
  const dateLocale = LOCALE_MAP[locale] ?? "cs-CZ";
  const numberLocale = NUMBER_LOCALE_MAP[locale] ?? "cs-CZ";

  const billingQuery = useQuery({
    queryKey: ["billing"],
    queryFn: () => endpoints.getBilling(),
    staleTime: 30 * 1000,
  });
  const countriesQuery = useQuery({
    queryKey: ["leads-countries"],
    queryFn: () => endpoints.getLeadsCountries(),
    staleTime: 30 * 60 * 1000,
  });

  const [cycle, setCycle] = useState<BillingCycle | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = billingQuery.data ?? null;
  const services = data?.services ?? [];
  const activeRows = services.filter((s) => s.state !== "CANCELED");
  const effectiveCycle: BillingCycle = cycle ?? data?.billingCycle ?? "MONTHLY";

  // Součet cen aktivních služeb v daném cyklu (backend posílá per-row ceny po
  // volume slevě v měně uživatele).
  const currency = activeRows.find((s) => s.priceCurrency)?.priceCurrency ?? "CZK";
  const total = activeRows.reduce((sum, s) => {
    const p = effectiveCycle === "YEARLY" ? s.priceYearly : s.priceMonthly;
    return sum + (p ?? 0);
  }, 0);

  function fmtCurrency(amount: number): string {
    try {
      return new Intl.NumberFormat(numberLocale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${amount} ${currency === "EUR" ? "€" : "Kč"}`;
    }
  }

  function countryLabelFor(code: string): string {
    const c = countriesQuery.data?.find((x) => x.code === code);
    if (!c) return code;
    return c.labels[locale as "cs" | "en" | "de"] ?? c.labels.en;
  }

  async function confirmTariff() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await endpoints.updateBilling({ billingMode: "INVOICE", billingCycle: effectiveCycle });
      // Existující nezaplacenou proformu nahradíme novou (změna cyklu/zemí).
      if (data?.invoice && data.invoice.paidDate === null) {
        await endpoints.deleteProforma().catch(() => {});
      }
      await endpoints.createProforma(effectiveCycle);
      setNotice(t("tariff", "invoiceSent", { email: user?.email ?? "" }));
      await qc.invalidateQueries({ queryKey: ["billing"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings", "billingSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (billingQuery.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textSubtle} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t("settings", "loadFailed")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Aktivní služby */}
        <Section styles={styles} title={t("settings", "billingServicesSection")}>
          {activeRows.length === 0 ? (
            <Text style={styles.emptyText}>{t("settings", "billingServicesEmpty")}</Text>
          ) : (
            activeRows.map((svc) => (
              <View key={`${svc.service}:${svc.scope ?? ""}`} style={styles.serviceRow}>
                <View style={styles.serviceText}>
                  <Text style={styles.serviceName}>
                    {svc.service === "LEADS" && svc.scope
                      ? `${countryFlag(svc.scope)} ${countryLabelFor(svc.scope)}`
                      : serviceLabel(svc.service, t)}
                  </Text>
                  <Text style={styles.serviceMeta}>{serviceMeta(svc, t, dateLocale)}</Text>
                </View>
              </View>
            ))
          )}
          <Pressable
            onPress={() => router.push("/(onboarding)/countries")}
            style={({ pressed }) => [styles.addCountryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.addCountryText}>＋ {t("settings", "billingAddCountry")}</Text>
          </Pressable>
        </Section>

        {/* Tarif — cyklus + cena + potvrzení (fakturace mimo aplikaci) */}
        {activeRows.length > 0 && (
          <Section styles={styles} title={t("tariff", "sectionTitle")}>
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

            {total > 0 && (
              <Text style={styles.priceText}>
                {t(
                  "tariff",
                  effectiveCycle === "YEARLY" ? "totalYearly" : "totalMonthly",
                  { price: fmtCurrency(total) },
                )}
              </Text>
            )}

            <Pressable
              onPress={confirmTariff}
              disabled={busy || total === 0}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
                (busy || total === 0) && styles.btnDisabled,
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {busy ? t("tariff", "confirming") : t("tariff", "confirmCta")}
              </Text>
            </Pressable>
            <Text style={styles.fineprint}>{t("tariff", "invoiceNote")}</Text>
          </Section>
        )}

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

function countryFlag(scope: string): string {
  return FLAGS[scope] ?? "🌐";
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

    priceText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
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
    noticeText: { fontSize: fontSize.sm, color: colors.success, lineHeight: 20 },
    errorBox: { marginTop: spacing.xs, marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.dangerBg, borderRadius: radius.md },
    errorBoxText: { fontSize: fontSize.sm, color: colors.danger },
    errorText: { fontSize: fontSize.sm, color: colors.danger, textAlign: "center" },
  });
