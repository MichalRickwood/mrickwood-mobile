import { useEffect, useMemo, useState } from "react";
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
import CountryPicker from "@/components/CountryPicker";
import CompanyLookupField from "@/components/CompanyLookupField";
import DialCodePicker from "@/components/DialCodePicker";
import { defaultDialCodeForLocale, DIAL_CODES } from "@/lib/dial-codes";
import { endpoints } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatNationalPhone(digitsOnly: string): string {
  // 3-3-3 grupování (CZ/SK/DE atd.) — pure cosmetics před odesláním stripneme spaces.
  const d = digitsOnly.replace(/\D/g, "").slice(0, 12);
  return d.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

function splitPhone(full: string | null, fallbackDial: string): { dial: string; local: string } {
  if (!full) return { dial: fallbackDial, local: "" };
  const trimmed = full.replace(/\s/g, "");
  // Najdi nejdelší matching dial code (např. +420 > +42).
  const sorted = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const dc of sorted) {
    if (trimmed.startsWith(dc.code)) {
      return { dial: dc.code, local: formatNationalPhone(trimmed.slice(dc.code.length)) };
    }
  }
  // Bez dial code → dej do local, použij fallback (locale default).
  return { dial: fallbackDial, local: formatNationalPhone(trimmed) };
}

export default function OnboardingProfile() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dialCode, setDialCode] = useState(defaultDialCodeForLocale(locale));
  const [phoneLocal, setPhoneLocal] = useState("");
  const [country, setCountry] = useState("CZ");
  const [companyName, setCompanyName] = useState("");
  const [companyIco, setCompanyIco] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyDic, setCompanyDic] = useState("");
  const [manualEntry, setManualEntry] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await endpoints.getProfileV2();
        if (cancelled) return;
        if (p.name && p.country) {
          router.replace("/(tabs)");
          return;
        }
        setEmail(p.email);
        setName(p.name ?? "");
        const { dial, local } = splitPhone(p.phone, defaultDialCodeForLocale(locale));
        setDialCode(dial);
        setPhoneLocal(local);
        if (p.country) setCountry(p.country);
        setCompanyName(p.company ?? "");
        setCompanyIco(p.ico ?? "");
        setCompanyAddress(p.address ?? "");
        setCompanyDic(p.dic ?? "");
        if (p.ico || p.address) setManualEntry(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, locale]);

  function validateEmail() {
    if (!email.trim()) {
      setEmailError(null);
      return;
    }
    setEmailError(EMAIL_RE.test(email.trim()) ? null : t("onboardingProfile", "emailInvalid"));
  }

  async function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("onboardingProfile", "nameRequired"));
      return;
    }
    if (!country) {
      setError(t("onboardingProfile", "countryRequired"));
      return;
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      setEmailError(t("onboardingProfile", "emailInvalid"));
      setError(t("onboardingProfile", "emailInvalid"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: Parameters<typeof endpoints.updateProfileV2>[0] = {
        name: trimmedName,
        country,
      };
      const phoneDigits = phoneLocal.replace(/\D/g, "");
      if (phoneDigits) input.phone = `${dialCode} ${phoneDigits}`;
      if (companyName.trim()) input.company = companyName.trim();
      if (companyIco.trim()) input.ico = companyIco.trim();
      if (companyAddress.trim()) input.address = companyAddress.trim();
      if (companyDic.trim()) input.dic = companyDic.trim();
      await endpoints.updateProfileV2(input);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("onboardingProfile", "saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("onboardingProfile", "title")}</Text>
          <Text style={styles.subtitle}>{t("onboardingProfile", "subtitle")}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>{t("onboardingProfile", "nameLabel")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("onboardingProfile", "namePlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={200}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("onboardingProfile", "emailLabel")}</Text>
            <TextInput
              value={email}
              onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(null); }}
              onBlur={validateEmail}
              placeholder="email@example.com"
              placeholderTextColor={colors.textFaint}
              style={[styles.input, emailError && styles.inputError]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              maxLength={255}
            />
            {emailError && <Text style={styles.fieldError}>{emailError}</Text>}
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{t("onboardingProfile", "phoneLabel")}</Text>
              <Text style={styles.labelOptional}>{t("onboardingProfile", "phoneOptional")}</Text>
            </View>
            <View style={styles.phoneRow}>
              <View style={styles.dialCodeWrap}>
                <DialCodePicker value={dialCode} onChange={setDialCode} />
              </View>
              <TextInput
                value={phoneLocal}
                onChangeText={(v) => setPhoneLocal(formatNationalPhone(v))}
                placeholder="123 456 789"
                placeholderTextColor={colors.textFaint}
                style={[styles.input, { flex: 1 }]}
                keyboardType="phone-pad"
                autoCorrect={false}
                maxLength={20}
              />
            </View>
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{t("onboardingProfile", "countryLabel")}</Text>
              <Pressable
                onPress={() => setManualEntry((v) => !v)}
                style={styles.manualToggle}
                hitSlop={8}
              >
                <View style={[styles.manualCheckbox, manualEntry && styles.manualCheckboxOn]}>
                  {manualEntry && <Text style={styles.manualCheckboxMark}>✓</Text>}
                </View>
                <Text style={styles.manualToggleText}>{t("onboardingProfile", "companyManualToggle")}</Text>
              </Pressable>
            </View>
            <CountryPicker value={country} onChange={setCountry} />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{t("onboardingProfile", "companyLabel")}</Text>
              <Text style={styles.labelOptional}>{t("onboardingProfile", "companyOptional")}</Text>
            </View>
            {!manualEntry ? (
              <>
                <CompanyLookupField
                  country={country}
                  value={companyIco}
                  resolvedName={companyName}
                  label=""
                  placeholder={t("onboardingProfile", "companyPlaceholder")}
                  onResolve={(d) => {
                    setCompanyIco(d.taxId);
                    setCompanyName(d.name);
                    setCompanyAddress(d.address);
                    setCompanyDic(d.vatNumber ?? "");
                  }}
                  onClear={() => {
                    setCompanyIco("");
                    setCompanyName("");
                    setCompanyAddress("");
                    setCompanyDic("");
                  }}
                />
                <Text style={styles.hint}>{t("onboardingProfile", "companyHint")}</Text>
              </>
            ) : (
              <View>
                <TextInput
                  value={companyIco}
                  onChangeText={setCompanyIco}
                  placeholder={t("onboardingProfile", "manualTaxIdPlaceholder")}
                  placeholderTextColor={colors.textFaint}
                  style={styles.input}
                  autoCorrect={false}
                  maxLength={64}
                />
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder={t("onboardingProfile", "manualNamePlaceholder")}
                  placeholderTextColor={colors.textFaint}
                  style={[styles.input, { marginTop: spacing.sm }]}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={500}
                />
                <TextInput
                  value={companyAddress}
                  onChangeText={setCompanyAddress}
                  placeholder={t("onboardingProfile", "manualAddressPlaceholder")}
                  placeholderTextColor={colors.textFaint}
                  style={[styles.input, { marginTop: spacing.sm }]}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={500}
                />
                <TextInput
                  value={companyDic}
                  onChangeText={setCompanyDic}
                  placeholder={t("onboardingProfile", "manualVatPlaceholder")}
                  placeholderTextColor={colors.textFaint}
                  style={[styles.input, { marginTop: spacing.sm }]}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={32}
                />
                <Text style={styles.hint}>{t("onboardingProfile", "companyManualHint")}</Text>
              </View>
            )}
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={saving}
            style={({ pressed }) => [
              styles.ctaBtn,
              pressed && { opacity: 0.85 },
              saving && { opacity: 0.6 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.accentForeground} />
            ) : (
              <Text style={styles.ctaBtnText}>{t("onboardingProfile", "cta")}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    loadingScreen: { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
    content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: c.text, marginBottom: spacing.sm },
    subtitle: { fontSize: fontSize.sm, color: c.textMuted, marginBottom: spacing.xl, lineHeight: 20 },
    field: { marginBottom: spacing.lg },
    labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
    label: { fontSize: fontSize.xs, color: c.textMuted, textTransform: "uppercase", fontWeight: "600", marginBottom: spacing.sm },
    labelOptional: { fontSize: fontSize.xs, color: c.textFaint, fontStyle: "italic" },
    input: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.base,
      color: c.text,
    },
    inputError: { borderColor: c.danger },
    fieldError: { fontSize: fontSize.xs, color: c.danger, marginTop: spacing.xs },
    phoneRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    dialCodeWrap: { minWidth: 100 },
    hint: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: spacing.xs, lineHeight: 16 },
    manualToggle: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: 4 },
    manualCheckbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    manualCheckboxOn: { backgroundColor: c.accent, borderColor: c.accent },
    manualCheckboxMark: { color: c.accentForeground, fontSize: 10, fontWeight: "700" },
    manualToggleText: { fontSize: fontSize.xs, color: c.textMuted },
    errorText: { fontSize: fontSize.sm, color: c.danger, marginBottom: spacing.md, textAlign: "center" },
    ctaBtn: { backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.md },
    ctaBtnText: { color: c.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
  });
}
