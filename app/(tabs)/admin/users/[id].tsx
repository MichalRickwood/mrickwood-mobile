import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminSubscription } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { openAuthedFile } from "@/lib/file-open";
import { AdminBadge, bandColors } from "@/components/AdminRow";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = String(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [comment, setComment] = useState("");

  // Uživatel — z listu (najdeme v cache) i vlastní fetch fallback.
  const userQuery = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: async ({ signal }) => {
      const list = await adminApi.listUsers("all", signal);
      return list.find((u) => u.id === userId) ?? null;
    },
  });
  const user = userQuery.data;

  const healthQuery = useQuery({ queryKey: ["admin-user-health", userId], queryFn: ({ signal }) => adminApi.getHealth(userId, signal) });
  const activityQuery = useQuery({ queryKey: ["admin-user-activity", userId], queryFn: ({ signal }) => adminApi.getActivity(userId, signal) });
  const invoicesQuery = useQuery({ queryKey: ["admin-user-invoices", userId], queryFn: ({ signal }) => adminApi.getUserInvoices(userId, signal) });
  const commentsQuery = useQuery({ queryKey: ["admin-user-comments", userId], queryFn: ({ signal }) => adminApi.listComments(userId, signal) });

  const invalidateUser = () => {
    void qc.invalidateQueries({ queryKey: ["admin-user", userId] });
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const roleMutation = useMutation({
    mutationFn: (role: "USER" | "ADMIN") => adminApi.updateUser(userId, { role }),
    onSuccess: invalidateUser,
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });
  const pauseMutation = useMutation({
    mutationFn: (v: { keyId: string; paused: boolean }) => adminApi.updateUser(userId, { keyId: v.keyId, paused: v.paused }),
    onSuccess: invalidateUser,
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });
  const deleteUserMutation = useMutation({
    mutationFn: () => adminApi.deleteUser(userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      router.back();
    },
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });
  const addCommentMutation = useMutation({
    mutationFn: (body: string) => adminApi.addComment(userId, body),
    onSuccess: () => {
      setComment("");
      void qc.invalidateQueries({ queryKey: ["admin-user-comments", userId] });
    },
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => adminApi.deleteComment(userId, commentId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-user-comments", userId] }),
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });

  function confirmRole() {
    if (!user) return;
    const next = user.role === "ADMIN" ? "USER" : "ADMIN";
    Alert.alert(t("admin", "changeRoleTitle"), t("admin", "changeRoleMsg"), [
      { text: t("admin", "cancel"), style: "cancel" },
      { text: t("admin", "confirm"), onPress: () => roleMutation.mutate(next) },
    ]);
  }
  function confirmDeleteUser() {
    Alert.alert(t("admin", "deleteUserTitle"), t("admin", "deleteUserMsg"), [
      { text: t("admin", "cancel"), style: "cancel" },
      { text: t("admin", "delete"), style: "destructive", onPress: () => deleteUserMutation.mutate() },
    ]);
  }
  function confirmDeleteComment(commentId: string) {
    Alert.alert(t("admin", "deleteCommentTitle"), t("admin", "deleteCommentMsg"), [
      { text: t("admin", "cancel"), style: "cancel" },
      { text: t("admin", "delete"), style: "destructive", onPress: () => deleteCommentMutation.mutate(commentId) },
    ]);
  }

  function toggleSub(sub: AdminSubscription) {
    // „Pozastaveno" = cancelAtPeriodEnd (SubscriptionState nemá PAUSED). Toggle přepne.
    pauseMutation.mutate({ keyId: sub.id, paused: !sub.cancelAtPeriodEnd });
  }

  if (userQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile */}
        <Section title={t("admin", "secProfile")} styles={styles}>
          <Field label={t("admin", "lblEmail")} value={user?.email ?? "—"} styles={styles} />
          <Field label={t("admin", "lblName")} value={user?.name || "—"} styles={styles} />
          <Field label={t("admin", "lblCompany")} value={user?.company || "—"} styles={styles} />
          <Field label={t("admin", "lblPhone")} value={user?.phone || "—"} styles={styles} />
          <Field label={t("admin", "lblRole")} value={user?.role ?? "—"} styles={styles} />
          <Field label={t("admin", "lblVerified")} value={user?.emailVerified ? t("admin", "yes") : t("admin", "no")} styles={styles} />
          <Field label={t("admin", "lblCreated")} value={fmtDate(user?.createdAt)} styles={styles} />
          <Field label={t("admin", "lblLastSeen")} value={fmtDateTime(user?.lastSeenAt)} styles={styles} />
        </Section>

        {/* Subscriptions */}
        <Section title={t("admin", "secSubscriptions")} styles={styles}>
          {user && user.subscriptions.length > 0 ? (
            user.subscriptions.map((s) => (
              <View key={s.id} style={styles.subRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subTitle}>
                    {s.service} · {s.tier}
                  </Text>
                  <Text style={styles.subMeta}>
                    {s.state}
                    {s.cancelAtPeriodEnd ? ` · ${t("admin", "pausedBadge")}` : ""}
                    {s.paidUntil ? ` · ${t("admin", "paidUntil")} ${fmtDate(s.paidUntil)}` : ""}
                    {s.trialEndsAt ? ` · ${t("admin", "trialEnds")} ${fmtDate(s.trialEndsAt)}` : ""}
                  </Text>
                </View>
                <Pressable onPress={() => toggleSub(s)} disabled={pauseMutation.isPending} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>{s.cancelAtPeriodEnd ? t("admin", "resume") : t("admin", "pause")}</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.emptyLine}>{t("admin", "noSubs")}</Text>
          )}
        </Section>

        {/* Health */}
        <Section title={t("admin", "secHealth")} styles={styles}>
          {healthQuery.isLoading ? (
            <ActivityIndicator color={colors.textSubtle} />
          ) : healthQuery.data ? (
            <View>
              <View style={styles.healthHeader}>
                <AdminBadge
                  text={`${t("admin", "healthScore")} ${healthQuery.data.score}`}
                  {...bandColors(healthQuery.data.band, colors)}
                />
              </View>
              {healthQuery.data.breakdown?.map((b) => (
                <View key={b.category} style={styles.healthRow}>
                  <Text style={styles.healthLabel}>{b.label}</Text>
                  <Text style={styles.healthValue}>
                    {b.earned}/{b.max}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyLine}>—</Text>
          )}
        </Section>

        {/* Activity */}
        <Section title={t("admin", "secActivity")} styles={styles}>
          {activityQuery.isLoading ? (
            <ActivityIndicator color={colors.textSubtle} />
          ) : activityQuery.data && activityQuery.data.length > 0 ? (
            activityQuery.data.slice(0, 40).map((a) => (
              <View key={a.id} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineLabel}>{a.label}</Text>
                  <Text style={styles.timelineMeta}>
                    {a.category} · {fmtDateTime(a.createdAt)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyLine}>{t("admin", "noActivity")}</Text>
          )}
        </Section>

        {/* Invoices */}
        <Section title={t("admin", "secInvoices")} styles={styles}>
          {invoicesQuery.isLoading ? (
            <ActivityIndicator color={colors.textSubtle} />
          ) : invoicesQuery.data && invoicesQuery.data.length > 0 ? (
            invoicesQuery.data.map((inv) => (
              <Pressable
                key={inv.id}
                disabled={!inv.hasPdf}
                onPress={() => openAuthedFile(`/api/v2/admin/invoices/${inv.id}/pdf`, `${inv.number}.pdf`, "application/pdf")}
                style={styles.invRow}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.invNumber}>{inv.number}</Text>
                  <Text style={styles.invMeta}>
                    {inv.status} · {inv.totalAmount} {inv.currency}
                  </Text>
                </View>
                {inv.hasPdf ? <Text style={styles.link}>PDF</Text> : null}
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyLine}>{t("admin", "noInvoices")}</Text>
          )}
        </Section>

        {/* Comments */}
        <Section title={t("admin", "secComments")} styles={styles}>
          <View style={styles.commentInputRow}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t("admin", "commentPlaceholder")}
              placeholderTextColor={colors.textFaint}
              multiline
              style={styles.commentInput}
            />
            <Pressable
              disabled={!comment.trim() || addCommentMutation.isPending}
              onPress={() => addCommentMutation.mutate(comment.trim())}
              style={[styles.smallBtn, (!comment.trim() || addCommentMutation.isPending) && { opacity: 0.5 }]}
            >
              <Text style={styles.smallBtnText}>{t("admin", "add")}</Text>
            </Pressable>
          </View>
          {commentsQuery.data && commentsQuery.data.length > 0 ? (
            commentsQuery.data.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentBody}>{c.body}</Text>
                  <Text style={styles.commentMeta}>
                    {c.authorName} · {fmtDateTime(c.createdAt)}
                  </Text>
                </View>
                <Pressable onPress={() => confirmDeleteComment(c.id)} hitSlop={8}>
                  <Text style={styles.deleteX}>×</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.emptyLine}>{t("admin", "noComments")}</Text>
          )}
        </Section>

        {/* Actions */}
        <Section title={t("admin", "secActions")} styles={styles}>
          <Pressable onPress={confirmRole} style={styles.actionBtn}>
            <Text style={styles.actionText}>{user?.role === "ADMIN" ? t("admin", "makeUser") : t("admin", "makeAdmin")}</Text>
          </Pressable>
          <Pressable onPress={confirmDeleteUser} style={[styles.actionBtn, styles.dangerBtn]}>
            <Text style={[styles.actionText, styles.dangerText]}>{t("admin", "deleteUser")}</Text>
          </Pressable>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}
function Field({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    section: { marginBottom: spacing.lg },
    sectionTitle: {
      fontSize: fontSize.xs,
      color: colors.textSubtle,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
    fieldRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs, gap: spacing.md },
    fieldLabel: { fontSize: fontSize.sm, color: colors.textSubtle },
    fieldValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500", flexShrink: 1, textAlign: "right" },
    subRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
    subTitle: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    subMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    smallBtn: { backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm },
    smallBtnText: { color: colors.accentForeground, fontSize: fontSize.xs, fontWeight: "600" },
    healthHeader: { marginBottom: spacing.sm, flexDirection: "row" },
    healthRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
    healthLabel: { fontSize: fontSize.sm, color: colors.textMuted },
    healthValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    timelineRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm },
    timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.link, marginTop: 5 },
    timelineLabel: { fontSize: fontSize.sm, color: colors.text },
    timelineMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    invRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, gap: spacing.md },
    invNumber: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    invMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    link: { color: colors.link, fontSize: fontSize.sm, fontWeight: "600" },
    commentInputRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end", marginBottom: spacing.md },
    commentInput: {
      flex: 1,
      minHeight: 40,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.text,
    },
    commentRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    commentBody: { fontSize: fontSize.sm, color: colors.text },
    commentMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    deleteX: { fontSize: 22, color: colors.danger, paddingHorizontal: spacing.xs },
    actionBtn: { paddingVertical: spacing.md, alignItems: "center", borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
    actionText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    dangerBtn: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
    dangerText: { color: colors.danger },
    emptyLine: { fontSize: fontSize.sm, color: colors.textSubtle, paddingVertical: spacing.xs },
  });
