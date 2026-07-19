import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export default function AdminSocialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = String(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [caption, setCaption] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [features, setFeatures] = useState("");
  const [zoom, setZoom] = useState(false);

  const query = useQuery({
    queryKey: ["admin-social-one", postId],
    queryFn: async ({ signal }) => {
      const posts = await adminApi.listSocial({ limit: 200 }, signal);
      return posts.find((p) => p.id === postId) ?? null;
    },
  });
  const post = query.data;

  useEffect(() => {
    if (post) {
      setCaption(post.caption);
      setHeadline(post.headline ?? "");
      setSubheadline(post.subheadline ?? "");
      setFeatures((post.features ?? []).join("\n"));
    }
  }, [post]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-social"] });
    void qc.invalidateQueries({ queryKey: ["admin-social-one", postId] });
  };

  const actionMutation = useMutation({
    mutationFn: (input: { action: "approve" | "reject" | "update" | "delete" | "rerender"; reason?: string; caption?: string; headline?: string; subheadline?: string; features?: string[] }) => adminApi.socialAction(postId, input),
    onSuccess: (_d, vars) => {
      invalidate();
      if (vars.action === "delete") router.back();
      setRejectOpen(false);
      // rerender/update s vizuálem běží server-side po odpovědi → refresh za chvíli
      if (vars.action === "rerender" || vars.headline !== undefined) setTimeout(invalidate, 2500);
    },
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });
  function saveVisual() {
    actionMutation.mutate({
      action: "update",
      headline,
      subheadline,
      features: features.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 4),
    });
  }
  const generateMutation = useMutation({
    mutationFn: () => adminApi.generateSocial(post?.country ?? undefined),
    onSuccess: () => {
      invalidate();
      Alert.alert(t("admin", "done"));
    },
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });

  function confirmApprove() {
    Alert.alert(t("admin", "approve"), post?.caption ?? "", [
      { text: t("admin", "cancel"), style: "cancel" },
      { text: t("admin", "confirm"), onPress: () => actionMutation.mutate({ action: "approve" }) },
    ]);
  }
  function confirmDelete() {
    Alert.alert(t("admin", "deletePostTitle"), t("admin", "deletePostMsg"), [
      { text: t("admin", "cancel"), style: "cancel" },
      { text: t("admin", "delete"), style: "destructive", onPress: () => actionMutation.mutate({ action: "delete" }) },
    ]);
  }

  if (query.isLoading || !post) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {query.isLoading ? <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} /> : <Text style={styles.empty}>{t("admin", "empty")}</Text>}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <AppScrollView contentContainerStyle={styles.scroll}>
        {post.imageUrl ? (
          <Pressable onPress={() => setZoom(true)}>
            <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" />
          </Pressable>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.badge}>{post.status}</Text>
          <Text style={styles.badge}>{post.country ?? "GLOBAL"}</Text>
          {post.pillar ? <Text style={styles.badge}>{post.pillar}</Text> : null}
          <Text style={styles.badge}>{(post.platforms ?? []).length >= 4 ? "vše" : (post.platforms ?? []).join("/")}</Text>
          {post.imageTemplate ? <Text style={styles.badge}>{post.imageTemplate}</Text> : null}
        </View>

        {post.scheduledFor ? (
          <Text style={styles.metaLine}>
            {t("admin", "scheduledFor")}: {new Date(post.scheduledFor).toLocaleString()}
          </Text>
        ) : null}
        {post.publishedAt ? (
          <Text style={styles.metaLine}>
            {t("admin", "publishedAt")}: {new Date(post.publishedAt).toLocaleString()}
          </Text>
        ) : null}
        {post.errorMsg ? <Text style={[styles.metaLine, { color: colors.danger }]}>{post.errorMsg}</Text> : null}
        {post.rejectionReason ? <Text style={styles.metaLine}>{post.rejectionReason}</Text> : null}
        {post.registerLink ? (
          <Pressable onPress={() => Linking.openURL(post.registerLink)}>
            <Text style={[styles.metaLine, styles.link]} numberOfLines={1}>
              {t("admin", "registerLinkLabel")}: {post.registerLink}
            </Text>
          </Pressable>
        ) : null}

        <Text style={styles.sectionTitle}>{t("admin", "editCaption")}</Text>
        <View style={styles.card}>
          <TextInput value={caption} onChangeText={setCaption} multiline style={styles.captionInput} placeholderTextColor={colors.textFaint} />
          <Pressable onPress={() => actionMutation.mutate({ action: "update", caption })} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>{t("admin", "saveCaption")}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{t("admin", "editVisual")}</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{t("admin", "headlineLabel")}</Text>
          <TextInput value={headline} onChangeText={setHeadline} style={styles.fieldInput} maxLength={120} placeholderTextColor={colors.textFaint} />
          <Text style={styles.fieldLabel}>{t("admin", "subheadlineLabel")}</Text>
          <TextInput value={subheadline} onChangeText={setSubheadline} style={styles.fieldInput} maxLength={200} placeholderTextColor={colors.textFaint} />
          <Text style={styles.fieldLabel}>{t("admin", "featuresLabel")}</Text>
          <TextInput value={features} onChangeText={setFeatures} multiline style={[styles.fieldInput, { minHeight: 72, textAlignVertical: "top" }]} placeholderTextColor={colors.textFaint} />
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" }}>
            <Pressable onPress={saveVisual} disabled={actionMutation.isPending} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{actionMutation.isPending ? t("admin", "rerendering") : t("admin", "saveVisual")}</Text>
            </Pressable>
            <Pressable onPress={() => actionMutation.mutate({ action: "rerender" })} disabled={actionMutation.isPending} style={[styles.saveBtn, styles.saveBtnGhost]}>
              <Text style={[styles.saveBtnText, { color: colors.text }]}>{t("admin", "rerender")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.actionsCol}>
          <Pressable onPress={confirmApprove} style={[styles.actionBtn, styles.approveBtn]}>
            <Text style={styles.approveText}>{t("admin", "approve")}</Text>
          </Pressable>
          <Pressable onPress={() => setRejectOpen(true)} style={styles.actionBtn}>
            <Text style={styles.actionText}>{t("admin", "reject")}</Text>
          </Pressable>
          <Pressable onPress={() => generateMutation.mutate()} disabled={generateMutation.isPending} style={styles.actionBtn}>
            <Text style={styles.actionText}>{generateMutation.isPending ? t("admin", "generating") : t("admin", "generate")}</Text>
          </Pressable>
          <Pressable onPress={confirmDelete} style={[styles.actionBtn, styles.dangerBtn]}>
            <Text style={[styles.actionText, styles.dangerText]}>{t("admin", "delete")}</Text>
          </Pressable>
        </View>
      </AppScrollView>

      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <Pressable style={styles.zoomOverlay} onPress={() => setZoom(false)}>
          {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.zoomImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>

      <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={() => setRejectOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("admin", "rejectTitle")}</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t("admin", "rejectMsg")}
              placeholderTextColor={colors.textFaint}
              multiline
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setRejectOpen(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnText}>{t("admin", "cancel")}</Text>
              </Pressable>
              <Pressable onPress={() => actionMutation.mutate({ action: "reject", reason: reason.trim() || undefined })} style={[styles.modalBtn, styles.modalBtnPrimary]}>
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>{t("admin", "confirm")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    image: { width: "100%", aspectRatio: 4 / 5, borderRadius: radius.md, backgroundColor: colors.card, marginBottom: spacing.md },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
    badge: { fontSize: fontSize.xs, color: colors.textMuted, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, fontWeight: "600" },
    metaLine: { fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: spacing.xs },
    sectionTitle: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md, marginLeft: spacing.xs },
    card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
    captionInput: { minHeight: 100, fontSize: fontSize.sm, color: colors.text, textAlignVertical: "top" },
    saveBtn: { alignSelf: "flex-start", backgroundColor: colors.accent, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm, marginTop: spacing.sm },
    saveBtnGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    saveBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
    fieldLabel: { fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 2, marginTop: spacing.sm },
    fieldInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, fontSize: fontSize.sm, color: colors.text },
    link: { color: colors.accent },
    zoomOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center", padding: spacing.md },
    zoomImage: { width: "100%", height: "80%" },
    actionsCol: { gap: spacing.sm, marginTop: spacing.lg },
    actionBtn: { paddingVertical: spacing.md, alignItems: "center", borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
    actionText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    approveBtn: { backgroundColor: colors.accent, borderColor: colors.accent },
    approveText: { fontSize: fontSize.sm, color: colors.accentForeground, fontWeight: "600" },
    dangerBtn: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
    dangerText: { color: colors.danger },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.xxl, fontSize: fontSize.sm },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.xl },
    modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
    modalTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.lg },
    input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.text, minHeight: 60, textAlignVertical: "top" },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md, marginTop: spacing.lg },
    modalBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
    modalBtnPrimary: { backgroundColor: colors.accent },
    modalBtnText: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    modalBtnTextPrimary: { color: colors.accentForeground },
  });
