/**
 * Billing screen pro iOS — čistě informativní (App Store 3.1.1, „reader" model).
 *
 * V aplikaci NENÍ žádný nákupní mechanismus ani call to action: žádné ceny,
 * žádný cyklus, žádné potvrzení tarifu, žádná zmínka o fakturách či webu.
 * Zobrazujeme jen aktivní služby a jejich stav (trial do / zaplaceno do)
 * + přidání další země (trial je zdarma). Konverze na placené předplatné
 * probíhá kompletně mimo aplikaci (e-mailové připomínky s proformou,
 * platba převodem) — appka pak jen ukáže nový stav.
 */
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { endpoints, type BillingServiceRow } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const LOCALE_MAP: Record<string, string> = { cs: "cs-CZ", en: "en-GB", de: "de-DE" };

type TFn = ReturnType<typeof useI18n>["t"];

export default function TariffIOS() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const dateLocale = LOCALE_MAP[locale] ?? "cs-CZ";

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

  function countryLabelFor(code: string): string {
    const c = countriesQuery.data?.find((x) => x.code === code);
    if (!c) return code;
    return c.labels[locale as "cs" | "en" | "de"] ?? c.labels.en;
  }

  if (billingQuery.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textSubtle} />
      </View>
    );
  }

  const data = billingQuery.data ?? null;
  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t("settings", "loadFailed")}</Text>
      </View>
    );
  }

  const activeRows = data.services.filter((s) => s.state !== "CANCELED");

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
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

    addCountryBtn: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm + 2,
      alignItems: "center",
      borderRadius: radius.md,
      backgroundColor: colors.accent,
    },
    addCountryText: { fontSize: fontSize.sm, color: colors.accentForeground, fontWeight: "600" },

    emptyText: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center" },
    errorText: { fontSize: fontSize.sm, color: colors.danger, textAlign: "center" },
  });
