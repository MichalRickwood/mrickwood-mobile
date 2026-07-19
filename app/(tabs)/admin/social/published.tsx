import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppFlatList } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type SocialPost } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { AdminBadge } from "@/components/AdminRow";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

type Tab = "PUBLISHED" | "FAILED";
const NETWORKS = ["instagram", "facebook", "linkedin", "x"] as const;
const NET_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X" };

/** Výkon publikací: co reálně vyšlo (prokliky per síť) + selhání. */
export default function AdminSocialPublishedScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>("PUBLISHED");

  const query = useQuery({
    queryKey: ["admin-social", tab],
    queryFn: ({ signal }) => adminApi.listSocial({ status: tab, limit: 200 }, signal),
  });

  const renderRow = ({ item }: { item: SocialPost }) => {
    const refs = item.platformRefs ?? {};
    const when = item.publishedAt ?? item.scheduledFor;
    return (
      <View style={styles.row}>
        <View style={styles.rowTop}>
          {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty]} />}
          <View style={{ flex: 1 }}>
            <View style={styles.badges}>
              <AdminBadge text={item.country ?? "GLOBAL"} color={colors.textMuted} bg={colors.bg} />
              {item.pillar ? <AdminBadge text={item.pillar} color={colors.textMuted} bg={colors.bg} /> : null}
              <Text style={styles.locale}>{item.locale}</Text>
            </View>
            <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>
            {when ? <Text style={styles.when}>{new Date(when).toLocaleString()}</Text> : null}
          </View>
        </View>

        {tab === "FAILED" && item.errorMsg ? <Text style={styles.error}>{item.errorMsg}</Text> : null}

        <View style={styles.netRow}>
          {NETWORKS.filter((n) => (item.platforms ?? []).includes(n)).map((n) => {
            const ref = refs[n];
            const url = ref?.permalink;
            return url ? (
              <Pressable key={n} onPress={() => Linking.openURL(url)} style={[styles.netChip, styles.netChipOk]}>
                <Text style={styles.netChipOkText}>{NET_LABEL[n]} · {t("admin", "openLink")}</Text>
              </Pressable>
            ) : (
              <View key={n} style={styles.netChip}>
                <Text style={styles.netChipText}>{NET_LABEL[n]}{tab === "FAILED" ? " ✕" : " ·"}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.segment}>
        {(["PUBLISHED", "FAILED"] as const).map((s) => (
          <Pressable key={s} onPress={() => setTab(s)} style={[styles.segmentBtn, tab === s && styles.segmentBtnActive]}>
            <Text style={[styles.segmentText, tab === s && styles.segmentTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <AppFlatList
        data={query.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.textSubtle} />}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} />
          ) : (
            <Text style={styles.empty}>{t("admin", "perfEmpty")}</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    segment: { flexDirection: "row", margin: spacing.lg, marginBottom: 0, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    segmentBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center" },
    segmentBtnActive: { backgroundColor: colors.accent },
    segmentText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    segmentTextActive: { color: colors.accentForeground, fontWeight: "600" },
    list: { padding: spacing.lg },
    row: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
    rowTop: { flexDirection: "row", gap: spacing.md },
    thumb: { width: 56, height: 70, borderRadius: radius.sm, backgroundColor: colors.bg },
    thumbEmpty: { borderWidth: 1, borderColor: colors.border },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, alignItems: "center", marginBottom: spacing.xs },
    locale: { fontSize: fontSize.xs, color: colors.textMuted },
    caption: { fontSize: fontSize.sm, color: colors.text },
    when: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    error: { fontSize: fontSize.xs, color: colors.danger },
    netRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    netChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.bg },
    netChipText: { fontSize: fontSize.xs, color: colors.textMuted },
    netChipOk: { borderColor: colors.accent, backgroundColor: colors.card },
    netChipOkText: { fontSize: fontSize.xs, color: colors.accent, fontWeight: "600" },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.xxl, fontSize: fontSize.sm },
  });
