import { useState } from "react";
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
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import OauthButtons from "@/components/OauthButtons";

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consentVop, setConsentVop] = useState(false);
  const [consentGdpr, setConsentGdpr] = useState(false);

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
        locale: "cs",
        consentVop,
        consentGdpr,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message || "Registrace selhala.");
      else setError("Chyba sítě. Zkuste to znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.successWrap}>
          <Image source={require("@/assets/logo.png")} style={styles.logoSmall} resizeMode="contain" />
          <Text style={styles.successTitle}>Zkontrolujte email</Text>
          <Text style={styles.successBody}>
            Odeslali jsme ověřovací odkaz na <Text style={styles.bold}>{email}</Text>. Klikněte na něj
            pro aktivaci účtu, pak se můžete přihlásit a doplnit kontaktní údaje.
          </Text>
          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Zpět na přihlášení</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Image source={require("@/assets/logo.png")} style={styles.logoSmall} resizeMode="contain" />
            <Text style={styles.brandText}>{APP_NAME}</Text>
            <Text style={styles.brandSub}>Vytvořit účet</Text>
          </View>

          <Field label="Jméno">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Jan Novák"
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              style={styles.input}
              returnKeyType="next"
            />
          </Field>

          <Field label="Email">
            <TextInput
              value={email}
              onChangeText={(v) => setEmail(v.trim().toLowerCase())}
              placeholder="jan@firma.cz"
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

          <Field label="Heslo (min. 8 znaků)">
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Vaše heslo"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoComplete="new-password"
              style={styles.input}
              returnKeyType="done"
            />
          </Field>

          <View style={styles.consents}>
            <Checkbox
              checked={consentVop}
              onToggle={() => setConsentVop((v) => !v)}
              label="Souhlasím s"
              linkText="obchodními podmínkami"
              linkUrl={`${API_BASE_URL}/vop`}
              tail="a potvrzuji, že jednám v rámci podnikatelské činnosti."
            />
            <Checkbox
              checked={consentGdpr}
              onToggle={() => setConsentGdpr((v) => !v)}
              label="Souhlasím se"
              linkText="zpracováním osobních údajů"
              linkUrl={`${API_BASE_URL}/gdpr`}
              tail="dle GDPR."
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
            <Text style={styles.buttonText}>{submitting ? "Registruji…" : "Vytvořit účet"}</Text>
          </Pressable>

          <OauthButtons onError={(msg) => setError(msg)} />

          <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.bottomLink}>
            <Text style={styles.bottomLinkText}>
              Máte účet? <Text style={styles.bottomLinkAccent}>Přihlásit se</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Checkbox({
  checked,
  onToggle,
  label,
  linkText,
  linkUrl,
  tail,
}: {
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  brand: { alignItems: "center", marginBottom: spacing.xl },
  logoSmall: { width: 72, height: 72, marginBottom: spacing.md },
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
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
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
  buttonText: { color: "#fff", fontSize: fontSize.base, fontWeight: "600" },
  help: { textAlign: "center", marginTop: spacing.lg, fontSize: fontSize.xs, color: colors.textSubtle },
  bottomLink: { marginTop: spacing.xl, alignItems: "center" },
  bottomLinkText: { fontSize: fontSize.sm, color: colors.textSubtle },
  bottomLinkAccent: { color: colors.text, fontWeight: "600" },
  successWrap: { flex: 1, padding: spacing.xl, justifyContent: "center", alignItems: "center" },
  successTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, marginTop: spacing.lg },
  successBody: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.md, textAlign: "center", lineHeight: 22 },
  bold: { fontWeight: "600", color: colors.text },
});
