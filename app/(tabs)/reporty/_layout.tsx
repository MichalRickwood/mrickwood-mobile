import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import ReportyPaywall from "@/components/ReportyPaywall";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { fontSize } from "@/constants/theme";

/**
 * Záložka Reporty v hlavním menu. Obsah vidí jen účet s přístupem k reportům (dnes role
 * ADMIN), ostatním se ukáže paywall — záložka je vidět všem, aby bylo co prodat.
 */
export default function ReportyLayout() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { user } = useAuth();

  if (user?.role !== "ADMIN") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
        <ReportyPaywall />
      </SafeAreaView>
    );
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
