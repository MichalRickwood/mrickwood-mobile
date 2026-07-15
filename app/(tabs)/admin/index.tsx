import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { openAuthedFile } from "@/lib/file-open";
import { AdminCard, AdminRow } from "@/components/AdminRow";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export default function AdminIndexScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [yearOpen, setYearOpen] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  async function openPayouts() {
    setYearOpen(false);
    const y = year.trim() || String(new Date().getFullYear());
    await openAuthedFile(`/api/v2/admin/referral/payout-summary?year=${y}`, `vyplaty-${y}.html`, "text/html");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("admin", "title")}</Text>
      </View>
      <AppScrollView contentContainerStyle={styles.scroll}>
        <AdminCard>
          <AdminRow
            label={t("admin", "usersRow")}
            hint={t("admin", "usersRowHint")}
            onPress={() => router.push("/(tabs)/admin/users")}
          />
          <AdminRow
            label={t("admin", "invoicesRow")}
            hint={t("admin", "invoicesRowHint")}
            onPress={() => router.push("/(tabs)/admin/invoices")}
          />
          <AdminRow
            label={t("admin", "feedbackRow")}
            hint={t("admin", "feedbackRowHint")}
            onPress={() => router.push("/(tabs)/admin/feedback")}
          />
          <AdminRow
            label={t("admin", "commsRow")}
            hint={t("admin", "commsRowHint")}
            onPress={() => router.push("/(tabs)/admin/communications")}
          />
          <AdminRow
            label={t("admin", "socialRow")}
            hint={t("admin", "socialRowHint")}
            onPress={() => router.push("/(tabs)/admin/social")}
          />
        </AdminCard>

        <AdminCard>
          <AdminRow
            label={t("admin", "payoutsRow")}
            hint={t("admin", "payoutsRowHint")}
            chevron={false}
            onPress={() => setYearOpen(true)}
          />
        </AdminCard>
      </AppScrollView>

      <Modal visible={yearOpen} transparent animationType="fade" onRequestClose={() => setYearOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("admin", "payoutPromptTitle")}</Text>
            <TextInput
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              placeholder={t("admin", "payoutPromptMsg")}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setYearOpen(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnText}>{t("admin", "cancel")}</Text>
              </Pressable>
              <Pressable onPress={openPayouts} style={[styles.modalBtn, styles.modalBtnPrimary]}>
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
    header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
    scroll: { padding: spacing.xl, paddingTop: 0 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      padding: spacing.xl,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.lg },
    input: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.base,
      color: colors.text,
    },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md, marginTop: spacing.lg },
    modalBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
    modalBtnPrimary: { backgroundColor: colors.accent },
    modalBtnText: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    modalBtnTextPrimary: { color: colors.accentForeground },
  });
