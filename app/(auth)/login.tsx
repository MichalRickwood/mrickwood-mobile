import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { APP_NAME } from "@/lib/config";
import { startWebAuth, WebAuthCancelled, type WebAuthMode } from "@/lib/web-auth";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useTheme } from "@/lib/theme-context";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import AppearanceSwitcher from "@/components/AppearanceSwitcher";
import { useI18n } from "@/lib/i18n";

/**
 * Auth landing — žádné nativní formuláře. Přihlášení i registrace probíhá na
 * auth.mrickwood.cz (ASWebAuthenticationSession). Dvě tlačítka se liší jen
 * parametrem `mode`. Apple compliance: viz lib/web-auth.ts.
 */
export default function LoginScreen() {
  const { applySession } = useAuth();
  const { t, locale } = useI18n();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const logoSrc = isDark
    ? require("@/assets/logo-dark.png")
    : require("@/assets/logo.png");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<WebAuthMode | null>(null);

  async function onPress(mode: WebAuthMode) {
    if (busy) return;
    setBusy(mode);
    setError(null);
    try {
      const user = await startWebAuth(mode, locale);
      applySession(user);
      // RouterGuard přesměruje na onboarding/tabs dle stavu subscription.
    } catch (err) {
      if (err instanceof WebAuthCancelled) {
        // user zavřel prohlížeč — žádná chyba
      } else if (err instanceof Error && err.message.startsWith("Fetch fail")) {
        setError(t("authLanding", "errorNetwork"));
      } else {
        setError(t("authLanding", "errorGeneric"));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <LocaleSwitcher />
        <View style={styles.pillGap} />
        <AppearanceSwitcher />
      </View>

      <View style={styles.content}>
        <View style={styles.brand}>
          <Image source={logoSrc} style={styles.brandIcon} resizeMode="contain" />
          <Text style={styles.brandText}>{APP_NAME}</Text>
          <Text style={styles.brandSub}>{t("brand", "tagline")}</Text>
        </View>

        <Text style={styles.subtitle}>{t("authLanding", "subtitle")}</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={() => onPress("login")}
          disabled={!!busy}
          style={({ pressed }) => [
            styles.button,
            !!busy && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>{t("authLanding", "loginBtn")}</Text>
        </Pressable>

        <Pressable
          onPress={() => onPress("register")}
          disabled={!!busy}
          style={({ pressed }) => [
            styles.buttonSecondary,
            !!busy && styles.buttonDisabled,
            pressed && styles.buttonSecondaryPressed,
          ]}
        >
          <Text style={styles.buttonSecondaryText}>{t("authLanding", "registerBtn")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    topBar: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
    },
    pillGap: { width: spacing.sm },
    content: { flex: 1, justifyContent: "center", padding: spacing.xl },
    brand: { marginBottom: spacing.lg, alignItems: "center" },
    brandIcon: { width: 72, height: 72, marginBottom: spacing.xs },
    brandText: { fontSize: 32, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
    brandSub: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.xs },
    subtitle: {
      fontSize: fontSize.base,
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: spacing.xl,
    },
    error: {
      color: colors.danger,
      fontSize: fontSize.sm,
      marginBottom: spacing.lg,
      backgroundColor: colors.dangerBg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      textAlign: "center",
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    buttonPressed: { backgroundColor: colors.accentHover },
    buttonText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    buttonSecondary: {
      marginTop: spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    buttonSecondaryPressed: { borderColor: colors.text },
    buttonSecondaryText: { color: colors.text, fontSize: fontSize.base, fontWeight: "600" },
    buttonDisabled: { opacity: 0.4 },
  });
