import { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export default function AdminEmailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const query = useQuery({ queryKey: ["admin-email", id], queryFn: ({ signal }) => adminApi.getEmail(String(id), signal) });
  const detail = query.data;

  if (query.isLoading || !detail) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {query.isLoading ? <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} /> : <Text style={styles.empty}>{t("admin", "empty")}</Text>}
      </SafeAreaView>
    );
  }

  const { log, body } = detail;
  const bodyText = body?.text ?? body?.html ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Field label={t("admin", "emailSubject")} value={log.subject || "—"} styles={styles} />
          <Field label={t("admin", "emailFrom")} value={log.fromAddr} styles={styles} />
          <Field label={t("admin", "emailTo")} value={log.toAddr} styles={styles} />
          <Field label="Status" value={log.status} styles={styles} />
          <Field label="Category" value={log.category} styles={styles} />
          <Field label="Sent" value={new Date(log.sentAt).toLocaleString()} styles={styles} />
          {log.error ? <Field label="Error" value={log.error} styles={styles} /> : null}
        </View>

        <Text style={styles.sectionTitle}>{t("admin", "emailBody")}</Text>
        <View style={styles.card}>
          {bodyText ? <Text style={styles.body}>{bodyText}</Text> : <Text style={styles.empty}>{t("admin", "noBody")}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
    fieldRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.xs },
    fieldLabel: { fontSize: fontSize.sm, color: colors.textSubtle },
    fieldValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500", flexShrink: 1, textAlign: "right" },
    sectionTitle: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm, marginLeft: spacing.xs },
    body: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.lg, fontSize: fontSize.sm },
  });
