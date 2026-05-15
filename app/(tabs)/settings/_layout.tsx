import { Stack } from "expo-router";
import { colors, fontSize } from "@/constants/theme";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: fontSize.base, fontWeight: "600" },
        headerBackTitle: "Zpět",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: "Firemní údaje" }} />
      <Stack.Screen name="account" options={{ title: "Účet" }} />
    </Stack>
  );
}
