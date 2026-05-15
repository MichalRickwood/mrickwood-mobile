import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();

  function confirmSignOut() {
    Alert.alert(
      t("settings", "signOutConfirmTitle"),
      t("settings", "signOutConfirmBody"),
      [
        { text: t("settings", "cancel"), style: "cancel" },
        { text: t("settings", "confirm"), style: "destructive", onPress: () => void signOut() },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {user && (
          <View style={styles.card}>
            <Text style={styles.label}>{t("settings", "accountEmail")}</Text>
            <Text style={styles.value}>{user.email}</Text>
            {user.name && (
              <>
                <Text style={[styles.label, styles.spacer]}>{t("settings", "accountName")}</Text>
                <Text style={styles.value}>{user.name}</Text>
              </>
            )}
          </View>
        )}

        <Pressable
          onPress={confirmSignOut}
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.signOutText}>{t("settings", "signOut")}</Text>
        </Pressable>

        <Text style={styles.deleteNote}>{t("settings", "deleteNote")}</Text>
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
