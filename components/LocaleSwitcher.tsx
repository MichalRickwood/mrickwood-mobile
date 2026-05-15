import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LOCALES, type Locale } from "@/lib/i18n/translations";
import { useI18n } from "@/lib/i18n";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

/**
 * Dropdown switcher — kompaktní pill (např. "CS ▾"), klik otevře sheet
 * se seznamem dostupných jazyků a jejich nativními názvy. Připraveno na
 * růst počtu jazyků (po cs/en/de přidáme např. sk/pl bez UI změny).
 */
export default function LocaleSwitcher() {
  const { locale, setLocale, dict } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      >
        <Text style={styles.pillText}>{locale.toUpperCase()}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.cancelBtn}>{dict.settings.cancel}</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>{labelForLocale(locale)}</Text>
            <View style={{ width: 60 }} />
          </View>
          <FlatList
            data={LOCALES}
            keyExtractor={(c) => c}
            renderItem={({ item }) => {
              const native = nativeLabel(item);
              return (
                <Pressable
                  onPress={() => {
                    setLocale(item as Locale);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    pressed && { backgroundColor: colors.bg },
                  ]}
                >
                  <Text style={styles.itemText}>{native}</Text>
                  {item === locale && <Text style={styles.check}>✓</Text>}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function nativeLabel(code: string): string {
  if (code === "cs") return "Čeština";
  if (code === "en") return "English";
  if (code === "de") return "Deutsch";
  return code;
}

function labelForLocale(code: Locale): string {
  return nativeLabel(code);
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillPressed: { borderColor: colors.text },
  pillText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text, letterSpacing: 0.5 },
  chevron: { fontSize: 10, color: colors.textSubtle },
  sheet: { flex: 1, backgroundColor: colors.card },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: { fontSize: fontSize.base, color: colors.link, width: 60 },
  sheetTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  itemText: { fontSize: fontSize.base, color: colors.text },
  check: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
  sep: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
});
