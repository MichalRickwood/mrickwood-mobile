import { useMemo, useState } from "react";
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
import { endpoints } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { AUTH_BASE_URL } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
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
          <Text style={styles.checkmark}>✉️</Text>
          <Text style={styles.title}>{t("auth", "verifyTitle")}</Text>
          <Text style={styles.body}>{t("auth", "verifyBody", { email: email.trim() })}</Text>
          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
          >
            <Text style={styles.btnPrimaryText}>{t("auth", "verifyGotIt")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("auth", "registerTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth", "registerSubtitle")}</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.label}>{t("auth", "name")}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("auth", "namePh")}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.label}>{t("auth", "email")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth", "emailPh")}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text style={styles.label}>{t("auth", "password")}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth", "passwordPh")}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
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

          <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.linkRow}>
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
    scroll: { padding: spacing.xl, paddingTop: spacing.xxl, flexGrow: 1 },
    centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    checkmark: { fontSize: 56, marginBottom: spacing.lg },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
    subtitle: { fontSize: fontSize.base, color: colors.textSubtle, marginBottom: spacing.xl },
    label: { fontSize: fontSize.sm, color: colors.textSubtle, marginBottom: spacing.xs, marginTop: spacing.md },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: fontSize.base,
      color: colors.text,
      backgroundColor: colors.card,
    },
    consentRow: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.lg },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
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
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      marginTop: spacing.xl,
    },
    btnPrimaryText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.85 },
    body: { fontSize: fontSize.base, color: colors.textSubtle, textAlign: "center", lineHeight: 22, marginBottom: spacing.xl },
    error: {
      color: colors.danger,
      fontSize: fontSize.sm,
      marginBottom: spacing.sm,
      backgroundColor: colors.dangerBg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      overflow: "hidden",
    },
    linkRow: { alignItems: "center", marginTop: spacing.xl },
    linkMuted: { color: colors.link, fontSize: fontSize.base, fontWeight: "600" },
  });
