import { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter, type Router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { endpoints, type LeadMatchRow, type TenderDocument } from "@/lib/endpoints";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import {
  iconForKind,
  inferDocExt,
  inferDocKind,
  openTenderDocument,
} from "@/lib/tender-doc-viewer";

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Primárně tahá z cache /matches. Pokud cache nemá řádek (deep link z push
  // notif, nebo cache vypadla), fallback fetchne celý list a najde.
  // Cache tvar: useInfiniteQuery má { pages: [{matches,...}] }; useQuery má
  // { matches: [...] }. Akceptujeme oba.
  type CachedShape =
    | { pages: Array<{ matches: LeadMatchRow[] }>; pageParams: unknown[] }
    | { matches: LeadMatchRow[] };
  const allCached = qc
    .getQueriesData<CachedShape>({ queryKey: ["matches"] })
    .flatMap(([, data]) => {
      if (!data) return [] as LeadMatchRow[];
      if ("pages" in data) return data.pages.flatMap((p) => p.matches);
      if ("matches" in data) return data.matches;
      return [] as LeadMatchRow[];
    });
  const cached = allCached.find((m) => m.matchId === id) ?? null;

  const fallback = useQuery({
    queryKey: ["matches", "fallback-for-detail"],
    queryFn: () => endpoints.myMatches(),
    enabled: !cached && !!id,
    staleTime: 0,
  });

  const match =
    cached ?? fallback.data?.matches.find((m) => m.matchId === id) ?? null;

  const markViewed = useMutation({
    mutationFn: (matchId: string) => endpoints.markViewed(matchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  useEffect(() => {
    // Auto-mark viewed při otevření detailu (jen poprvé). Synthetic IDs
    // (live-{tenderId}) z live searche nemají leadMatch řádek — skip.
    if (
      match &&
      !match.viewedAt &&
      !markViewed.isPending &&
      !match.matchId.startsWith("live-")
    ) {
      markViewed.mutate(match.matchId);
    }
  }, [match, markViewed]);

  async function openInBrowser() {
    if (!match) return;
    await WebBrowser.openBrowserAsync(match.tender.url);
  }

  if (!match) {
    if (fallback.isLoading || fallback.isFetching) {
      return (
        <SafeAreaView style={styles.safe}>
          <Stack.Screen options={{ title: "Zakázka", headerShown: true, headerBackTitle: "Zpět" }} />
          <View style={styles.notFound}>
            <ActivityIndicator color={colors.textSubtle} />
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "Zakázka", headerShown: true, headerBackTitle: "Zpět" }} />
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
          title: "",
          headerShown: true,
          headerBackTitle: "Zpět",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: fontSize.sm, fontWeight: "600" },
          headerRight: () => (
            <Pressable onPress={openInBrowser} hitSlop={8}>
              <Text style={styles.headerCta}>Otevřít na portálu →</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.subtitle}>{t.contractingAuthority.name}</Text>
        {(() => {
          const parts = [
            t.contractingAuthority.ico ? `IČO ${t.contractingAuthority.ico}` : null,
            [t.contractingAuthority.district, t.contractingAuthority.region]
              .filter(Boolean)
              .join(", ") || null,
          ].filter(Boolean);
          if (parts.length === 0) return null;
          return <Text style={styles.subtitleSub}>{parts.join(" · ")}</Text>;
        })()}

        {t.description && t.description.trim().length > 0 && (
          <View style={styles.descSection}>
            <Text style={styles.sectionLabel}>Popis</Text>
            <Text style={styles.descText}>{t.description}</Text>
          </View>
        )}

        <View style={styles.metaGrid}>
          {(t.deadlineAt || t.publishedAt) && (
            <View style={styles.metaRow}>
              {t.deadlineAt && (
                <View style={{ flex: 1 }}>
                  <MetaCell
                    styles={styles}
                    label="Lhůta podání"
                    value={formatDate(t.deadlineAt)}
                    accent
                  />
                </View>
              )}
              {t.publishedAt && (
                <View style={{ flex: 1 }}>
                  <MetaCell
                    styles={styles}
                    label="Publikováno"
                    value={formatDate(t.publishedAt)}
                  />
                </View>
              )}
            </View>
          )}
          {t.estimatedValue ? (
            <MetaCell
              styles={styles}
              label="Předpokládaná hodnota"
              value={formatMoney(t.estimatedValue, t.currency)}
            />
          ) : null}
        </View>

        {(() => {
          const docs = t.documents ?? [];
          if (docs.length === 0) return null;
          return (
            <View style={styles.docsSection}>
              <Text style={styles.sectionLabel}>Dokumenty ({docs.length})</Text>
              {docs.map((d, i) => (
                <DocumentRow key={`${d.url}-${i}`} styles={styles} doc={d} router={router} />
              ))}
            </View>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

function DocumentRow({
  styles,
  doc,
  router,
}: {
  styles: ReturnType<typeof makeStyles>;
  doc: TenderDocument;
  router: Router;
}) {
  const kind = inferDocKind(doc);
  const ext = inferDocExt(doc);
  const meta = [ext?.toUpperCase(), formatFileSize(doc.fileSizeBytes)]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      onPress={() => void openTenderDocument(doc, router)}
      style={({ pressed }) => [styles.docRow, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.docIcon}>
        <Text style={styles.docIconText}>{iconForKind(kind)}</Text>
      </View>
      <View style={styles.docText}>
        <Text style={styles.docName} numberOfLines={2}>
          {doc.name}
        </Text>
        {meta && <Text style={styles.docMeta}>{meta}</Text>}
      </View>
      <Text style={styles.docChevron}>›</Text>
    </Pressable>
  );
}

function formatFileSize(bytes: number | null): string | null {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
  subtitleSub: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.xs },
  metaGrid: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  metaRow: { flexDirection: "row", gap: spacing.md },
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
  descSection: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  descText: { fontSize: fontSize.sm, color: colors.text, marginTop: spacing.sm, lineHeight: 20 },
  docsSection: { marginTop: spacing.xl },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  docIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  docIconText: { fontSize: 18 },
  docText: { flex: 1 },
  docName: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
  docMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  docChevron: { fontSize: 20, color: colors.textFaint, marginLeft: spacing.sm },
  headerCta: { color: colors.link, fontSize: fontSize.sm, fontWeight: "600" },
  notFound: { flex: 1, padding: spacing.xl, justifyContent: "center", alignItems: "center" },
  notFoundTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  notFoundBody: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center" },
  backBtn: { marginTop: spacing.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.accent },
  backBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
});
