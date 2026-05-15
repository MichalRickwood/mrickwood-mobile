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
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { APP_NAME } from "@/lib/config";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import OauthButtons from "@/components/OauthButtons";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { useI18n } from "@/lib/i18n";

// __DEV__ flag = true v Expo dev / EAS development build, false v production
// build. Prefill credentials z env (EXPO_PUBLIC_DEV_*) jen pro dev pohodu —
// v prod buildu nikdy nedosadí, i kdyby env zůstal.
const DEV_EMAIL = __DEV__ ? process.env.EXPO_PUBLIC_DEV_EMAIL ?? "" : "";
const DEV_PASSWORD = __DEV__ ? process.env.EXPO_PUBLIC_DEV_PASSWORD ?? "" : "";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError(t("login", "errorInvalid"));
        else if (err.status === 403) setError(err.message || t("login", "errorAccount"));
        else setError(err.message || t("login", "errorGeneric"));
      } else {
        setError(t("login", "errorNetwork"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <LocaleSwitcher />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <Image
              source={require("@/assets/logo.png")}
              style={styles.brandIcon}
              resizeMode="contain"
            />
            <Text style={styles.brandText}>{APP_NAME}</Text>
            <Text style={styles.brandSub}>{t("brand", "tagline")}</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{t("login", "emailLabel")}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              placeholder={t("login", "emailPlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              returnKeyType="next"
            />

            <Text style={[styles.label, styles.mt]}>{t("login", "passwordLabel")}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder={t("login", "passwordPlaceholder")}
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
              <Text style={styles.buttonText}>
                {busy ? t("login", "submitting") : t("login", "submit")}
              </Text>
            </Pressable>

            <OauthButtons onError={(msg) => setError(msg)} />

            <Pressable onPress={() => router.push("/(auth)/register")} style={styles.bottomLink}>
              <Text style={styles.bottomLinkText}>
                {t("login", "noAccount")}{" "}
                <Text style={styles.bottomLinkAccent}>{t("login", "register")}</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  brand: { marginBottom: spacing.lg, alignItems: "center" },
  brandIcon: { width: 72, height: 72, marginBottom: spacing.xs },
  brandText: { fontSize: 32, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  brandSub: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.xs },
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
  bottomLink: { marginTop: spacing.xl, alignItems: "center" },
  bottomLinkText: { fontSize: fontSize.sm, color: colors.textSubtle },
  bottomLinkAccent: { color: colors.text, fontWeight: "600" },
});
