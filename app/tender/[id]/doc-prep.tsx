import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import {
  endpoints,
  type Currency,
  type DocClassification,
  type DocPrepState,
  type DocPrepStreamEvent,
} from "@/lib/endpoints";
import { ssePost } from "@/lib/sse";
import { openAuthedFile } from "@/lib/file-open";
import { AUTH_BASE_URL } from "@/lib/config";

export default function TenderDocPrepScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const tenderId = Number(id);
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<DocPrepState | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [qualMode, setQualMode] = useState<"gcp" | "own">("gcp");
  const [priceMode, setPriceMode] = useState<"amount" | "placeholder">("placeholder");
  const [priceText, setPriceText] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = async () => {
    const { data } = await endpoints.docPrepGet(tenderId);
    setState(data);
    return data;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await reload();
      } catch (e) {
        if (alive) Alert.alert(t("docPrep", "errorTitle"), e instanceof Error ? e.message : "");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [tenderId]);

  async function analyze() {
    if (analyzing) return;
    setAnalyzing(true);
    setPhase(null);
    try {
      await ssePost<DocPrepStreamEvent>(
        `/api/v2/leads/tenders/${tenderId}/doc-prep`,
        { new: false },
        (evt) => {
          if (evt.type === "status") setPhase(evt.detail || evt.name || evt.phase);
          else if (evt.type === "done") setState((s) => (s ? { ...s, docPrep: evt.docPrep } : s));
          else if (evt.type === "error") Alert.alert(t("docPrep", "errorTitle"), evt.message);
        },
      );
      await reload();
    } catch (e) {
      Alert.alert(t("docPrep", "errorTitle"), e instanceof Error ? e.message : "");
    } finally {
      setAnalyzing(false);
      setPhase(null);
    }
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const d = await reload();
        if (d.docPrep && (d.docPrep.status === "DONE" || d.docPrep.status === "FAILED")) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setGenerating(false);
        }
      } catch {
        /* keep polling */
      }
    }, 5000);
  }

  async function generate() {
    if (generating) return;
    setGenerating(true);
    try {
      const priceNoVat = priceMode === "amount" ? Number(priceText.replace(/[^\d.]/g, "")) : undefined;
      const { data } = await endpoints.docPrepGenerate(tenderId, {
        priceMode,
        priceNoVat: priceNoVat && priceNoVat > 0 ? priceNoVat : undefined,
        qualificationMode: qualMode,
      });
      setState((s) => (s ? { ...s, docPrep: data.docPrep, balance: data.balance } : s));
      if (data.docPrep.status === "DONE") {
        setGenerating(false);
      } else {
        startPolling();
      }
    } catch (e) {
      setGenerating(false);
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("kredit") || msg.toLowerCase().includes("credit") || msg.includes("402")) {
        Alert.alert(t("docPrep", "insufficientTitle"), t("docPrep", "insufficientBody"));
      } else {
        Alert.alert(t("docPrep", "errorTitle"), msg);
      }
    }
  }

  const screenOpts = {
    title: t("docPrep", "title"),
    headerShown: true,
    headerBackTitle: t("matchDetail", "back"),
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.text,
  } as const;

  const classLabel = (c: DocClassification): string =>
    c === "GENERATE_OWN"
      ? t("docPrep", "classGenerate")
      : c === "FILL_VENDOR"
        ? t("docPrep", "classFill")
        : c === "USER_UPLOAD"
          ? t("docPrep", "classUpload")
          : t("docPrep", "classExtra");

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <Stack.Screen options={screenOpts} />
        <View style={styles.center}><ActivityIndicator color={colors.textSubtle} /></View>
      </SafeAreaView>
    );
  }

  if (state && !state.hasDocuments) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <Stack.Screen options={screenOpts} />
        <View style={styles.center}><Text style={styles.gateBody}>{t("docPrep", "noDocs")}</Text></View>
      </SafeAreaView>
    );
  }

  if (state && !state.identity.complete) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <Stack.Screen options={screenOpts} />
        <View style={styles.center}>
          <Text style={styles.gateTitle}>{t("docPrep", "identityRequiredTitle")}</Text>
          <Text style={styles.gateBody}>{t("docPrep", "identityRequiredBody")}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => WebBrowser.openBrowserAsync(`${AUTH_BASE_URL}/dashboard/settings?tab=ai`)}>
            <Text style={styles.primaryBtnText}>{t("docPrep", "identityRequiredCta")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const dp = state?.docPrep ?? null;
  const plan = dp?.plan ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={screenOpts} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {title ? <Text style={styles.tenderTitle} numberOfLines={2}>{title}</Text> : null}
        <Text style={styles.balanceLine}>
          {dp?.freeTier ? t("docPrep", "firstFree") : t("docPrep", "balance", { amount: String(state?.balance ?? 0), currency: (state?.currency ?? "CZK") as Currency })}
        </Text>

        {!plan ? (
          <View style={styles.block}>
            <Text style={styles.hint}>{t("docPrep", "analyzeHint")}</Text>
            <Pressable style={[styles.primaryBtn, analyzing && { opacity: 0.6 }]} disabled={analyzing} onPress={analyze}>
              {analyzing ? (
                <View style={styles.rowCenter}>
                  <ActivityIndicator size="small" color={colors.accentForeground} />
                  <Text style={[styles.primaryBtnText, { marginLeft: spacing.sm }]}>{phase || t("docPrep", "analyzing")}</Text>
                </View>
              ) : (
                <Text style={styles.primaryBtnText}>{t("docPrep", "analyzeBtn")}</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <>
            {plan.summary ? <Text style={styles.summary}>{plan.summary}</Text> : null}
            <View style={styles.metaWrap}>
              {plan.deadline ? <MetaLine styles={styles} label={t("docPrep", "deadline")} value={plan.deadline} /> : null}
              {plan.submissionMethod ? <MetaLine styles={styles} label={t("docPrep", "submission")} value={plan.submissionMethod} /> : null}
              {plan.signatureMode ? <MetaLine styles={styles} label={t("docPrep", "signature")} value={plan.signatureMode} /> : null}
              {plan.vatRegime ? <MetaLine styles={styles} label={t("docPrep", "vat")} value={plan.vatRegime} /> : null}
            </View>

            <Text style={styles.sectionLabel}>{t("docPrep", "docsLabel")}</Text>
            {plan.requiredDocs.map((d, i) => (
              <View key={i} style={styles.docCard}>
                <Text style={styles.docName}>{d.name}</Text>
                <Text style={styles.docClass}>{classLabel(d.classification)}{d.mandatory ? " · *" : ""}</Text>
                {d.note ? <Text style={styles.docNote}>{d.note}</Text> : null}
                {d.classification === "USER_UPLOAD" ? <Text style={styles.uploadNote}>{t("docPrep", "uploadOnWeb")}</Text> : null}
              </View>
            ))}

            {plan.warnings?.length ? (
              <View style={styles.warnBox}>
                <Text style={styles.warnLabel}>{t("docPrep", "warnings")}</Text>
                {plan.warnings.map((w, i) => <Text key={i} style={styles.warnText}>• {w}</Text>)}
              </View>
            ) : null}

            {/* Kvalifikace */}
            <Text style={styles.sectionLabel}>{t("docPrep", "qualificationLabel")}</Text>
            <View style={styles.toggleRow}>
              <Toggle styles={styles} active={qualMode === "gcp"} label={t("docPrep", "qualGcp")} onPress={() => setQualMode("gcp")} />
              <Toggle styles={styles} active={qualMode === "own"} label={t("docPrep", "qualOwn")} onPress={() => setQualMode("own")} />
            </View>

            {/* Cena */}
            <Text style={styles.sectionLabel}>{t("docPrep", "priceLabel")}</Text>
            <View style={styles.toggleRow}>
              <Toggle styles={styles} active={priceMode === "amount"} label={t("docPrep", "priceAmount")} onPress={() => setPriceMode("amount")} />
              <Toggle styles={styles} active={priceMode === "placeholder"} label={t("docPrep", "pricePlaceholder")} onPress={() => setPriceMode("placeholder")} />
            </View>
            {priceMode === "amount" ? (
              <TextInput
                style={styles.priceInput}
                value={priceText}
                onChangeText={setPriceText}
                keyboardType="numeric"
                placeholder={t("docPrep", "priceInputPlaceholder")}
                placeholderTextColor={colors.textFaint}
              />
            ) : null}

            <Pressable style={[styles.primaryBtn, generating && { opacity: 0.6 }]} disabled={generating} onPress={generate}>
              {generating ? (
                <View style={styles.rowCenter}>
                  <ActivityIndicator size="small" color={colors.accentForeground} />
                  <Text style={[styles.primaryBtnText, { marginLeft: spacing.sm }]}>{t("docPrep", "generating")}</Text>
                </View>
              ) : (
                <Text style={styles.primaryBtnText}>{t("docPrep", "generateBtn")}</Text>
              )}
            </Pressable>

            {/* Výsledné soubory */}
            {dp?.result?.files?.length ? (
              <View style={styles.block}>
                <Text style={styles.sectionLabel}>{t("docPrep", "filesLabel")}</Text>
                {dp.result.files.map((f, i) => (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [styles.fileRow, pressed && { opacity: 0.7 }]}
                    onPress={() => openAuthedFile(`/api/v2/leads/tenders/${tenderId}/doc-prep/file?key=${encodeURIComponent(f.key)}`, f.name.replace(/\s+/g, "_"))}
                  >
                    <Text style={styles.fileName}>{f.name}</Text>
                    <Text style={styles.download}>{t("docPrep", "download")}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {dp?.result?.pending?.length ? (
              <Text style={styles.pending}>{t("docPrep", "pending")}: {dp.result.pending.map((p) => p.name).join(", ")}</Text>
            ) : null}
          </>
        )}

        {state && state.balance <= 0 && !dp?.freeTier ? (
          <Pressable onPress={() => WebBrowser.openBrowserAsync(`${AUTH_BASE_URL}/dashboard/settings?tab=ai`)}>
            <Text style={styles.topUpLink}>{t("docPrep", "topUpWeb")}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaLine({ styles, label, value }: { styles: ReturnType<typeof makeStyles>; label: string; value: string }) {
  return (
    <View style={styles.metaLine}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Toggle({ styles, active, label, onPress }: { styles: ReturnType<typeof makeStyles>; active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, active && styles.toggleActive]}>
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    gateTitle: { fontSize: fontSize.lg, fontWeight: "700", color: c.text, marginBottom: spacing.sm, textAlign: "center" },
    gateBody: { fontSize: fontSize.sm, color: c.textSubtle, textAlign: "center", marginBottom: spacing.xl, lineHeight: 20 },
    primaryBtn: { backgroundColor: c.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.md },
    primaryBtnText: { color: c.accentForeground, fontWeight: "600", fontSize: fontSize.sm },
    rowCenter: { flexDirection: "row", alignItems: "center" },
    tenderTitle: { fontSize: fontSize.sm, fontWeight: "600", color: c.text },
    balanceLine: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: spacing.xs, marginBottom: spacing.md },
    block: { marginTop: spacing.md },
    hint: { fontSize: fontSize.sm, color: c.textSubtle, lineHeight: 20, marginBottom: spacing.sm },
    summary: { fontSize: fontSize.sm, color: c.text, lineHeight: 20, marginBottom: spacing.md },
    metaWrap: { gap: spacing.xs, marginBottom: spacing.md },
    metaLine: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
    metaLabel: { fontSize: fontSize.xs, color: c.textSubtle, fontWeight: "500" },
    metaValue: { fontSize: fontSize.xs, color: c.text, flexShrink: 1, textAlign: "right" },
    sectionLabel: { fontSize: fontSize.xs, color: c.textSubtle, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
    docCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
    docName: { fontSize: fontSize.sm, color: c.text, fontWeight: "600" },
    docClass: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: 2 },
    docNote: { fontSize: fontSize.xs, color: c.textMuted, marginTop: spacing.xs, lineHeight: 18 },
    uploadNote: { fontSize: fontSize.xs, color: c.link, marginTop: spacing.xs },
    warnBox: { backgroundColor: c.warningBg, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
    warnLabel: { fontSize: fontSize.xs, color: c.warning, fontWeight: "700", marginBottom: spacing.xs, textTransform: "uppercase" },
    warnText: { fontSize: fontSize.xs, color: c.text, lineHeight: 18 },
    toggleRow: { flexDirection: "row", gap: spacing.sm },
    toggle: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: "center", backgroundColor: c.card },
    toggleActive: { borderColor: c.accent, backgroundColor: c.accent },
    toggleText: { fontSize: fontSize.xs, color: c.text, fontWeight: "600" },
    toggleTextActive: { color: c.accentForeground },
    priceInput: { marginTop: spacing.sm, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.sm, color: c.text },
    fileRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
    fileName: { flex: 1, fontSize: fontSize.sm, color: c.text },
    download: { fontSize: fontSize.xs, color: c.link, fontWeight: "600", marginLeft: spacing.md },
    pending: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: spacing.sm, fontStyle: "italic" },
    topUpLink: { color: c.link, fontSize: fontSize.xs, textAlign: "center", marginTop: spacing.lg, textDecorationLine: "underline" },
  });
