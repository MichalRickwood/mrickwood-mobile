import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { endpoints, type AnalysisMessage, type AnalysisStreamEvent, type Currency } from "@/lib/endpoints";
import { ssePost } from "@/lib/sse";
import { openAuthedFile } from "@/lib/file-open";
import { AUTH_BASE_URL } from "@/lib/config";

type Msg = AnalysisMessage & { streaming?: boolean };

export default function TenderAnalysisScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const tenderId = Number(id);
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [freeTier, setFreeTier] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency>("CZK");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await endpoints.analysisGet(tenderId);
        if (!alive) return;
        setHasProfile(data.hasCompanyProfile);
        setBalance(data.balance);
        setCurrency(data.currency);
        if (data.session) {
          setSessionId(data.session.id);
          setFreeTier(data.session.freeTier);
          setMessages(data.session.messages);
        }
      } catch (e) {
        Alert.alert(t("aiAnalysis", "errorTitle"), e instanceof Error ? e.message : "");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tenderId]);

  const scrollEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    const turnKey = Crypto.randomUUID();
    const userMsg: Msg = { id: turnKey, role: "user", content: text, createdAt: new Date().toISOString() };
    const asstId = `a-${turnKey}`;
    setMessages((m) => [...m, userMsg, { id: asstId, role: "assistant", content: "", createdAt: "", streaming: true }]);
    scrollEnd();
    try {
      await ssePost<AnalysisStreamEvent>(
        `/api/v2/leads/tenders/${tenderId}/analysis`,
        { turnKey, message: text, sessionId: sessionId ?? undefined },
        (evt) => {
          if (evt.type === "delta") {
            setMessages((m) => m.map((x) => (x.id === asstId ? { ...x, content: x.content + evt.text } : x)));
            scrollEnd();
          } else if (evt.type === "done") {
            setMessages((m) => m.map((x) => (x.id === asstId ? { ...x, streaming: false } : x)));
            if (typeof evt.balance === "number") setBalance(evt.balance);
            if (evt.currency) setCurrency(evt.currency);
            if (evt.insufficient) {
              Alert.alert(t("aiAnalysis", "insufficientTitle"), t("aiAnalysis", "insufficientBody"));
            }
          } else if (evt.type === "error") {
            Alert.alert(t("aiAnalysis", "errorTitle"), evt.message);
          }
        },
      );
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== asstId));
      Alert.alert(t("aiAnalysis", "errorTitle"), e instanceof Error ? e.message : "");
    } finally {
      setMessages((m) => m.map((x) => (x.id === asstId ? { ...x, streaming: false } : x)));
      setSending(false);
      scrollEnd();
    }
  }

  async function generateReport() {
    if (reporting) return;
    setReporting(true);
    try {
      const { data } = await endpoints.analysisReport(tenderId);
      if (typeof data.balance === "number") setBalance(data.balance);
      if (data.insufficient) {
        Alert.alert(t("aiAnalysis", "insufficientTitle"), t("aiAnalysis", "insufficientBody"));
        return;
      }
      await openAuthedFile(
        `/api/v2/leads/tenders/${tenderId}/analysis/report`,
        `zhodnoceni-zakazky-${tenderId}.pdf`,
        "application/pdf",
      );
    } catch (e) {
      Alert.alert(t("aiAnalysis", "errorTitle"), e instanceof Error ? e.message : "");
    } finally {
      setReporting(false);
    }
  }

  const screenOpts = {
    title: t("aiAnalysis", "title"),
    headerShown: true,
    headerBackTitle: t("matchDetail", "back"),
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.text,
  } as const;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <Stack.Screen options={screenOpts} />
        <View style={styles.center}><ActivityIndicator color={colors.textSubtle} /></View>
      </SafeAreaView>
    );
  }

  if (!hasProfile) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <Stack.Screen options={screenOpts} />
        <View style={styles.center}>
          <Text style={styles.gateTitle}>{t("aiAnalysis", "profileRequiredTitle")}</Text>
          <Text style={styles.gateBody}>{t("aiAnalysis", "profileRequiredBody")}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => WebBrowser.openBrowserAsync(`${AUTH_BASE_URL}/dashboard/settings?tab=ai`)}>
            <Text style={styles.primaryBtnText}>{t("aiAnalysis", "profileRequiredCta")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={screenOpts} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {title ? <Text style={styles.tenderTitle} numberOfLines={2}>{title}</Text> : null}
        <Text style={styles.balanceLine}>
          {freeTier ? t("aiAnalysis", "firstFree") : t("aiAnalysis", "balance", { amount: String(balance ?? 0), currency })}
        </Text>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyHint}>{t("aiAnalysis", "emptyHint")}</Text>}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAsst]}>
              {item.streaming && item.content.length === 0 ? (
                <ActivityIndicator size="small" color={colors.textSubtle} />
              ) : (
                <Text style={item.role === "user" ? styles.bubbleUserText : styles.bubbleAsstText}>{item.content}</Text>
              )}
            </View>
          )}
        />
        {messages.some((m) => m.role === "assistant" && !m.streaming) && (
          <Pressable style={[styles.reportBtn, reporting && { opacity: 0.5 }]} disabled={reporting} onPress={generateReport}>
            {reporting ? (
              <ActivityIndicator size="small" color={colors.accentForeground} />
            ) : (
              <Text style={styles.reportBtnText}>{t("aiAnalysis", "reportBtn")}</Text>
            )}
          </Pressable>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t("aiAnalysis", "inputPlaceholder")}
            placeholderTextColor={colors.textFaint}
            multiline
            editable={!sending}
          />
          <Pressable style={[styles.sendBtn, (sending || !input.trim()) && { opacity: 0.4 }]} disabled={sending || !input.trim()} onPress={send}>
            {sending ? <ActivityIndicator size="small" color={colors.accentForeground} /> : <Text style={styles.sendBtnText}>{t("aiAnalysis", "send")}</Text>}
          </Pressable>
        </View>
        {balance != null && balance <= 0 && !freeTier && (
          <Pressable onPress={() => WebBrowser.openBrowserAsync(`${AUTH_BASE_URL}/dashboard/settings?tab=ai`)}>
            <Text style={styles.topUpLink}>{t("aiAnalysis", "topUpWeb")}</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    gateTitle: { fontSize: fontSize.lg, fontWeight: "700", color: c.text, marginBottom: spacing.sm, textAlign: "center" },
    gateBody: { fontSize: fontSize.sm, color: c.textSubtle, textAlign: "center", marginBottom: spacing.xl, lineHeight: 20 },
    primaryBtn: { backgroundColor: c.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
    primaryBtnText: { color: c.accentForeground, fontWeight: "600", fontSize: fontSize.sm },
    tenderTitle: { fontSize: fontSize.sm, fontWeight: "600", color: c.text, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    balanceLine: { fontSize: fontSize.xs, color: c.textSubtle, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
    list: { padding: spacing.lg, gap: spacing.sm },
    emptyHint: { fontSize: fontSize.sm, color: c.textFaint, textAlign: "center", marginTop: spacing.xxl, paddingHorizontal: spacing.xl, lineHeight: 20 },
    bubble: { maxWidth: "85%", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs },
    bubbleUser: { alignSelf: "flex-end", backgroundColor: c.accent },
    bubbleAsst: { alignSelf: "flex-start", backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    bubbleUserText: { color: c.accentForeground, fontSize: fontSize.sm, lineHeight: 20 },
    bubbleAsstText: { color: c.text, fontSize: fontSize.sm, lineHeight: 20 },
    reportBtn: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
    reportBtnText: { color: c.accentForeground, fontWeight: "600", fontSize: fontSize.sm },
    inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
    input: { flex: 1, maxHeight: 120, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.sm, color: c.text },
    sendBtn: { backgroundColor: c.accent, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    sendBtnText: { color: c.accentForeground, fontWeight: "600", fontSize: fontSize.sm },
    topUpLink: { color: c.link, fontSize: fontSize.xs, textAlign: "center", paddingBottom: spacing.sm, textDecorationLine: "underline" },
  });
