import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { APP_NAME } from "@/lib/config";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // Navigaci řeší RouterGuard po změně status na authenticated.
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError("Neplatný email nebo heslo.");
        else if (err.status === 403) setError(err.message || "Účet není aktivní.");
        else setError(err.message || "Přihlášení selhalo.");
      } else {
        setError("Chyba sítě. Zkuste to znovu.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Image
              source={require("@/assets/icon.png")}
              style={styles.brandIcon}
              resizeMode="contain"
            />
            <Text style={styles.brandText}>{APP_NAME}</Text>
            <Text style={styles.brandSub}>Vyhledávání veřejných zakázek</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              placeholder="jan@firma.cz"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              returnKeyType="next"
            />

            <Text style={[styles.label, styles.mt]}>Heslo</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="Vaše heslo"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              onPress={onSubmit}
              disabled={busy || !email || !password}
              style={({ pressed }) => [
                styles.button,
                (busy || !email || !password) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>{busy ? "Přihlašuji…" : "Přihlásit"}</Text>
            </Pressable>

            <Text style={styles.help}>
              Účet zakládejte na mrickwood.cz. V appce zatím jen přihlášení.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  brand: { marginBottom: spacing.xxl, alignItems: "center" },
  brandIcon: { width: 96, height: 96, marginBottom: spacing.lg },
  brandText: { fontSize: 36, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  brandSub: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.sm },
  form: { gap: 0 },
  label: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  mt: { marginTop: spacing.lg },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.text,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { backgroundColor: colors.accentHover },
  buttonText: { color: "#fff", fontSize: fontSize.base, fontWeight: "600" },
  help: { marginTop: spacing.xl, fontSize: fontSize.xs, color: colors.textSubtle, textAlign: "center" },
});
