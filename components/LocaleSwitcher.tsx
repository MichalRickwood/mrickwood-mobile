import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LOCALES, type Locale } from "@/lib/i18n/translations";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Pill button + modal s flag + native name + check — adaptováno z eprotokol-mobile
 * LanguageSelector. Vlajka + překlad názvu jazyka v jeho vlastním jazyce.
 */

const LANG_INFO: Record<string, { flag: string; native: string }> = {
  cs: { flag: "🇨🇿", native: "Čeština" },
  en: { flag: "🇬🇧", native: "English" },
  de: { flag: "🇩🇪", native: "Deutsch" },
};

export default function LocaleSwitcher() {
  const { locale, setLocale, dict } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const currentFlag = LANG_INFO[locale]?.flag ?? "🌐";

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      >
        <Text style={styles.flag}>{currentFlag}</Text>
        <Text style={styles.code}>{locale.toUpperCase()}</Text>
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
            <Text style={styles.title}>{dict.settings.appearanceTitle === "Vzhled" ? "Jazyk" : "Language"}</Text>
            {LOCALES.map((code) => {
              const info = LANG_INFO[code];
              const isActive = code === locale;
              return (
                <TouchableOpacity
                  key={code}
                  onPress={() => {
                    setLocale(code as Locale);
                    setOpen(false);
                  }}
                  style={[styles.row, isActive && styles.rowActive]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.flagBig}>{info?.flag}</Text>
                  <Text style={[styles.rowText, isActive && styles.rowTextActive]}>
                    {info?.native ?? code}
                  </Text>
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
    flag: { fontSize: 14, marginRight: 6 },
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
    flagBig: { fontSize: 24, marginRight: spacing.md },
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
