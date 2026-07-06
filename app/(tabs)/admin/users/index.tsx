import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type AdminUser, type HealthBand } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { AdminBadge, bandColors } from "@/components/AdminRow";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

type StatusFilter = "active" | "inactive" | "all";

export default function AdminUsersScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users", status],
    queryFn: ({ signal }) => adminApi.listUsers(status, signal),
  });

  const bandLabel = (band: HealthBand): string => {
    const map: Record<HealthBand, string> = {
      critical: t("admin", "bandCritical"),
      at_risk: t("admin", "bandAtRisk"),
      ok: t("admin", "bandOk"),
      healthy: t("admin", "bandHealthy"),
      champion: t("admin", "bandChampion"),
    };
    return map[band];
  };
  const sourceLabel = (src: string): string => {
    if (src === "app") return t("admin", "srcApp");
    if (src === "mobile_web") return t("admin", "srcMobileWeb");
    if (src === "web") return t("admin", "srcWeb");
    return src;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = usersQuery.data ?? [];
    if (!q) return all;
    return all.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.company ?? "").toLowerCase().includes(q),
    );
  }, [usersQuery.data, search]);

  const renderRow = ({ item }: { item: AdminUser }) => {
    const activeSub = item.subscriptions.find((s) => s.state === "ACTIVE" || s.state === "TRIAL");
    return (
      <Pressable
        onPress={() => router.push({ pathname: "/(tabs)/admin/users/[id]", params: { id: item.id } })}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.name || item.email}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {item.name ? item.email : item.company || t("admin", "unnamed")}
          </Text>
          <View style={styles.badgeRow}>
            {item.health ? (
              <AdminBadge
                text={`${bandLabel(item.health.band)} ${item.health.score}`}
                {...bandColors(item.health.band, colors)}
              />
            ) : null}
            {activeSub ? (
              <AdminBadge text={`${activeSub.service} · ${activeSub.state}`} color={colors.textMuted} bg={colors.bg} />
            ) : null}
            {item.role === "ADMIN" ? <AdminBadge text="ADMIN" color={colors.accentForeground} bg={colors.accent} /> : null}
            {item.signupSource ? (
              <AdminBadge text={sourceLabel(item.signupSource)} color={colors.textMuted} bg={colors.bg} />
            ) : null}
          </View>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.controls}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("admin", "searchUsers")}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
        <View style={styles.segment}>
          {(["active", "inactive", "all"] as StatusFilter[]).map((s) => (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              style={[styles.segmentBtn, status === s && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, status === s && styles.segmentTextActive]}>
                {s === "active" ? t("admin", "statusActive") : s === "inactive" ? t("admin", "statusInactive") : t("admin", "statusAll")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(u) => u.id}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={usersQuery.isRefetching} onRefresh={() => usersQuery.refetch()} tintColor={colors.textSubtle} />
        }
        ListEmptyComponent={
          usersQuery.isLoading ? (
            <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} />
          ) : usersQuery.isError ? (
            <Text style={styles.empty}>{t("admin", "errorBody")}</Text>
          ) : (
            <Text style={styles.empty}>{t("admin", "usersEmpty")}</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    controls: { padding: spacing.lg, gap: spacing.md },
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
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginBottom: spacing.sm,
    },
    rowPressed: { borderColor: colors.text },
    rowTitle: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    rowSub: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
    chevron: { fontSize: 22, color: colors.textFaint, marginLeft: spacing.sm },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.xxl, fontSize: fontSize.sm },
  });
