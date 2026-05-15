import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "@/lib/auth-context";
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
 * 3 OAuth tlačítka (Google, Apple, GitHub) — zobrazují se jen pokud je
 * provider configured (env var v app.json extra nebo EXPO_PUBLIC_ vars).
 * Apple se zobrazuje vždy na iOS — Apple Review to vyžaduje pokud máme
 * Google nebo GitHub.
 */
export default function OauthButtons({ onError }: { onError: (msg: string) => void }) {
  const { applyOauthSession } = useAuth();
  const [busyProvider, setBusyProvider] = useState<"google" | "apple" | "github" | null>(null);

  const google = isGoogleConfigured() ? useGoogleAuth() : null;
  const github = isGithubConfigured() ? useGithubAuth() : null;

  // Google response handler
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

  // GitHub response handler
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
      // Cancel není error — uživatel se může chtít vrátit.
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
        <Text style={styles.dividerText}>nebo</Text>
        <View style={styles.dividerLine} />
      </View>

      {isAppleAvailable() && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.md}
          style={styles.appleButton}
          onPress={tryApple}
        />
      )}

      {google && (
        <Pressable
          onPress={tryGoogle}
          disabled={!!busyProvider}
          style={({ pressed }) => [
            styles.providerButton,
            pressed && styles.providerButtonPressed,
            !!busyProvider && styles.providerButtonDisabled,
          ]}
        >
          {busyProvider === "google" ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.providerText}>Pokračovat přes Google</Text>
          )}
        </Pressable>
      )}

      {github && (
        <Pressable
          onPress={tryGithub}
          disabled={!!busyProvider}
          style={({ pressed }) => [
            styles.providerButton,
            pressed && styles.providerButtonPressed,
            !!busyProvider && styles.providerButtonDisabled,
          ]}
        >
          {busyProvider === "github" ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.providerText}>Pokračovat přes GitHub</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl, gap: spacing.md },
  divider: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: spacing.md, fontSize: fontSize.xs, color: colors.textSubtle },
  appleButton: { width: "100%", height: 48 },
  providerButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  providerButtonPressed: { borderColor: colors.text },
  providerButtonDisabled: { opacity: 0.5 },
  providerText: { color: colors.text, fontSize: fontSize.base, fontWeight: "500" },
});
