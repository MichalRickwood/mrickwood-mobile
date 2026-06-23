import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { endpoints } from "@/lib/endpoints";

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

  useEffect(() => {
    if (status === "loading") return;
    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";

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

    // Cíl už známe → posouváme jen z (auth) na správné místo. Z onboardingu na
    // tabs (po aktivaci v CountriesManager) NEpřepisujeme zpět — proto jen `inAuth`.
    // Onboarding začíná na profile (doplnění údajů: jméno/tel/firma+IČO), pak
    // profile.tsx routuje na countries.
    if (destination === "onboarding") {
      if (inAuth) router.replace("/(onboarding)/profile");
      return;
    }
    if (destination === "tabs") {
      if (inAuth) router.replace("/(tabs)");
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
        const subs = await qc
          .fetchQuery({
            queryKey: ["account-subscriptions"],
            queryFn: () => endpoints.listSubscriptions(),
            staleTime: 30 * 1000,
          })
          .catch(() => []);
        if (cancelled) return;
        // hasAnyLeads = měl někdy LEADS (i SUSPENDED/CANCELED po vypršení trialu).
        // Onboarding je JEN pro úplně nové (žádný LEADS řádek). Post-trial uživatel
        // → tabs, kde matches vrátí 402 a ukáže se paywall (aktivace předplatného).
        // Dřív SUSPENDED padal do onboardingu, kde nešel znovu aktivovat trial.
        const hasAnyLeads = subs.some((s) => s.service === "LEADS");
        // Jen nastavíme cíl — navigaci provede re-run efektu výše dle `destination`.
        // Tím se onboarding redirect nikdy nepřepíše tabs větví (původní bug).
        setDestination(hasAnyLeads ? "tabs" : "onboarding");
      } catch {
        // Nečekaný throw v guardu — bezpečný fallback je onboarding, ne tabs.
        if (!cancelled) setDestination("onboarding");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, segments, router, destination, qc]);

  // Anti-flash splash: bez app/index.tsx renderuje „/" rovnou (tabs)/index
  // (zakázky), takže anonym vidí na okamžik zakázky, než ho efekt redirectne na
  // login. Overlay drží splash dokud:
  //   - status === "loading" (zjišťujeme session z úložiště), nebo
  //   - anonym ještě není na login screenu (zakázky se schovají, než redirect doběhne).
  // Přihlášený → splash zmizí hned po zjištění session (krátký splash → tabs, dává
  // smysl při běžném otevření appky). Navazuje na native splash (stejný icon + barva).
  const onAuthScreen = segments[0] === "(auth)";
  const showSplash = status === "loading" || (status === "anonymous" && !onAuthScreen);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      {showSplash && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#FAFAF9",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={require("@/assets/splash-icon.png")}
            style={{ width: "55%", height: "55%" }}
            resizeMode="contain"
          />
        </View>
      )}
    </View>
  );
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
              <RouterGuard />
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
