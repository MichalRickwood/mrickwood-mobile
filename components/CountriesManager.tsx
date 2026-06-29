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
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { isIapAvailable, getCountryProducts, purchaseProduct, restorePurchases } from "@/lib/iap";
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
  labels: { cs: string; en: string; de: string; sk: string; fr: string; it: string };
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
  cancelAtPeriodEnd: boolean;
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
  const [busyScope, setBusyScope] = useState<string | null>(null);
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
      if (mode === "onboarding" && activeScopes.size > 0) router.replace("/(tabs)/matches");
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
        router.replace("/(tabs)/matches");
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

  function countryLabel(code: string): string {
    const c = countries?.find((x) => x.code === code);
    return c ? c.labels[locale] ?? c.labels.en : code;
  }

  // iOS Apple IAP: přímý nákup země v Nastavení (placené předplatné přes StoreKit).
  const iapEnabled = Platform.OS === "ios" && isIapAvailable() && mode === "settings";

  async function invalidateAfterIap() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["account-subscriptions"] }),
      qc.invalidateQueries({ queryKey: ["service", "leads"] }),
      qc.invalidateQueries({ queryKey: ["matches"] }),
      qc.invalidateQueries({ queryKey: ["billing"] }),
    ]);
  }

  async function purchaseCountry(code: string) {
    setError(null);
    setNotice(null);
    setBusyScope(code);
    let products;
    try {
      products = await getCountryProducts(
        `veritra_leads_${code.toLowerCase()}_monthly`,
        `veritra_leads_${code.toLowerCase()}_yearly`,
      );
    } finally {
      setBusyScope(null);
    }
    const { monthly, yearly } = products;
    if (!monthly && !yearly) {
      setError(t("purchase", "unavailable"));
      return;
    }
    const doBuy = async (product: NonNullable<typeof monthly>) => {
      setBusyScope(code);
      try {
        const ok = await purchaseProduct(product);
        if (!ok) return; // uživatel zrušil
        await endpoints.iapSync();
        await invalidateAfterIap();
        setNotice(t("purchase", "success", { country: countryLabel(code) }));
      } catch (e) {
        setError(e instanceof Error ? e.message : t("purchase", "failed"));
      } finally {
        setBusyScope(null);
      }
    };
    const opts: { text: string; onPress?: () => void; style?: "cancel" }[] = [];
    if (monthly) opts.push({ text: t("purchase", "monthlyOpt", { price: monthly.priceString }), onPress: () => void doBuy(monthly) });
    if (yearly) opts.push({ text: t("purchase", "yearlyOpt", { price: yearly.priceString }), onPress: () => void doBuy(yearly) });
    opts.push({ text: t("purchase", "cancel"), style: "cancel" });
    Alert.alert(t("purchase", "title", { country: countryLabel(code) }), t("purchase", "subtitle"), opts);
  }

  async function doRestore() {
    setError(null);
    setNotice(null);
    setActivating(true);
    try {
      await restorePurchases();
      await endpoints.iapSync();
      await invalidateAfterIap();
      setNotice(t("purchase", "restoreDone"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("purchase", "failed"));
    } finally {
      setActivating(false);
    }
  }

  async function refreshSubs() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["account-subscriptions"] }),
      qc.invalidateQueries({ queryKey: ["billing"] }),
      qc.invalidateQueries({ queryKey: ["service", "leads"] }),
      qc.invalidateQueries({ queryKey: ["matches"] }),
    ]);
  }

  // Odebrání aktivní země = cancelAtPeriodEnd. Země zůstane sledovaná do konce
  // zaplaceného/zkušebního období a do DALŠÍ fakturace se nezahrne (backend
  // generateProforma filtruje cancelAtPeriodEnd=false). Žádné okamžité zrušení
  // — user nepřijde o období, za které už zaplatil.
  function confirmRemove(code: string) {
    const row = rowByScope.get(code);
    const dateIso = row?.paidUntil ?? row?.trialEndsAt ?? null;
    const dateStr = dateIso ? fmtDate(dateIso, dateLocale) : null;
    Alert.alert(
      t("onboardingCountries", "removeTitle"),
      dateStr
        ? t("onboardingCountries", "removeBody", { country: countryLabel(code), date: dateStr })
        : t("onboardingCountries", "removeBodyNoDate", { country: countryLabel(code) }),
      [
        { text: t("settings", "cancel"), style: "cancel" },
        {
          text: t("onboardingCountries", "removeConfirm"),
          style: "destructive",
          onPress: () => void doRemove(code),
        },
      ],
    );
  }

  async function doRemove(code: string) {
    setBusyScope(code);
    setError(null);
    setNotice(null);
    try {
      await endpoints.deactivateLeadsService(code);
      await refreshSubs();
      setNotice(t("onboardingCountries", "removedNotice", { country: countryLabel(code) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("onboardingCountries", "activateFailed"));
    } finally {
      setBusyScope(null);
    }
  }

  async function doReactivate(code: string) {
    setBusyScope(code);
    setError(null);
    setNotice(null);
    try {
      await endpoints.reactivateLeadsService(code);
      await refreshSubs();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("onboardingCountries", "activateFailed"));
    } finally {
      setBusyScope(null);
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
    : mode === "settings"
      ? t("onboardingCountries", "addSelected")
      : hasActiveTrial
        ? t("onboardingCountries", "ctaAddToTrial")
        : t("onboardingCountries", "cta");

  // Spravovat aktivní země (odebrat/obnovit) jde jen v Nastavení — onboarding
  // je čistě first-run výběr.
  const canManage = mode === "settings";

  // Onboarding: back button jen pro returning usery (first-time signup nemá
  // kam zpět — RouterGuard ho sem replace-nul). Settings: back řeší settings stack.
  const showBack = mode === "onboarding" && activeScopes.size > 0;

  // Save button v headeru jen když je co uložit (nové výběry) nebo právě běží
  // aktivace. Jinak headerRight = undefined → žádné prázdné tlačítko.
  const showSave = newSelections.length > 0 || activating;
  const headerSave = () => (
    <Pressable
      onPress={activate}
      disabled={activating}
      hitSlop={8}
      style={({ pressed }) => [styles.headerSaveBtn, (pressed || activating) && { opacity: 0.6 }]}
    >
      {activating ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <Text style={styles.headerSaveText}>{ctaLabel}</Text>
      )}
    </Pressable>
  );

  function metaForActive(code: string): string | null {
    const row = rowByScope.get(code);
    if (!row) return null;
    // Zrušená (cancelAtPeriodEnd) — běží do konce období, pak končí bez účtování.
    if (row.cancelAtPeriodEnd) {
      const dateIso = row.paidUntil ?? row.trialEndsAt ?? null;
      return dateIso
        ? t("onboardingCountries", "removeUntil", { date: fmtDate(dateIso, dateLocale) })
        : t("onboardingCountries", "removeScheduled");
    }
    return serviceStateMeta(row, t, dateLocale);
  }

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <Stack.Screen
        options={{
          headerRight: showSave ? headerSave : undefined,
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
                          router.canGoBack() ? router.back() : router.replace("/(tabs)/matches")
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
          const row = isActive ? rowByScope.get(c.code) : null;
          const activeMeta = isActive ? metaForActive(c.code) : null;
          const scopeBusy = busyScope === c.code;
          return (
            <Pressable
              onPress={() => {
                if (!c.available || isActive) return;
                if (iapEnabled) void purchaseCountry(c.code);
                else toggle(c.code);
              }}
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
                canManage ? (
                  scopeBusy ? (
                    <ActivityIndicator color={colors.textSubtle} size="small" style={styles.rowAction} />
                  ) : row?.cancelAtPeriodEnd ? (
                    <Pressable
                      onPress={() => void doReactivate(c.code)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.rowAction, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={styles.reactivateText}>{t("onboardingCountries", "reactivate")}</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => confirmRemove(c.code)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.rowAction, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={styles.removeText}>{t("onboardingCountries", "remove")}</Text>
                    </Pressable>
                  )
                ) : (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>{t("onboardingCountries", "alreadyActive")}</Text>
                  </View>
                )
              ) : c.available ? (
                iapEnabled ? (
                  scopeBusy ? (
                    <ActivityIndicator color={colors.textSubtle} size="small" style={styles.rowAction} />
                  ) : (
                    <Pressable
                      onPress={() => void purchaseCountry(c.code)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.rowAction, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={styles.subscribeText}>{t("onboardingCountries", "subscribe")}</Text>
                    </Pressable>
                  )
                ) : (
                  <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                )
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
            {iapEnabled && (
              <View style={styles.iapFooter}>
                <Pressable onPress={() => void doRestore()} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
                  <Text style={styles.iapFooterLink}>{t("purchase", "restore")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void Linking.openURL("https://apps.apple.com/account/subscriptions")}
                  hitSlop={8}
                  style={({ pressed }) => pressed && { opacity: 0.6 }}
                >
                  <Text style={styles.iapFooterLink}>{t("purchase", "manage")}</Text>
                </Pressable>
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
    rowAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minWidth: 64, alignItems: "flex-end" },
    removeText: { fontSize: fontSize.xs, color: c.textSubtle, fontWeight: "500", textDecorationLine: "underline" },
    reactivateText: { fontSize: fontSize.xs, color: c.link, fontWeight: "600", textDecorationLine: "underline" },
    subscribeText: { fontSize: fontSize.sm, color: c.link, fontWeight: "700" },
    iapFooter: { flexDirection: "row", justifyContent: "center", gap: spacing.xl, marginTop: spacing.lg },
    iapFooterLink: { fontSize: fontSize.sm, color: c.textSubtle, fontWeight: "500", textDecorationLine: "underline" },
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
