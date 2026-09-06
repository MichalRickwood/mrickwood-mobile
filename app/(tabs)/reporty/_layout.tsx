import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import ReportyPaywall from "@/components/ReportyPaywall";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { fontSize } from "@/constants/theme";

interface SubRow {
  service: string;
  state: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";
  trialEndsAt: string | null;
  paidUntil: string | null;
}

/** Živá služba REPORTS: stejná pravidla jako server (`checkEntitlement`) — TRIAL/ACTIVE/PAST_DUE, nevypršelá. */
function maReporty(subs: SubRow[]): boolean {
  const now = Date.now();
  return subs.some((s) => {
    if (s.service !== "REPORTS") return false;
    if (s.state === "TRIAL") return !s.trialEndsAt || new Date(s.trialEndsAt).getTime() > now;
    if (s.state === "ACTIVE") return !s.paidUntil || new Date(s.paidUntil).getTime() > now;
    return s.state === "PAST_DUE";
  });
}

/**
 * Záložka Reporty v hlavním menu. Reporty jsou služba s předplatným (Subscription REPORTS):
 * admin má přístup vždy, ostatní podle stavu služby ze serveru; bez ní paywall. Záložka je vidět
 * všem, aby bylo co prodat.
 */
export default function ReportyLayout() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const subs = useQuery({
    queryKey: ["account-subscriptions"],
    queryFn: async () => (await api.get<{ data: SubRow[] }>("/api/v2/account/subscriptions")).data,
    enabled: !isAdmin && !!user,
    staleTime: 30_000,
  });

  if (!isAdmin) {
    if (subs.isLoading) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
          <ActivityIndicator color={colors.textSubtle} />
        </View>
      );
    }
    if (!maReporty(subs.data ?? [])) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
          <ReportyPaywall onRecheck={() => void subs.refetch()} />
        </SafeAreaView>
      );
    }
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: fontSize.base, fontWeight: "600" },
        headerBackTitle: t("admin", "back"),
      }}
    >
      <Stack.Screen name="index" options={{ title: t("admin", "repTitle") }} />
      <Stack.Screen name="model/index" options={{ title: t("admin", "repModelTitle") }} />
      <Stack.Screen name="model/[id]" options={{ title: t("admin", "repDetailTitle") }} />
      <Stack.Screen name="subjekty/index" options={{ title: t("admin", "repSubjektyTitle") }} />
      <Stack.Screen name="subjekty/profil" options={{ title: t("admin", "repSubjektyTitle") }} />
      <Stack.Screen name="cenove-hladiny" options={{ title: t("admin", "repCenyTitle") }} />
      <Stack.Screen name="konkurence" options={{ title: t("admin", "repKonkTitle") }} />
      <Stack.Screen name="zadani" options={{ title: t("admin", "repAwardDetail") }} />
    </Stack>
  );
}
