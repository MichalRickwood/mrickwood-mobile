import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type SocialPost, type SocialStatus } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { AdminBadge } from "@/components/AdminRow";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const STATUSES: SocialStatus[] = ["DRAFT", "PENDING_REVIEW", "SCHEDULED", "PUBLISHED", "FAILED", "REJECTED", "ARCHIVED"];

export default function AdminSocialScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [status, setStatus] = useState<SocialStatus | "">("PENDING_REVIEW");
  const [kind, setKind] = useState<"" | "POST" | "AD_CREATIVE">("");

  const query = useQuery({
    queryKey: ["admin-social", status, kind],
    queryFn: ({ signal }) => adminApi.listSocial({ status: status || undefined, kind: kind || undefined, limit: 200 }, signal),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin-social"] });

  const generateMutation = useMutation({
    mutationFn: () => adminApi.generateSocial(),
    onSuccess: invalidate,
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });
  const cycleMutation = useMutation({
    mutationFn: (action: "approve" | "reject") => adminApi.cycleAction(action),
    onSuccess: invalidate,
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });

  function confirmGenerate() {
    Alert.alert(t("admin", "generateTitle"), t("admin", "generateMsg"), [
      { text: t("admin", "cancel"), style: "cancel" },
      { text: t("admin", "confirm"), onPress: () => generateMutation.mutate() },
    ]);
  }
  function confirmCycle(action: "approve" | "reject") {
    Alert.alert(
      action === "approve" ? t("admin", "cycleApproveTitle") : t("admin", "cycleRejectTitle"),
      action === "approve" ? t("admin", "cycleApproveMsg") : t("admin", "cycleRejectMsg"),
      [
        { text: t("admin", "cancel"), style: "cancel" },
        { text: t("admin", "confirm"), onPress: () => cycleMutation.mutate(action) },
      ],
    );
  }

  const renderRow = ({ item }: { item: SocialPost }) => (
    <Pressable
      onPress={() => router.push({ pathname: "/(tabs)/admin/social/[id]", params: { id: item.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty]} />}
      <View style={{ flex: 1 }}>
        <View style={styles.rowHead}>
          <AdminBadge text={item.status} color={colors.textMuted} bg={colors.bg} />
          <AdminBadge text={item.country ?? "GLOBAL"} color={colors.textMuted} bg={colors.bg} />
        </View>
        <Text style={styles.caption} numberOfLines={3}>
          {item.caption}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.controls}>
        <View style={styles.topActions}>
          <Pressable onPress={() => router.push("/(tabs)/admin/social/replies")} style={styles.topBtn}>
            <Text style={styles.topBtnText}>{t("admin", "repliesBtn")}</Text>
          </Pressable>
          <Pressable onPress={confirmGenerate} disabled={generateMutation.isPending} style={[styles.topBtn, styles.topBtnPrimary]}>
            <Text style={[styles.topBtnText, styles.topBtnTextPrimary]}>{generateMutation.isPending ? t("admin", "generating") : t("admin", "generate")}</Text>
          </Pressable>
        </View>
        <View style={styles.cycleRow}>
          <Pressable onPress={() => confirmCycle("approve")} style={[styles.cycleBtn, styles.cycleApprove]}>
            <Text style={styles.cycleApproveText}>{t("admin", "cycleApprove")}</Text>
          </Pressable>
          <Pressable onPress={() => confirmCycle("reject")} style={[styles.cycleBtn, styles.cycleReject]}>
            <Text style={styles.cycleRejectText}>{t("admin", "cycleReject")}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable onPress={() => setStatus("")} style={[styles.chip, status === "" && styles.chipActive]}>
            <Text style={[styles.chipText, status === "" && styles.chipTextActive]}>{t("admin", "filterAll")}</Text>
          </Pressable>
          {STATUSES.map((s) => (
            <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipActive]}>
              <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.segment}>
          {([["", "filterAll"], ["POST", "kindPost"], ["AD_CREATIVE", "kindAd"]] as const).map(([val, key]) => (
            <Pressable key={val} onPress={() => setKind(val)} style={[styles.segmentBtn, kind === val && styles.segmentBtnActive]}>
              <Text style={[styles.segmentText, kind === val && styles.segmentTextActive]}>{t("admin", key)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={query.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.textSubtle} />}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} />
          ) : (
            <Text style={styles.empty}>{t("admin", "socialEmpty")}</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    controls: { padding: spacing.lg, gap: spacing.sm },
    topActions: { flexDirection: "row", gap: spacing.sm },
    topBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    topBtnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
    topBtnText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    topBtnTextPrimary: { color: colors.accentForeground },
    cycleRow: { flexDirection: "row", gap: spacing.sm },
    cycleBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.md },
    cycleApprove: { backgroundColor: colors.successBg },
    cycleApproveText: { color: colors.success, fontSize: fontSize.sm, fontWeight: "600" },
    cycleReject: { backgroundColor: colors.dangerBg },
    cycleRejectText: { color: colors.danger, fontSize: fontSize.sm, fontWeight: "600" },
    chipRow: { gap: spacing.sm, paddingVertical: 2 },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.card },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
    chipTextActive: { color: colors.accentForeground, fontWeight: "600" },
    segment: { flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    segmentBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center" },
    segmentBtnActive: { backgroundColor: colors.accent },
    segmentText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    segmentTextActive: { color: colors.accentForeground, fontWeight: "600" },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    row: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
    rowPressed: { borderColor: colors.text },
    thumb: { width: 56, height: 70, borderRadius: radius.sm, backgroundColor: colors.bg },
    thumbEmpty: { borderWidth: 1, borderColor: colors.border },
    rowHead: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
    caption: { fontSize: fontSize.sm, color: colors.text },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.xxl, fontSize: fontSize.sm },
  });
