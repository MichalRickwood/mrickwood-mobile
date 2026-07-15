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
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { endpoints } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { AUTH_BASE_URL } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { AuthBrand, AuthError, AuthHeader, AuthTextField } from "@/components/AuthUi";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Nativní registrace (email/heslo/jméno + souhlasy VOP/GDPR). Povolena protože
 * appka má funkční Apple IAP — placené odemčení jde přes IAP, takže 3.1.1 je
 * splněno (registrace = free účet + trial, placení přes IAP, nikoli mimo).
 * Po registraci se pošle ověřovací e-mail; uživatel ověří a přihlásí se.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consentVop, setConsentVop] = useState(false);
  const [consentGdpr, setConsentGdpr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  function mapError(e: unknown): string {
    if (e instanceof ApiError) {
      switch (e.message) {
        case "EMAIL_INVALID":
        case "EMAIL_REQUIRED":
          return t("auth", "errEmailInvalid");
        case "PASSWORD_TOO_SHORT":
          return t("auth", "errPasswordShort");
        case "CONSENT_REQUIRED":
          return t("auth", "errConsent");
        case "USER_EXISTS":
          return t("auth", "errExists");
      }
      if (e.message.startsWith("Fetch fail")) return t("auth", "errNetwork");
    }
    return t("auth", "errGeneric");
  }

  async function onSubmit() {
    if (busy) return;
    setError(null);
    if (!consentVop || !consentGdpr) {
      setError(t("auth", "errConsent"));
      return;
    }
    setBusy(true);
    try {
      await endpoints.mobileRegister({
        email: email.trim(),
        password,
        name: name.trim(),
        locale,
        consentVop,
        consentGdpr,
      });
      setDone(true);
    } catch (e) {
      setError(mapError(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerWrap}>
          <View style={styles.mailBadge}>
            <Ionicons name="mail-unread-outline" size={34} color={colors.text} />
          </View>
          <Text style={styles.title}>{t("auth", "verifyTitle")}</Text>
          <Text style={styles.body}>{t("auth", "verifyBody", { email: email.trim() })}</Text>
          {Platform.OS === "ios" && (
            <Pressable
              onPress={() => void Linking.openURL("message://").catch(() => {})}
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            >
              <Text style={styles.btnSecondaryText}>{t("auth", "openEmailApp")}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            style={({ pressed }) => [styles.btnPrimary, styles.btnFull, pressed && styles.pressed]}
          >
            <Text style={styles.btnPrimaryText}>{t("auth", "verifyGotIt")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AuthHeader />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthBrand title={t("auth", "registerTitle")} subtitle={t("auth", "registerSubtitle")} />

          {error && <AuthError message={error} />}

          <AuthTextField
            label={t("auth", "name")}
            icon="person-outline"
            value={name}
            onChangeText={setName}
            placeholder={t("auth", "namePh")}
            autoCapitalize="words"
            textContentType="name"
            autoComplete="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            blurOnSubmit={false}
          />

          <AuthTextField
            ref={emailRef}
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
            hint={t("auth", "passwordHint")}
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth", "passwordPh")}
            autoCapitalize="none"
            textContentType="newPassword"
            autoComplete="new-password"
            passwordRules="minlength: 8;"
            returnKeyType="done"
          />

          <Pressable style={styles.consentRow} onPress={() => setConsentVop((v) => !v)}>
            <View style={[styles.checkbox, consentVop && styles.checkboxOn]}>
              {consentVop && <Text style={styles.checkboxMark}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              {t("auth", "consentVop")}{" "}
              <Text style={styles.link} onPress={() => void Linking.openURL(`${AUTH_BASE_URL}/${locale}/vop`)}>
                {t("auth", "termsLink")}
              </Text>
            </Text>
          </Pressable>

          <Pressable style={styles.consentRow} onPress={() => setConsentGdpr((v) => !v)}>
            <View style={[styles.checkbox, consentGdpr && styles.checkboxOn]}>
              {consentGdpr && <Text style={styles.checkboxMark}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              {t("auth", "consentGdpr")}{" "}
              <Text style={styles.link} onPress={() => void Linking.openURL(`${AUTH_BASE_URL}/${locale}/gdpr`)}>
                {t("auth", "privacyLink")}
              </Text>
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void onSubmit()}
            disabled={busy}
            style={({ pressed }) => [styles.btnPrimary, busy && styles.disabled, pressed && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color={colors.accentForeground} />
            ) : (
              <Text style={styles.btnPrimaryText}>{t("auth", "registerBtn")}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.linkRow} hitSlop={8}>
            <Text style={styles.linkMuted}>{t("auth", "toLogin")}</Text>
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
      paddingBottom: spacing.xxl,
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
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, marginBottom: spacing.xs, textAlign: "center" },
    consentRow: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.lg },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: colors.borderHover,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
      marginTop: 1,
    },
    checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    checkboxMark: { color: colors.accentForeground, fontSize: 14, fontWeight: "700" },
    consentText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
    link: { color: colors.link, fontWeight: "600" },
    btnPrimary: {
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.md + 2,
      alignItems: "center",
      marginTop: spacing.xl,
    },
    btnFull: { alignSelf: "stretch" },
    btnPrimaryText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    btnSecondary: {
      alignSelf: "stretch",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.md + 2,
      alignItems: "center",
      marginTop: spacing.md,
    },
    btnSecondaryText: { color: colors.text, fontSize: fontSize.base, fontWeight: "600" },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.85 },
    body: { fontSize: fontSize.base, color: colors.textSubtle, textAlign: "center", lineHeight: 22, marginBottom: spacing.lg },
    linkRow: { alignItems: "center", marginTop: spacing.xl },
    linkMuted: { color: colors.link, fontSize: fontSize.base, fontWeight: "600" },
  });
