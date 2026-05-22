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

    // Authenticated — gating:
    //   1) žádná aktivní LEADS sub → /(onboarding)/countries
    //   2) má sub ale profile.name/country missing → /(onboarding)/profile
    //      (transitioning: countries → profile, nebo OAuth user co nedokončil)
    //   3) jinak → (tabs)
    if (!onboardingChecked && !inOnboarding) {
      let cancelled = false;
      (async () => {
        try {
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
            return;
          }
          // Má sub — zkontroluj profile pro completion gating
          const profile = await endpoints.getProfileV2().catch(() => null);
          if (cancelled) return;
          const needsProfile = !profile || !profile.name || !profile.country;
          if (needsProfile) {
            router.replace("/(onboarding)/profile");
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
