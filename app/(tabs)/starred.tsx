import { useCallback, useMemo } from "react";
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
import { endpoints, type LeadMatchRow } from "@/lib/endpoints";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const LOCALE_MAP: Record<string, string> = { cs: "cs-CZ", en: "en-GB", de: "de-DE" };

/** Sledované — list všech starred zakázek napříč filtry. */
export default function StarredScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
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

  const matches = useMemo(() => q.data?.pages.flatMap((p) => p.matches) ?? [], [q.data]);
  const empty = !q.isLoading && matches.length === 0;

  const onRefresh = useCallback(() => {
    void q.refetch();
  }, [q]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("matches", "starredTab")}</Text>
        <Text style={styles.subtitle}>{t("matches", "starredCounter", { count: matches.length })}</Text>
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardFilter} numberOfLines={1}>
          {match.filterName}
        </Text>
        <Text style={styles.starIcon}>★</Text>
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
