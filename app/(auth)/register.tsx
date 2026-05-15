import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import {
  DIAL_CODES,
  defaultDialCodeForLocale,
  localDigitsRange,
} from "@/lib/dial-codes";
import { SUPPORTED_COUNTRIES, lookupCompanyById } from "@/lib/company-lookup";
import Picker, { type PickerItem } from "@/components/Picker";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

const LOOKUP_DEBOUNCE_MS = 600;

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; name: string; address: string; vatNumber: string | null }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [dialCode, setDialCode] = useState<string>(defaultDialCodeForLocale("cs"));
  const [phoneLocal, setPhoneLocal] = useState("");

  const [country, setCountry] = useState<string>("CZ");
  const [ico, setIco] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });
  const lookupAbortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [consentVop, setConsentVop] = useState(false);
  const [consentGdpr, setConsentGdpr] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function formatPhoneLocal(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return (digits.match(/.{1,3}/g) ?? []).join(" ");
  }

  function handlePhoneLocalChange(v: string) {
    setPhoneLocal(formatPhoneLocal(v));
  }

  const phone = phoneLocal ? `${dialCode} ${phoneLocal}` : "";
  const phoneDigitsLen = phoneLocal.replace(/\D/g, "").length;
  const selectedIso = DIAL_CODES.find((d) => d.code === dialCode)?.iso ?? "";
  const range = localDigitsRange(selectedIso);
  const phoneValid = phoneDigitsLen >= range.min && phoneDigitsLen <= range.max;

  const runLookup = useCallback(
    (countryCode: string, idValue: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      lookupAbortRef.current?.abort();
      const cleaned = idValue.replace(/\s/g, "").trim();
      if (cleaned.length < 6) {
        setLookup({ kind: "idle" });
        return;
      }
      setLookup({ kind: "loading" });
      debounceRef.current = setTimeout(async () => {
        const ctrl = new AbortController();
        lookupAbortRef.current = ctrl;
        try {
          const r = await lookupCompanyById(countryCode, cleaned, ctrl.signal);
          if (r.found) {
            setLookup({ kind: "found", name: r.name, address: r.address, vatNumber: r.vatNumber ?? null });
          } else {
            setLookup({ kind: "not_found" });
          }
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          setLookup({ kind: "error", message: (e as Error).message });
        }
      }, LOOKUP_DEBOUNCE_MS);
    },
    [],
  );

  function handleIcoChange(v: string) {
    setIco(v);
    runLookup(country, v);
  }

  function handleCountryChange(v: string) {
    setCountry(v);
    if (ico) runLookup(v, ico);
  }

  const formValid =
    name.trim().length >= 2 &&
    email.includes("@") &&
    password.length >= 8 &&
    phoneValid &&
    lookup.kind === "found" &&
    consentVop &&
    consentGdpr;

  async function onSubmit() {
    if (!formValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const companyData = lookup.kind === "found" ? lookup : null;
      await endpoints.register({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        phone,
        country,
        company: companyData?.name ?? null,
        ico: ico.replace(/\s/g, "").trim(),
        dic: companyData?.vatNumber ?? null,
        address: companyData?.address ?? null,
        locale: "cs",
        consentVop,
        consentGdpr,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Registrace selhala.");
      } else {
        setError("Chyba sítě. Zkuste to znovu.");
      }
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
            pro aktivaci účtu, pak se můžete přihlásit.
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Image source={require("@/assets/logo.png")} style={styles.logoSmall} resizeMode="contain" />
            <Text style={styles.brandText}>{APP_NAME}</Text>
            <Text style={styles.brandSub}>Registrace</Text>
          </View>

          <Field label="Jméno *">
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

          <Field label="Email *">
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

          <Field label="Heslo * (min. 8 znaků)">
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Vaše heslo"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoComplete="new-password"
              style={styles.input}
              returnKeyType="next"
            />
          </Field>

          <Field label="Telefon *">
            <View style={styles.phoneRow}>
              <View style={styles.dialCodeBox}>
                <Picker
                  items={DIAL_CODES.map((d): PickerItem => ({ value: d.code, label: d.label }))}
                  value={dialCode}
                  onChange={setDialCode}
                  placeholder="Předvolba"
                  searchable
                />
              </View>
              <View style={styles.phoneInputBox}>
                <TextInput
                  value={phoneLocal}
                  onChangeText={handlePhoneLocalChange}
                  placeholder="777 123 456"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="phone-pad"
                  autoComplete="tel-national"
                  style={styles.input}
                />
              </View>
            </View>
          </Field>

          <Field label="Země firmy *">
            <Picker
              items={SUPPORTED_COUNTRIES.map((c): PickerItem => ({ value: c.code, label: c.label }))}
              value={country}
              onChange={handleCountryChange}
              placeholder="Vyberte zemi"
              searchable
            />
          </Field>

          <Field label="IČO / Tax ID firmy *">
            <TextInput
              value={ico}
              onChangeText={handleIcoChange}
              placeholder={country === "CZ" ? "12345678" : country === "SK" ? "12345678" : "Tax ID"}
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              autoCapitalize="characters"
              style={styles.input}
            />
            <LookupStatus state={lookup} />
          </Field>

          <View style={styles.consents}>
            <Checkbox
              checked={consentVop}
              onToggle={() => setConsentVop((v) => !v)}
              label="Souhlasím s"
              linkText="obchodními podmínkami"
              linkUrl={`${API_BASE_URL}/vop`}
              tail="a potvrzuji, že jednám v rámci své podnikatelské činnosti."
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
            <Text style={styles.buttonText}>
              {submitting ? "Registruji…" : "Vytvořit účet"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            style={styles.bottomLink}
          >
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

function LookupStatus({ state }: { state: LookupState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "loading") {
    return (
      <View style={styles.lookupRow}>
        <ActivityIndicator size="small" color={colors.textSubtle} />
        <Text style={styles.lookupText}>Hledám firmu v rejstříku…</Text>
      </View>
    );
  }
  if (state.kind === "found") {
    return (
      <View style={styles.lookupCard}>
        <Text style={styles.lookupName}>{state.name}</Text>
        <Text style={styles.lookupAddress}>{state.address}</Text>
        {state.vatNumber && <Text style={styles.lookupVat}>DIČ: {state.vatNumber}</Text>}
      </View>
    );
  }
  if (state.kind === "not_found") {
    return <Text style={styles.lookupNotFound}>Firma s tímto IČO/Tax ID nebyla nalezena.</Text>;
  }
  return <Text style={styles.lookupError}>Chyba načtení rejstříku: {state.message}</Text>;
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
  phoneRow: { flexDirection: "row", gap: spacing.sm },
  dialCodeBox: { width: 130 },
  phoneInputBox: { flex: 1 },
  lookupRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  lookupText: { fontSize: fontSize.xs, color: colors.textSubtle },
  lookupCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  lookupName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  lookupAddress: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs },
  lookupVat: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.xs },
  lookupNotFound: {
    fontSize: fontSize.xs,
    color: colors.warning,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  lookupError: { fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.sm },
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
  bottomLink: { marginTop: spacing.xl, alignItems: "center" },
  bottomLinkText: { fontSize: fontSize.sm, color: colors.textSubtle },
  bottomLinkAccent: { color: colors.text, fontWeight: "600" },
  successWrap: { flex: 1, padding: spacing.xl, justifyContent: "center", alignItems: "center" },
  successTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, marginTop: spacing.lg },
  successBody: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.md, textAlign: "center", lineHeight: 22 },
  bold: { fontWeight: "600", color: colors.text },
});
