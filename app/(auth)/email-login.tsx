import { useMemo, useRef, useState } from "react";
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
import { AuthBrand, AuthError, AuthHeader, AuthTextField } from "@/components/AuthUi";
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
  const passwordRef = useRef<TextInput>(null);

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
      <AuthHeader />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthBrand title={t("auth", "loginBtn")} subtitle={t("auth", "loginSubtitle")} />

          {error && <AuthError message={error} />}

          <AuthTextField
            label={t("auth", "email")}
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth", "emailPh")}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />

          <AuthTextField
            ref={passwordRef}
            label={t("auth", "password")}
            icon="lock-closed-outline"
            secure
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            autoCapitalize="none"
            textContentType="password"
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={() => void onLogin()}
          />

          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotRow}
            hitSlop={8}
          >
            <Text style={styles.forgotText}>{t("login", "forgotPassword")}</Text>
          </Pressable>

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

          <Pressable onPress={() => router.replace("/(auth)/register")} style={styles.linkRow} hitSlop={8}>
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
    // Krátký formulář vertikálně vycentrovaný (s mírným posunem nahoru), ať
    // nevisí u status baru s prázdnou spodní polovinou displeje.
    scroll: {
      padding: spacing.xl,
      flexGrow: 1,
      justifyContent: "center",
      paddingBottom: spacing.xxl * 2,
    },
    forgotRow: { alignSelf: "flex-end", marginTop: spacing.sm },
    forgotText: { color: colors.link, fontSize: fontSize.sm, fontWeight: "600" },
    btnPrimary: {
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.md + 2,
      alignItems: "center",
      marginTop: spacing.xl,
    },
    btnPrimaryText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.85 },
    linkRow: { alignItems: "center", marginTop: spacing.xl },
    linkMuted: { color: colors.link, fontSize: fontSize.base, fontWeight: "600" },
  });
