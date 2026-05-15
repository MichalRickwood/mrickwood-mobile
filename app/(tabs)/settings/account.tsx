import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

/**
 * Account sekce — odhlášení + budoucí "Smazat účet" (Apple Review iOS 16+
 * povinné, řešíme později jako separátní flow).
 */
export default function AccountScreen() {
  const { user, signOut } = useAuth();

  function confirmSignOut() {
    Alert.alert("Odhlásit se", "Opravdu se chcete odhlásit?", [
      { text: "Zrušit", style: "cancel" },
      { text: "Odhlásit", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {user && (
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user.email}</Text>
            {user.name && (
              <>
                <Text style={[styles.label, styles.spacer]}>Jméno</Text>
                <Text style={styles.value}>{user.name}</Text>
              </>
            )}
          </View>
        )}

        <Pressable
          onPress={confirmSignOut}
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.signOutText}>Odhlásit se</Text>
        </Pressable>

        <Text style={styles.deleteNote}>
          Smazání účtu zatím přes web — bude přidáno do appky v další verzi.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: fontSize.base, color: colors.text, fontWeight: "500", marginTop: spacing.xs },
  spacer: { marginTop: spacing.md },
  signOut: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  signOutText: { fontSize: fontSize.base, color: colors.danger, fontWeight: "600" },
  deleteNote: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.lg, textAlign: "center" },
});
