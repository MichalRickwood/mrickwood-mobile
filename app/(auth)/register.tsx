import { useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { API_BASE_URL, APP_NAME } from "@/lib/config";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useTheme } from "@/lib/theme-context";
import OauthButtons from "@/components/OauthButtons";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import AppearanceSwitcher from "@/components/AppearanceSwitcher";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

export default function RegisterScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consentVop, setConsentVop] = useState(false);
  const [consentGdpr, setConsentGdpr] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const formValid =
    name.trim().length >= 2 &&
    email.includes("@") &&
    password.length >= 8 &&
    consentVop &&
    consentGdpr;

  async function onSubmit() {
    if (!formValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await endpoints.register({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        locale,
        consentVop,
        consentGdpr,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message || t("register", "errorDefault"));
      else setError(t("register", "errorNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  async function tryAutoLogin() {
    if (checking) return;
    setChecking(true);
    setCheckError(null);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // Explicit navigation — RouterGuard reaguje asynchronně přes useEffect.
      // Telefon + IČO se doplňují v Settings tabu (dobrovolně, ne blokující).
      router.replace("/(tabs)");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) setCheckError(t("register", "successNotVerified"));
        else if (err.status === 401) setCheckError(t("register", "successNotVerified"));
        else setCheckError(err.message || t("register", "errorDefault"));
      } else {
        setCheckError(t("register", "errorNetwork"));
      }
    } finally {
      setChecking(false);
    }
  }

  if (success) {
    const body = t("register", "successBody", { email });
    const [bodyBefore, bodyAfter] = body.split("{email}");
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.successWrap}>
          <Image source={require("@/assets/logo.png")} style={styles.logoSmall} resizeMode="contain" />
          <Text style={styles.successTitle}>{t("register", "successTitle")}</Text>
          <Text style={styles.successBody}>
            {bodyAfter !== undefined ? (
              <>
                {bodyBefore}
                <Text style={styles.bold}>{email}</Text>
                {bodyAfter}
              </>
            ) : (
              body
            )}
          </Text>

          {checkError && <Text style={styles.successError}>{checkError}</Text>}

          <Pressable
            onPress={tryAutoLogin}
            disabled={checking}
            style={({ pressed }) => [
              styles.successButton,
              checking && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>
              {checking ? t("register", "successCheckBtnLoading") : t("register", "successCheckBtn")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            style={styles.successSecondary}
          >
            <Text style={styles.successSecondaryText}>{t("register", "successCta")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <LocaleSwitcher />
        <View style={styles.pillGap} />
        <AppearanceSwitcher />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <Image source={require("@/assets/logo.png")} style={styles.logoSmall} resizeMode="contain" />
            <Text style={styles.brandText}>{APP_NAME}</Text>
            <Text style={styles.brandSub}>{t("register", "title")}</Text>
          </View>

          <Field styles={styles} label={t("register", "nameLabel")}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("register", "namePlaceholder")}
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              style={styles.input}
              returnKeyType="next"
            />
          </Field>

          <Field styles={styles} label={t("register", "emailLabel")}>
            <TextInput
              value={email}
              onChangeText={(v) => setEmail(v.trim().toLowerCase())}
              placeholder={t("register", "emailPlaceholder")}
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              spellCheck={false}
              style={styles.input}
              returnKeyType="next"
            />
          </Field>

          <Field styles={styles} label={t("register", "passwordLabel")}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t("register", "passwordPlaceholder")}
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoComplete="new-password"
              style={styles.input}
              returnKeyType="done"
            />
          </Field>

          <View style={styles.consents}>
            <Checkbox styles={styles}
              checked={consentVop}
              onToggle={() => setConsentVop((v) => !v)}
              label={t("register", "consentVopPre")}
              linkText={t("register", "consentVopLink")}
              linkUrl={`${API_BASE_URL}/vop`}
              tail={t("register", "consentVopTail")}
            />
            <Checkbox styles={styles}
              checked={consentGdpr}
              onToggle={() => setConsentGdpr((v) => !v)}
              label={t("register", "consentGdprPre")}
              linkText={t("register", "consentGdprLink")}
              linkUrl={`${API_BASE_URL}/gdpr`}
              tail={t("register", "consentGdprTail")}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={onSubmit}
            disabled={!formValid || submitting}
            style={({ pressed }) => [
              styles.button,
              (!formValid || submitting) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>
              {submitting ? t("register", "submitting") : t("register", "submit")}
            </Text>
          </Pressable>

          <OauthButtons onError={(msg) => setError(msg)} />

          <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.bottomLink}>
            <Text style={styles.bottomLinkText}>
              {t("register", "haveAccount")}{" "}
              <Text style={styles.bottomLinkAccent}>{t("register", "loginLink")}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  styles,
  label,
  children,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Checkbox({
  styles,
  checked,
  onToggle,
  label,
  linkText,
  linkUrl,
  tail,
}: {
  styles: ReturnType<typeof makeStyles>;
  checked: boolean;
  onToggle: () => void;
  label: string;
  linkText: string;
  linkUrl: string;
  tail: string;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.checkboxRow}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.checkboxText}>
        {label}{" "}
        <Text
          style={styles.linkText}
          onPress={(e) => {
            e.stopPropagation();
            void Linking.openURL(linkUrl);
          }}
        >
          {linkText}
        </Text>{" "}
        {tail}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  pillGap: { width: spacing.sm },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  brand: { alignItems: "center", marginBottom: spacing.xl },
  logoSmall: { width: 72, height: 72, marginBottom: spacing.md, alignSelf: "center" },
  brandText: { fontSize: 28, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  brandSub: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.xs },
  field: { marginBottom: spacing.lg },
  label: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.text,
  },
  consents: { marginTop: spacing.lg, gap: spacing.md },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: colors.borderHover,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: colors.accentForeground, fontSize: 14, fontWeight: "700" },
  checkboxText: { fontSize: fontSize.xs, color: colors.textMuted, flex: 1, lineHeight: 18 },
  linkText: { color: colors.link, textDecorationLine: "underline" },
  error: {
    marginTop: spacing.lg,
    color: colors.danger,
    fontSize: fontSize.sm,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { backgroundColor: colors.accentHover },
  buttonText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
  help: { textAlign: "center", marginTop: spacing.lg, fontSize: fontSize.xs, color: colors.textSubtle },
  bottomLink: { marginTop: spacing.xl, alignItems: "center" },
  bottomLinkText: { fontSize: fontSize.sm, color: colors.textSubtle },
  bottomLinkAccent: { color: colors.text, fontWeight: "600" },
  successWrap: { flex: 1, padding: spacing.xl, justifyContent: "center", alignItems: "stretch" },
  successTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, marginTop: spacing.lg, textAlign: "center" },
  successBody: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.md, textAlign: "center", lineHeight: 22 },
  successError: {
    marginTop: spacing.lg,
    color: colors.danger,
    fontSize: fontSize.sm,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    textAlign: "center",
  },
  successButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  successSecondary: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  successSecondaryText: {
    color: colors.textSubtle,
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  bold: { fontWeight: "600", color: colors.text },
});
