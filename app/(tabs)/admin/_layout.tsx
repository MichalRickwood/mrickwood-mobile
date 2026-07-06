import { Redirect, Stack } from "expo-router";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { fontSize } from "@/constants/theme";

export default function AdminLayout() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { user } = useAuth();

  // Runtime guard — jen owner (ADMIN). Non-admin přesměrujeme na matches.
  if (user?.role !== "ADMIN") return <Redirect href="/(tabs)/matches" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: fontSize.base, fontWeight: "600" },
        headerBackTitle: t("admin", "back"),
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="users/index" options={{ title: t("admin", "usersTitle") }} />
      <Stack.Screen name="users/[id]" options={{ title: t("admin", "userDetailTitle") }} />
      <Stack.Screen name="invoices/index" options={{ title: t("admin", "invoicesTitle") }} />
      <Stack.Screen name="feedback/index" options={{ title: t("admin", "feedbackTitle") }} />
      <Stack.Screen name="feedback/[id]" options={{ title: t("admin", "feedbackDetailTitle") }} />
      <Stack.Screen name="communications/index" options={{ title: t("admin", "commsTitle") }} />
      <Stack.Screen name="communications/[id]" options={{ title: t("admin", "emailDetailTitle") }} />
      <Stack.Screen name="social/index" options={{ title: t("admin", "socialTitle") }} />
      <Stack.Screen name="social/[id]" options={{ title: t("admin", "socialDetailTitle") }} />
      <Stack.Screen name="social/replies" options={{ title: t("admin", "repliesBtn") }} />
    </Stack>
  );
}
