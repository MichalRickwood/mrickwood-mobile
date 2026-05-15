import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();
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
