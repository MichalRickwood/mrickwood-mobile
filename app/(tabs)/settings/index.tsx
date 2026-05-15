import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { APP_NAME } from "@/lib/config";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

/**
 * Settings index — list sub-sekcí. Stejný pattern jako webový /dashboard/settings
 * (notifications, security, billing, account). Každá row otevírá detail screen.
 */
export default function SettingsIndexScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale } = useI18n();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Nastavení</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {user && (
          <View style={styles.userCard}>
            <Text style={styles.userLabel}>Přihlášen jako</Text>
            <Text style={styles.userValue}>{user.name || user.email}</Text>
            {user.name && <Text style={styles.userSub}>{user.email}</Text>}
          </View>
        )}

        <View style={styles.group}>
          <SectionRow
            label="Firemní údaje"
            hint="Telefon, IČO, fakturace"
            onPress={() => router.push("/(tabs)/settings/profile")}
          />
          <SectionRow
            label="Jazyk"
            hint={localeLabel(locale)}
            onPress={() => router.push("/(tabs)/settings/language")}
          />
          <SectionRow
            label="Vzhled"
            hint="Světlý / tmavý režim"
            onPress={() => router.push("/(tabs)/settings/appearance")}
          />
        </View>

        <View style={styles.group}>
          <SectionRow
            label="Účet"
            hint="Odhlásit, smazat účet"
            onPress={() => router.push("/(tabs)/settings/account")}
          />
        </View>

        <Text style={styles.version}>{APP_NAME} v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function localeLabel(code: string): string {
  if (code === "cs") return "Čeština";
  if (code === "en") return "English";
  if (code === "de") return "Deutsch";
  return code;
}

function SectionRow({
  label,
  hint,
  onPress,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  scroll: { padding: spacing.xl, paddingTop: 0 },
  userCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  userLabel: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  userValue: { fontSize: fontSize.base, color: colors.text, fontWeight: "600", marginTop: spacing.sm },
  userSub: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.xs },
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.bg },
  rowLabel: { fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
  rowHint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  rowChevron: { fontSize: 22, color: colors.textFaint, marginLeft: spacing.md },
  version: { textAlign: "center", marginTop: spacing.lg, fontSize: fontSize.xs, color: colors.textFaint },
});
