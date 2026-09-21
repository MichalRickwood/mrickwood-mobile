import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, Text } from "react-native";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

// Tenders tab je "matches" (ne "index") — "/" route je app/index.tsx (auth gate),
// aby se při startu nepro­bliklo (tabs)/index nepřihlášenému uživateli.
export const unstable_settings = { initialRouteName: "matches" };

/**
 * iOS 18+ na iPhone má nativní glass tab bar (UIKit Liquid Glass).
 * Mimo to (iPad, iOS <18, Android) fallback na klasický Tabs — ten má od
 * 11. 9. 2026 sklo taky: bar plave nad obsahem a pozadí dělá BlurView.
 * Na Androidu se skutečné rozostření zapíná `experimentalBlurMethod`, bez něj
 * knihovna jen ztmaví plochu.
 *
 * Aby se obsah pod plovoucím barem neschovával, přidává `AppScrollView` /
 * `AppFlatList` spodní odsazení podle výšky baru (viz components/AppScroll.tsx).
 */
function supportsNativeTabs(): boolean {
  if (Platform.OS !== "ios") return false;
  if (Platform.isPad) return false;
  const v = typeof Platform.Version === "string" ? parseFloat(Platform.Version) : Platform.Version;
  return v >= 18;
}

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const isAdmin = useAuth().user?.role === "ADMIN";

  if (supportsNativeTabs()) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="starred">
          <Icon sf="star.fill" />
          <Label>{t("matches", "starredTab")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="matches">
          <Icon sf="doc.text.magnifyingglass" />
          <Label>{t("matches", "title")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="reporty">
          <Icon sf="chart.bar.xaxis" />
          <Label>{t("admin", "repTitle")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <Icon sf="gearshape" />
          <Label>{t("settings", "title")}</Label>
        </NativeTabs.Trigger>
        {isAdmin ? (
          <NativeTabs.Trigger name="admin">
            <Icon sf="shield.lefthalf.filled" />
            <Label>{t("admin", "title")}</Label>
          </NativeTabs.Trigger>
        ) : null}
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
          position: "absolute",
          backgroundColor: "transparent",
          borderTopColor: colors.border,
          // Android kreslí u tab baru stín přes obsah; u skla by vznikl šedý pruh.
          elevation: 0,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={Platform.OS === "android" ? 60 : 40}
            tint={isDark ? "dark" : "light"}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="starred"
        options={{
          title: t("matches", "starredTab"),
          tabBarIcon: ({ color }) => <TabGlyph color={color}>★</TabGlyph>,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t("matches", "title"),
          tabBarIcon: ({ color }) => <TabGlyph color={color}>•</TabGlyph>,
        }}
      />
      <Tabs.Screen
        name="reporty"
        options={{
          title: t("admin", "repTitle"),
          tabBarIcon: ({ color }) => <TabGlyph color={color}>▦</TabGlyph>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("settings", "title"),
          tabBarIcon: ({ color }) => <TabGlyph color={color}>•</TabGlyph>,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: isAdmin ? undefined : null,
          title: t("admin", "title"),
          tabBarIcon: ({ color }) => <TabGlyph color={color}>⚙</TabGlyph>,
        }}
      />
    </Tabs>
  );
}

function TabGlyph({ children, color }: { children: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{children}</Text>;
}
