import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useI18n } from "@/lib/i18n";
import { useTheme, type ThemeMode } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Pill button + modal pro výběr theme mode (system/light/dark).
 * Stejný eprotokol-style modal jako LocaleSwitcher.
 */

const ICON: Record<ThemeMode, string> = {
  system: "⚙︎",
  light: "☀︎",
  dark: "☾",
};

export default function AppearanceSwitcher() {
  const { mode, setMode, colors } = useTheme();
  const { t, dict } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const LABEL: Record<ThemeMode, string> = {
    system: dict.settings.appearancePillSystem,
    light: dict.settings.appearancePillLight,
    dark: dict.settings.appearancePillDark,
  };

  const OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
    { value: "system", label: t("settings", "appearanceSystem"), icon: ICON.system },
    { value: "light", label: t("settings", "appearanceLight"), icon: ICON.light },
    { value: "dark", label: t("settings", "appearanceDark"), icon: ICON.dark },
  ];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      >
        <Text style={styles.icon}>{ICON[mode]}</Text>
        <Text style={styles.code}>{LABEL[mode]}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{t("settings", "appearanceTitle")}</Text>
            {OPTIONS.map((opt) => {
              const isActive = opt.value === mode;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    setMode(opt.value);
                    setOpen(false);
                  }}
                  style={[styles.row, isActive && styles.rowActive]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.iconBig}>{opt.icon}</Text>
                  <Text style={[styles.rowText, isActive && styles.rowTextActive]}>{opt.label}</Text>
                  {isActive && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{dict.settings.cancel}</Text>
            </TouchableOpacity>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
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
    icon: { fontSize: 14, marginRight: 4, color: colors.text },
    code: {
      fontSize: fontSize.xs,
      fontWeight: "600",
      color: colors.text,
      letterSpacing: 0.5,
      marginRight: 4,
    },
    chevron: { fontSize: 10, color: colors.textSubtle },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    rowActive: { backgroundColor: colors.bg },
    iconBig: { fontSize: 22, marginRight: spacing.md, color: colors.text },
    rowText: { fontSize: fontSize.base, color: colors.text, flex: 1 },
    rowTextActive: { fontWeight: "600" },
    check: { fontSize: fontSize.base, color: colors.accent, fontWeight: "700" },
    cancelBtn: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    cancelText: { color: colors.textSubtle, fontSize: fontSize.sm },
  });
