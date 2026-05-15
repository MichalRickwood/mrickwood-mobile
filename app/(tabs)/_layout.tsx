import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { Platform, Text } from "react-native";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";

/**
 * iOS 18+ na iPhone má nativní glass tab bar (UIKit Liquid Glass).
 * Mimo to (iPad, iOS <18, Android) fallback na klasický Tabs.
 */
function supportsNativeTabs(): boolean {
  if (Platform.OS !== "ios") return false;
  if (Platform.isPad) return false;
  const v = typeof Platform.Version === "string" ? parseFloat(Platform.Version) : Platform.Version;
  return v >= 18;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();

  if (supportsNativeTabs()) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <Icon sf="doc.text.magnifyingglass" />
          <Label>{t("matches", "title")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <Icon sf="gearshape" />
          <Label>{t("settings", "title")}</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("matches", "title"),
          tabBarIcon: ({ color }) => <TabGlyph color={color}>•</TabGlyph>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("settings", "title"),
          tabBarIcon: ({ color }) => <TabGlyph color={color}>•</TabGlyph>,
        }}
      />
    </Tabs>
  );
}

function TabGlyph({ children, color }: { children: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{children}</Text>;
}
