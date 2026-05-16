import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { endpoints, type LeadMatchRow } from "@/lib/endpoints";
import FilterPicker from "@/components/FilterPicker";
import MatchCard from "@/components/MatchCard";
import AdHocFilterModal, {
  EMPTY_AD_HOC,
  isAdHocActive,
  type AdHocFilter,
} from "@/components/AdHocFilterModal";
import { useToggleTenderPreference } from "@/lib/use-tender-preference";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export default function MatchesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [adHoc, setAdHoc] = useState<AdHocFilter>(EMPTY_AD_HOC);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const setPreference = useToggleTenderPreference();

  // Debounce search input → odložený query refetch.
  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const filtersQuery = useQuery({
    queryKey: ["filters"],
    queryFn: () => endpoints.myFilters(),
  });

  // Při aktivním search / ad-hoc rozšiřujeme page size — in-memory filter
  // by jinak vrátil málo výsledků z 50-item page (i když celkově match je více).
  const hasNarrowingFilter = !!searchDebounced || isAdHocActive(adHoc);
  const matchesQuery = useInfiniteQuery({
    queryKey: ["matches", activeFilterId, searchDebounced, adHoc],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      endpoints.myMatches({
        ...(activeFilterId ? { filterId: activeFilterId } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
        ...(searchDebounced ? { q: searchDebounced } : {}),
        ...(adHoc.regions.length > 0 ? { regions: adHoc.regions.join(",") } : {}),
        ...(adHoc.minValue != null ? { minValue: adHoc.minValue } : {}),
        ...(adHoc.maxValue != null ? { maxValue: adHoc.maxValue } : {}),
        ...(hasNarrowingFilter ? { limit: 200 } : {}),
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const filters = filtersQuery.data?.filters ?? [];
  const matches = useMemo(
    () => matchesQuery.data?.pages.flatMap((p) => p.matches) ?? [],
    [matchesQuery.data],
  );
  // Server totalCount nereflektuje in-memory search/region/value filter. Pokud
  // jsou aktivní, počítáme local matches; jinak server total.
  const totalCount = hasNarrowingFilter
    ? matches.length
    : (matchesQuery.data?.pages[0]?.totalCount ?? matches.length);

  const onRefresh = useCallback(() => {
    void matchesQuery.refetch();
    void filtersQuery.refetch();
  }, [matchesQuery, filtersQuery]);

  const empty = !matchesQuery.isLoading && matches.length === 0;
  const errored = matchesQuery.isError;

  const headerLabel = useMemo(() => {
    if (!activeFilterId) {
      return t("matches", "counterAll", { count: totalCount });
    }
    const f = filters.find((x) => x.id === activeFilterId);
    const name = f?.name ?? t("matches", "title");
    return t("matches", "counterFilter", { filter: name, count: totalCount });
  }, [activeFilterId, filters, totalCount, t]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{t("matches", "title")}</Text>
          <View style={styles.headerControls}>
            <FilterPicker
              filters={filters}
              activeId={activeFilterId}
              onPick={setActiveFilterId}
              onAdd={() => router.push("/filter/new")}
              onEdit={(fid) => router.push({ pathname: "/filter/[id]", params: { id: fid } })}
            />
            <Pressable
              onPress={() => setAdHocOpen(true)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.adHocBtn,
                isAdHocActive(adHoc) && styles.adHocBtnActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.adHocIcon,
                  isAdHocActive(adHoc) && styles.adHocIconActive,
                ]}
              >
                ☰
              </Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.subtitle}>{headerLabel}</Text>
        <View style={styles.searchRow}>
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={t("matches", "matchesSearchPlaceholder")}
            placeholderTextColor={colors.textFaint}
            style={[styles.searchInput, { flex: 1 }]}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {(searchInput !== searchDebounced ||
            (hasNarrowingFilter && matchesQuery.isFetching)) && (
            <ActivityIndicator
              size="small"
              color={colors.textSubtle}
              style={styles.searchSpinner}
            />
          )}
        </View>
      </View>

      <AdHocFilterModal
        visible={adHocOpen}
        initial={adHoc}
        onClose={() => setAdHocOpen(false)}
        onApply={setAdHoc}
      />

      <FlatList
        data={matches}
        keyExtractor={(item) => item.matchId}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            onPress={() =>
              router.push({ pathname: "/match/[id]", params: { id: item.matchId } })
            }
            onToggleStar={(tenderId, next) =>
              setPreference.mutate({ tenderId, status: next ? "STARRED" : "NONE" })
            }
            onExclude={(tenderId) =>
              setPreference.mutate({ tenderId, status: "EXCLUDED" })
            }
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={matchesQuery.isRefetching && !matchesQuery.isFetchingNextPage}
            onRefresh={onRefresh}
            tintColor={colors.textSubtle}
          />
        }
        onEndReached={() => {
          if (matchesQuery.hasNextPage && !matchesQuery.isFetchingNextPage) {
            void matchesQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          matchesQuery.isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.textSubtle} />
            </View>
          ) : null
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


const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
    headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    headerControls: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    adHocBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    adHocBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    adHocIcon: { fontSize: 18, color: colors.text, fontWeight: "700", lineHeight: 18 },
    adHocIconActive: { color: colors.accentForeground },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, letterSpacing: -0.5, flexShrink: 1 },
    subtitle: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.xs },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    searchSpinner: { marginLeft: spacing.xs },
    searchInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.text,
    },
    list: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: 100, flexGrow: 1 },
    footerLoader: { paddingVertical: spacing.lg, alignItems: "center" },
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
    titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    priceTag: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingTop: 2 },
    priceText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.link },
    cardTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, lineHeight: 22, flex: 1 },
    cardActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.lg,
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    actionIcon: { fontSize: 22, color: colors.textSubtle },
    actionIconStarred: { color: "#F59E0B" },
    cardMeta: { marginTop: spacing.md },
    cardMetaText: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs },
    cardMetaSub: { fontSize: fontSize.xs, color: colors.textSubtle },
    empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
    emptyTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
    emptyBody: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center", paddingHorizontal: spacing.xl },
  });
