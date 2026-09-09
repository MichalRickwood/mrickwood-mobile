import { useMemo, useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-deprecated -- core Clipboard je v binárce (OTA-safe); expo-clipboard by chtěl nativní rebuild
import { ActivityIndicator, Alert, Clipboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type InboxDecision, type InboxOffer, type InboxOprava } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { isInboxOwner } from "@/lib/inbox-owner";
import { useTheme } from "@/lib/theme-context";
import { AGENDA_LABEL } from "./index";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export default function AdminInboxDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mailId = String(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [note, setNote] = useState("");
  // Text odpovědi jde před schválením přepsat — schválení ho rovnou odešle,
  // takže poslední slovo má to, co je vidět na obrazovce, ne koncept z triáže.
  const [replyBody, setReplyBody] = useState<string | null>(null);
  const [replySubject, setReplySubject] = useState<string | null>(null);
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["admin-inbox-one", mailId],
    queryFn: ({ signal }) => adminApi.getInboxMail(mailId, signal),
  });
  const mail = query.data;
  const proposal = mail?.proposals[0];
  const content = proposal?.content;

  const decide = useMutation({
    mutationFn: (status: InboxDecision) =>
      adminApi.decideInboxProposal(mailId, {
        ...(status === "APPROVED" && replyBody != null ? { replyBody } : {}),
        ...(status === "APPROVED" && replySubject != null ? { replySubject } : {}),
        proposalId: proposal!.id,
        status,
        ...(note.trim() ? { decisionNote: note.trim() } : {}),
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["admin-inbox"] });
      void qc.invalidateQueries({ queryKey: ["admin-inbox-one", mailId] });
      // Odeslání může selhat i po zapsaném rozhodnutí (Resend, chybějící text).
      // Tichý návrat zpět by vypadal jako úspěch, proto se chyba ukáže a zůstane se na detailu.
      const r = res?.reply;
      if (r && !r.sent && (r.error || r.reason)) {
        Alert.alert(t("admin", "inboxReplyFailed"), r.error ?? r.reason ?? "");
        return;
      }
      if (r?.sent) Alert.alert(t("admin", "inboxReplySent"), r.to ?? "");
      router.back();
    },
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });

  function copyPrikaz(prikaz: string) {
    Clipboard.setString(prikaz);
    Alert.alert(t("admin", "inboxCopied"));
  }

  function copyReply() {
    if (!content?.suggestedReply) return;
    Clipboard.setString(replyBody ?? content.suggestedReply.body);
    Alert.alert(t("admin", "inboxCopied"));
  }

  if (!isInboxOwner(user)) return <Redirect href="/(tabs)/admin" />;

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      </SafeAreaView>
    );
  }
  if (!mail || !content) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.muted}>{t("admin", "errorBody")}</Text>
      </SafeAreaView>
    );
  }

  const decided = proposal!.status !== "NEW" && proposal!.status !== "NOTIFIED";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <AppScrollView contentContainerStyle={styles.body}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ {t("admin", "back")}</Text>
        </Pressable>

        <View style={styles.headRow}>
          <Text style={styles.badge}>{AGENDA_LABEL[content.agenda] ?? content.agenda}</Text>
          <Text style={styles.action}>{content.proposedAction}</Text>
          {content.urgency === "high" && <Text style={styles.urgent}>⚠️</Text>}
        </View>
        <Text style={styles.subject}>{mail.subject}</Text>
        <Text style={styles.from}>
          {t("admin", "inboxFrom")}: {mail.fromName || mail.fromEmail}
        </Text>

        <Text style={styles.label}>{t("admin", "inboxSummary")}</Text>
        <Text style={styles.text}>{content.summary}</Text>

        {!!content.deadline && (
          <>
            <Text style={styles.label}>{t("admin", "inboxDeadline")}</Text>
            <Text style={styles.text}>{content.deadline}</Text>
          </>
        )}

        {content.reasons.length > 0 && (
          <>
            <Text style={styles.label}>{t("admin", "inboxReasons")}</Text>
            {content.reasons.map((r, i) => (
              <Text key={i} style={styles.bullet}>• {r}</Text>
            ))}
          </>
        )}

        {!!content.offers?.length && (
          <>
            <Text style={styles.label}>{t("admin", "inboxOffers")}</Text>
            {content.offers.map((o: InboxOffer, i: number) => (
              <View key={i} style={styles.offer}>
                <Text style={styles.offerName}>{o.supplier}</Text>
                {!!o.price && <Text style={styles.offerPrice}>{o.price}</Text>}
                {!!o.priceNote && <Text style={styles.offerMeta}>{o.priceNote}</Text>}
                {!!o.deliveryDays && <Text style={styles.offerMeta}>⏱ {o.deliveryDays}</Text>}
                {!!o.validUntil && <Text style={styles.offerMeta}>platí do {o.validUntil}</Text>}
                {!!o.note && <Text style={styles.offerWarn}>{o.note}</Text>}
              </View>
            ))}
          </>
        )}

        {!!content.navrhOpravy?.length && (
          <>
            <Text style={styles.label}>{t("admin", "inboxFix")}</Text>
            {content.navrhOpravy.map((o: InboxOprava, i: number) => (
              <View key={i} style={styles.offer}>
                <Text style={styles.offerName}>{o.co}</Text>
                {!!o.kde && <Text style={styles.offerMeta}>{o.kde}</Text>}
                {!!o.prikaz && (
                  <>
                    <Text style={styles.prikaz}>{o.prikaz}</Text>
                    <Pressable style={styles.copyBtn} onPress={() => copyPrikaz(o.prikaz!)}>
                      <Text style={styles.copyText}>{t("admin", "inboxCopyCommand")}</Text>
                    </Pressable>
                  </>
                )}
                {!!o.dopad && <Text style={styles.offerMeta}>{o.dopad}</Text>}
                {!!o.riziko && <Text style={styles.offerWarn}>{o.riziko}</Text>}
              </View>
            ))}
            <Text style={styles.hint}>{t("admin", "inboxFixHint")}</Text>
          </>
        )}

        {!!content.suggestedReply && (
          <>
            <Text style={styles.label}>{t("admin", "inboxSuggestedReply")}</Text>
            {decided ? (
              <>
                <Text style={styles.replySubject}>{content.suggestedReply.subject}</Text>
                <Text style={styles.text}>{content.suggestedReply.body}</Text>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.replySubjectInput}
                  value={replySubject ?? content.suggestedReply.subject ?? ""}
                  onChangeText={setReplySubject}
                  placeholder={t("admin", "inboxReplySubject")}
                  placeholderTextColor={colors.textSubtle}
                />
                <TextInput
                  style={styles.replyInput}
                  value={replyBody ?? content.suggestedReply.body ?? ""}
                  onChangeText={setReplyBody}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.hint}>{t("admin", "inboxReplyHint")}</Text>
              </>
            )}
            <Pressable style={styles.copyBtn} onPress={copyReply}>
              <Text style={styles.copyText}>{t("admin", "inboxCopyReply")}</Text>
            </Pressable>
          </>
        )}

        {!!mail.textBody && (
          <>
            <Text style={styles.label}>{t("admin", "inboxOriginal")}</Text>
            <Text style={styles.original}>{mail.textBody}</Text>
          </>
        )}

        {decided ? (
          <Text style={styles.decided}>
            ✓ {t("admin", "inboxDecided")}: {proposal!.status}
            {proposal!.decisionNote ? `\n${proposal!.decisionNote}` : ""}
          </Text>
        ) : (
          <>
            <Text style={styles.hint}>
              {content.suggestedReply ? t("admin", "inboxApproveSends") : t("admin", "inboxProposalOnly")}
            </Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder={t("admin", "inboxDecisionNote")}
              placeholderTextColor={colors.textSubtle}
              multiline
            />
            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.btnReject]}
                disabled={decide.isPending}
                onPress={() => decide.mutate("REJECTED")}
              >
                <Text style={styles.btnRejectText}>{t("admin", "inboxReject")}</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                disabled={decide.isPending}
                onPress={() => decide.mutate("APPROVED")}
              >
                <Text style={styles.btnPrimaryText}>{t("admin", "inboxApprove")}</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.btnGhost}
              disabled={decide.isPending}
              onPress={() => decide.mutate("DONE")}
            >
              <Text style={styles.btnGhostText}>{t("admin", "inboxMarkDone")}</Text>
            </Pressable>
          </>
        )}
      </AppScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.xs, paddingBottom: spacing.xl * 2 },
    spinner: { marginTop: spacing.xl },
    muted: { color: c.textSubtle, textAlign: "center", marginTop: spacing.xl },
    back: { color: c.accent, fontSize: fontSize.sm, marginBottom: spacing.sm },
    headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    badge: { fontSize: fontSize.xs, color: c.accent, fontWeight: "700", textTransform: "uppercase" },
    action: { fontSize: fontSize.xs, color: c.textSubtle, fontWeight: "600" },
    urgent: { fontSize: fontSize.xs },
    subject: { fontSize: fontSize.lg, fontWeight: "700", color: c.text, marginTop: spacing.xs },
    from: { fontSize: fontSize.xs, color: c.textSubtle, marginBottom: spacing.sm },
    label: {
      fontSize: fontSize.xs, color: c.textSubtle, fontWeight: "700",
      textTransform: "uppercase", marginTop: spacing.lg, letterSpacing: 0.5,
    },
    text: { fontSize: fontSize.sm, color: c.text, lineHeight: 20 },
    bullet: { fontSize: fontSize.sm, color: c.text, lineHeight: 20 },
    offer: {
      backgroundColor: c.card, borderRadius: radius.sm, padding: spacing.md,
      borderWidth: 1, borderColor: c.border, marginTop: spacing.sm, gap: 2,
    },
    offerName: { fontSize: fontSize.sm, fontWeight: "700", color: c.text },
    offerPrice: { fontSize: fontSize.base, fontWeight: "700", color: c.accent },
    offerMeta: { fontSize: fontSize.xs, color: c.textSubtle },
    offerWarn: { fontSize: fontSize.xs, color: c.text, fontStyle: "italic", marginTop: 2 },
    prikaz: {
      fontSize: fontSize.xs, color: c.text, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      backgroundColor: c.bg, padding: spacing.sm, borderRadius: radius.sm, marginTop: spacing.xs,
    },
    replySubject: { fontSize: fontSize.sm, fontWeight: "700", color: c.text },
    hint: { fontSize: fontSize.xs, color: c.textSubtle, fontStyle: "italic", marginTop: spacing.sm },
    original: {
      fontSize: fontSize.xs, color: c.textSubtle, lineHeight: 18,
      backgroundColor: c.card, padding: spacing.md, borderRadius: radius.sm, marginTop: spacing.xs,
    },
    copyBtn: {
      alignSelf: "flex-start", marginTop: spacing.sm, paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border,
    },
    copyText: { fontSize: fontSize.xs, color: c.text, fontWeight: "600" },
    replyInput: {
      backgroundColor: c.card, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border,
      padding: spacing.md, color: c.text, fontSize: fontSize.sm, minHeight: 180,
      marginBottom: spacing.xs, textAlignVertical: "top",
    },
    replySubjectInput: {
      backgroundColor: c.card, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border,
      padding: spacing.md, color: c.text, fontSize: fontSize.sm, fontWeight: "600",
      marginBottom: spacing.xs,
    },
    input: {
      backgroundColor: c.card, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border,
      padding: spacing.md, color: c.text, fontSize: fontSize.sm, minHeight: 64,
      marginTop: spacing.sm, textAlignVertical: "top",
    },

    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    btn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
    btnPrimary: { backgroundColor: c.accent },
    btnPrimaryText: { color: c.accentForeground, fontWeight: "700", fontSize: fontSize.sm },
    btnReject: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    btnRejectText: { color: c.text, fontWeight: "600", fontSize: fontSize.sm },
    btnGhost: { paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xs },
    btnGhostText: { color: c.textSubtle, fontSize: fontSize.sm, fontWeight: "600" },
    decided: {
      marginTop: spacing.lg, padding: spacing.md, backgroundColor: c.card,
      borderRadius: radius.sm, color: c.textSubtle, fontSize: fontSize.sm,
    },
  });
