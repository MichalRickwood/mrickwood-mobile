import { useMemo, useState } from "react";
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { APP_NAME } from "@/lib/config";
import { startWebAuth, WebAuthCancelled } from "@/lib/web-auth";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useTheme } from "@/lib/theme-context";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import AppearanceSwitcher from "@/components/AppearanceSwitcher";
import { useI18n } from "@/lib/i18n";

/**
 * Auth landing — full-bleed handshake pozadí (uzavření dealu) + tmavý overlay.
 * Žádné nativní formuláře. Pouze PŘIHLÁŠENÍ existujícího účtu na veritra.io
 * (ASWebAuthenticationSession).
 *
 * Apple compliance (3.1.1): appka VĚDOMĚ nenabízí registraci nového účtu.
 * Nový business účet vede k placenému tarifu prodávanému mimo IAP → in-app
 * registrace = "external mechanism for purchases", což Apple zamítl. Nový účet
 * se zakládá výhradně na webu a appka na to ani neodkazuje. Nepřidávej zpět
 * tlačítko Registrovat / Sign up. Viz lib/web-auth.ts.
 */
export default function LoginScreen() {
  const { applySession } = useAuth();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await startWebAuth(locale);
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
      setBusy(false);
    }
  }

  return (
    <ImageBackground
      source={require("@/assets/login-bg.png")}
      resizeMode="cover"
      style={styles.bg}
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <LocaleSwitcher />
          <View style={styles.pillGap} />
          <AppearanceSwitcher />
        </View>

        <View style={styles.brand}>
          <Image
            source={require("@/assets/logo-dark.png")}
            style={styles.brandIcon}
            resizeMode="contain"
          />
          <Text style={styles.brandText}>{APP_NAME}</Text>
          <Text style={styles.brandSub}>{t("brand", "tagline")}</Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.footer}>
          <Text style={styles.subtitle}>{t("authLanding", "subtitle")}</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={onLogin}
            disabled={busy}
            style={({ pressed }) => [
              styles.button,
              busy && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>{t("authLanding", "loginBtn")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: "#0B1220" },
    // Tmavý scrim přes foto pro čitelnost bílého textu (silnější dole u tlačítek).
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(8,12,24,0.55)",
    },
    safe: { flex: 1 },
    topBar: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
    },
    pillGap: { width: spacing.sm },
    brand: { marginTop: spacing.xl, alignItems: "center" },
    brandIcon: { width: 76, height: 76, marginBottom: spacing.xs },
    brandText: {
      fontSize: 36,
      fontWeight: "700",
      color: "#FFFFFF",
      letterSpacing: -0.5,
      textShadowColor: "rgba(0,0,0,0.45)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    brandSub: {
      fontSize: fontSize.sm,
      color: "rgba(255,255,255,0.88)",
      marginTop: spacing.xs,
      textShadowColor: "rgba(0,0,0,0.4)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
    spacer: { flex: 1 },
    footer: {
      padding: spacing.xl,
      paddingBottom: spacing.lg,
    },
    subtitle: {
      fontSize: fontSize.base,
      color: "rgba(255,255,255,0.92)",
      textAlign: "center",
      marginBottom: spacing.lg,
      textShadowColor: "rgba(0,0,0,0.5)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    error: {
      color: "#FFFFFF",
      fontSize: fontSize.sm,
      marginBottom: spacing.lg,
      backgroundColor: "rgba(220,38,38,0.85)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      textAlign: "center",
      overflow: "hidden",
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    buttonPressed: { backgroundColor: colors.accentHover },
    buttonText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    buttonDisabled: { opacity: 0.4 },
  });
