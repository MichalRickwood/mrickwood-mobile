import { ActionSheetIOS, Platform, Pressable, StyleSheet, Text } from "react-native";
import { LOCALES, type Locale } from "@/lib/i18n/translations";
import { useI18n } from "@/lib/i18n";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

const NATIVE_NAMES: Record<string, string> = {
  cs: "Čeština",
  en: "English",
  de: "Deutsch",
};

/**
 * Tiny pill button — klik otevře native iOS ActionSheet s 3 jazyky.
 * Pressable je čistě style-based (cssInterop ho global nemodifikuje, jinak
 * rozbije style={({pressed}) => [...]} funkci).
 */
export default function LocaleSwitcher() {
  const { locale, setLocale, dict } = useI18n();

  function open() {
    if (Platform.OS !== "ios") {
      const idx = LOCALES.indexOf(locale);
      setLocale(LOCALES[(idx + 1) % LOCALES.length] as Locale);
      return;
    }
    const labels = LOCALES.map((c) => NATIVE_NAMES[c] ?? c);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Jazyk aplikace",
        options: [...labels, dict.settings.cancel],
        cancelButtonIndex: labels.length,
        userInterfaceStyle: "light",
      },
      (idx) => {
        if (idx >= 0 && idx < LOCALES.length) {
          setLocale(LOCALES[idx] as Locale);
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
      <Text style={styles.code}>{locale.toUpperCase()}</Text>
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
