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
import { useQueryClient } from "@tanstack/react-query";
import DialCodePicker from "@/components/DialCodePicker";
import LocaleSwitcher from "@/components/LocaleSwitcher";
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
  const qc = useQueryClient();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dialCode, setDialCode] = useState(defaultDialCodeForLocale(locale));
  const [phoneLocal, setPhoneLocal] = useState("");

  // App Store 3.1.1: company / IČO / DIČ / address (business identifikátory)
  // se v mobile VĚDOMĚ nesbírají — Apple zamítl "registration features for
  // businesses and organizations". Žádný CompanyLookup ani fakturační pole.
  // Pokud user potřebuje vyplnit fakturační údaje (B2B), udělá to na webu na
  // veritra.io/dashboard/settings/billing. Nepřidávej je sem zpět.
  //
  // Country se taky neptáme přímo — derivujeme ho z předvolby telefonu
  // (DialCode.iso). User vybírá +420/+49/+33 v phone fieldu, server dostane
  // ISO code automaticky.

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // OAuth users zatím nemají consent proof — checkboxy se zobrazí jen pokud
  // backend řekne consentRequired=true.
  const [consentRequired, setConsentRequired] = useState(false);
  const [consentVop, setConsentVop] = useState(false);
  const [consentGdpr, setConsentGdpr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await endpoints.getProfileV2();
        if (cancelled) return;
        // ŽÁDNÝ auto-skip — profile je první krok onboardingu (osobní kontaktní
        // údaje), takže ho chceme ukázat i uživateli s vyplněným jménem.
        // RouterGuard sem pošle jen nové usery (bez aktivní LEADS sub).
        setEmail(p.email);
        setName(p.name ?? "");
        // Dial code preferuj ze server-side country pokud uložená (matchni
        // ISO → DialCode), jinak split z phone, jinak default per locale.
        const dialFromCountry = p.country
          ? DIAL_CODES.find((d) => d.iso === p.country)?.code ?? null
          : null;
        const { dial, local } = splitPhone(p.phone, dialFromCountry ?? defaultDialCodeForLocale(locale));
        setDialCode(dial);
        setPhoneLocal(local);
        setConsentRequired(!!p.consentRequired);
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
    // Country derived z dial code (předvolby). Fallback CZ kdyby DIAL_CODES
    // matchnutí selhalo (custom dial code mimo katalog by neměl projít UI).
    const derivedCountry = DIAL_CODES.find((d) => d.code === dialCode)?.iso ?? "CZ";

    // Žádné business fields (firma/IČO/DIČ/adresa) — Apple 3.1.1 zakazuje
    // mobile "registration features for businesses and organizations". User je
    // vyplní na webu (veritra.io/dashboard/settings/billing) pokud chce B2B
    // billing. Mobile profile = osobní kontaktní údaje.
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      setEmailError(t("onboardingProfile", "emailInvalid"));
      setError(t("onboardingProfile", "emailInvalid"));
      return;
    }
    if (consentRequired && (!consentVop || !consentGdpr)) {
      setError(t("onboardingProfile", "consentRequiredError"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: Parameters<typeof endpoints.updateProfileV2>[0] = {
        name: trimmedName,
        country: derivedCountry,
        // Zvolený jazyk → user.locale, aby e-maily (proforma atd.) chodily ve
        // správné řeči. Bez tohoto by zůstal registrační jazyk.
        locale,
      };
      const phoneDigits = phoneLocal.replace(/\D/g, "");
      if (phoneDigits) input.phone = `${dialCode} ${phoneDigits}`;
      if (consentRequired) {
        input.consentVop = consentVop;
        input.consentGdpr = consentGdpr;
      }
      await endpoints.updateProfileV2(input);
      // Invalidate profileQuery cache aby countries.tsx pre-flight check
      // viděl čerstvý stav (jinak by mu staleTime 5 min ukázal starý
      // profile=incomplete a redirectoval by zpět na profile → smyčka).
      await qc.invalidateQueries({ queryKey: ["profile-v2"] });
      // Profile complete → countries picker (router guard pak rozhodne)
      router.replace("/(onboarding)/countries");
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
          <View style={styles.topBar}>
            <LocaleSwitcher />
          </View>
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
            <Text style={styles.label}>{t("onboardingProfile", "phoneLabel")}</Text>
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

          {consentRequired && (
            <View style={styles.consentSection}>
              <Text style={styles.consentIntro}>{t("onboardingProfile", "consentIntro")}</Text>
              <Pressable
                onPress={() => setConsentVop((v) => !v)}
                style={styles.consentRow}
              >
                <View style={[styles.checkbox, consentVop && styles.checkboxOn]}>
                  {consentVop && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.consentLabel}>{t("onboardingProfile", "consentVopLabel")}</Text>
              </Pressable>
              <Pressable
                onPress={() => setConsentGdpr((v) => !v)}
                style={styles.consentRow}
              >
                <View style={[styles.checkbox, consentGdpr && styles.checkboxOn]}>
                  {consentGdpr && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.consentLabel}>{t("onboardingProfile", "consentGdprLabel")}</Text>
              </Pressable>
            </View>
          )}

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
    content: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
    topBar: { flexDirection: "row", justifyContent: "flex-end", marginBottom: spacing.sm },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: c.text, marginBottom: spacing.sm },
    subtitle: { fontSize: fontSize.sm, color: c.textMuted, marginBottom: spacing.xl, lineHeight: 20 },
    field: { marginBottom: spacing.lg },
    label: { fontSize: fontSize.xs, color: c.textMuted, textTransform: "uppercase", fontWeight: "600", marginBottom: spacing.sm },
    input: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.base,
      color: c.text,
    },
    inputError: { borderColor: c.danger },
    fieldError: { fontSize: fontSize.xs, color: c.danger, marginTop: spacing.xs },
    fieldHint: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: spacing.xs },
    icoCompany: { fontSize: fontSize.xs, color: c.success, marginTop: spacing.xs, fontWeight: "500" },
    phoneRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    dialCodeWrap: { minWidth: 100 },
    errorText: { fontSize: fontSize.sm, color: c.danger, marginBottom: spacing.md, textAlign: "center" },
    ctaBtn: { backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.md },
    ctaBtnText: { color: c.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    consentSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.border, gap: spacing.sm },
    consentIntro: { fontSize: fontSize.xs, color: c.textMuted, marginBottom: spacing.xs },
    consentRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card, marginTop: 2, alignItems: "center", justifyContent: "center" },
    checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
    checkboxMark: { color: c.accentForeground, fontSize: 14, fontWeight: "700" },
    consentLabel: { flex: 1, fontSize: fontSize.xs, color: c.text, lineHeight: 16 },
  });
}
