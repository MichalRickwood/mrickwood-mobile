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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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

// Skrytá úvodní zpráva, která analýzu spustí hned po otevření (nezobrazuje se).
const KICKOFF =
  "Proveď rozbor této zakázky: shrň předmět a klíčové podmínky; vypiš, co zakázka vyžaduje (kvalifikace, autorizace, jistota, prohlídka, harmonogram, technická specifikace, lhůty) formou „vyžaduje X — ověřte/máte?\"; vhodnost posuď jen podle dostupných informací (BEZ tvrdého verdiktu a NEpředpokládej, že naše firma něco nemá); na konci mi polož konkrétní doplňující otázky.";

export default function TenderAnalysisScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const tenderId = Number(id);
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
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
  // Auto-scroll jen když je uživatel u dna; když odscrolluje nahoru, necháme ho číst.
  const stickToBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

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
        // Auto-spuštění: když je profil hotový a ještě nic neproběhlo, spustíme
        // analýzu rovnou (skrytá kickoff zpráva) — uživatel nemusí nic psát.
        const hasMsgs = (data.session?.messages?.length ?? 0) > 0;
        if (data.hasCompanyProfile && !hasMsgs) {
          void runTurn(KICKOFF, data.session?.id ?? null);
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
  // Scrollnout na konec jen když je uživatel u dna (jinak ho neruš při čtení).
  const maybeScrollEnd = () => { if (stickToBottomRef.current) scrollEnd(); };
  const onScroll = (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distance = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const near = distance < 80;
    stickToBottomRef.current = near;
    setAtBottom(near);
  };
  const jumpToEnd = () => { stickToBottomRef.current = true; setAtBottom(true); scrollEnd(); };

  // Jeden tah konverzace. `sid` umožní předat aktuální sessionId i když ho stav
  // ještě nestihl zapsat (auto-start hned po loadu).
  async function runTurn(text: string, sid?: string | null) {
    if (!text || sending) return;
    setSending(true);
    const turnKey = Crypto.randomUUID();
    const userMsg: Msg = { id: turnKey, role: "user", content: text, createdAt: new Date().toISOString() };
    const asstId = `a-${turnKey}`;
    setMessages((m) => [...m, userMsg, { id: asstId, role: "assistant", content: "", createdAt: "", streaming: true }]);
    // Nový tah uživatele → vrať ho k dnu, ať vidí svou zprávu i začátek odpovědi.
    stickToBottomRef.current = true;
    setAtBottom(true);
    scrollEnd();
    try {
      await ssePost<AnalysisStreamEvent>(
        `/api/v2/leads/tenders/${tenderId}/analysis`,
        { turnKey, message: text, sessionId: sid ?? sessionId ?? undefined, locale },
        (evt) => {
          if (evt.type === "delta") {
            setMessages((m) => m.map((x) => (x.id === asstId ? { ...x, content: x.content + evt.text } : x)));
            maybeScrollEnd();
          } else if (evt.type === "done") {
            setMessages((m) => m.map((x) => (x.id === asstId ? { ...x, streaming: false } : x)));
            if (evt.sessionId) setSessionId(evt.sessionId);
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
      maybeScrollEnd();
    }
  }

  function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    void runTurn(text);
  }

  async function generateReport() {
    if (reporting) return;
    setReporting(true);
    try {
      const { data } = await endpoints.analysisReport(tenderId, locale);
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
          <Pressable style={styles.primaryBtn} onPress={() => router.push("/(tabs)/settings/company-profile")}>
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
          data={messages.filter((m) => !(m.role === "user" && m.content === KICKOFF))}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={<Text style={styles.emptyHint}>{t("aiAnalysis", "analyzing")}</Text>}
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
        {!atBottom && messages.length > 0 && (
          <Pressable style={styles.jumpBtn} onPress={jumpToEnd} accessibilityLabel={t("aiAnalysis", "jumpToLatest")}>
            <Text style={styles.jumpBtnText}>↓</Text>
          </Pressable>
        )}
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
    jumpBtn: { position: "absolute", right: spacing.lg, bottom: 76, width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
    jumpBtnText: { color: c.accentForeground, fontSize: 20, fontWeight: "700", lineHeight: 22 },
    reportBtn: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: c.accent, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
    reportBtnText: { color: c.accentForeground, fontWeight: "600", fontSize: fontSize.sm },
    inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
    input: { flex: 1, maxHeight: 120, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.sm, color: c.text },
    sendBtn: { backgroundColor: c.accent, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    sendBtnText: { color: c.accentForeground, fontWeight: "600", fontSize: fontSize.sm },
    topUpLink: { color: c.link, fontSize: fontSize.xs, textAlign: "center", paddingBottom: spacing.sm, textDecorationLine: "underline" },
  });
