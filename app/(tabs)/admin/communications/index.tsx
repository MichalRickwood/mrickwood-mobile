import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminApi, type EmailLogRow, type EmailStatus } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { AdminBadge } from "@/components/AdminRow";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const STATUSES: EmailStatus[] = ["QUEUED", "SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "COMPLAINED", "FAILED"];

function statusColor(status: EmailStatus, colors: Colors): { color: string; bg: string } {
  if (status === "BOUNCED" || status === "COMPLAINED" || status === "FAILED") return { color: colors.danger, bg: colors.dangerBg };
  if (status === "DELIVERED" || status === "OPENED" || status === "CLICKED") return { color: colors.success, bg: colors.successBg };
  return { color: colors.textMuted, bg: colors.bg };
}

export default function AdminCommunicationsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [direction, setDirection] = useState<"" | "in" | "out">("");
  const [status, setStatus] = useState<EmailStatus | "">("");
  const [category, setCategory] = useState<string>("");

  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useQuery({
    queryKey: ["admin-emails", q, direction, status, category],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      adminApi.listEmails(
        {
          q: q || undefined,
          direction: direction || undefined,
          status: status || undefined,
          category: category || undefined,
          limit: 200,
        },
        signal,
      ),
  });

  const items = query.data?.items ?? [];
  const categories = query.data?.categories ?? [];

  const renderRow = ({ item }: { item: EmailLogRow }) => (
    <Pressable
      onPress={() => router.push({ pathname: "/(tabs)/admin/communications/[id]", params: { id: item.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.subject} numberOfLines={1}>
          {item.subject || "—"}
        </Text>
        <Text style={styles.addr} numberOfLines={1}>
          {item.toAddr}
        </Text>
        <Text style={styles.cat} numberOfLines={1}>
          {item.category} · {new Date(item.sentAt).toLocaleString()}
        </Text>
      </View>
      <AdminBadge text={item.status} {...statusColor(item.status, colors)} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.controls}>
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={t("admin", "searchEmails")}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
        <View style={styles.segment}>
          {([["", "dirAll"], ["in", "dirIn"], ["out", "dirOut"]] as const).map(([val, key]) => (
            <Pressable key={val} onPress={() => setDirection(val)} style={[styles.segmentBtn, direction === val && styles.segmentBtnActive]}>
              <Text style={[styles.segmentText, direction === val && styles.segmentTextActive]}>{t("admin", key)}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable onPress={() => setStatus("")} style={[styles.chip, status === "" && styles.chipActive]}>
            <Text style={[styles.chipText, status === "" && styles.chipTextActive]}>{t("admin", "allStatuses")}</Text>
          </Pressable>
          {STATUSES.map((s) => (
            <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipActive]}>
              <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {categories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Pressable onPress={() => setCategory("")} style={[styles.chip, category === "" && styles.chipActive]}>
              <Text style={[styles.chipText, category === "" && styles.chipTextActive]}>{t("admin", "allCategories")}</Text>
            </Pressable>
            {categories.map((c) => (
              <Pressable key={c.category} onPress={() => setCategory(c.category)} style={[styles.chip, category === c.category && styles.chipActive]}>
                <Text style={[styles.chipText, category === c.category && styles.chipTextActive]}>
                  {c.category} ({c.count})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.textSubtle} />}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} />
          ) : (
            <Text style={styles.empty}>{t("admin", "commsEmpty")}</Text>
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
    search: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.text,
    },
    segment: { flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    segmentBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center" },
    segmentBtnActive: { backgroundColor: colors.accent },
    segmentText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    segmentTextActive: { color: colors.accentForeground, fontWeight: "600" },
    chipRow: { gap: spacing.sm, paddingVertical: 2 },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.card },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
    chipTextActive: { color: colors.accentForeground, fontWeight: "600" },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    rowPressed: { borderColor: colors.text },
    subject: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    addr: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    cat: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.xxl, fontSize: fontSize.sm },
  });
