import { useEffect, useMemo, useState } from "react";
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useAuth } from "@/lib/auth-context";
import { APP_NAME, AUTH_BASE_URL } from "@/lib/config";
import { appleSignIn, googleExchange, isAppleAuthAvailable, OAuthCancelled } from "@/lib/oauth";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useTheme } from "@/lib/theme-context";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import AppearanceSwitcher from "@/components/AppearanceSwitcher";
import { useI18n } from "@/lib/i18n";

WebBrowser.maybeCompleteAuthSession();

/**
 * Auth landing — Registrovat / Přihlásit + nativní OAuth (Apple sheet, Google).
 * Plně nativní auth je možné protože appka má funkční Apple IAP (3.1.1 OK).
 * OAuth uživatelé: server je rovnou emailVerified, souhlas je clickwrap (text
 * pod tlačítky s odkazy na VOP/GDPR — viz /api/auth/mobile/oauth).
 */
export default function LoginScreen() {
  const { applySession } = useAuth();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [error, setError] = useState<string | null>(null);
  const [appleOk, setAppleOk] = useState(false);

  const [, gResponse, gPrompt] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    // Android: bez androidClientId hook při renderu HODÍ chybu (crash celé
    // obrazovky). Dokud nemáme Google OAuth Android klienta, drží login
    // naživu fallback hodnota; Google tlačítko na Androidu stejně nevedeme.
    androidClientId:
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
      "unset.apps.googleusercontent.com",
  });

  useEffect(() => {
    void isAppleAuthAvailable().then(setAppleOk);
  }, []);

  useEffect(() => {
    if (gResponse?.type === "success") {
      const idToken = gResponse.params?.id_token ?? gResponse.authentication?.idToken ?? null;
      if (idToken) {
        googleExchange(idToken)
          .then(applySession)
          .catch(() => setError(t("auth", "errGeneric")));
      }
    } else if (gResponse?.type === "error") {
      setError(t("auth", "errGeneric"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gResponse]);

  async function onApple() {
    setError(null);
    try {
      const user = await appleSignIn();
      applySession(user);
    } catch (e) {
      if (e instanceof OAuthCancelled) return;
      setError(t("auth", "errGeneric"));
    }
  }

  return (
    <ImageBackground source={require("@/assets/login-bg.png")} resizeMode="cover" style={styles.bg}>
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <LocaleSwitcher />
          <View style={styles.pillGap} />
          <AppearanceSwitcher />
        </View>

        <View style={styles.brand}>
          <Image source={require("@/assets/veritra-mark-light.png")} style={styles.brandIcon} resizeMode="contain" />
          <Text style={styles.brandText}>{APP_NAME}</Text>
          <Text style={styles.brandSub}>{t("brand", "tagline")}</Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.footer}>
          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={() => router.push("/(auth)/register")}
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
          >
            <Text style={styles.btnPrimaryText}>{t("auth", "registerBtn")}</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/email-login")}
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
          >
            <Text style={styles.btnSecondaryText}>{t("auth", "loginBtn")}</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t("auth", "orContinue")}</Text>
            <View style={styles.divider} />
          </View>

          {appleOk && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={radius.md}
              style={styles.appleBtn}
              onPress={() => void onApple()}
            />
          )}

          <Pressable
            onPress={() => void gPrompt()}
            style={({ pressed }) => [styles.googleBtn, pressed && styles.pressed]}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.googleText}>{t("auth", "googleBtn")}</Text>
          </Pressable>

          <Text style={styles.clickwrap}>
            {t("auth", "clickwrapPrefix")}{" "}
            <Text style={styles.link} onPress={() => void Linking.openURL(`${AUTH_BASE_URL}/${locale}/vop`)}>
              {t("auth", "termsLink")}
            </Text>{" "}
            {t("auth", "clickwrapAnd")}{" "}
            <Text style={styles.link} onPress={() => void Linking.openURL(`${AUTH_BASE_URL}/${locale}/gdpr`)}>
              {t("auth", "privacyLink")}
            </Text>
            .
          </Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: "#0B1220" },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,12,24,0.62)" },
    safe: { flex: 1 },
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
    btnPrimary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
    btnPrimaryText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    btnSecondary: {
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.5)",
    },
    btnSecondaryText: { color: "#FFFFFF", fontSize: fontSize.base, fontWeight: "600" },
    pressed: { opacity: 0.85 },
    dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg },
    divider: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.25)" },
    dividerText: { color: "rgba(255,255,255,0.7)", fontSize: fontSize.xs, marginHorizontal: spacing.md },
    appleBtn: { height: 48, marginBottom: spacing.md },
    googleBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
      borderRadius: radius.md,
      height: 48,
    },
    googleG: { color: "#4285F4", fontSize: fontSize.lg, fontWeight: "800", marginRight: spacing.sm },
    googleText: { color: "#1F1F1F", fontSize: fontSize.base, fontWeight: "600" },
    clickwrap: {
      color: "rgba(255,255,255,0.8)",
      fontSize: fontSize.xs,
      textAlign: "center",
      marginTop: spacing.lg,
      lineHeight: 18,
    },
    link: { color: "#FFFFFF", fontWeight: "700", textDecorationLine: "underline" },
  });
