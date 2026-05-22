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
import { endpoints } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * OAuth completion screen — pro usery co se přihlásili přes Apple/Google/GitHub
 * a nemají dořešený profil (typicky chybí country pro currency).
 *
 * Routing: RouterGuard → pokud profile.name nebo profile.country chybí → sem.
 * Po submit → /(onboarding)/countries.
 */
export default function OnboardingProfile() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("CZ");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await endpoints.getProfileV2();
        if (cancelled) return;
        setName(p.name ?? "");
        if (p.country) setCountry(p.country);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      await endpoints.updateProfileV2({ name: trimmedName, country });
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
            <Text style={styles.label}>{t("onboardingProfile", "countryLabel")}</Text>
            <CountryPicker value={country} onChange={setCountry} />
            <Text style={styles.hint}>{t("onboardingProfile", "countryHint")}</Text>
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
    content: { padding: spacing.lg, paddingTop: spacing.xl },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: c.text, marginBottom: spacing.sm },
    subtitle: { fontSize: fontSize.sm, color: c.textMuted, marginBottom: spacing.xl, lineHeight: 20 },
    field: { marginBottom: spacing.lg },
    label: { fontSize: fontSize.xs, color: c.textMuted, marginBottom: spacing.xs, textTransform: "uppercase", fontWeight: "600" },
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
    hint: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: spacing.xs },
    errorText: { fontSize: fontSize.sm, color: c.danger, marginBottom: spacing.md, textAlign: "center" },
    ctaBtn: { backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.md },
    ctaBtnText: { color: c.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
  });
}
