import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type FeedbackStatus } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { openAuthedFile } from "@/lib/file-open";
import { feedbackKindLabel, feedbackStatusLabel } from "./index";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const STATUSES: FeedbackStatus[] = ["NEW", "IN_PROGRESS", "RESOLVED", "WONT_FIX", "DUPLICATE"];

export default function AdminFeedbackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fid = String(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: ["admin-feedback-one", fid],
    queryFn: async ({ signal }) => {
      const items = await adminApi.listFeedback(signal);
      return items.find((f) => f.id === fid) ?? null;
    },
  });
  const item = query.data;

  useEffect(() => {
    if (item) setNote(item.adminNote ?? "");
  }, [item]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-feedback"] });
    void qc.invalidateQueries({ queryKey: ["admin-feedback-one", fid] });
  };

  const updateMutation = useMutation({
    mutationFn: (patch: { status?: FeedbackStatus; adminNote?: string | null }) => adminApi.updateFeedback(fid, patch),
    onSuccess: invalidate,
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });
  const grantMutation = useMutation({
    mutationFn: () => adminApi.grantMonth(fid),
    onSuccess: () => Alert.alert(t("admin", "done")),
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });
  const deleteMutation = useMutation({
    mutationFn: () => adminApi.deleteFeedback(fid),
    onSuccess: () => {
      invalidate();
      router.back();
    },
    onError: () => Alert.alert(t("admin", "actionFailed")),
  });

  function confirmGrant() {
    Alert.alert(t("admin", "grantMonthTitle"), t("admin", "grantMonthMsg"), [
      { text: t("admin", "cancel"), style: "cancel" },
      { text: t("admin", "confirm"), onPress: () => grantMutation.mutate() },
    ]);
  }
  function confirmDelete() {
    Alert.alert(t("admin", "deleteFeedbackTitle"), t("admin", "deleteFeedbackMsg"), [
      { text: t("admin", "cancel"), style: "cancel" },
      { text: t("admin", "delete"), style: "destructive", onPress: () => deleteMutation.mutate() },
    ]);
  }

  if (query.isLoading || !item) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {query.isLoading ? <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} /> : <Text style={styles.empty}>{t("admin", "empty")}</Text>}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.metaRow}>
          <Text style={styles.badge}>{feedbackKindLabel(item.kind, t)}</Text>
          <Text style={styles.badge}>{feedbackStatusLabel(item.status, t)}</Text>
        </View>

        <Text style={styles.sectionTitle}>{t("admin", "secMessage")}</Text>
        <View style={styles.card}>
          <Text style={styles.message}>{item.message}</Text>
          {item.page ? <Text style={styles.metaLine}>{item.page}</Text> : null}
        </View>

        <Text style={styles.sectionTitle}>{t("admin", "secUser")}</Text>
        <View style={styles.card}>
          <Text style={styles.value}>{item.user?.email ?? item.email ?? t("admin", "anonymous")}</Text>
          {item.user?.name || item.name ? <Text style={styles.metaLine}>{item.user?.name ?? item.name}</Text> : null}
        </View>

        {item.attachments.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t("admin", "attachments")}</Text>
            <View style={styles.card}>
              {item.attachments.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => openAuthedFile(`/api/v2/admin/feedback/attachments/${a.id}`, a.filename, a.mimeType)}
                  style={styles.attRow}
                >
                  <Text style={styles.link} numberOfLines={1}>
                    📎 {a.filename}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{t("admin", "changeStatus")}</Text>
        <View style={styles.statusWrap}>
          {STATUSES.map((s) => (
            <Pressable
              key={s}
              onPress={() => updateMutation.mutate({ status: s })}
              style={[styles.statusChip, item.status === s && styles.statusChipActive]}
            >
              <Text style={[styles.statusChipText, item.status === s && styles.statusChipTextActive]}>{feedbackStatusLabel(s, t)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t("admin", "adminNote")}</Text>
        <View style={styles.card}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t("admin", "adminNotePlaceholder")}
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.noteInput}
          />
          <Pressable
            onPress={() => updateMutation.mutate({ adminNote: note.trim() || null })}
            disabled={updateMutation.isPending}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>{t("admin", "saveNote")}</Text>
          </Pressable>
        </View>

        {item.kind === "MISSING_TENDER" ? (
          <Pressable onPress={confirmGrant} style={styles.actionBtn}>
            <Text style={styles.actionText}>{t("admin", "grantMonth")}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={confirmDelete} style={[styles.actionBtn, styles.dangerBtn]}>
          <Text style={[styles.actionText, styles.dangerText]}>{t("admin", "delete")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    metaRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
    badge: { fontSize: fontSize.xs, color: colors.textMuted, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, fontWeight: "600" },
    sectionTitle: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md, marginLeft: spacing.xs },
    card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
    message: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
    value: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    metaLine: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.xs },
    attRow: { paddingVertical: spacing.sm },
    link: { color: colors.link, fontSize: fontSize.sm, fontWeight: "600" },
    statusWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    statusChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.card },
    statusChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    statusChipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
    statusChipTextActive: { color: colors.accentForeground, fontWeight: "600" },
    noteInput: { minHeight: 60, fontSize: fontSize.sm, color: colors.text, textAlignVertical: "top" },
    saveBtn: { alignSelf: "flex-start", backgroundColor: colors.accent, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm, marginTop: spacing.sm },
    saveBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
    actionBtn: { paddingVertical: spacing.md, alignItems: "center", borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
    actionText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    dangerBtn: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
    dangerText: { color: colors.danger },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.xxl, fontSize: fontSize.sm },
  });
