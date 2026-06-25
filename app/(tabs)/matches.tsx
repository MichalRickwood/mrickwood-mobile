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
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints, type LeadMatchRow } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import FilterPicker from "@/components/FilterPicker";
import LeadsPaywall from "@/components/LeadsPaywall";
import MatchCard from "@/components/MatchCard";
import RegionPickerModal from "@/components/RegionPickerModal";
import ValueRangePickerModal from "@/components/ValueRangePickerModal";
import DeadlinePickerModal from "@/components/DeadlinePickerModal";
import CategoryPickerModal from "@/components/CategoryPickerModal";
import CpvPickerModal from "@/components/CpvPickerModal";
import SaveFilterModal from "@/components/SaveFilterModal";
import SortPickerModal, { type SortKey } from "@/components/SortPickerModal";
import { CZ_REGIONS, regionLabel } from "@/lib/nuts-cz";
import {
  EMPTY_AD_HOC,
  isAdHocActive,
  type AdHocFilter,
} from "@/lib/ad-hoc-filter";
import { useToggleTenderPreference } from "@/lib/use-tender-preference";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

type FilterT = ReturnType<typeof useI18n>["t"];

function fmtMoney(n: number): string {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
    : n >= 1_000
      ? `${Math.round(n / 1_000)}k`
      : String(n);
}

function fmtIsoShort(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.` : iso;
}

function regionChipLabel(codes: string[], t: FilterT, locale: string): string {
  if (codes.length === 0) return t("filters", "chipRegion");
  if (codes.length === 1) return regionLabel(codes[0], locale);
  return t("filters", "chipRegionsN", { count: String(codes.length) });
}

function deadlineChipLabel(from: string | null, to: string | null, t: FilterT): string {
  if (!from && !to) return t("filters", "chipDeadline");
  if (from && to) return `${fmtIsoShort(from)} – ${fmtIsoShort(to)}`;
  if (from) return t("filters", "chipDeadlineFrom", { date: fmtIsoShort(from) });
  return t("filters", "chipDeadlineTo", { date: fmtIsoShort(to!) });
}

function valueChipLabel(min: number | null, max: number | null, t: FilterT): string {
  if (min == null && max == null) return t("filters", "chipPrice");
  if (min != null && max != null) return `${fmtMoney(min)} – ${fmtMoney(max)}`;
  if (min != null) return t("filters", "chipPriceFrom", { value: fmtMoney(min) });
  return t("filters", "chipPriceTo", { value: fmtMoney(max!) });
}

export default function MatchesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const qc = useQueryClient();
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [adHoc, setAdHoc] = useState<AdHocFilter>(EMPTY_AD_HOC);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [valuePickerOpen, setValuePickerOpen] = useState(false);
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [cpvPickerOpen, setCpvPickerOpen] = useState(false);
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortPickerOpen, setSortPickerOpen] = useState(false);
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

  const deleteFilter = useMutation({
    mutationFn: (fid: string) => endpoints.deleteFilter(fid),
    onSuccess: async (_d, fid) => {
      if (activeFilterId === fid) setActiveFilterId(null);
      await qc.invalidateQueries({ queryKey: ["filters"] });
      await qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  // Subscriptions — cache sdílená s RouterGuardem (ten ji naplní fetchQuery před
  // navigací sem), takže pro post-trial usera známe stav OKAMŽITĚ a ukážeme
  // paywall bez problikávání matches loadingu. staleTime 30s.
  const subsQuery = useQuery({
    queryKey: ["account-subscriptions"],
    queryFn: () => endpoints.listSubscriptions(),
    staleTime: 30 * 1000,
  });
  // LEADS neaktivní = má řádek(y), ale žádný ACTIVE ani běžící TRIAL (= po trialu
  // SUSPENDED/CANCELED/expired) → paywall. Žádný LEADS řádek = neřešíme tady
  // (RouterGuard takového usera pošle do onboardingu).
  const leadsInactive = useMemo(() => {
    const rows = (subsQuery.data ?? []).filter((s) => s.service === "LEADS");
    if (rows.length === 0) return false;
    const now = Date.now();
    const anyActive = rows.some(
      (s) =>
        s.state === "ACTIVE" ||
        (s.state === "TRIAL" && !!s.trialEndsAt && new Date(s.trialEndsAt).getTime() > now),
    );
    return !anyActive;
  }, [subsQuery.data]);

  // Při aktivním search / ad-hoc rozšiřujeme page size — in-memory filter
  // by jinak vrátil málo výsledků z 50-item page (i když celkově match je více).
  const hasNarrowingFilter = !!searchDebounced || isAdHocActive(adHoc);
  const matchesQuery = useInfiniteQuery({
    // Neaktivní LEADS → nestřílíme matches (vrátilo by 402); paywall se ukáže z
    // subsQuery rovnou.
    enabled: !leadsInactive,
    queryKey: ["matches", activeFilterId, searchDebounced, adHoc, sort],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      endpoints.myMatches({
        ...(activeFilterId ? { filterId: activeFilterId } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
        ...(searchDebounced ? { q: searchDebounced } : {}),
        ...(adHoc.regions.length > 0 ? { regions: adHoc.regions.join(",") } : {}),
        ...(adHoc.minValue != null ? { minValue: adHoc.minValue } : {}),
        ...(adHoc.maxValue != null ? { maxValue: adHoc.maxValue } : {}),
        ...(adHoc.deadlineFrom ? { deadlineFrom: adHoc.deadlineFrom } : {}),
        ...(adHoc.deadlineTo ? { deadlineTo: adHoc.deadlineTo } : {}),
        ...(adHoc.cpvPrefixes.length > 0
          ? { cpvPrefixes: adHoc.cpvPrefixes.join(",") }
          : {}),
        ...(adHoc.industryTags.length > 0
          ? { industryTags: adHoc.industryTags.join(",") }
          : {}),
        ...(sort !== "newest" ? { sort } : {}),
        ...(hasNarrowingFilter ? { limit: 200 } : {}),
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const filters = filtersQuery.data?.filters ?? [];

  // Auto-pick právě vytvořený filtr — filter/[id] po createFilter zapíše id do
  // ["pendingPickFilterId"]. Až sem doteče seznam, vybereme ho a marker smažeme.
  useEffect(() => {
    const pending = qc.getQueryData<string>(["pendingPickFilterId"]);
    if (pending && filters.some((f) => f.id === pending)) {
      setActiveFilterId(pending);
      qc.removeQueries({ queryKey: ["pendingPickFilterId"] });
    }
  }, [filters, qc]);
  const matches = useMemo(
    () => matchesQuery.data?.pages.flatMap((p) => p.matches) ?? [],
    [matchesQuery.data],
  );
  // Server now applies all filters SQL-side a vrací accurate totalCount.
  // Fallback na matches.length jen když server nepošle (offline cache atd.).
  const totalCount = matchesQuery.data?.pages[0]?.totalCount ?? matches.length;

  const onRefresh = useCallback(() => {
    void matchesQuery.refetch();
    void filtersQuery.refetch();
  }, [matchesQuery, filtersQuery]);

  const empty = !matchesQuery.isLoading && matches.length === 0;
  const errored = matchesQuery.isError;
  // 402 = LEADS service není aktivní → paywall UI místo listu
  const paymentRequired =
    matchesQuery.error instanceof ApiError && matchesQuery.error.status === 402;

  // 402 = LEADS entitlement není aktivní (po vypršení trialu → SUSPENDED).
  // Paywall „aktivuj předplatné" → web (App Store 3.1.1, externí nákup).
  // Úplně nový user (žádný LEADS řádek) se sem nedostane — RouterGuard ho pošle
  // do onboardingu; sem chodí jen post-trial, kde paywall dává smysl.
  if (paymentRequired || leadsInactive) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <LeadsPaywall />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>{t("matches", "title")}</Text>
          <View style={styles.headerControls}>
            <FilterPicker
              filters={filters}
              activeId={activeFilterId}
              count={totalCount}
              onPick={setActiveFilterId}
              onAdd={() => router.push("/filter/new")}
              onEdit={(fid) => router.push({ pathname: "/filter/[id]", params: { id: fid } })}
              onDelete={(fid) => deleteFilter.mutate(fid)}
            />
            <Pressable
              onPress={() => {
                const willOpen = !adHocOpen;
                // Když otevíráme a máme aktivní filter + prázdný adhoc, načteme
                // hodnoty filtru do chipů (user vidí current state, může editovat).
                if (willOpen && activeFilterId && !isAdHocActive(adHoc)) {
                  const f = filters.find((x) => x.id === activeFilterId);
                  if (f) {
                    setAdHoc({
                      regions: f.regions ?? [],
                      minValue: f.minValue,
                      maxValue: f.maxValue,
                      deadlineFrom: null,
                      deadlineTo: null,
                      cpvPrefixes: f.categories ?? [],
                      industryTags: f.industryTags ?? [],
                    });
                  }
                }
                setAdHocOpen(willOpen);
              }}
              hitSlop={6}
              style={({ pressed }) => [
                styles.adHocBtn,
                (adHocOpen || isAdHocActive(adHoc)) && styles.adHocBtnActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.adHocIcon,
                  (adHocOpen || isAdHocActive(adHoc)) && styles.adHocIconActive,
                ]}
              >
                ☰
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={t("matches", "matchesSearchPlaceholder")}
            placeholderTextColor={colors.textFaint}
            style={[styles.searchInput, { flex: 1 }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchInput.length > 0 && (
            <Pressable
              onPress={() => setSearchInput("")}
              hitSlop={10}
              style={({ pressed }) => [
                styles.searchClearBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.searchClearText}>×</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setSortPickerOpen(true)}
            hitSlop={6}
            style={({ pressed }) => [
              styles.adHocBtn,
              sort !== "newest" && styles.adHocBtnActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                styles.adHocIcon,
                sort !== "newest" && styles.adHocIconActive,
              ]}
            >
              ⇅
            </Text>
          </Pressable>
        </View>
        {adHocOpen && (
          <View style={styles.adHocPanel}>
            <Pressable
              onPress={() => setRegionPickerOpen(true)}
              style={({ pressed }) => [
                styles.adHocChip,
                adHoc.regions.length > 0 && styles.adHocChipActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.adHocChipText,
                  adHoc.regions.length > 0 && styles.adHocChipTextActive,
                ]}
              >
                {regionChipLabel(adHoc.regions, t, locale)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setValuePickerOpen(true)}
              style={({ pressed }) => [
                styles.adHocChip,
                (adHoc.minValue != null || adHoc.maxValue != null) && styles.adHocChipActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.adHocChipText,
                  (adHoc.minValue != null || adHoc.maxValue != null) &&
                    styles.adHocChipTextActive,
                ]}
              >
                {valueChipLabel(adHoc.minValue, adHoc.maxValue, t)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDeadlinePickerOpen(true)}
              style={({ pressed }) => [
                styles.adHocChip,
                (adHoc.deadlineFrom || adHoc.deadlineTo) && styles.adHocChipActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.adHocChipText,
                  (adHoc.deadlineFrom || adHoc.deadlineTo) && styles.adHocChipTextActive,
                ]}
              >
                {deadlineChipLabel(adHoc.deadlineFrom, adHoc.deadlineTo, t)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCategoryPickerOpen(true)}
              style={({ pressed }) => [
                styles.adHocChip,
                adHoc.industryTags.length > 0 && styles.adHocChipActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.adHocChipText,
                  adHoc.industryTags.length > 0 && styles.adHocChipTextActive,
                ]}
              >
                {adHoc.industryTags.length > 0
                  ? t("filters", "chipCategoryN", { count: String(adHoc.industryTags.length) })
                  : t("filters", "chipCategory")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCpvPickerOpen(true)}
              style={({ pressed }) => [
                styles.adHocChip,
                adHoc.cpvPrefixes.length > 0 && styles.adHocChipActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.adHocChipText,
                  adHoc.cpvPrefixes.length > 0 && styles.adHocChipTextActive,
                ]}
              >
                {adHoc.cpvPrefixes.length > 0
                  ? t("filters", "chipCpvN", { count: String(adHoc.cpvPrefixes.length) })
                  : t("filters", "chipCpv")}
              </Text>
            </Pressable>
            {isAdHocActive(adHoc) && (
              <>
                <Pressable
                  onPress={() => setAdHoc(EMPTY_AD_HOC)}
                  style={({ pressed }) => [styles.adHocClearChip, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.adHocClearChipText}>{t("matches", "adHocClear")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSaveFilterOpen(true)}
                  style={({ pressed }) => [
                    styles.adHocChip,
                    styles.adHocSaveChip,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.adHocSaveChipText}>{t("filters", "chipSave")}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>

      <RegionPickerModal
        visible={regionPickerOpen}
        initial={adHoc.regions}
        onClose={() => setRegionPickerOpen(false)}
        onApply={(regions) => setAdHoc((prev) => ({ ...prev, regions }))}
      />
      <ValueRangePickerModal
        visible={valuePickerOpen}
        initialMin={adHoc.minValue}
        initialMax={adHoc.maxValue}
        onClose={() => setValuePickerOpen(false)}
        onApply={(min, max) => setAdHoc((prev) => ({ ...prev, minValue: min, maxValue: max }))}
      />
      <DeadlinePickerModal
        visible={deadlinePickerOpen}
        initialFrom={adHoc.deadlineFrom}
        initialTo={adHoc.deadlineTo}
        onClose={() => setDeadlinePickerOpen(false)}
        onApply={(from, to) =>
          setAdHoc((prev) => ({ ...prev, deadlineFrom: from, deadlineTo: to }))
        }
      />
      <CategoryPickerModal
        visible={categoryPickerOpen}
        initial={adHoc.industryTags}
        onClose={() => setCategoryPickerOpen(false)}
        onApply={(tagIds) => setAdHoc((prev) => ({ ...prev, industryTags: tagIds }))}
      />
      <CpvPickerModal
        visible={cpvPickerOpen}
        initial={adHoc.cpvPrefixes}
        onClose={() => setCpvPickerOpen(false)}
        onApply={(p) => setAdHoc((prev) => ({ ...prev, cpvPrefixes: p }))}
      />
      <SortPickerModal
        visible={sortPickerOpen}
        value={sort}
        onClose={() => setSortPickerOpen(false)}
        onPick={setSort}
      />
      <SaveFilterModal
        visible={saveFilterOpen}
        adHoc={adHoc}
        onClose={() => setSaveFilterOpen(false)}
        onSaved={(newId) => {
          setActiveFilterId(newId);
          setAdHoc(EMPTY_AD_HOC);
          setAdHocOpen(false);
        }}
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
          ) : matchesQuery.isFetching && !matchesQuery.isFetchingNextPage ? (
            <View style={styles.loadingState}>
              <Text style={styles.loadingEmoji}>🔍</Text>
              <Text style={styles.loadingTitle}>{t("matches", "loadingTitle")}</Text>
              <Text style={styles.loadingBody}>{t("matches", "loadingBody")}</Text>
              <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.md }} />
            </View>
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
    // Title + filter picker na jednom řádku; když se nevejdou (např. DE
    // "Ausschreibungen" + "Alle Ausschreibungen · N"), picker se zalomí pod
    // nadpis a marginLeft:auto ho drží zarovnaný doprava.
    headerTopRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.sm, rowGap: spacing.sm },
    headerControls: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginLeft: "auto" },
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
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    searchSpinner: { marginLeft: spacing.xs },
    searchClearBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.textSubtle,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: spacing.xs,
    },
    searchClearText: {
      color: colors.bg,
      fontSize: 18,
      lineHeight: 20,
      fontWeight: "700",
    },
    adHocPanel: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    adHocChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    adHocChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    adHocChipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
    adHocChipTextActive: { color: colors.accentForeground, fontWeight: "600" },
    adHocClearChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
    },
    adHocClearChipText: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500" },
    adHocSaveChip: { backgroundColor: colors.success, borderColor: colors.success },
    adHocSaveChipText: { fontSize: fontSize.xs, color: colors.accentForeground, fontWeight: "600" },
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
    entitlementEmpty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
    entitlementTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
    entitlementBody: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center", lineHeight: 20 },
    loadingState: { paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, alignItems: "center" },
    loadingEmoji: { fontSize: 48, marginBottom: spacing.md },
    loadingTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
    loadingBody: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center" },
  });
