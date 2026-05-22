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
import { endpoints } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Profile completion screen — pro nového usera po prvním aktivovaném trialu
 * (countries → profile → tabs flow). Doplňuje kontaktní + fakturační údaje.
 *
 * Pole:
 *   - name (povinné)
 *   - email (read-only, prefilled z User row)
 *   - phone (nepovinné)
 *   - country (povinné, určuje currency)
 *   - company (nepovinné, CompanyLookupField volá ARES/RPO/VIES dle zvolené země
 *     a po výběru doplní IČO/název/adresu/DIČ)
 *
 * Routing: po Continue → /(tabs). Pokud user už profile complete (vrátil se),
 * router.replace skip rovnou na /(tabs).
 */
export default function OnboardingProfile() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("CZ");
  // Company lookup — taxId+name+address+dic se vyplní automaticky po výběru
  // z CompanyLookupField; user může taky nechat prázdné (nepovinné).
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
        // Pokud user už profile complete → skip rovnou na tabs (returning user)
        if (p.name && p.country) {
          router.replace("/(tabs)");
          return;
        }
        setEmail(p.email);
        setName(p.name ?? "");
        setPhone(p.phone ?? "");
        if (p.country) setCountry(p.country);
        setCompanyName(p.company ?? "");
        setCompanyIco(p.ico ?? "");
        setCompanyAddress(p.address ?? "");
        setCompanyDic(p.dic ?? "");
        // Pokud user už nějaká data má (návrat na obrazovku), preferuj manual
        // mode — lookup field by se snažil přepsat ručně zadané hodnoty.
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
  }, [router]);

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
    setSaving(true);
    setError(null);
    try {
      const input: Parameters<typeof endpoints.updateProfileV2>[0] = {
        name: trimmedName,
        country,
      };
      const trimmedPhone = phone.trim();
      if (trimmedPhone) input.phone = trimmedPhone;
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
              editable={false}
              style={[styles.input, styles.inputReadonly]}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{t("onboardingProfile", "phoneLabel")}</Text>
              <Text style={styles.labelOptional}>{t("onboardingProfile", "phoneOptional")}</Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t("onboardingProfile", "phonePlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              keyboardType="phone-pad"
              autoCorrect={false}
              maxLength={32}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("onboardingProfile", "countryLabel")}</Text>
            <CountryPicker value={country} onChange={setCountry} />
            <Text style={styles.hint}>{t("onboardingProfile", "countryHint")}</Text>
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
              <View style={styles.manualBlock}>
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
            <Pressable
              onPress={() => setManualEntry((v) => !v)}
              style={styles.manualToggle}
            >
              <View style={[styles.manualCheckbox, manualEntry && styles.manualCheckboxOn]}>
                {manualEntry && <Text style={styles.manualCheckboxMark}>✓</Text>}
              </View>
              <Text style={styles.manualToggleText}>{t("onboardingProfile", "companyManualToggle")}</Text>
            </Pressable>
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
    labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing.xs },
    label: { fontSize: fontSize.xs, color: c.textMuted, textTransform: "uppercase", fontWeight: "600" },
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
    inputReadonly: { backgroundColor: c.bg, color: c.textMuted },
    hint: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: spacing.xs, lineHeight: 16 },
    manualBlock: { gap: 0 },
    manualToggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, paddingVertical: spacing.xs },
    manualCheckbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    manualCheckboxOn: { backgroundColor: c.accent, borderColor: c.accent },
    manualCheckboxMark: { color: c.accentForeground, fontSize: 11, fontWeight: "700" },
    manualToggleText: { fontSize: fontSize.sm, color: c.textMuted },
    errorText: { fontSize: fontSize.sm, color: c.danger, marginBottom: spacing.md, textAlign: "center" },
    ctaBtn: { backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.md },
    ctaBtnText: { color: c.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
  });
}
