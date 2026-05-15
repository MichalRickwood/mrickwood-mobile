import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import {
  useGoogleAuth,
  useGithubAuth,
  completeGoogleSignIn,
  completeGithubSignIn,
  signInWithApple,
  isGoogleConfigured,
  isGithubConfigured,
  isAppleAvailable,
} from "@/lib/oauth";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

/**
 * 3 OAuth tlačítka (Apple, Google, GitHub) v custom designu — konzistentní
 * styl + české labely. Apple button je custom (ne `AppleAuthenticationButton`)
 * aby měl náš český text "Pokračovat přes Apple". Apple HIG to povoluje
 * pokud zachováme black/white styl + Apple logo + minimum touch size.
 */
export default function OauthButtons({ onError }: { onError: (msg: string) => void }) {
  const { applyOauthSession } = useAuth();
  const { t } = useI18n();
  const [busyProvider, setBusyProvider] = useState<"google" | "apple" | "github" | null>(null);

  const google = isGoogleConfigured() ? useGoogleAuth() : null;
  const github = isGithubConfigured() ? useGithubAuth() : null;

  useEffect(() => {
    if (!google?.response || busyProvider !== "google") return;
    (async () => {
      try {
        if (google.response?.type === "success") {
          const idToken = google.response.params?.id_token;
          if (!idToken) throw new Error("Google neposlal id_token.");
          const user = await completeGoogleSignIn(idToken);
          applyOauthSession(user);
        } else if (google.response?.type === "error") {
          onError(google.response.error?.message ?? "Google sign-in selhal.");
        }
      } catch (e) {
        onError((e as Error).message);
      } finally {
        setBusyProvider(null);
      }
    })();
  }, [google?.response, busyProvider, applyOauthSession, onError]);

  useEffect(() => {
    if (!github?.response || busyProvider !== "github") return;
    (async () => {
      try {
        if (github.response?.type === "success") {
          const code = github.response.params?.code;
          if (!code) throw new Error("GitHub neposlal code.");
          const user = await completeGithubSignIn(code, github.redirectUri);
          applyOauthSession(user);
        } else if (github.response?.type === "error") {
          onError(github.response.error?.message ?? "GitHub sign-in selhal.");
        }
      } catch (e) {
        onError((e as Error).message);
      } finally {
        setBusyProvider(null);
      }
    })();
  }, [github?.response, busyProvider, applyOauthSession, onError, github?.redirectUri]);

  async function tryGoogle() {
    if (!google || busyProvider) return;
    setBusyProvider("google");
    await google.promptAsync().catch((e) => {
      onError((e as Error).message);
      setBusyProvider(null);
    });
  }

  async function tryGithub() {
    if (!github || busyProvider) return;
    setBusyProvider("github");
    await github.promptAsync().catch((e) => {
      onError((e as Error).message);
      setBusyProvider(null);
    });
  }

  async function tryApple() {
    if (busyProvider) return;
    setBusyProvider("apple");
    try {
      const user = await signInWithApple();
      applyOauthSession(user);
    } catch (e) {
      const msg = (e as Error).message;
      if (!msg.toLowerCase().includes("cancel")) onError(msg);
    } finally {
      setBusyProvider(null);
    }
  }

  const hasAny = google || github || isAppleAvailable();
  if (!hasAny) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t("oauth", "divider")}</Text>
        <View style={styles.dividerLine} />
      </View>

      {isAppleAvailable() && (
        <ProviderButton
          variant="apple"
          icon={<FontAwesome name="apple" size={20} color="#fff" />}
          label={t("oauth", "apple")}
          loading={busyProvider === "apple"}
          disabled={!!busyProvider}
          onPress={tryApple}
        />
      )}

      {google && (
        <ProviderButton
          variant="light"
          icon={<FontAwesome name="google" size={18} color="#EA4335" />}
          label={t("oauth", "google")}
          loading={busyProvider === "google"}
          disabled={!!busyProvider}
          onPress={tryGoogle}
        />
      )}

      {github && (
        <ProviderButton
          variant="light"
          icon={<FontAwesome name="github" size={20} color={colors.text} />}
          label={t("oauth", "github")}
          loading={busyProvider === "github"}
          disabled={!!busyProvider}
          onPress={tryGithub}
        />
      )}
    </View>
  );
}

function ProviderButton({
  variant,
  icon,
  label,
  loading,
  disabled,
  onPress,
}: {
  variant: "apple" | "light";
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const isApple = variant === "apple";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        isApple ? styles.buttonApple : styles.buttonLight,
        pressed && (isApple ? styles.buttonApplePressed : styles.buttonLightPressed),
        disabled && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isApple ? "#fff" : colors.text} />
      ) : (
        <View style={styles.buttonContent}>
          <View style={styles.iconWrap}>{icon}</View>
          <Text style={[styles.buttonText, isApple && styles.buttonTextApple]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl, gap: spacing.md },
  divider: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: spacing.md, fontSize: fontSize.xs, color: colors.textSubtle },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonApple: { backgroundColor: "#000" },
  buttonApplePressed: { backgroundColor: "#1a1a1a" },
  buttonLight: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonLightPressed: { borderColor: colors.text },
  buttonDisabled: { opacity: 0.5 },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconWrap: { width: 22, alignItems: "center" },
  buttonText: { color: colors.text, fontSize: fontSize.base, fontWeight: "500" },
  buttonTextApple: { color: "#fff", fontWeight: "600" },
});
