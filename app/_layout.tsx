import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";

    if (status === "anonymous") {
      if (!inAuth) router.replace("/(auth)/login");
      setOnboardingChecked(false);
      return;
    }

    // Authenticated — gating (order: profil → countries → tabs):
    //   1) profil missing (name/country) → /(onboarding)/profile
    //   2) má profil ale žádná aktivní LEADS sub → /(onboarding)/countries
    //   3) jinak → (tabs)
    //
    // Profile minimum = name + country. IČO je volitelný (App Store 3.1.1 —
    // mobile registrace nesmí business ID vyžadovat). Bez IČO trial běží
    // a anti-abuse 1-trial-per-IČO se aplikuje jen pokud user IČO vyplní.
    if (!onboardingChecked && !inOnboarding) {
      let cancelled = false;
      (async () => {
        try {
          const profile = await endpoints.getProfileV2().catch(() => null);
          if (cancelled) return;
          const needsProfile = !profile || !profile.name || !profile.country;
          if (needsProfile) {
            setOnboardingChecked(true);
            router.replace("/(onboarding)/profile");
            return;
          }
          // Má kompletní profil — zkontroluj LEADS subscription
          const subs = await endpoints.listSubscriptions().catch(() => []);
          if (cancelled) return;
          const hasActiveLeads = subs.some(
            (s) =>
              s.service === "LEADS" &&
              s.state !== "CANCELED" &&
              s.state !== "SUSPENDED",
          );
          setOnboardingChecked(true);
          if (!hasActiveLeads) {
            router.replace("/(onboarding)/countries");
          } else if (inAuth) {
            router.replace("/(tabs)");
          }
        } catch {
          if (!cancelled) {
            setOnboardingChecked(true);
            if (inAuth) router.replace("/(tabs)");
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (inAuth && onboardingChecked) {
      router.replace("/(tabs)");
    }
  }, [status, segments, router, onboardingChecked]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
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
