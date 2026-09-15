import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppFlatList } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type SocialPost, type SocialStatus } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { AdminBadge } from "@/components/AdminRow";
import OpenInClaude from "@/components/OpenInClaude";
import AdminMenu from "@/components/AdminMenu";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const STATUSES: SocialStatus[] = ["DRAFT", "PENDING_REVIEW", "SCHEDULED", "PUBLISHED", "FAILED", "REJECTED", "ARCHIVED"];
const COUNTRIES = ["GLOBAL", "CZ", "SK", "DE", "AT", "PL", "FR", "IT"];

/** Překlad = automatický fanOut sourozenec (GLOBAL + jiný jazyk než cs). */
function isTranslation(p: SocialPost): boolean {
  return p.scope === "GLOBAL" && p.locale !== "cs";
}
function platformsLabel(p: SocialPost): string {
  const pls = p.platforms ?? [];
  if (pls.length >= 4) return "vše";
  return pls.join("/") || "—";
}

export default function AdminSocialScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [status, setStatus] = useState<SocialStatus | "">("PENDING_REVIEW");
  const [kind, setKind] = useState<"" | "POST" | "AD_CREATIVE">("");
  const [country, setCountry] = useState("");
  const [showTranslations, setShowTranslations] = useState(false);
  const [filtryOpen, setFiltryOpen] = useState(false);

  /** Co je zapnuté, shrnuté do jedné pilulky — jinak není po zabalení filtrů vidět. */
  const filtrPopis = useMemo(() => {
    const casti = [status || "vše", kind === "POST" ? "posty" : kind === "AD_CREATIVE" ? "reklamy" : null, country || null];
    return `Filtry: ${casti.filter(Boolean).join(" · ")}`;
  }, [status, kind, country]);

  const query = useQuery({
    queryKey: ["admin-social", status, kind, country],
    queryFn: ({ signal }) => adminApi.listSocial({ status: status || undefined, kind: kind || undefined, country: country || undefined, limit: 200 }, signal),
  });

  const visible = useMemo(() => {
    const rows = query.data ?? [];
    return showTranslations ? rows : rows.filter((p) => !isTranslation(p));
  }, [query.data, showTranslations]);
  const hiddenCount = (query.data?.length ?? 0) - visible.length;

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
          {item.pillar ? <AdminBadge text={item.pillar} color={colors.textMuted} bg={colors.bg} /> : null}
          <AdminBadge text={platformsLabel(item)} color={colors.textMuted} bg={colors.bg} />
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
        {/* Dvě pilulky místo sedmi řad ovládání — filtry a akce se rozbalí do
            modalu. Na telefonu se jinak na obsah nedostane bez scrollování. */}
        <View style={styles.toolbar}>
          <Pressable onPress={() => setFiltryOpen(true)} style={styles.toolbarPill}>
            <Text style={styles.toolbarPillText} numberOfLines={1}>{filtrPopis}</Text>
            <Text style={styles.toolbarCaret}>⌄</Text>
          </Pressable>
          <AdminMenu
            label={t("admin", "actionsBtn")}
            polozky={[
              { label: t("admin", "generate"), onPress: confirmGenerate, disabled: generateMutation.isPending, primary: true, popis: "Vyrobí nový příspěvek do fronty" },
              { label: t("admin", "cycleApprove"), onPress: () => confirmCycle("approve"), popis: "Schválí celý čekající cyklus" },
              { label: t("admin", "cycleReject"), onPress: () => confirmCycle("reject"), destructive: true, popis: "Odmítne celý čekající cyklus" },
              { label: t("admin", "repliesBtn"), onPress: () => router.push("/(tabs)/admin/social/replies") },
              { label: t("admin", "perfBtn"), onPress: () => router.push("/(tabs)/admin/social/published") },
            ]}
          />
          <OpenInClaude kind="social-queue" label="Claude" variant="primary" />
        </View>
      </View>

      <Modal visible={filtryOpen} transparent animationType="fade" onRequestClose={() => setFiltryOpen(false)}>
        <Pressable style={styles.filtryOverlay} onPress={() => setFiltryOpen(false)}>
          <Pressable style={styles.filtrySheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView>
              <Text style={styles.filtryNadpis}>{t("admin", "filterStatus")}</Text>
              <View style={styles.filtryChips}>
                <Pressable onPress={() => setStatus("")} style={[styles.chip, status === "" && styles.chipActive]}>
                  <Text style={[styles.chipText, status === "" && styles.chipTextActive]}>{t("admin", "filterAll")}</Text>
                </Pressable>
                {STATUSES.map((sx) => (
                  <Pressable key={sx} onPress={() => setStatus(sx)} style={[styles.chip, status === sx && styles.chipActive]}>
                    <Text style={[styles.chipText, status === sx && styles.chipTextActive]}>{sx}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.filtryNadpis}>{t("admin", "filterKind")}</Text>
              <View style={styles.segment}>
                {([["", "filterAll"], ["POST", "kindPost"], ["AD_CREATIVE", "kindAd"]] as const).map(([val, key]) => (
                  <Pressable key={val} onPress={() => setKind(val)} style={[styles.segmentBtn, kind === val && styles.segmentBtnActive]}>
                    <Text style={[styles.segmentText, kind === val && styles.segmentTextActive]}>{t("admin", key)}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.filtryNadpis}>{t("admin", "filterCountry")}</Text>
              <View style={styles.filtryChips}>
                <Pressable onPress={() => setCountry("")} style={[styles.chip, country === "" && styles.chipActive]}>
                  <Text style={[styles.chipText, country === "" && styles.chipTextActive]}>{t("admin", "allCountries")}</Text>
                </Pressable>
                {COUNTRIES.map((c) => (
                  <Pressable key={c} onPress={() => setCountry(c)} style={[styles.chip, country === c && styles.chipActive]}>
                    <Text style={[styles.chipText, country === c && styles.chipTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={() => setShowTranslations((v) => !v)} style={styles.translToggle}>
                <Text style={styles.translToggleText}>
                  {showTranslations ? "☑" : "☐"} {t("admin", "showTranslations")}
                  {!showTranslations && hiddenCount > 0 ? ` (${hiddenCount})` : ""}
                </Text>
              </Pressable>

              <Pressable onPress={() => setFiltryOpen(false)} style={styles.filtryHotovo}>
                <Text style={styles.filtryHotovoText}>{t("admin", "done")}</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <AppFlatList
        data={visible}
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
      toolbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    toolbarPill: {
      flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    },
    toolbarPillText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600", flexShrink: 1 },
    toolbarCaret: { color: colors.textSubtle, fontSize: fontSize.sm },
    filtryOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg },
    filtrySheet: { backgroundColor: colors.card, borderRadius: radius.lg, maxHeight: "80%", padding: spacing.lg },
    filtryNadpis: { color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: "700", textTransform: "uppercase", marginTop: spacing.md, marginBottom: spacing.sm },
    filtryChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    filtryHotovo: { marginTop: spacing.lg, backgroundColor: colors.text, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
    filtryHotovoText: { color: colors.bg, fontSize: fontSize.base, fontWeight: "700" },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.card },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
    chipTextActive: { color: colors.accentForeground, fontWeight: "600" },
    segment: { flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    segmentBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center" },
    segmentBtnActive: { backgroundColor: colors.accent },
    segmentText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    segmentTextActive: { color: colors.accentForeground, fontWeight: "600" },
    translToggle: { paddingVertical: spacing.xs },
    translToggleText: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: "500" },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    row: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
    rowPressed: { borderColor: colors.text },
    thumb: { width: 56, height: 70, borderRadius: radius.sm, backgroundColor: colors.bg },
    thumbEmpty: { borderWidth: 1, borderColor: colors.border },
    rowHead: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
    caption: { fontSize: fontSize.sm, color: colors.text },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.xxl, fontSize: fontSize.sm },
  });
