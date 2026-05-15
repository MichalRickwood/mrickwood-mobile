import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { endpoints, type LeadMatchRow } from "@/lib/endpoints";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Detail tahá z cache /matches — jeden zdroj pravdy, žádný extra request.
  // Pokud cache nemá řádek (např. push notif → deeplink bez předchozího list view),
  // zafallbackuje na .find = undefined a zobrazí "Nenalezeno".
  const allMatches = qc
    .getQueriesData<{ matches: LeadMatchRow[] }>({ queryKey: ["matches"] })
    .flatMap(([, data]) => data?.matches ?? []);
  const match = allMatches.find((m) => m.matchId === id) ?? null;

  const markViewed = useMutation({
    mutationFn: (matchId: string) => endpoints.markViewed(matchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  useEffect(() => {
    // Auto-mark viewed při otevření detailu (jen poprvé).
    if (match && !match.viewedAt && !markViewed.isPending) {
      markViewed.mutate(match.matchId);
    }
  }, [match, markViewed]);

  async function openInBrowser() {
    if (!match) return;
    await WebBrowser.openBrowserAsync(match.tender.url);
  }

  if (!match) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "Zakázka", headerShown: true }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Zakázka nenalezena</Text>
          <Text style={styles.notFoundBody}>
            Otevřete seznam a zkuste to znovu — možná je třeba pull-to-refresh.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Zpět</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const t = match.tender;
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: t.portalType.toUpperCase(),
          headerShown: true,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: fontSize.sm, fontWeight: "600" },
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.subtitle}>{t.contractingAuthority.name}</Text>

        <View style={styles.metaGrid}>
          {t.deadlineAt && (
            <MetaCell styles={styles} label="Lhůta podání" value={formatDate(t.deadlineAt)} accent />
          )}
          {t.estimatedValue ? (
            <MetaCell styles={styles}
              label="Předpokládaná hodnota"
              value={formatMoney(t.estimatedValue, t.currency)}
            />
          ) : null}
          {t.publishedAt && (
            <MetaCell styles={styles} label="Publikováno" value={formatDate(t.publishedAt)} />
          )}
          {t.contractingAuthority.region && (
            <MetaCell styles={styles} label="Region" value={t.contractingAuthority.region} />
          )}
          {t.cpvCode && <MetaCell styles={styles} label="CPV" value={t.cpvCode} />}
          {t.tenderType && <MetaCell styles={styles} label="Druh řízení" value={t.tenderType} />}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Filtr</Text>
          <Text style={styles.sectionValue}>{match.filterName}</Text>
        </View>

        <Pressable
          onPress={openInBrowser}
          style={({ pressed }) => [styles.cta, pressed && { backgroundColor: colors.accentHover }]}
        >
          <Text style={styles.ctaText}>Otevřít na portálu →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaCell({
  styles,
  label,
  value,
  accent,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.metaCell, accent && styles.metaCellAccent]}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, accent && styles.metaValueAccent]}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(value: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: currency ?? "CZK",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString("cs-CZ")} ${currency ?? "CZK"}`;
  }
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, lineHeight: 30, letterSpacing: -0.3 },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm, fontWeight: "500" },
  metaGrid: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  metaCell: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  metaCellAccent: { borderColor: colors.text },
  metaLabel: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: fontSize.base, color: colors.text, fontWeight: "600", marginTop: spacing.xs },
  metaValueAccent: { color: colors.text },
  section: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  sectionLabel: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  sectionValue: { fontSize: fontSize.base, color: colors.text, marginTop: spacing.xs },
  cta: {
    marginTop: spacing.xxl,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  ctaText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
  notFound: { flex: 1, padding: spacing.xl, justifyContent: "center", alignItems: "center" },
  notFoundTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  notFoundBody: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center" },
  backBtn: { marginTop: spacing.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.accent },
  backBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
});
