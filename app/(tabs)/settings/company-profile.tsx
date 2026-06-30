import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { endpoints, type CompanyProfileView } from "@/lib/endpoints";
import { AUTH_BASE_URL } from "@/lib/config";

export default function CompanyProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CompanyProfileView | null>(null);
  const [md, setMd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await endpoints.companyProfileGet();
        if (!alive) return;
        setView(data);
        setMd(data.companyMd ?? "");
      } catch (e) {
        if (alive) Alert.alert(t("companyProfile", "errorTitle"), e instanceof Error ? e.message : "");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    try {
      const { data } = await endpoints.companyProfileBuild();
      setView(data);
      setMd(data.companyMd ?? "");
    } catch (e) {
      Alert.alert(t("companyProfile", "errorTitle"), e instanceof Error ? e.message : "");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (saving || !md.trim()) return;
    setSaving(true);
    try {
      const { data } = await endpoints.companyProfileSaveMd(md.trim());
      setView(data);
      Alert.alert(t("companyProfile", "savedTitle"), t("companyProfile", "savedBody"));
    } catch (e) {
      Alert.alert(t("companyProfile", "errorTitle"), e instanceof Error ? e.message : "");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.center}><ActivityIndicator color={colors.textSubtle} /></View>
      </SafeAreaView>
    );
  }

  if (!view?.ico) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.center}>
          <Text style={styles.gateTitle}>{t("companyProfile", "noIcoTitle")}</Text>
          <Text style={styles.gateBody}>{t("companyProfile", "noIcoBody")}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push("/(tabs)/settings/billing")}>
            <Text style={styles.primaryBtnText}>{t("companyProfile", "noIcoCta")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>{t("companyProfile", "intro")}</Text>

        <Pressable style={[styles.secondaryBtn, generating && { opacity: 0.6 }]} disabled={generating} onPress={generate}>
          {generating ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.secondaryBtnText}>{view.companyMd ? t("companyProfile", "regenerate") : t("companyProfile", "generateBtn")}</Text>
          )}
        </Pressable>
        <Text style={styles.hint}>{t("companyProfile", "generateHint")}</Text>

        <Text style={styles.sectionLabel}>{t("companyProfile", "mdLabel")}</Text>
        <TextInput
          style={styles.mdInput}
          value={md}
          onChangeText={setMd}
          placeholder={t("companyProfile", "mdPlaceholder")}
          placeholderTextColor={colors.textFaint}
          multiline
          textAlignVertical="top"
        />

        <Pressable style={[styles.primaryBtn, (saving || !md.trim()) && { opacity: 0.5 }]} disabled={saving || !md.trim()} onPress={save}>
          {saving ? <ActivityIndicator size="small" color={colors.accentForeground} /> : <Text style={styles.primaryBtnText}>{t("companyProfile", "saveBtn")}</Text>}
        </Pressable>

        <Pressable onPress={() => WebBrowser.openBrowserAsync(`${AUTH_BASE_URL}/dashboard/settings?tab=ai`)}>
          <Text style={styles.webLink}>{t("companyProfile", "advancedWeb")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    gateTitle: { fontSize: fontSize.lg, fontWeight: "700", color: c.text, marginBottom: spacing.sm, textAlign: "center" },
    gateBody: { fontSize: fontSize.sm, color: c.textSubtle, textAlign: "center", marginBottom: spacing.xl, lineHeight: 20 },
    intro: { fontSize: fontSize.sm, color: c.textSubtle, lineHeight: 20, marginBottom: spacing.md },
    secondaryBtn: { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: "center", backgroundColor: c.card },
    secondaryBtnText: { fontSize: fontSize.sm, color: c.text, fontWeight: "600" },
    hint: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: spacing.xs, lineHeight: 16 },
    sectionLabel: { fontSize: fontSize.xs, color: c.textSubtle, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.xs },
    mdInput: { minHeight: 240, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.sm, color: c.text, lineHeight: 20 },
    primaryBtn: { backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.lg },
    primaryBtnText: { color: c.accentForeground, fontWeight: "600", fontSize: fontSize.sm },
    webLink: { color: c.link, fontSize: fontSize.xs, textAlign: "center", marginTop: spacing.lg, textDecorationLine: "underline" },
  });
