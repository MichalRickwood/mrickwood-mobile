import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { saveToken, saveUser } from "@/lib/auth-storage";
import { endpoints } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/** Nativní přihlášení e-mailem/heslem. */
export default function EmailLoginScreen() {
  const { applySession } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { token, user } = await endpoints.mobileLogin({ email: email.trim(), password });
      await saveToken(token);
      await saveUser(user);
      applySession(user);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) setError(t("auth", "errNotVerified"));
        else if (err.status === 401) setError(t("auth", "errInvalid"));
        else if (err.message.startsWith("Fetch fail")) setError(t("auth", "errNetwork"));
        else setError(t("auth", "errGeneric"));
      } else {
        setError(t("auth", "errGeneric"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("auth", "loginBtn")}</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.label}>{t("auth", "email")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth", "emailPh")}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text style={styles.label}>{t("auth", "password")}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth", "passwordPh")}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => void onLogin()}
          />

          <Pressable
            onPress={() => void onLogin()}
            disabled={busy}
            style={({ pressed }) => [styles.btnPrimary, busy && styles.disabled, pressed && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color={colors.accentForeground} />
            ) : (
              <Text style={styles.btnPrimaryText}>{t("auth", "loginBtn")}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace("/(auth)/register")} style={styles.linkRow}>
            <Text style={styles.linkMuted}>{t("auth", "toRegister")}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: { padding: spacing.xl, paddingTop: spacing.xxl, flexGrow: 1 },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, marginBottom: spacing.xl },
    label: { fontSize: fontSize.sm, color: colors.textSubtle, marginBottom: spacing.xs, marginTop: spacing.md },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: fontSize.base,
      color: colors.text,
      backgroundColor: colors.card,
    },
    btnPrimary: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      marginTop: spacing.xl,
    },
    btnPrimaryText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.85 },
    error: {
      color: colors.danger,
      fontSize: fontSize.sm,
      marginBottom: spacing.sm,
      backgroundColor: colors.dangerBg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      overflow: "hidden",
    },
    linkRow: { alignItems: "center", marginTop: spacing.xl },
    linkMuted: { color: colors.link, fontSize: fontSize.base, fontWeight: "600" },
  });
