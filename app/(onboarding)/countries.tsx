import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { HeaderBackButton } from "@react-navigation/elements";
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

// Country object z /api/v2/leads/countries. Price/discount metadata
// se v mobile vědomě nezobrazují (App Store 3.1.1/3.1.3(c)) — ceník je
// dostupný jen na webu. Pole `price` necháváme v typu jen pro shape match,
// abychom mohli vrátit ceny v budoucnu (např. po IAP migraci) bez API změny.

/**
 * Locale-aware thousand separator (CZ "1 234", DE "1.234", EN "1,234"). Pro
 * země s ≥10k aktivních zakázek (CZ obvykle ~24k) jinak číslo splývá v jedno.
 * Fallback na hrubý formátting kdyby Intl.NumberFormat selhal (Hermes edge case).
 */
function fmtCoverage(n: number, locale: string): string {
  try {
    return new Intl.NumberFormat(
      locale === "cs" ? "cs-CZ" : locale === "de" ? "de-DE" : "en-US",
    ).format(n);
  } catch {
    return String(n);
  }
}

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

export default function OnboardingCountries() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const qc = useQueryClient();

  // Countries katalog se nemění často — staleTime 30 min. Cache se sdílí napříč
  // mounty (návrat z billing → onboarding/countries je instant).
  const countriesQuery = useQuery({
    queryKey: ["leads-countries"],
    queryFn: () => endpoints.getLeadsCountries(),
    staleTime: 30 * 60 * 1000,
  });
  // Subscriptions — krátká cache 30s aby návrat po activate okamžitě reflektoval.
  const subsQuery = useQuery({
    queryKey: ["account-subscriptions"],
    queryFn: () => endpoints.listSubscriptions(),
    staleTime: 30 * 1000,
  });
  // Profile — pro default country výběr (profile.country → fallback CZ).
  const profileQuery = useQuery({
    queryKey: ["profile-v2"],
    queryFn: () => endpoints.getProfileV2(),
    staleTime: 5 * 60 * 1000,
  });
  const countries: Country[] | null = countriesQuery.data ?? null;
  const activeScopes = useMemo(() => {
    const set = new Set<string>();
    for (const s of subsQuery.data ?? []) {
      if (s.service === "LEADS" && s.scope && s.state !== "CANCELED" && s.state !== "SUSPENDED") {
        set.add(s.scope);
      }
    }
    return set;
  }, [subsQuery.data]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestValue, setRequestValue] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  async function submitRequest() {
    const v = requestValue.trim();
    if (!v) return;
    setRequestSubmitting(true);
    try {
      await endpoints.submitFeedback({
        kind: "OTHER",
        message: `[new-country-request] Žádám přidání země do LEADS pokrytí: ${v}`,
      });
      setRequestSent(true);
      setRequestValue("");
      setRequestOpen(false);
    } catch {
      // Silently fail — best-effort.
    } finally {
      setRequestSubmitting(false);
    }
  }

  // Defense-in-depth: pokud user dorazí na countries bez minimálního profilu
  // (name + country + consent — IČO je volitelný per App Store 3.1.1), pošleme
  // zpět na profile. Bez tohohle by user viděl spinner na "Pokračovat" + tichý
  // 400 v footeru a vypadalo by to že nic nedělá.
  useEffect(() => {
    if (profileQuery.isPending) return;
    const p = profileQuery.data;
    const needsProfile =
      !p || !p.name || !p.country || p.consentRequired;
    if (needsProfile) {
      router.replace("/(onboarding)/profile");
    }
  }, [profileQuery.isPending, profileQuery.data, router]);

  // Pre-check existující aktivní scopes (jen jednou při prvním načtení subs).
  // Fallback pro first-time user (žádné scopes): default na profile.country,
  // jinak CZ. Country musí být v katalogu (jinak skip — exotické země typu BR).
  // Čekáme až profile query doběhne (success OR error) — jinak po resetu (kde
  // profile fetch failne nebo vrátí null) by useEffect čekal věčně a CZ default
  // by se nikdy neaplikoval.
  useEffect(() => {
    if (selected.size !== 0) return;
    if (!countries) return;
    if (activeScopes.size > 0) {
      setSelected(new Set(activeScopes));
      return;
    }
    if (profileQuery.isPending) return;
    const profileCountry = profileQuery.data?.country?.toUpperCase() ?? null;
    const inCatalog = (code: string) =>
      countries.some((c) => c.code === code && c.available);
    const def = profileCountry && inCatalog(profileCountry) ? profileCountry : "CZ";
    if (inCatalog(def)) setSelected(new Set([def]));
  }, [subsQuery.data, activeScopes, selected.size, profileQuery.isPending, profileQuery.data, countries]);

  // Surface fetch error z queries (rare — backend cachuje).
  useEffect(() => {
    const err = countriesQuery.error ?? subsQuery.error;
    if (err) setError(err instanceof Error ? err.message : String(err));
  }, [countriesQuery.error, subsQuery.error]);

  const newSelections = useMemo(() => {
    return [...selected].filter((c) => !activeScopes.has(c));
  }, [selected, activeScopes]);

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
      // Returning user co jen prochází → rovnou do tabs (nic ke schválení)
      if (activeScopes.size > 0) router.replace("/(tabs)");
      return; // first-time user without selection — disabled button stops them
    }

    // Pre-flight: backend trial activation vyžaduje kompletní profile
    // (name + country + IČO + consent). Pokud profil chybí, redirect na
    // profil screen MÍSTO API callu — předtím UI tiše hodil error v footeru
    // (off-screen) a user viděl jen spinning button (bug report 2026-05-29).
    const profile = profileQuery.data;
    // IČO je volitelný (App Store 3.1.1) — nevyžadujeme v pre-flight checku.
    // Server fallback: 1-trial-per-userId na (userId, service, scope) unique key.
    const needsProfile =
      !profile ||
      !profile.name ||
      !profile.country ||
      profile.consentRequired;
    if (needsProfile) {
      router.replace("/(onboarding)/profile");
      return;
    }

    setActivating(true);
    setError(null);
    try {
      // Atomická batch aktivace — buď všechny vybrané země nebo žádná. Backend
      // skipuje země už aktivní (bezpečné poslat celé selection).
      await endpoints.activateLeadsBatch(newSelections);
      // Invalidate caches → tabs ukáží nový stav po návratu. KRITICKÉ: invaliduj
      // i `matches` query, jinak tabs/index + tabs/starred zobrazí cached 402
      // (z předaktivačního stavu) a může to vyvolat loop redirect zpět sem.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["account-subscriptions"] }),
        qc.invalidateQueries({ queryKey: ["billing"] }),
        qc.invalidateQueries({ queryKey: ["service", "leads"] }),
        qc.invalidateQueries({ queryKey: ["matches"] }),
        qc.invalidateQueries({ queryKey: ["filters"] }),
        qc.invalidateQueries({ queryKey: ["profile-v2"] }),
      ]);
      // Po aktivaci → tabs (profil už je kompletní, jinak by se k aktivaci
      // user nedostal kvůli pre-flight checku výše).
      router.replace("/(tabs)");
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
  // Label nezávisí na newSelections.length aby měl save button v headeru
  // konstantní šířku (title 'Vyberte země' jinak hopká mezi slotama když se
  // button objeví/zmizí).
  const ctaLabel = activating
    ? t("onboardingCountries", "activating")
    : hasActiveTrial
      ? t("onboardingCountries", "ctaAddToTrial")
      : t("onboardingCountries", "cta");

  // Back button v native Stack header — vždy viditelný pokud user už má aktivní
  // scopes (= přišel ze Settings). Pro first-time signup (no scopes) je skrytý
  // (RouterGuard ho replace tady, není kam zpět).
  const showBack = activeScopes.size > 0;

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <Stack.Screen
        options={{
          // Returning user (přes router.push) má swipe-back; first-time signup
          // (žádné aktivní scopes) má swipe disabled.
          gestureEnabled: showBack,
          headerLeft: showBack
            ? () => (
                <HeaderBackButton
                  tintColor={colors.text}
                  label={t("onboardingCountries", "back")}
                  displayMode="default"
                  onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
                />
              )
            : () => null,
          // Always-rendered placeholder, jen toggleujeme opacity, aby title
          // 'Vyberte země' nehopkal mezi slotama když se Save objeví/zmizí.
          headerRight: () => {
            const visible = newSelections.length > 0;
            return (
              <Pressable
                onPress={visible ? activate : undefined}
                disabled={!visible || activating}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerSaveBtn,
                  pressed && visible && { opacity: 0.6 },
                  activating && { opacity: 0.6 },
                  !visible && { opacity: 0 },
                ]}
              >
                {activating ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Text style={styles.headerSaveText}>{ctaLabel}</Text>
                )}
              </Pressable>
            );
          },
        }}
      />
      <FlatList
        contentContainerStyle={styles.list}
        data={countries}
        keyExtractor={(c) => c.code}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.subtitle}>{t("onboardingCountries", "subtitle")}</Text>
            <Text style={styles.trialNote}>{t("onboardingCountries", "trialNote")}</Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            {/* App Store 3.1.1 / 3.1.3(c): mobile UI nesmí ukazovat ceny ani
                cycle toggle (vypadalo by to jako sales mechanism v appce).
                Billing + ceník je výhradně na webu (mrickwood.cz/pricing).
                Country picker zde slouží pouze jako filter preference. */}

            <View style={styles.selectAllRow}>
              <Pressable onPress={selectAll} style={styles.selectAllBtn}>
                <Text style={styles.selectAllText}>
                  {t("onboardingCountries", allAvailableSelected ? "deselectAll" : "selectAll")}
                </Text>
              </Pressable>
              {!requestSent && (
                <Pressable onPress={() => setRequestOpen((v) => !v)} style={styles.selectAllBtn}>
                  <Text style={styles.selectAllText}>{t("onboardingCountries", "requestToggle")}</Text>
                </Pressable>
              )}
            </View>

            {requestOpen && (
              <View style={styles.requestBox}>
                <Text style={styles.requestHelper}>{t("onboardingCountries", "requestHelper")}</Text>
                <TextInput
                  value={requestValue}
                  onChangeText={setRequestValue}
                  placeholder={t("onboardingCountries", "requestPlaceholder")}
                  placeholderTextColor={colors.textFaint}
                  style={styles.requestInput}
                  autoFocus
                  autoCapitalize="words"
                />
                <View style={styles.requestActions}>
                  <Pressable
                    onPress={() => { setRequestOpen(false); setRequestValue(""); }}
                    style={styles.requestCancelBtn}
                  >
                    <Text style={styles.requestCancelText}>{t("onboardingCountries", "requestCancel")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={submitRequest}
                    disabled={requestSubmitting || !requestValue.trim()}
                    style={[styles.requestSubmitBtn, (requestSubmitting || !requestValue.trim()) && { opacity: 0.5 }]}
                  >
                    <Text style={styles.requestSubmitText}>
                      {requestSubmitting ? t("onboardingCountries", "requestSending") : t("onboardingCountries", "requestSubmit")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {requestSent && (
              <View style={styles.requestSentBox}>
                <Text style={styles.requestSentText}>{t("onboardingCountries", "requestSubmitted")}</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item: c }) => {
          const isActive = activeScopes.has(c.code);
          const isSelected = selected.has(c.code);
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
                {c.available && (
                  <Text style={styles.coverageText}>
                    {t("onboardingCountries", "activeTendersCount", {
                      count: fmtCoverage(c.coverage, locale),
                    })}
                  </Text>
                )}
                {!c.available && (
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
            {/* App Store 3.1.1: footer summary s cenami/slevami pryč. Pro
                přehled ceníku směruj uživatele na webový dashboard. */}
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    loadingScreen: { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
    list: { paddingBottom: spacing.xxl },
    header: { padding: spacing.lg, paddingTop: spacing.md },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: c.text, marginBottom: spacing.sm },
    subtitle: { fontSize: fontSize.sm, color: c.textMuted, marginBottom: spacing.md, lineHeight: 20 },
    trialNote: { fontSize: fontSize.xs, color: c.textSubtle, marginBottom: spacing.lg, fontStyle: "italic" },
    toggleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
    segmented: { flexDirection: "row", backgroundColor: c.card, borderRadius: radius.full, padding: 3, borderWidth: 1, borderColor: c.border, height: 36 },
    segment: { flex: 1, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.full },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 13, color: c.textMuted, fontWeight: "500" },
    segmentTextActive: { color: c.accentForeground, fontWeight: "600" },
    selectAllRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    selectAllBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
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
    countryPrice: { fontSize: fontSize.xs, color: c.textMuted },
    priceRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 },
    priceStrikethrough: { fontSize: fontSize.xs, color: c.textFaint, textDecorationLine: "line-through" },
    discountBadge: { fontSize: 10, fontWeight: "700", color: c.success, backgroundColor: c.successBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    countryBadge: { fontSize: fontSize.xs, color: c.warning, marginTop: 2 },
    coverageText: { fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
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
    errorBanner: {
      backgroundColor: c.dangerBg,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    errorBannerText: { color: c.danger, fontSize: fontSize.sm, lineHeight: 18 },
    headerSaveBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6, marginRight: spacing.sm, alignItems: "center", justifyContent: "center" },
    headerSaveText: { color: c.text, fontSize: 17, fontWeight: "400" },
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
