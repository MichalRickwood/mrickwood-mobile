/**
 * Správa sledovaných zemí — JEDNA obrazovka pro onboarding i nastavení.
 *
 * mode="onboarding": první spuštění (RouterGuard sem posílá usery bez aktivní
 *   LEADS subscription). Vlastní header back/save logika, po aktivaci → tabs.
 * mode="settings": Nastavení → „Sledované země". Stejný picker + u aktivních
 *   zemí stav (zkušební období do / aktivní do), po aktivaci se zůstává na
 *   obrazovce. Save button v headeru settings stacku.
 *
 * App Store 3.1.1: žádné ceny, žádné platební CTA — picker je čistě výběr
 * sledovaných zemí (trial zdarma). Konverze na placené probíhá mimo aplikaci.
 *
 * Obsahuje i žádost o doplnění chybějící země (feedback endpoint).
 */
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
import * as Localization from "expo-localization";
import { endpoints } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const LOCALE_MAP: Record<string, string> = { cs: "cs-CZ", en: "en-GB", de: "de-DE" };

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

// Country object z /api/v2/leads/countries. Price/discount metadata se
// v mobile vědomě nezobrazují (App Store 3.1.1) — ceník je jen na webu.
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

interface SubRow {
  service: string;
  scope: string | null;
  state: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";
  tier: "FREE" | "PAID";
  trialEndsAt: string | null;
  paidUntil: string | null;
}

export default function CountriesManager({ mode }: { mode: "onboarding" | "settings" }) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const qc = useQueryClient();
  const dateLocale = LOCALE_MAP[locale] ?? "cs-CZ";

  // Countries katalog se nemění často — staleTime 30 min. Cache se sdílí napříč
  // mounty (návrat settings ↔ onboarding je instant).
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
  const subRows = (subsQuery.data ?? []) as SubRow[];
  const activeScopes = useMemo(() => {
    const set = new Set<string>();
    for (const s of subRows) {
      if (s.service === "LEADS" && s.scope && s.state !== "CANCELED" && s.state !== "SUSPENDED") {
        set.add(s.scope);
      }
    }
    return set;
  }, [subRows]);
  // Stav per aktivní země — „Zkušební období do…" / „Aktivní do…" v řádku.
  const rowByScope = useMemo(() => {
    const map = new Map<string, SubRow>();
    for (const s of subRows) {
      if (s.service === "LEADS" && s.scope) map.set(s.scope, s);
    }
    return map;
  }, [subRows]);
  const otherServices = useMemo(
    () => subRows.filter((s) => s.service !== "LEADS" && s.state !== "CANCELED"),
    [subRows],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  // Pre-check existující aktivní scopes (jen jednou při prvním načtení subs).
  // Fallback pro first-time user (žádné scopes): default na profile.country,
  // jinak CZ. Country musí být v katalogu (jinak skip — exotické země typu BR).
  // Čekáme až profile query doběhne (success OR error) — jinak po resetu by
  // useEffect čekal věčně a CZ default by se nikdy neaplikoval.
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
    setNotice(null);
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
      // Onboarding returning user co jen prochází → rovnou do tabs.
      if (mode === "onboarding" && activeScopes.size > 0) router.replace("/(tabs)");
      return;
    }

    // Country tiše doplníme z device region / první vybrané země — user kvůli
    // němu nikdy nevidí formulář (jméno/souhlasy řeší backend fallbacky).
    const profile = profileQuery.data;
    if (profile && !profile.country) {
      const region = Localization.getLocales()[0]?.regionCode?.toUpperCase() ?? null;
      const derived =
        (region && countries?.some((c) => c.code === region) ? region : null) ??
        newSelections[0] ??
        "CZ";
      // Fire-and-forget by stačil, ale backend activateTrial country využívá —
      // počkáme, ať batch volání níž má profil hotový.
      await endpoints.updateProfileV2({ country: derived }).catch(() => {});
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
      if (mode === "onboarding") {
        router.replace("/(tabs)");
      } else {
        // Settings: zůstáváme — refreshnuté subs zamknou nové země jako aktivní.
        setNotice(t("onboardingCountries", "addedNotice"));
      }
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
  // konstantní šířku (title jinak hopká mezi slotama když se button objeví/zmizí).
  const ctaLabel = activating
    ? t("onboardingCountries", "activating")
    : hasActiveTrial
      ? t("onboardingCountries", "ctaAddToTrial")
      : t("onboardingCountries", "cta");

  // Onboarding: back button jen pro returning usery (first-time signup nemá
  // kam zpět — RouterGuard ho sem replace-nul). Settings: back řeší settings stack.
  const showBack = mode === "onboarding" && activeScopes.size > 0;

  const headerSave = () => {
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
  };

  function metaForActive(code: string): string | null {
    const row = rowByScope.get(code);
    if (!row) return null;
    return serviceStateMeta(row, t, dateLocale);
  }

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <Stack.Screen
        options={{
          headerRight: headerSave,
          ...(mode === "onboarding"
            ? {
                // Returning user (přes router.push) má swipe-back; first-time
                // signup (žádné aktivní scopes) má swipe disabled.
                gestureEnabled: showBack,
                headerLeft: showBack
                  ? () => (
                      <HeaderBackButton
                        tintColor={colors.text}
                        label={t("onboardingCountries", "back")}
                        displayMode="default"
                        onPress={() =>
                          router.canGoBack() ? router.back() : router.replace("/(tabs)")
                        }
                      />
                    )
                  : () => null,
              }
            : {}),
        }}
      />
      <FlatList
        contentContainerStyle={styles.list}
        data={countries}
        keyExtractor={(c) => c.code}
        ListHeaderComponent={
          <View style={styles.header}>
            {mode === "onboarding" && (
              <>
                <Text style={styles.subtitle}>{t("onboardingCountries", "subtitle")}</Text>
                <Text style={styles.trialNote}>{t("onboardingCountries", "trialNote")}</Text>
              </>
            )}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}
            {notice && (
              <View style={styles.requestSentBox}>
                <Text style={styles.requestSentText}>{notice}</Text>
              </View>
            )}

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
          const activeMeta = isActive ? metaForActive(c.code) : null;
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
                {activeMeta && <Text style={styles.coverageText}>{activeMeta}</Text>}
                {c.available && !isActive && (
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
            {/* Non-LEADS služby (PRICING/PROCUREMENT/…) — jen informativně,
                ať se v unifikaci neztratí. Zobrazí se jen pokud existují. */}
            {mode === "settings" && otherServices.length > 0 && (
              <View style={styles.otherServicesBox}>
                {otherServices.map((s) => (
                  <View key={s.service} style={styles.otherServiceRow}>
                    <Text style={styles.otherServiceName}>{otherServiceLabel(s.service, t)}</Text>
                    <Text style={styles.otherServiceMeta}>{serviceStateMeta(s, t, dateLocale)}</Text>
                  </View>
                ))}
              </View>
            )}
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        }
      />
    </SafeAreaView>
  );
}

type TFn = ReturnType<typeof useI18n>["t"];

function serviceStateMeta(row: SubRow, t: TFn, dateLocale: string): string {
  if (row.state === "TRIAL" && row.trialEndsAt) {
    return t("settings", "billingServiceTrialEnds", { date: fmtDate(row.trialEndsAt, dateLocale) });
  }
  if (row.tier === "PAID" && row.paidUntil) {
    return t("settings", "billingServicePaidUntil", { date: fmtDate(row.paidUntil, dateLocale) });
  }
  switch (row.state) {
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

function otherServiceLabel(service: string, t: TFn): string {
  switch (service) {
    case "PRICING":
      return t("settings", "servicePricing");
    case "PROCUREMENT":
      return t("settings", "serviceProcurement");
    case "MANAGEMENT":
      return t("settings", "serviceManagement");
    default:
      return service;
  }
}

function fmtDate(iso: string, dateLocale: string): string {
  return new Date(iso).toLocaleDateString(dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    loadingScreen: { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
    list: { paddingBottom: spacing.xxl },
    header: { padding: spacing.lg, paddingTop: spacing.md },
    subtitle: { fontSize: fontSize.sm, color: c.textMuted, marginBottom: spacing.md, lineHeight: 20 },
    trialNote: { fontSize: fontSize.xs, color: c.textSubtle, marginBottom: spacing.lg, fontStyle: "italic" },
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
    otherServicesBox: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
    otherServiceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs },
    otherServiceName: { fontSize: fontSize.sm, color: c.text, fontWeight: "500" },
    otherServiceMeta: { fontSize: fontSize.xs, color: c.textSubtle },
  });
}
