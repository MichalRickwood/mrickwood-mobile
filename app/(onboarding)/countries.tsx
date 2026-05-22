import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { endpoints } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

type Currency = "CZK" | "EUR";
type Cycle = "MONTHLY" | "YEARLY";

interface Country {
  code: string;
  flag: string;
  labels: { cs: string; en: string; de: string };
  price: {
    czk: { monthly: number; yearly: number };
    eur: { monthly: number; yearly: number };
  };
  trialEnabled: boolean;
  coverage: number;
  available: boolean;
}

// Volume discount tiers — match s lib/leads-countries.ts na backendu.
function discountPct(n: number): number {
  if (n >= 5) return 0.5;
  if (n === 4) return 0.4;
  if (n === 3) return 0.3;
  if (n === 2) return 0.2;
  return 0;
}

function priceFor(c: Country, cur: Currency, cycle: Cycle): number {
  const bucket = cur === "CZK" ? c.price.czk : c.price.eur;
  return cycle === "YEARLY" ? bucket.yearly : bucket.monthly;
}

function fmtPrice(amount: number, cur: Currency, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === "cs" ? "cs-CZ" : locale === "de" ? "de-DE" : "en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${cur}`;
  }
}

export default function OnboardingCountries() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [countries, setCountries] = useState<Country[] | null>(null);
  const [activeScopes, setActiveScopes] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currency, setCurrency] = useState<Currency>(locale === "cs" ? "CZK" : "EUR");
  const [cycle, setCycle] = useState<Cycle>("MONTHLY");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, subs] = await Promise.all([
          endpoints.getLeadsCountries(),
          endpoints.listSubscriptions().catch(() => []),
        ]);
        if (cancelled) return;
        setCountries(data);
        const active = new Set(
          subs
            .filter((s) => s.service === "LEADS" && s.scope && s.state !== "CANCELED" && s.state !== "SUSPENDED")
            .map((s) => s.scope as string),
        );
        setActiveScopes(active);
        setSelected(new Set(active)); // Pre-check existující aktivní scopes
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const newSelections = useMemo(() => {
    return [...selected].filter((c) => !activeScopes.has(c));
  }, [selected, activeScopes]);

  const subtotal = useMemo(() => {
    if (!countries) return 0;
    return newSelections.reduce((s, code) => {
      const c = countries.find((x) => x.code === code);
      if (!c) return s;
      return s + priceFor(c, currency, cycle);
    }, 0);
  }, [countries, newSelections, currency, cycle]);

  const pct = discountPct(newSelections.length);
  const discountAmount = Math.round(subtotal * pct);
  const total = subtotal - discountAmount;

  function toggle(code: string) {
    if (activeScopes.has(code)) return; // locked
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const availableCodes = useMemo(
    () => (countries ?? []).filter((c) => c.available).map((c) => c.code),
    [countries],
  );
  const allAvailableSelected =
    availableCodes.length > 0 && availableCodes.every((c) => selected.has(c));

  function selectAll() {
    if (!countries) return;
    if (allAvailableSelected) {
      setSelected(new Set(activeScopes));
    } else {
      setSelected(new Set([...activeScopes, ...availableCodes]));
    }
  }

  async function activate() {
    if (newSelections.length === 0) {
      // Returning user co jen prochází → rovnou na profile gating (RouterGuard rozhodne)
      if (activeScopes.size > 0) router.replace("/(onboarding)/profile");
      return; // first-time user without selection — disabled button stops them
    }
    setActivating(true);
    setError(null);
    try {
      for (const scope of newSelections) {
        await endpoints.activateLeadsScope(scope);
      }
      // Po aktivaci → profile completion (name/phone/country/company)
      router.replace("/(onboarding)/profile");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("onboardingCountries", "activateFailed"));
    } finally {
      setActivating(false);
    }
  }

  if (countries === null) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    );
  }

  const hasActiveTrial = activeScopes.size > 0;
  const ctaLabel = activating
    ? t("onboardingCountries", "activating")
    : hasActiveTrial && newSelections.length > 0
      ? t("onboardingCountries", "ctaAddToTrial")
      : t("onboardingCountries", "cta");

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <FlatList
        contentContainerStyle={styles.list}
        data={countries}
        keyExtractor={(c) => c.code}
        ListHeaderComponent={
          <View style={styles.header}>
            {activeScopes.size > 0 && (
              <Pressable onPress={() => router.replace("/(tabs)/settings/billing")} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← {t("onboardingCountries", "backToSettings")}</Text>
              </Pressable>
            )}
            <Text style={styles.title}>{t("onboardingCountries", "title")}</Text>
            <Text style={styles.subtitle}>{t("onboardingCountries", "subtitle")}</Text>
            <Text style={styles.trialNote}>{t("onboardingCountries", "trialNote")}</Text>

            <View style={styles.toggleRow}>
              <View style={[styles.segmented, { flex: 1.4 }]}>
                <Pressable
                  onPress={() => setCycle("MONTHLY")}
                  style={[styles.segment, cycle === "MONTHLY" && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, cycle === "MONTHLY" && styles.segmentTextActive]}>
                    {t("onboardingCountries", "cycleMonthly")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setCycle("YEARLY")}
                  style={[styles.segment, cycle === "YEARLY" && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, cycle === "YEARLY" && styles.segmentTextActive]}>
                    {t("onboardingCountries", "cycleYearly")}
                  </Text>
                </Pressable>
              </View>
              <View style={[styles.segmented, { flex: 1 }]}>
                <Pressable
                  onPress={() => setCurrency("CZK")}
                  style={[styles.segment, currency === "CZK" && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, currency === "CZK" && styles.segmentTextActive]}>
                    CZK
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setCurrency("EUR")}
                  style={[styles.segment, currency === "EUR" && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, currency === "EUR" && styles.segmentTextActive]}>
                    EUR
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable onPress={selectAll} style={styles.selectAllBtn}>
              <Text style={styles.selectAllText}>
                {t("onboardingCountries", allAvailableSelected ? "deselectAll" : "selectAll")}
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: c }) => {
          const isActive = activeScopes.has(c.code);
          const isSelected = selected.has(c.code);
          const price = priceFor(c, currency, cycle);
          const label = c.labels[locale] ?? c.labels.en;
          const flagUrl = `https://flagcdn.com/24x18/${c.code.toLowerCase()}.png`;
          return (
            <Pressable
              onPress={() => c.available && toggle(c.code)}
              disabled={!c.available || isActive}
              style={[
                styles.countryCard,
                isSelected && styles.countryCardSelected,
                !c.available && styles.countryCardDisabled,
              ]}
            >
              <Image source={{ uri: flagUrl }} style={styles.flag} />
              <View style={styles.countryInfo}>
                <Text style={styles.countryName}>{label}</Text>
                {c.available ? (
                  <Text style={styles.countryPrice}>
                    {fmtPrice(price, currency, locale)}{cycle === "YEARLY" ? t("onboardingCountries", "perYear") : t("onboardingCountries", "perMonth")}
                  </Text>
                ) : (
                  <Text style={styles.countryBadge}>{t("onboardingCountries", "notAvailable")}</Text>
                )}
                {c.available && c.code !== "CZ" && !isActive && (
                  <View style={styles.partialTag}>
                    <Text style={styles.partialTagText}>{t("onboardingCountries", "partialCoverage")}</Text>
                  </View>
                )}
              </View>
              {isActive ? (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>{t("onboardingCountries", "alreadyActive")}</Text>
                </View>
              ) : c.available ? (
                <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            <RequestNewCountry styles={styles} colors={colors} />

            {newSelections.length > 0 && (
              <View style={styles.summary}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryTitle}>{t("onboardingCountries", "summaryTitle")}</Text>
                  <Text style={styles.summaryCount}>
                    {t("onboardingCountries", "countriesCount", { count: newSelections.length })}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t("onboardingCountries", "summarySubtotal")}</Text>
                  <Text style={styles.summaryValue}>{fmtPrice(subtotal, currency, locale)}</Text>
                </View>
                {pct > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.success }]}>
                      {t("onboardingCountries", "summaryDiscount", { pct: Math.round(pct * 100) })}
                    </Text>
                    <Text style={[styles.summaryValue, { color: colors.success }]}>
                      −{fmtPrice(discountAmount, currency, locale)}
                    </Text>
                  </View>
                )}
                <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                  <Text style={styles.summaryTotalLabel}>{t("onboardingCountries", "summaryAfterTrial")}</Text>
                  <Text style={styles.summaryTotalValue}>
                    {fmtPrice(total, currency, locale)}{cycle === "YEARLY" ? t("onboardingCountries", "perYear") : t("onboardingCountries", "perMonth")}
                  </Text>
                </View>
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              onPress={activate}
              disabled={activating || (newSelections.length === 0 && activeScopes.size === 0)}
              style={({ pressed }) => [
                styles.ctaBtn,
                pressed && { opacity: 0.85 },
                activating && { opacity: 0.6 },
                newSelections.length === 0 && activeScopes.size === 0 && styles.ctaBtnDisabled,
              ]}
            >
              {activating ? (
                <ActivityIndicator color={colors.accentForeground} />
              ) : (
                <Text style={styles.ctaBtnText}>{ctaLabel}</Text>
              )}
            </Pressable>
            {hasActiveTrial && newSelections.length === 0 && (
              <Pressable onPress={() => router.replace("/(tabs)")} style={styles.skipBtn}>
                <Text style={styles.skipBtnText}>{t("onboardingCountries", "ctaSkip")}</Text>
              </Pressable>
            )}
            <Text style={styles.footerNote}>{t("onboardingCountries", "footerNote")}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function RequestNewCountry({ styles, colors }: { styles: ReturnType<typeof makeStyles>; colors: Colors }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const v = value.trim();
    if (!v) return;
    setSubmitting(true);
    try {
      await endpoints.submitFeedback({
        kind: "OTHER",
        message: `[new-country-request] Žádám přidání země do LEADS pokrytí: ${v}`,
      });
      setSent(true);
      setValue("");
    } catch {
      // Silently fail — request je best-effort, user can retry později.
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <View style={styles.requestSentBox}>
        <Text style={styles.requestSentText}>{t("onboardingCountries", "requestSubmitted")}</Text>
      </View>
    );
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={styles.requestToggle}>
        <Text style={styles.requestToggleText}>{t("onboardingCountries", "requestToggle")}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.requestBox}>
      <Text style={styles.requestHelper}>{t("onboardingCountries", "requestHelper")}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={t("onboardingCountries", "requestPlaceholder")}
        placeholderTextColor={colors.textFaint}
        style={styles.requestInput}
        autoFocus
        autoCapitalize="words"
      />
      <View style={styles.requestActions}>
        <Pressable
          onPress={() => { setOpen(false); setValue(""); }}
          style={styles.requestCancelBtn}
        >
          <Text style={styles.requestCancelText}>{t("onboardingCountries", "requestCancel")}</Text>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={submitting || !value.trim()}
          style={[styles.requestSubmitBtn, (submitting || !value.trim()) && { opacity: 0.5 }]}
        >
          <Text style={styles.requestSubmitText}>
            {submitting ? t("onboardingCountries", "requestSending") : t("onboardingCountries", "requestSubmit")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    loadingScreen: { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
    list: { paddingBottom: spacing.xxl },
    header: { padding: spacing.lg, paddingTop: spacing.md },
    backBtn: { marginBottom: spacing.md, alignSelf: "flex-start" },
    backBtnText: { fontSize: fontSize.sm, color: c.link, fontWeight: "500" },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: c.text, marginBottom: spacing.sm },
    subtitle: { fontSize: fontSize.sm, color: c.textMuted, marginBottom: spacing.md, lineHeight: 20 },
    trialNote: { fontSize: fontSize.xs, color: c.textSubtle, marginBottom: spacing.lg, fontStyle: "italic" },
    toggleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
    segmented: { flexDirection: "row", backgroundColor: c.card, borderRadius: radius.full, padding: 3, borderWidth: 1, borderColor: c.border, height: 36 },
    segment: { flex: 1, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.full },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 13, color: c.textMuted, fontWeight: "500" },
    segmentTextActive: { color: c.accentForeground, fontWeight: "600" },
    selectAllBtn: { alignSelf: "flex-start", paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
    selectAllText: { fontSize: fontSize.xs, color: c.link, fontWeight: "500", textDecorationLine: "underline" },
    countryCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    countryCardSelected: { borderColor: c.accent, backgroundColor: c.cardElevated },
    countryCardDisabled: { opacity: 0.55, borderStyle: "dashed" },
    flag: { width: 24, height: 18, borderRadius: 2 },
    countryInfo: { flex: 1 },
    countryName: { fontSize: fontSize.base, color: c.text, fontWeight: "500" },
    countryPrice: { fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
    countryBadge: { fontSize: fontSize.xs, color: c.warning, marginTop: 2 },
    activeBadge: { backgroundColor: c.successBg, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
    activeBadgeText: { fontSize: 10, fontWeight: "700", color: c.success, textTransform: "uppercase", letterSpacing: 0.5 },
    partialTag: { alignSelf: "flex-start", marginTop: 4, backgroundColor: c.warningBg, borderWidth: 1, borderColor: c.warning, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    partialTagText: { fontSize: 10, color: c.warning, fontWeight: "500" },
    checkbox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    checkboxOn: { borderColor: c.accent, backgroundColor: c.accent },
    checkmark: { color: c.accentForeground, fontSize: 14, fontWeight: "700" },
    footer: { padding: spacing.lg, paddingTop: spacing.md },
    summary: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
    summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing.sm },
    summaryTitle: { fontSize: fontSize.xs, color: c.textMuted, fontWeight: "600", textTransform: "uppercase" },
    summaryCount: { fontSize: fontSize.xs, color: c.textSubtle },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    summaryRowTotal: { borderTopWidth: 1, borderTopColor: c.border, marginTop: spacing.sm, paddingTop: spacing.sm },
    summaryLabel: { fontSize: fontSize.sm, color: c.textMuted },
    summaryValue: { fontSize: fontSize.sm, color: c.text, fontWeight: "500" },
    summaryTotalLabel: { fontSize: fontSize.base, color: c.text, fontWeight: "600" },
    summaryTotalValue: { fontSize: fontSize.base, color: c.text, fontWeight: "700" },
    errorText: { fontSize: fontSize.sm, color: c.danger, marginBottom: spacing.md, textAlign: "center" },
    ctaBtn: { backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
    ctaBtnDisabled: { backgroundColor: c.border, opacity: 0.6 },
    ctaBtnText: { color: c.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    skipBtn: { paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.sm },
    skipBtnText: { color: c.textMuted, fontSize: fontSize.sm },
    footerNote: { fontSize: fontSize.xs, color: c.textSubtle, textAlign: "center", marginTop: spacing.md, lineHeight: 16 },
    requestToggle: { alignItems: "center", paddingVertical: spacing.md, marginBottom: spacing.sm },
    requestToggleText: { fontSize: fontSize.sm, color: c.link, textDecorationLine: "underline" },
    requestBox: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
    requestHelper: { fontSize: fontSize.xs, color: c.textMuted, marginBottom: spacing.sm },
    requestInput: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, fontSize: fontSize.sm, color: c.text, marginBottom: spacing.sm },
    requestActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
    requestCancelBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
    requestCancelText: { fontSize: fontSize.sm, color: c.textMuted },
    requestSubmitBtn: { backgroundColor: c.accent, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm },
    requestSubmitText: { fontSize: fontSize.sm, color: c.accentForeground, fontWeight: "500" },
    requestSentBox: { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
    requestSentText: { fontSize: fontSize.sm, color: c.success, textAlign: "center", fontWeight: "500" },
  });
}
