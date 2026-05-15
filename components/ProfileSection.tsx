import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import {
  DIAL_CODES,
  defaultDialCodeForLocale,
  localDigitsRange,
} from "@/lib/dial-codes";
import { SUPPORTED_COUNTRIES, lookupCompanyById } from "@/lib/company-lookup";
import Picker, { type PickerItem } from "./Picker";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const LOOKUP_DEBOUNCE_MS = 600;

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; name: string; address: string; vatNumber: string | null }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Firemní údaje sekce v Settings tabu — telefon + země + IČO s lookupem.
 * Dobrovolné, ne blokující (account funguje bez nich). Explicitní save tlačítko
 * dolu, ne autosave (jednodušší UX pro telefon+IČO co se mění zřídka).
 */
export default function ProfileSection() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [dialCode, setDialCode] = useState<string>(defaultDialCodeForLocale(locale));
  const [phoneLocal, setPhoneLocal] = useState("");
  const [country, setCountry] = useState<string>("CZ");
  const [ico, setIco] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });
  const lookupAbortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await endpoints.profile();
        if (cancelled) return;
        if (p.phone) {
          const match = DIAL_CODES.find((d) => p.phone!.startsWith(d.code));
          if (match) {
            setDialCode(match.code);
            setPhoneLocal(formatPhoneLocal(p.phone.slice(match.code.length)));
          } else {
            setPhoneLocal(formatPhoneLocal(p.phone));
          }
        }
        if (p.ico) {
          setIco(p.ico);
          // Spustíme lookup ať vidíme aktuální stav z rejstříku.
          runLookup(country, p.ico);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const phoneValid = !phoneLocal || (phoneDigitsLen >= range.min && phoneDigitsLen <= range.max);

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
  }, []);

  function handleIcoChange(v: string) {
    setIco(v);
    runLookup(country, v);
  }

  function handleCountryChange(v: string) {
    setCountry(v);
    if (ico) runLookup(v, ico);
  }

  async function onSave() {
    if (saveState === "saving") return;
    if (!phoneValid) {
      setSaveError(t("profileComplete", "lookupNotFound")); // generic, swap if needed
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      const found = lookup.kind === "found" ? lookup : null;
      await endpoints.updateProfile({
        phone: phone || null,
        country: ico ? country : null,
        ico: ico ? ico.replace(/\s/g, "").trim() : null,
        company: found?.name ?? null,
        dic: found?.vatNumber ?? null,
        address: found?.address ?? null,
      });
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (err) {
      if (err instanceof ApiError) setSaveError(err.message);
      else setSaveError(t("profileComplete", "error"));
      setSaveState("error");
    }
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.textSubtle} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("settings", "companyTitle")}</Text>
        {saveState === "saving" && <Text style={styles.statusSaving}>{t("settings", "companySaving")}</Text>}
        {saveState === "saved" && <Text style={styles.statusSaved}>{t("settings", "companySaved")}</Text>}
      </View>
      <Text style={styles.subtitle}>{t("settings", "companySubtitle")}</Text>

      <Field styles={styles} label={t("profileComplete", "phoneLabel")}>
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
              placeholder={t("profileComplete", "phonePlaceholder")}
              placeholderTextColor={colors.textFaint}
              keyboardType="phone-pad"
              autoComplete="tel-national"
              style={styles.input}
            />
          </View>
        </View>
      </Field>

      <Field styles={styles} label={t("profileComplete", "countryLabel")}>
        <Picker
          items={SUPPORTED_COUNTRIES.map((c): PickerItem => ({ value: c.code, label: c.label }))}
          value={country}
          onChange={handleCountryChange}
          placeholder={t("profileComplete", "countryPlaceholder")}
          searchable
        />
      </Field>

      <Field styles={styles} label={t("profileComplete", "icoLabel")}>
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
        <LookupStatus styles={styles} colors={colors} state={lookup} t={t} />
      </Field>

      {saveError && <Text style={styles.error}>{saveError}</Text>}

      <Pressable
        onPress={onSave}
        disabled={saveState === "saving"}
        style={({ pressed }) => [
          styles.button,
          saveState === "saving" && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>
          {saveState === "saving" ? t("settings", "companySaveBtnLoading") : t("settings", "companySaveBtn")}
        </Text>
      </Pressable>
    </View>
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

function LookupStatus({
  styles,
  colors,
  state,
  t,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
  state: LookupState;
  t: (s: "profileComplete", k: "lookupSearching" | "lookupNotFound" | "lookupError", p?: Record<string, string>) => string;
}) {
  if (state.kind === "idle") return null;
  if (state.kind === "loading") {
    return (
      <View style={styles.lookupRow}>
        <ActivityIndicator size="small" color={colors.textSubtle} />
        <Text style={styles.lookupText}>{t("profileComplete", "lookupSearching")}</Text>
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
    return <Text style={styles.lookupNotFound}>{t("profileComplete", "lookupNotFound")}</Text>;
  }
  return <Text style={styles.lookupError}>{t("profileComplete", "lookupError", { message: state.message })}</Text>;
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingRow: { paddingVertical: spacing.md, alignItems: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
  subtitle: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 18 },
  statusSaving: { fontSize: fontSize.xs, color: colors.textSubtle },
  statusSaved: { fontSize: fontSize.xs, color: colors.success, fontWeight: "600" },
  field: { marginBottom: spacing.md },
  label: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.text,
  },
  phoneRow: { flexDirection: "row" },
  dialCodeBox: { width: 130, marginRight: spacing.sm },
  phoneInputBox: { flex: 1 },
  lookupRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  lookupText: { fontSize: fontSize.xs, color: colors.textSubtle, marginLeft: spacing.sm },
  lookupCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.successBg,
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
    marginTop: spacing.md,
    color: colors.danger,
    fontSize: fontSize.xs,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { backgroundColor: colors.accentHover },
  buttonText: { color: "#fff", fontSize: fontSize.base, fontWeight: "600" },
});
