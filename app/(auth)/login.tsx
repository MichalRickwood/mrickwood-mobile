import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { APP_NAME } from "@/lib/config";
import { saveToken, saveUser } from "@/lib/auth-storage";
import { endpoints } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { startWebAuth, WebAuthCancelled } from "@/lib/web-auth";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useTheme } from "@/lib/theme-context";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import AppearanceSwitcher from "@/components/AppearanceSwitcher";
import { useI18n } from "@/lib/i18n";

/**
 * Auth landing — nativní login (email/heslo) + odkaz na registraci. Plně nativní
 * auth je možné protože appka má funkční Apple IAP (placené přes IAP → 3.1.1 OK).
 * Web-redirect zůstává jako sekundární „další možnosti" pro social login
 * (Google/Apple), který appka nativně neřeší (běží na webu).
 */
export default function LoginScreen() {
  const { applySession } = useAuth();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [webBusy, setWebBusy] = useState(false);

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

  async function onWebLogin() {
    if (webBusy) return;
    setWebBusy(true);
    setError(null);
    try {
      const user = await startWebAuth(locale);
      applySession(user);
    } catch (err) {
      if (err instanceof WebAuthCancelled) {
        // user zavřel prohlížeč
      } else if (err instanceof Error && err.message.startsWith("Fetch fail")) {
        setError(t("auth", "errNetwork"));
      } else {
        setError(t("auth", "errGeneric"));
      }
    } finally {
      setWebBusy(false);
    }
  }

  return (
    <ImageBackground source={require("@/assets/login-bg.png")} resizeMode="cover" style={styles.bg}>
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.topBar}>
            <LocaleSwitcher />
            <View style={styles.pillGap} />
            <AppearanceSwitcher />
          </View>

          <View style={styles.brand}>
            <Image source={require("@/assets/logo-dark.png")} style={styles.brandIcon} resizeMode="contain" />
            <Text style={styles.brandText}>{APP_NAME}</Text>
            <Text style={styles.brandSub}>{t("brand", "tagline")}</Text>
          </View>

          <View style={styles.spacer} />

          <View style={styles.footer}>
            {error && <Text style={styles.error}>{error}</Text>}

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t("auth", "emailPh")}
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth", "passwordPh")}
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => void onLogin()}
            />

            <Pressable
              onPress={() => void onLogin()}
              disabled={busy}
              style={({ pressed }) => [styles.button, busy && styles.buttonDisabled, pressed && styles.buttonPressed]}
            >
              {busy ? (
                <ActivityIndicator color={colors.accentForeground} />
              ) : (
                <Text style={styles.buttonText}>{t("auth", "loginBtn")}</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.push("/(auth)/register")} style={styles.registerRow}>
              <Text style={styles.registerText}>{t("auth", "toRegister")}</Text>
            </Pressable>

            <Pressable onPress={() => void onWebLogin()} disabled={webBusy} style={styles.webRow}>
              <Text style={styles.webText}>
                {webBusy ? t("auth", "webLoading") : t("auth", "webBtn")}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: "#0B1220" },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,12,24,0.6)" },
    safe: { flex: 1 },
    flex: { flex: 1 },
    topBar: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
    pillGap: { width: spacing.sm },
    brand: { marginTop: spacing.xl, alignItems: "center" },
    brandIcon: { width: 72, height: 72, marginBottom: spacing.xs },
    brandText: {
      fontSize: 34,
      fontWeight: "700",
      color: "#FFFFFF",
      letterSpacing: -0.5,
      textShadowColor: "rgba(0,0,0,0.45)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    brandSub: { fontSize: fontSize.sm, color: "rgba(255,255,255,0.88)", marginTop: spacing.xs },
    spacer: { flex: 1 },
    footer: { padding: spacing.xl, paddingBottom: spacing.lg },
    input: {
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: fontSize.base,
      color: "#FFFFFF",
      backgroundColor: "rgba(255,255,255,0.08)",
      marginBottom: spacing.md,
    },
    error: {
      color: "#FFFFFF",
      fontSize: fontSize.sm,
      marginBottom: spacing.md,
      backgroundColor: "rgba(220,38,38,0.85)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      textAlign: "center",
      overflow: "hidden",
    },
    button: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
    buttonPressed: { backgroundColor: colors.accentHover },
    buttonText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    buttonDisabled: { opacity: 0.5 },
    registerRow: { alignItems: "center", marginTop: spacing.lg },
    registerText: { color: "#FFFFFF", fontSize: fontSize.base, fontWeight: "700" },
    webRow: { alignItems: "center", marginTop: spacing.lg },
    webText: { color: "rgba(255,255,255,0.75)", fontSize: fontSize.sm, textDecorationLine: "underline" },
  });
