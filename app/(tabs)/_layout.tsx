import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/constants/theme";

/**
 * Bottom tab bar — Zakázky + Nastavení. Ikonky řešíme později (Expo Vector
 * Icons); pro V0 jen text labels, ať se nezasekneme na asset pipeline.
 */
export default function TabsLayout() {
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
          title: "Zakázky",
          tabBarIcon: ({ color }) => <TabGlyph color={color}>•</TabGlyph>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Nastavení",
          tabBarIcon: ({ color }) => <TabGlyph color={color}>•</TabGlyph>,
        }}
      />
    </Tabs>
  );
}

function TabGlyph({ children, color }: { children: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{children}</Text>;
}
