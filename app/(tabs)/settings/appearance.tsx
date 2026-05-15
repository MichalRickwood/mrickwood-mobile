import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

/**
 * Placeholder pro Phase 2 — tmavý/světlý/system mode. Aktuálně jen UI,
 * pod ním ThemeContext refactor přijde v dalším kroku.
 */

type Mode = "system" | "light" | "dark";

const OPTIONS: { value: Mode; label: string; hint: string }[] = [
  { value: "system", label: "Podle systému", hint: "Automaticky se přizpůsobí nastavení iOS" },
  { value: "light", label: "Světlý", hint: "Vždy světlé pozadí" },
  { value: "dark", label: "Tmavý", hint: "Vždy tmavé pozadí" },
];

export default function AppearanceScreen() {
  // Phase 2 — wire to ThemeContext. Pro teď fixní "system".
  const active: Mode = "system";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          Tmavý režim přijde v další verzi. Pro teď je vše světlé.
        </Text>
      </View>

      <View style={styles.list}>
        <FlatList
          data={OPTIONS}
          keyExtractor={(o) => o.value}
          renderItem={({ item }) => {
            const isActive = item.value === active;
            return (
              <Pressable
                disabled
                style={[styles.row, isActive && styles.rowActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.hint}>{item.hint}</Text>
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
  notice: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  noticeText: { fontSize: fontSize.xs, color: colors.text },
  list: {
    backgroundColor: colors.card,
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    opacity: 0.6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  rowActive: { backgroundColor: colors.bg },
  label: { fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
  hint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  check: { fontSize: fontSize.base, color: colors.text, fontWeight: "700", marginLeft: spacing.md },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },
});
