import { useState } from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

/**
 * Placeholder pill pro Phase 2 — světlý / tmavý / system. Aktuálně jen UI,
 * pod ním ThemeContext + colors swap přijde v dalším kroku. Pro teď vždy
 * vybráno "AUTO" a kliknutí ukáže info že přijde brzy.
 */

type Mode = "system" | "light" | "dark";

const LABEL: Record<Mode, string> = {
  system: "AUTO",
  light: "DEN",
  dark: "NOC",
};

export default function AppearanceSwitcher() {
  const [mode] = useState<Mode>("system");

  function open() {
    if (Platform.OS !== "ios") return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Vzhled",
        message: "Tmavý režim přijde v další verzi appky.",
        options: ["Podle systému", "Světlý", "Tmavý", "Zrušit"],
        cancelButtonIndex: 3,
        userInterfaceStyle: "light",
      },
      (idx) => {
        if (idx >= 0 && idx <= 2) {
          // Phase 2 — wire to ThemeContext
          Alert.alert("Vzhled", "Tmavý/světlý režim přidáme brzy — pro teď je vše světlé.");
        }
      },
    );
  }

  return (
    <Pressable
      onPress={open}
      hitSlop={8}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      <Text style={styles.code}>{LABEL[mode]}</Text>
      <Text style={styles.chevron}>▾</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillPressed: { borderColor: colors.text },
  code: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
    letterSpacing: 0.5,
    marginRight: 4,
  },
  chevron: { fontSize: 10, color: colors.textSubtle },
});
