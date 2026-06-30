import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { endpoints, type CompanyProfileView } from "@/lib/endpoints";
import { ssePost } from "@/lib/sse";

type BuildEvent = {
  type: "status" | "done" | "error";
  step?: "dump" | "explore";
  month?: string;
  found?: number;
  matchedTotal?: number;
  sample?: string[];
  view?: CompanyProfileView;
  message?: string;
};

export default function CompanyProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CompanyProfileView | null>(null);
  const [md, setMd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<"dump" | "explore" | null>(null);
  const [progress, setProgress] = useState<{ months: number; found: number }>({ months: 0, found: 0 });
  const [log, setLog] = useState<string[]>([]);
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
    if (!view?.ico?.trim()) return; // bez IČO nelze generovat (podmínka)
    setGenerating(true);
    setPhase("dump");
    setProgress({ months: 0, found: 0 });
    setLog([]);
    let errMsg: string | null = null;
    try {
      await ssePost<BuildEvent>("/api/v2/account/company-profile/build", {}, (evt) => {
        if (evt.type === "status") {
          if (evt.step === "dump") {
            setPhase("dump");
            setProgress((p) => ({ months: p.months + 1, found: p.found + (evt.found ?? 0) }));
            // Do logu jen měsíce s nálezem — s názvy smluv. Počítadlo nahoře
            // ukazuje průběh (kolik měsíců projito). Prázdné měsíce nezahlcují log.
            if ((evt.found ?? 0) > 0 && Array.isArray(evt.sample) && evt.sample.length) {
              for (const name of evt.sample) {
                setLog((l) => [...l, `${evt.month} · ${name}`]);
              }
            }
          } else if (evt.step === "explore") {
            setPhase("explore");
          }
        } else if (evt.type === "done" && evt.view) {
          setView(evt.view);
          setMd(evt.view.companyMd ?? "");
        } else if (evt.type === "error") {
          errMsg = evt.message || t("companyProfile", "errorTitle");
        }
      });
      if (errMsg) Alert.alert(t("companyProfile", "errorTitle"), errMsg);
    } catch (e) {
      Alert.alert(t("companyProfile", "errorTitle"), e instanceof Error ? e.message : "");
    } finally {
      setGenerating(false);
      setPhase(null);
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

  if (!view?.ico?.trim()) {
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

        {generating ? (
          <View style={styles.progressBox}>
            <Text style={styles.progressText}>
              {phase === "explore"
                ? t("companyProfile", "analyzing")
                : t("companyProfile", "scanProgress", { months: progress.months, found: progress.found })}
            </Text>
            {log.length > 0 && (
              <View style={styles.logBox}>
                {log.slice(-8).map((l, i) => (
                  <Text key={i} style={styles.logLine} numberOfLines={1}>{l}</Text>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.hint}>{t("companyProfile", "generateHint")}</Text>
        )}

        {/* Editace + uložení až když profil existuje (po vygenerování). Dokud
            není nastavený, ukazujeme jen tlačítko Vygenerovat výše. */}
        {view.companyMd ? (
          <>
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
          </>
        ) : null}
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
    progressBox: { marginTop: spacing.sm, padding: spacing.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md },
    progressText: { fontSize: fontSize.xs, color: c.text, fontWeight: "600" },
    logBox: { marginTop: spacing.sm, gap: 2 },
    logLine: { fontSize: fontSize.xs, color: c.textSubtle, lineHeight: 16 },
    sectionLabel: { fontSize: fontSize.xs, color: c.textSubtle, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.xs },
    mdInput: { minHeight: 240, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.sm, color: c.text, lineHeight: 20 },
    primaryBtn: { backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.lg },
    primaryBtnText: { color: c.accentForeground, fontWeight: "600", fontSize: fontSize.sm },
  });
