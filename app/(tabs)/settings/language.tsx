import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LOCALES, type Locale } from "@/lib/i18n/translations";
import { useI18n } from "@/lib/i18n";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

const NATIVE_NAMES: Record<string, { native: string; english: string }> = {
  cs: { native: "Čeština", english: "Czech" },
  en: { native: "English", english: "English" },
  de: { native: "Deutsch", english: "German" },
};

export default function LanguageScreen() {
  const { locale, setLocale } = useI18n();

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.list}>
        <FlatList
          data={LOCALES}
          keyExtractor={(c) => c}
          renderItem={({ item }) => {
            const info = NATIVE_NAMES[item];
            const isActive = item === locale;
            return (
              <Pressable
                onPress={() => setLocale(item as Locale)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{info?.native ?? item}</Text>
                  {info && info.native !== info.english && (
                    <Text style={styles.sub}>{info.english}</Text>
                  )}
                </View>
                {isActive && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: {
    backgroundColor: colors.card,
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  rowPressed: { backgroundColor: colors.bg },
  label: { fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
  sub: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  check: { fontSize: fontSize.base, color: colors.text, fontWeight: "700", marginLeft: spacing.md },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },
});
