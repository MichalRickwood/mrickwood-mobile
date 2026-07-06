import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type SocialReply } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { AdminBadge } from "@/components/AdminRow";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export default function AdminRepliesScreen() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [withLink, setWithLink] = useState<Record<string, boolean>>({});

  const query = useQuery({ queryKey: ["admin-replies"], queryFn: ({ signal }) => adminApi.listReplies(signal) });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin-replies"] });

  const actionMutation = useMutation({
    mutationFn: (input: { id: string; action: "approve" | "reject" | "delete"; withLink?: boolean }) => adminApi.replyAction(input),
    onSuccess: (data, vars) => {
      invalidate();
      if (vars.action === "approve" && data.status === "FAILED") Alert.alert(t("admin", "actionFailed"), data.errorMsg ?? "");
    },
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });

  function confirmApprove(item: SocialReply) {
    Alert.alert(t("admin", "replyApprove"), item.draftReply, [
      { text: t("admin", "cancel"), style: "cancel" },
      { text: t("admin", "confirm"), onPress: () => actionMutation.mutate({ id: item.id, action: "approve", withLink: withLink[item.id] ?? false }) },
    ]);
  }
  function confirmReject(item: SocialReply) {
    Alert.alert(t("admin", "replyRejectTitle"), "", [
      { text: t("admin", "cancel"), style: "cancel" },
      { text: t("admin", "confirm"), onPress: () => actionMutation.mutate({ id: item.id, action: "reject" }) },
    ]);
  }
  function confirmDelete(item: SocialReply) {
    Alert.alert(t("admin", "replyDeleteTitle"), t("admin", "replyDeleteMsg"), [
      { text: t("admin", "cancel"), style: "cancel" },
      { text: t("admin", "delete"), style: "destructive", onPress: () => actionMutation.mutate({ id: item.id, action: "delete" }) },
    ]);
  }

  const renderRow = ({ item }: { item: SocialReply }) => (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <AdminBadge text={item.status} color={colors.textMuted} bg={colors.bg} />
        {item.relevance != null ? <AdminBadge text={`${t("admin", "relevance")} ${item.relevance}`} color={colors.textMuted} bg={colors.bg} /> : null}
        {item.authorHandle ? <Text style={styles.handle}>@{item.authorHandle}</Text> : null}
      </View>
      <Text style={styles.tweet}>{item.tweetText}</Text>
      <Text style={styles.draftLabel}>{t("admin", "draftReply")}</Text>
      <Text style={styles.draft}>{item.draftReply}</Text>

      <View style={styles.linkRow}>
        <Text style={styles.linkLabel}>{t("admin", "withLink")}</Text>
        <Switch
          value={withLink[item.id] ?? false}
          onValueChange={(v) => setWithLink((prev) => ({ ...prev, [item.id]: v }))}
        />
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => confirmApprove(item)} style={[styles.actionBtn, styles.approveBtn]}>
          <Text style={styles.approveText}>{t("admin", "replyApprove")}</Text>
        </Pressable>
        <Pressable onPress={() => confirmReject(item)} style={styles.actionBtn}>
          <Text style={styles.actionText}>{t("admin", "replyReject")}</Text>
        </Pressable>
        <Pressable onPress={() => confirmDelete(item)} style={[styles.actionBtn, styles.dangerBtn]}>
          <Text style={[styles.actionText, styles.dangerText]}>{t("admin", "replyDelete")}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(r) => r.id}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.textSubtle} />}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} />
          ) : (
            <Text style={styles.empty}>{t("admin", "repliesEmpty")}</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    list: { padding: spacing.lg, paddingBottom: spacing.xxl },
    row: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
    rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm, flexWrap: "wrap" },
    handle: { fontSize: fontSize.xs, color: colors.link, fontWeight: "600" },
    tweet: { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: "italic", lineHeight: 20 },
    draftLabel: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "600", marginTop: spacing.md, textTransform: "uppercase", letterSpacing: 0.5 },
    draft: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20, marginTop: spacing.xs },
    linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
    linkLabel: { fontSize: fontSize.sm, color: colors.textMuted },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    actionBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
    actionText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "600" },
    approveBtn: { backgroundColor: colors.accent, borderColor: colors.accent },
    approveText: { fontSize: fontSize.xs, color: colors.accentForeground, fontWeight: "600" },
    dangerBtn: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
    dangerText: { color: colors.danger },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.xxl, fontSize: fontSize.sm },
  });
