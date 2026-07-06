import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type Feedback, type FeedbackKind, type FeedbackStatus } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { AdminBadge } from "@/components/AdminRow";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export type TFn = ReturnType<typeof useI18n>["t"];

export function feedbackKindLabel(kind: FeedbackKind, t: TFn): string {
  switch (kind) {
    case "BUG":
      return t("admin", "kindBug");
    case "IMPROVEMENT":
      return t("admin", "kindImprovement");
    case "MISSING_TENDER":
      return t("admin", "kindMissingTender");
    default:
      return t("admin", "kindOther");
  }
}
export function feedbackStatusLabel(status: FeedbackStatus, t: TFn): string {
  switch (status) {
    case "NEW":
      return t("admin", "fbNew");
    case "IN_PROGRESS":
      return t("admin", "fbInProgress");
    case "RESOLVED":
      return t("admin", "fbResolved");
    case "WONT_FIX":
      return t("admin", "fbWontFix");
    default:
      return t("admin", "fbDuplicate");
  }
}

export default function AdminFeedbackScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [kindFilter, setKindFilter] = useState<FeedbackKind | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "ALL">("ALL");

  const query = useQuery({ queryKey: ["admin-feedback"], queryFn: ({ signal }) => adminApi.listFeedback(signal) });

  const filtered = useMemo(() => {
    let items = query.data ?? [];
    if (kindFilter !== "ALL") items = items.filter((f) => f.kind === kindFilter);
    if (statusFilter !== "ALL") items = items.filter((f) => f.status === statusFilter);
    return items;
  }, [query.data, kindFilter, statusFilter]);

  const kinds: (FeedbackKind | "ALL")[] = ["ALL", "BUG", "IMPROVEMENT", "MISSING_TENDER", "OTHER"];
  const statuses: (FeedbackStatus | "ALL")[] = ["ALL", "NEW", "IN_PROGRESS", "RESOLVED", "WONT_FIX", "DUPLICATE"];

  const renderRow = ({ item }: { item: Feedback }) => (
    <Pressable
      onPress={() => router.push({ pathname: "/(tabs)/admin/feedback/[id]", params: { id: item.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowHead}>
        <AdminBadge text={feedbackKindLabel(item.kind, t)} color={colors.textMuted} bg={colors.bg} />
        <AdminBadge
          text={feedbackStatusLabel(item.status, t)}
          color={item.status === "NEW" ? colors.accentForeground : colors.textMuted}
          bg={item.status === "NEW" ? colors.accent : colors.bg}
        />
        {item.attachments.length > 0 ? <Text style={styles.clip}>📎 {item.attachments.length}</Text> : null}
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {item.message}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {item.user?.email ?? item.email ?? t("admin", "anonymous")}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {kinds.map((k) => (
            <Pressable key={k} onPress={() => setKindFilter(k)} style={[styles.chip, kindFilter === k && styles.chipActive]}>
              <Text style={[styles.chipText, kindFilter === k && styles.chipTextActive]}>
                {k === "ALL" ? t("admin", "filterAll") : feedbackKindLabel(k, t)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {statuses.map((s) => (
            <Pressable key={s} onPress={() => setStatusFilter(s)} style={[styles.chip, statusFilter === s && styles.chipActive]}>
              <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                {s === "ALL" ? t("admin", "filterAll") : feedbackStatusLabel(s, t)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(f) => f.id}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.textSubtle} />}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} />
          ) : (
            <Text style={styles.empty}>{t("admin", "feedbackEmpty")}</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    filters: { paddingVertical: spacing.sm, gap: spacing.sm },
    filterRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.card },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
    chipTextActive: { color: colors.accentForeground, fontWeight: "600" },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    row: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    rowPressed: { borderColor: colors.text },
    rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    clip: { fontSize: fontSize.xs, color: colors.textSubtle },
    message: { fontSize: fontSize.sm, color: colors.text },
    meta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.sm },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.xxl, fontSize: fontSize.sm },
  });
