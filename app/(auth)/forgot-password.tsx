import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { endpoints } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { AuthBrand, AuthError, AuthHeader, AuthTextField } from "@/components/AuthUi";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Zapomenuté heslo — pošle reset link e-mailem (endpoint vždy vrací ok, žádná
 * enumerace e-mailů). Nové heslo se nastavuje na webu, přihlášení pak v appce.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    if (busy) return;
    const trimmed = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError(t("forgotPassword", "errorEmailInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await endpoints.forgotPassword(trimmed);
      setSent(true);
    } catch {
      setError(t("forgotPassword", "errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerWrap}>
          <View style={styles.mailBadge}>
            <Ionicons name="mail-unread-outline" size={34} color={colors.text} />
          </View>
          <Text style={styles.title}>{t("forgotPassword", "successTitle")}</Text>
          <Text style={styles.body}>{t("forgotPassword", "successBody")}</Text>
          <Pressable
            onPress={() => router.replace("/(auth)/email-login")}
            style={({ pressed }) => [styles.btnPrimary, styles.btnFull, pressed && styles.pressed]}
          >
            <Text style={styles.btnPrimaryText}>{t("forgotPassword", "backToLogin")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AuthHeader />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthBrand title={t("forgotPassword", "title")} subtitle={t("forgotPassword", "subtitle")} />

          {error && <AuthError message={error} />}

          <AuthTextField
            label={t("forgotPassword", "emailLabel")}
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder={t("forgotPassword", "emailPlaceholder")}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="done"
            onSubmitEditing={() => void onSubmit()}
          />

          <Pressable
            onPress={() => void onSubmit()}
            disabled={busy}
            style={({ pressed }) => [styles.btnPrimary, busy && styles.disabled, pressed && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color={colors.accentForeground} />
            ) : (
              <Text style={styles.btnPrimaryText}>{t("forgotPassword", "submit")}</Text>
            )}
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
    scroll: {
      padding: spacing.xl,
      flexGrow: 1,
      justifyContent: "center",
      paddingBottom: spacing.xxl * 2,
    },
    centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    mailBadge: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: fontSize.xxl,
      fontWeight: "700",
      color: colors.text,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    body: {
      fontSize: fontSize.base,
      color: colors.textSubtle,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
    btnPrimary: {
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.md + 2,
      alignItems: "center",
      marginTop: spacing.xl,
    },
    btnFull: { alignSelf: "stretch", marginTop: spacing.md },
    btnPrimaryText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.85 },
  });
