import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/lib/auth-context";
import { API_BASE_URL, APP_NAME } from "@/lib/config";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import ProfileSection from "@/components/ProfileSection";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  function confirmSignOut() {
    Alert.alert("Odhlásit se", "Opravdu se chcete odhlásit?", [
      { text: "Zrušit", style: "cancel" },
      { text: "Odhlásit", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  async function openWebDashboard() {
    await WebBrowser.openBrowserAsync(`${API_BASE_URL}/dashboard`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Nastavení</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {user && (
          <View style={styles.card}>
            <Text style={styles.label}>Přihlášen jako</Text>
            <Text style={styles.value}>{user.name || user.email}</Text>
            {user.name && <Text style={styles.valueSub}>{user.email}</Text>}
          </View>
        )}

        <ProfileSection />

        <SettingsRow label="Otevřít web dashboard" onPress={openWebDashboard} />

        <Pressable
          onPress={confirmSignOut}
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.signOutText}>Odhlásit se</Text>
        </Pressable>

        <Text style={styles.version}>{APP_NAME} v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bg }]}
    >
      <Text style={styles.rowText}>{label}</Text>
      <Text style={styles.rowChevron}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: fontSize.base, color: colors.text, fontWeight: "600", marginTop: spacing.sm },
  valueSub: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.xs },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: { fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
  rowChevron: { fontSize: fontSize.base, color: colors.textFaint },
  signOut: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    alignItems: "center",
  },
  signOutText: { fontSize: fontSize.base, color: colors.danger, fontWeight: "600" },
  version: { textAlign: "center", marginTop: spacing.xl, fontSize: fontSize.xs, color: colors.textFaint },
});
