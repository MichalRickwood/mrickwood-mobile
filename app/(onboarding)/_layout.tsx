import { Stack } from "expo-router";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize } from "@/constants/theme";

export default function OnboardingLayout() {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: fontSize.base, fontWeight: "600" },
        headerBackTitle: t("onboardingCountries", "back"),
        // First-time signup: gestureEnabled false aby user nemohl swipovat zpět
        // bez dokončení onboarding. Returning user (přes router.push) má swipe.
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen
        name="countries"
        options={{ title: t("onboardingCountries", "title") }}
      />
    </Stack>
  );
}
