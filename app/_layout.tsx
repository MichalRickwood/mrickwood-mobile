import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

/**
 * Router guard — přesměruje podle auth stavu.
 * - anonymous → /(auth)/login
 * - authenticated → /(tabs)
 * Profile completion (telefon, IČO) je dobrovolný v Settings tabu, ne blokující.
 */
function RouterGuard() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const inAuth = segments[0] === "(auth)";
    const inTabs = segments[0] === "(tabs)";

    if (status === "anonymous") {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }
    if (!inTabs) router.replace("/(tabs)");
  }, [status, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <RouterGuard />
          </AuthProvider>
        </QueryClientProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
