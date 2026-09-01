import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type InboxMailListItem } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/** Agendy jsou doménové pojmy z triáže — krátké štítky do seznamu. */
export const AGENDA_LABEL: Record<string, string> = {
  POPTAVKA_ODPOVED: "Nabídka",
  POPTAVKA_PRICHOZI: "Poptávka",
  VYSVETLENI_ZD: "Vysvětlení ZD",
  LHUTA_VYZVA: "Lhůta",
  FAKTURA_PLATBA: "Faktura",
  SMLOUVA_PRAVNI: "Smlouva",
  ZAKAZNIK: "Zákazník",
  JINE: "Jiné",
};

export function isPending(item: InboxMailListItem): boolean {
  const p = item.proposals[0];
  return !!p && (p.status === "NEW" || p.status === "NOTIFIED");
}

export default function AdminInboxScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pendingOnly, setPendingOnly] = useState(true);

  const query = useQuery({
    queryKey: ["admin-inbox", pendingOnly],
    queryFn: ({ signal }) => adminApi.listInbox(pendingOnly, signal),
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("admin", "inboxTitle")}</Text>
        <View style={styles.tabs}>
          {[true, false].map((v) => (
            <Pressable
              key={String(v)}
              onPress={() => setPendingOnly(v)}
              style={[styles.tab, pendingOnly === v && styles.tabActive]}
            >
              <Text style={[styles.tabText, pendingOnly === v && styles.tabTextActive]}>
                {t("admin", v ? "inboxPending" : "inboxAll")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <AppScrollView contentContainerStyle={styles.list}>
        {query.isLoading && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
        {query.isError && <Text style={styles.muted}>{t("admin", "errorBody")}</Text>}
        {query.data?.length === 0 && <Text style={styles.muted}>{t("admin", "inboxEmpty")}</Text>}

        {query.data?.map((item) => (
          <Pressable
            key={item.id}
            style={styles.card}
            onPress={() => router.push(`/(tabs)/admin/inbox/${item.id}`)}
          >
            <View style={styles.cardTop}>
              {!!item.agenda && (
                <Text style={styles.badge}>{AGENDA_LABEL[item.agenda] ?? item.agenda}</Text>
              )}
              {item.urgency === "high" && <Text style={styles.urgent}>⚠️</Text>}
              {!isPending(item) && <Text style={styles.done}>✓ {t("admin", "inboxDecided")}</Text>}
            </View>
            <Text style={styles.subject} numberOfLines={2}>{item.subject}</Text>
            <Text style={styles.from} numberOfLines={1}>{item.fromName || item.fromEmail}</Text>
            {!!item.summary && (
              <Text style={styles.summary} numberOfLines={3}>{item.summary}</Text>
            )}
          </Pressable>
        ))}
      </AppScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    title: { fontSize: fontSize.xl, fontWeight: "700", color: c.text, marginBottom: spacing.sm },
    tabs: { flexDirection: "row", gap: spacing.sm },
    tab: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.sm, backgroundColor: c.card,
    },
    tabActive: { backgroundColor: c.accent },
    tabText: { fontSize: fontSize.sm, color: c.textSubtle, fontWeight: "600" },
    tabTextActive: { color: c.accentForeground },
    list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
    spinner: { marginTop: spacing.xl },
    muted: { color: c.textSubtle, fontSize: fontSize.sm, textAlign: "center", marginTop: spacing.xl },
    card: {
      backgroundColor: c.card, borderRadius: radius.md, padding: spacing.md,
      borderWidth: 1, borderColor: c.border, gap: spacing.xs,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    badge: {
      fontSize: fontSize.xs, color: c.accent, fontWeight: "700",
      textTransform: "uppercase", letterSpacing: 0.5,
    },
    urgent: { fontSize: fontSize.xs },
    done: { fontSize: fontSize.xs, color: c.textSubtle, marginLeft: "auto" },
    subject: { fontSize: fontSize.base, fontWeight: "600", color: c.text },
    from: { fontSize: fontSize.xs, color: c.textSubtle },
    summary: { fontSize: fontSize.sm, color: c.textSubtle, lineHeight: 19 },
  });
