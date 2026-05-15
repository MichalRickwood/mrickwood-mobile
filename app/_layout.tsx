import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

/**
 * Router guard — přesměruje podle auth stavu + completeness profilu.
 * - anonymous → /(auth)/login
 * - authenticated + profile NOT complete → /profile-complete
 * - authenticated + profile complete → /(tabs)
 * - loading nebo profileComplete=null → necháme aktuální screen renderovat
 *   (typicky splash nebo currently-mounted screen)
 */
function RouterGuard() {
  const { status, profileComplete } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const inAuth = segments[0] === "(auth)";
    const inTabs = segments[0] === "(tabs)";
    const inProfileComplete = segments[0] === "profile-complete";

    if (status === "anonymous") {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }
    // authenticated
    if (profileComplete === null) {
      // Ještě nevíme — necháme stav být. Když user dlouho nečtou profile
      // request, zůstaneme na předchozí obrazovce (typicky login screen).
      return;
    }
    if (!profileComplete) {
      if (!inProfileComplete) router.replace("/profile-complete");
      return;
    }
    if (!inTabs) router.replace("/(tabs)");
  }, [status, profileComplete, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile-complete" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RouterGuard />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
