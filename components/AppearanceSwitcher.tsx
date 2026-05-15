import { useState } from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text } from "react-native";
import { useI18n } from "@/lib/i18n";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

/**
 * Placeholder pill pro Phase 2 — světlý / tmavý / system.
 */

type Mode = "system" | "light" | "dark";

export default function AppearanceSwitcher() {
  const { t, dict } = useI18n();
  const [mode] = useState<Mode>("system");

  const LABEL: Record<Mode, string> = {
    system: dict.settings.appearancePillSystem,
    light: dict.settings.appearancePillLight,
    dark: dict.settings.appearancePillDark,
  };

  function open() {
    if (Platform.OS !== "ios") return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t("settings", "appearanceTitle"),
        message: t("settings", "appearanceMessage"),
        options: [
          t("settings", "appearanceSystem"),
          t("settings", "appearanceLight"),
          t("settings", "appearanceDark"),
          t("settings", "cancel"),
        ],
        cancelButtonIndex: 3,
        userInterfaceStyle: "light",
      },
      (idx) => {
        if (idx >= 0 && idx <= 2) {
          Alert.alert(t("settings", "appearanceComingSoon"), t("settings", "appearanceComingSoonBody"));
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
