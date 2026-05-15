import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { endpoints, type LeadMatchRow } from "@/lib/endpoints";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

export default function MatchesScreen() {
  const router = useRouter();
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  const filtersQuery = useQuery({
    queryKey: ["filters"],
    queryFn: () => endpoints.myFilters(),
  });

  const matchesQuery = useQuery({
    queryKey: ["matches", activeFilterId],
    queryFn: () => endpoints.myMatches(activeFilterId ? { filterId: activeFilterId } : undefined),
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
    if (!activeFilterId) return `Všechny matche · ${matches.length}`;
    const f = filters.find((x) => x.id === activeFilterId);
    return f ? `${f.name} · ${matches.length}` : `Matches · ${matches.length}`;
  }, [activeFilterId, filters, matches.length]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Zakázky</Text>
        <Text style={styles.subtitle}>{headerLabel}</Text>
      </View>

      {filters.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <FilterChip
            label="Vše"
            active={activeFilterId === null}
            onPress={() => setActiveFilterId(null)}
          />
          {filters.map((f) => (
            <FilterChip
              key={f.id}
              label={f.name}
              active={activeFilterId === f.id}
              onPress={() => setActiveFilterId(f.id)}
            />
          ))}
        </ScrollView>
      )}

      <FlatList
        data={matches}
        keyExtractor={(item) => item.matchId}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            onPress={() => router.push({ pathname: "/match/[id]", params: { id: item.matchId } })}
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
              title="Nepodařilo se načíst"
              body={(matchesQuery.error as Error)?.message ?? "Zkuste pull-to-refresh."}
            />
          ) : empty ? (
            <EmptyState
              title="Žádné nové zakázky"
              body="Jakmile se objeví nová zakázka odpovídající vašim filtrům, uvidíte ji tady."
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function MatchCard({ match, onPress }: { match: LeadMatchRow; onPress: () => void }) {
  const t = match.tender;
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
        {t.title}
      </Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText} numberOfLines={1}>
          {t.contractingAuthority.name}
        </Text>
        {t.deadlineAt && (
          <Text style={styles.cardMetaSub}>
            Lhůta {formatDate(t.deadlineAt)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: spacing.xs },
  chipsRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    maxWidth: 200,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  list: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 },
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
  cardMeta: { marginTop: spacing.md, gap: spacing.xs },
  cardMetaText: { fontSize: fontSize.xs, color: colors.textMuted },
  cardMetaSub: { fontSize: fontSize.xs, color: colors.textSubtle },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  emptyBody: { fontSize: fontSize.sm, color: colors.textSubtle, textAlign: "center", paddingHorizontal: spacing.xl },
});
