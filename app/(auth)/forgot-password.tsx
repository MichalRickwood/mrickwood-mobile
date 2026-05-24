import { useMemo, useState } from "react";
import {
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
import { ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailValid = EMAIL_RE.test(email.trim());

  async function onSubmit() {
    if (busy || !emailValid) return;
    setBusy(true);
    setError(null);
    try {
      await endpoints.requestPasswordReset(email.trim().toLowerCase());
      // Backend vždy 200 (i pro neexistující email) — success screen řekne neutrální zprávu.
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("forgotPassword", "errorGeneric"));
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
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {sent ? (
            <View style={styles.form}>
              <Text style={styles.title}>{t("forgotPassword", "successTitle")}</Text>
              <Text style={styles.subtitle}>{t("forgotPassword", "successBody")}</Text>
              <Pressable
                onPress={() => router.replace("/(auth)/login")}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              >
                <Text style={styles.buttonText}>{t("forgotPassword", "backToLogin")}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.title}>{t("forgotPassword", "title")}</Text>
              <Text style={styles.subtitle}>{t("forgotPassword", "subtitle")}</Text>

              <Text style={[styles.label, { marginTop: spacing.lg }]}>
                {t("forgotPassword", "emailLabel")}
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                placeholder={t("forgotPassword", "emailPlaceholder")}
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                autoFocus
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                onPress={onSubmit}
                disabled={busy || !emailValid}
                style={({ pressed }) => [
                  styles.button,
                  (busy || !emailValid) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonText}>
                  {busy ? t("forgotPassword", "submitting") : t("forgotPassword", "submit")}
                </Text>
              </Pressable>

              <Pressable onPress={() => router.back()} style={styles.bottomLink}>
                <Text style={styles.bottomLinkText}>{t("forgotPassword", "backToLogin")}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
    form: {},
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
    subtitle: { fontSize: fontSize.sm, color: colors.textSubtle, lineHeight: 20 },
    label: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
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
    buttonText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    bottomLink: { marginTop: spacing.xl, alignItems: "center" },
    bottomLinkText: { fontSize: fontSize.sm, color: colors.link },
  });
