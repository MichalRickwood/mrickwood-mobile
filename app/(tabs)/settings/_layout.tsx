import { Stack } from "expo-router";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize } from "@/constants/theme";

export default function SettingsLayout() {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: fontSize.base, fontWeight: "600" },
        headerBackTitle: t("settings", "back"),
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: t("settings", "profileTitle") }} />
      <Stack.Screen name="notifications" options={{ title: t("settings", "notificationsTitle") }} />
      <Stack.Screen name="security" options={{ title: t("settings", "securityTitle") }} />
      <Stack.Screen name="billing" options={{ title: t("settings", "billingTitle") }} />
      <Stack.Screen name="invoice-pdf" options={{ title: t("settings", "billingInvoicesSection") }} />
      <Stack.Screen name="feedback" options={{ title: t("feedback", "title") }} />
      <Stack.Screen name="account" options={{ title: t("settings", "accountTitle") }} />
    </Stack>
  );
}
