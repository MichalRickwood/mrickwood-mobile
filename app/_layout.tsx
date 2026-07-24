import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { endpoints } from "@/lib/endpoints";
import { trackScreen, reportClientError } from "@/lib/tracker";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

/**
 * Router guard — anon → login, auth bez LEADS subs → onboarding, jinak → tabs.
 *
 * Onboarding check probíhá jen po přechodu z auth screenu (nebo na cold start).
 * Cache výsledku v useState aby další navigace neopakovala subscription fetch.
 */
function RouterGuard() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const qc = useQueryClient();
  // Cíl po subscription checku: null = ještě nezjištěno. Ukládáme KAM patří
  // (ne jen bool „checked") — jinak po router.replace("/(onboarding)") re-render
  // se segments ještě v (auth) spustil (auth)→(tabs) a přepsal onboarding redirect
  // na tabs ("Zatím žádné země"). S cílem routujeme konzistentně.
  const [destination, setDestination] = useState<"onboarding" | "tabs" | null>(null);
  // Subscription check SELHAL (server/DB down) → error screen s retry.
  // Dřív se chyba tiše brala jako „žádné subscription" → existující uživatel
  // skončil v onboardingu („Dokončete profil"), což mate.
  const [guardError, setGuardError] = useState(false);

  useEffect(() => {
    if (status === "loading" || guardError) return;
    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";
    // atEntry = na "/" (app/index.tsx, vstupní gate) — odsud (stejně jako z auth)
    // aktivně routujeme na cíl. Z (tabs)/(onboarding) už ne (necháme flow být).
    const atEntry = segments[0] === undefined;

    if (status === "anonymous") {
      if (!inAuth) router.replace("/(auth)/login");
      setDestination(null);
      return;
    }

    // Authenticated — gating:
    //   1) žádná aktivní LEADS sub → /(onboarding)/countries
    //   2) jinak → (tabs)
    //
    // ŽÁDNÝ profil gate — „Dokončete profil" krok v appce neexistuje (App
    // Store flow). Jméno i souhlasy řeší backend (registrace / OAuth clickwrap
    // + backfill při loginu), country se derivuje tiše v countries.tsx.

    // Cíl už známe → routujeme jen ze vstupu (auth nebo "/"). Z onboardingu na
    // tabs (po aktivaci v CountriesManager) NEpřepisujeme zpět — proto jen
    // `inAuth || atEntry`. Onboarding začíná na profile, pak routuje na countries.
    if (destination === "onboarding") {
      if (inAuth || atEntry) router.replace("/(onboarding)/profile");
      return;
    }
    if (destination === "tabs") {
      if (inAuth || atEntry) router.replace("/(tabs)/matches");
      return;
    }

    // Uvnitř onboardingu necháváme uživatele dokončit flow.
    if (inOnboarding) return;

    let cancelled = false;
    (async () => {
      try {
        // fetchQuery (ne raw call) → naplní react-query cache pod
        // ["account-subscriptions"], kterou tabs/index přečte SYNCHRONNĚ a ukáže
        // paywall hned (bez round-tripu navíc / problikávání matches loadingu).
        const subs = await qc.fetchQuery({
          queryKey: ["account-subscriptions"],
          queryFn: () => endpoints.listSubscriptions(),
          staleTime: 30 * 1000,
        });
        if (cancelled) return;
        // hasAnyLeads = měl někdy LEADS (i SUSPENDED/CANCELED po vypršení trialu).
        // Onboarding je JEN pro úplně nové (žádný LEADS řádek). Post-trial uživatel
        // → tabs, kde matches vrátí 402 a ukáže se paywall (aktivace předplatného).
        // Dřív SUSPENDED padal do onboardingu, kde nešel znovu aktivovat trial.
        const hasAnyLeads = subs.some((s) => s.service === "LEADS");
        // Jen nastavíme cíl — navigaci provede re-run efektu výše dle `destination`.
        // Tím se onboarding redirect nikdy nepřepíše tabs větví (původní bug).
        setDestination(hasAnyLeads ? "tabs" : "onboarding");
      } catch (e) {
        if (cancelled) return;
        // 401 → api klient už session vyčistil, auth flow přesměruje na login.
        if (e instanceof ApiError && e.status === 401) return;
        // Server/DB down ap. → NEhádat onboarding; error screen s retry + report.
        reportClientError("router_guard.subscriptions", e);
        setGuardError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, segments, router, destination, qc, guardError]);

  if (guardError) {
    return <GuardErrorScreen onRetry={() => setGuardError(false)} />;
  }

  // „/" = app/index.tsx (neutrální gate), NE tenders → nepřihlášený nikdy nevidí
  // probliknutí zakázek. RouterGuard odsud přesměruje (efekt výše). Žádný overlay
  // ani splash logo navíc.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* Auth-flow přechody (gate → login/tabs/onboarding) fade, ne slide —
          jinak to z „/" na login „swipe-ne". Detail screeny (match/filter)
          si nechávají default slide. */}
      <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
      <Stack.Screen name="(onboarding)" options={{ animation: "fade" }} />
      <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
    </Stack>
  );
}

/** Celoplošná chyba načtení (server/DB down) — místo hádání onboardingu. */
function GuardErrorScreen({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeGuardStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={styles.title}>{t("errorScreen", "title")}</Text>
      <Text style={styles.body}>{t("errorScreen", "body")}</Text>
      <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]} onPress={onRetry}>
        <Text style={styles.btnText}>{t("errorScreen", "retry")}</Text>
      </Pressable>
    </View>
  );
}

const makeGuardStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    emoji: { fontSize: 40, marginBottom: spacing.md },
    title: { fontSize: fontSize.lg, fontWeight: "700", color: c.text, marginBottom: spacing.sm, textAlign: "center" },
    body: { fontSize: fontSize.sm, color: c.textSubtle, textAlign: "center", lineHeight: 20, marginBottom: spacing.xl },
    btn: { backgroundColor: c.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
    btnText: { color: c.accentForeground, fontWeight: "600", fontSize: fontSize.sm },
  });

/**
 * Screen views → /api/v2/track (UserActivity timeline v admin detailu
 * uživatele). Jen přihlášený — anon se netrackuje.
 */
function ScreenTracker() {
  const { status } = useAuth();
  const pathname = usePathname();
  useEffect(() => {
    if (status === "authenticated") trackScreen(pathname);
  }, [status, pathname]);
  return null;
}

/**
 * Tap na push notifikaci „nové zakázky" → otevře matches na daném filtru a ukáže
 * JEN nové z dané dávky (params filterId + since). Řeší warm (listener) i cold
 * start (getLastNotificationResponseAsync); cold-start naviguje až po přihlášení.
 */
function NotificationTapHandler() {
  const { status } = useAuth();
  const router = useRouter();
  const statusRef = useRef(status);
  const pendingRef = useRef<Record<string, string> | null>(null);
  useEffect(() => { statusRef.current = status; }, [status]);

  const navigate = useCallback(
    (params: Record<string, string>) => router.push({ pathname: "/(tabs)/matches", params }),
    [router],
  );

  const handle = useCallback((data: unknown) => {
    const d = data as { type?: string; filterId?: string; since?: string } | null;
    if (!d || d.type !== "leads.new") return;
    const params: Record<string, string> = {};
    if (d.filterId) params.filterId = String(d.filterId);
    if (d.since) params.since = String(d.since);
    if (!params.since) return;
    if (statusRef.current === "authenticated") navigate(params);
    else pendingRef.current = params; // cold start — počkej na přihlášení
  }, [navigate]);

  useEffect(() => {
    let mounted = true;
    Notifications.getLastNotificationResponseAsync()
      .then((resp) => { if (mounted && resp) handle(resp.notification.request.content.data); })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((resp) =>
      handle(resp.notification.request.content.data),
    );
    return () => { mounted = false; sub.remove(); };
  }, [handle]);

  useEffect(() => {
    if (status === "authenticated" && pendingRef.current) {
      const p = pendingRef.current;
      pendingRef.current = null;
      const id = setTimeout(() => navigate(p), 400); // nech RouterGuard dokončit redirect
      return () => clearTimeout(id);
    }
  }, [status, navigate]);

  return null;
}

/**
 * StatusBar follows the active theme — světlý styl pro dark mode (bílý text na tmavém),
 * tmavý styl pro light mode (černý text na světlém).
 */
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThemedStatusBar />
              <ScreenTracker />
              <NotificationTapHandler />
              <RouterGuard />
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
