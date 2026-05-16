import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import LeadsPaywall from "@/components/LeadsPaywall";
import MatchCard from "@/components/MatchCard";
import { useToggleTenderPreference } from "@/lib/use-tender-preference";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

type ListView = "starred" | "excluded";

/** Sledované / Odstraněné — list zakázek z UserTenderPreference, switch nahoře. */
export default function StarredScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [view, setView] = useState<ListView>("starred");

  const q = useInfiniteQuery({
    queryKey: ["matches", view],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      endpoints.myMatches({
        view,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const setPreference = useToggleTenderPreference();

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
  const paymentRequired = q.error instanceof ApiError && q.error.status === 402;

  const onRefresh = useCallback(() => {
    void q.refetch();
  }, [q]);

  if (paymentRequired) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Sledované</Text>
        </View>
        <LeadsPaywall />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {view === "starred" ? "Sledované" : "Odstraněné"}
        </Text>
        <Text style={styles.subtitle}>
          {view === "starred"
            ? t("matches", "starredCounter", { count: totalCount })
            : `Odstraněné · ${totalCount}`}
        </Text>
        <View style={styles.segWrap}>
          <Pressable
            onPress={() => setView("starred")}
            style={({ pressed }) => [
              styles.segBtn,
              view === "starred" && styles.segBtnActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.segText, view === "starred" && styles.segTextActive]}>
              ☆ Sledované
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setView("excluded")}
            style={({ pressed }) => [
              styles.segBtn,
              view === "excluded" && styles.segBtnActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.segText, view === "excluded" && styles.segTextActive]}>
              👎 Odstraněné
            </Text>
          </Pressable>
        </View>
      </View>

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
              <Text style={styles.emptyTitle}>
                {view === "starred"
                  ? t("matches", "starredEmptyTitle")
                  : "Žádné odstraněné"}
              </Text>
              <Text style={styles.emptyBody}>
                {view === "starred"
                  ? t("matches", "starredEmptyBody")
                  : "Zakázky, které odstraníte palcem dolů, se sem ukládají. Můžeš je vrátit zpět."}
              </Text>
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
    segWrap: {
      flexDirection: "row",
      marginTop: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
    },
    segBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      alignItems: "center",
    },
    segBtnActive: { backgroundColor: colors.accent },
    segText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    segTextActive: { color: colors.accentForeground, fontWeight: "600" },
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
