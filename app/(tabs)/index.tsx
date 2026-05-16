import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { endpoints, type LeadMatchRow } from "@/lib/endpoints";
import FilterPicker from "@/components/FilterPicker";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const LOCALE_MAP: Record<string, string> = { cs: "cs-CZ", en: "en-GB", de: "de-DE" };

export default function MatchesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  const filtersQuery = useQuery({
    queryKey: ["filters"],
    queryFn: () => endpoints.myFilters(),
  });

  const matchesQuery = useQuery({
    queryKey: ["matches", activeFilterId],
    queryFn: () =>
      endpoints.myMatches(activeFilterId ? { filterId: activeFilterId } : undefined),
  });

  const filters = filtersQuery.data?.filters ?? [];
  const matches = matchesQuery.data?.matches ?? [];

  const onRefresh = useCallback(() => {
    void matchesQuery.refetch();
    void filtersQuery.refetch();
  }, [matchesQuery, filtersQuery]);

  const empty = !matchesQuery.isLoading && matches.length === 0;
  const errored = matchesQuery.isError;

  const headerLabel = useMemo(() => {
    if (!activeFilterId) {
      return t("matches", "counterAll", { count: matches.length });
    }
    const f = filters.find((x) => x.id === activeFilterId);
    const name = f?.name ?? t("matches", "title");
    return t("matches", "counterFilter", { filter: name, count: matches.length });
  }, [activeFilterId, filters, matches.length, t]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{t("matches", "title")}</Text>
          <FilterPicker
            filters={filters}
            activeId={activeFilterId}
            onPick={setActiveFilterId}
            onAdd={() => router.push("/filter/new")}
            onEdit={(fid) => router.push({ pathname: "/filter/[id]", params: { id: fid } })}
          />
        </View>
        <Text style={styles.subtitle}>{headerLabel}</Text>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.matchId}
        renderItem={({ item }) => (
          <MatchCard
            styles={styles}
            match={item}
            locale={locale}
            deadlineLabel={t("matches", "deadline", { date: "{date}" })}
            onPress={() =>
              router.push({ pathname: "/match/[id]", params: { id: item.matchId } })
            }
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={matchesQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.textSubtle}
          />
        }
        ListEmptyComponent={
          errored ? (
            <EmptyState
              styles={styles}
              title={t("matches", "errorTitle")}
              body={(matchesQuery.error as Error)?.message ?? t("matches", "errorBody")}
            />
          ) : empty ? (
            <EmptyState
              styles={styles}
              title={t("matches", "emptyTitle")}
              body={t("matches", "emptyBody")}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function MatchCard({
  styles,
  match,
  locale,
  deadlineLabel,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  match: LeadMatchRow;
  locale: string;
  deadlineLabel: string;
  onPress: () => void;
}) {
  const tender = match.tender;
  const isNew = !match.viewedAt;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardFilter} numberOfLines={1}>
          {match.filterName}
        </Text>
        {isNew && <View style={styles.newDot} />}
      </View>
      <Text style={styles.cardTitle} numberOfLines={3}>
        {tender.title}
      </Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText} numberOfLines={1}>
          {tender.contractingAuthority.name}
        </Text>
        {tender.deadlineAt && (
          <Text style={styles.cardMetaSub}>
            {deadlineLabel.replace("{date}", formatDate(tender.deadlineAt, locale))}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function EmptyState({
  styles,
  title,
  body,
}: {
  styles: ReturnType<typeof makeStyles>;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(LOCALE_MAP[locale] ?? "cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
    headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, letterSpacing: -0.5, flexShrink: 1 },
    subtitle: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.xs },
    list: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: 100, flexGrow: 1 },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    cardPressed: { borderColor: colors.text },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
    cardFilter: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500", flex: 1 },
    newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.link, marginLeft: spacing.sm },
    cardTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, lineHeight: 22 },
    cardMeta: { marginTop: spacing.md },
    cardMetaText: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs },
    cardMetaSub: { fontSize: fontSize.xs, color: colors.textSubtle },
    empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
    emptyTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
    emptyBody: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center", paddingHorizontal: spacing.xl },
  });
