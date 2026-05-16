import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFocusEffect, useNavigation } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/endpoints";
import MatchCard from "@/components/MatchCard";
import { useToggleTenderPreference } from "@/lib/use-tender-preference";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/** Sledované — list všech starred zakázek napříč filtry. */
export default function StarredScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const q = useInfiniteQuery({
    queryKey: ["matches", "starred"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      endpoints.myMatches({
        view: "starred",
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const setPreference = useToggleTenderPreference();
  const listRef = useRef<FlatList>(null);
  const navigation = useNavigation();
  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as never, () => {
      if (navigation.isFocused?.()) {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
    });
    return unsub;
  }, [navigation]);

  // Auto-refresh při focusu tabu — když user dá star v Zakázkách a přepne sem,
  // optimistic update nemůže přidat nový řádek (jen modifikovat existující),
  // takže refetchneme. Ref pattern aby useCallback měl prázdné deps — jinak
  // by se efekt re-firoval na každém renderu kvůli unstable react-query objektu.
  const refetchRef = useRef(q.refetch);
  refetchRef.current = q.refetch;
  useFocusEffect(
    useCallback(() => {
      void refetchRef.current();
    }, []),
  );

  const matches = useMemo(() => q.data?.pages.flatMap((p) => p.matches) ?? [], [q.data]);
  const totalCount = q.data?.pages[0]?.totalCount ?? matches.length;
  const empty = !q.isLoading && matches.length === 0;

  const onRefresh = useCallback(() => {
    void q.refetch();
  }, [q]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("matches", "starredTab")}</Text>
        <Text style={styles.subtitle}>{t("matches", "starredCounter", { count: totalCount })}</Text>
      </View>

      <FlatList
        ref={listRef}
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
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={onRefresh}
            tintColor={colors.textSubtle}
          />
        }
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.textSubtle} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          empty ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t("matches", "starredEmptyTitle")}</Text>
              <Text style={styles.emptyBody}>{t("matches", "starredEmptyBody")}</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
    subtitle: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.xs },
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
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    cardFilter: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500", flex: 1 },
    starIcon: { fontSize: 16, color: "#F59E0B", marginLeft: spacing.sm },
    cardTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, lineHeight: 22 },
    cardMeta: { marginTop: spacing.md },
    cardMetaText: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs },
    cardMetaSub: { fontSize: fontSize.xs, color: colors.textSubtle },
    empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
    emptyTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
    emptyBody: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center", paddingHorizontal: spacing.xl },
  });
