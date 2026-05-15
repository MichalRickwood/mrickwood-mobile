import { useCallback, useEffect, useRef, useState } from "react";
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
import { ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import {
  DIAL_CODES,
  defaultDialCodeForLocale,
  localDigitsRange,
} from "@/lib/dial-codes";
import { SUPPORTED_COUNTRIES, lookupCompanyById } from "@/lib/company-lookup";
import Picker, { type PickerItem } from "@/components/Picker";
import { useAuth } from "@/lib/auth-context";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

const LOOKUP_DEBOUNCE_MS = 600;

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; name: string; address: string; vatNumber: string | null }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

/**
 * Doplnění profilu po prvním přihlášení — telefon + země firmy + IČO.
 * Po uložení router guard přesměruje do (tabs).
 *
 * Tento screen se zobrazí jen pokud user nemá phone nebo IČO. Pro existující
 * usery z webu kteří už profile mají, tenhle screen se přeskakuje.
 */
export default function ProfileCompleteScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [dialCode, setDialCode] = useState<string>(defaultDialCodeForLocale("cs"));
  const [phoneLocal, setPhoneLocal] = useState("");
  const [country, setCountry] = useState<string>("CZ");
  const [ico, setIco] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });
  const lookupAbortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill — pokud user už něco má (částečně vyplněný profil), nepřepisujeme.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await endpoints.profile();
        if (cancelled) return;
        if (p.isComplete) {
          router.replace("/(tabs)");
          return;
        }
        if (p.phone) {
          const match = DIAL_CODES.find((d) => p.phone!.startsWith(d.code));
          if (match) {
            setDialCode(match.code);
            setPhoneLocal(formatPhoneLocal(p.phone.slice(match.code.length)));
          } else {
            setPhoneLocal(formatPhoneLocal(p.phone));
          }
        }
        if (p.ico) setIco(p.ico);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

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

  const runLookup = useCallback((countryCode: string, idValue: string) => {
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
        if (r.found) setLookup({ kind: "found", name: r.name, address: r.address, vatNumber: r.vatNumber ?? null });
        else setLookup({ kind: "not_found" });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setLookup({ kind: "error", message: (e as Error).message });
      }
    }, LOOKUP_DEBOUNCE_MS);
  }, []);

  function handleIcoChange(v: string) {
    setIco(v);
    runLookup(country, v);
  }

  function handleCountryChange(v: string) {
    setCountry(v);
    if (ico) runLookup(v, ico);
  }

  const formValid = phoneValid && lookup.kind === "found";

  async function onSubmit() {
    if (!formValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const found = lookup.kind === "found" ? lookup : null;
      await endpoints.updateProfile({
        phone,
        country,
        ico: ico.replace(/\s/g, "").trim(),
        company: found?.name ?? null,
        dic: found?.vatNumber ?? null,
        address: found?.address ?? null,
      });
      router.replace("/(tabs)");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Uložení selhalo. Zkuste to znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.textSubtle} />
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
          <View style={styles.header}>
            <Text style={styles.title}>Dokončete profil</Text>
            <Text style={styles.subtitle}>
              Pro plnou funkčnost potřebujeme telefon a IČO firmy. Trvá to chvilku.
            </Text>
          </View>

          <Field label="Telefon">
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

          <Field label="Země firmy">
            <Picker
              items={SUPPORTED_COUNTRIES.map((c): PickerItem => ({ value: c.code, label: c.label }))}
              value={country}
              onChange={handleCountryChange}
              placeholder="Vyberte zemi"
              searchable
            />
          </Field>

          <Field label="IČO / Tax ID firmy">
            <TextInput
              value={ico}
              onChangeText={handleIcoChange}
              placeholder={country === "CZ" || country === "SK" ? "12345678" : "Tax ID"}
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              autoCapitalize="characters"
              style={styles.input}
            />
            <LookupStatus state={lookup} />
          </Field>

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
            <Text style={styles.buttonText}>{submitting ? "Ukládám…" : "Pokračovat"}</Text>
          </Pressable>

          <Pressable onPress={() => void signOut()} style={styles.signOutLink}>
            <Text style={styles.signOutText}>Odhlásit a vrátit se na přihlášení</Text>
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
  if (state.kind === "not_found") return <Text style={styles.lookupNotFound}>Firma s tímto IČO/Tax ID nebyla nalezena.</Text>;
  return <Text style={styles.lookupError}>Chyba načtení rejstříku: {state.message}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  header: { marginBottom: spacing.xl },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.sm, lineHeight: 20 },
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
  lookupNotFound: { fontSize: fontSize.xs, color: colors.warning, marginTop: spacing.sm },
  lookupError: { fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.sm },
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
  signOutLink: { marginTop: spacing.xl, alignItems: "center" },
  signOutText: { fontSize: fontSize.xs, color: colors.textSubtle, textDecorationLine: "underline" },
});
