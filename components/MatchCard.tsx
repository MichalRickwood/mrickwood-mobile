import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LeadMatchRow } from "@/lib/endpoints";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const LOCALE_MAP: Record<string, string> = { cs: "cs-CZ", en: "en-GB", de: "de-DE" };

interface Props {
  match: LeadMatchRow;
  onPress: () => void;
  onToggleStar: (tenderId: number, next: boolean) => void;
  onExclude: (tenderId: number) => void;
}

/** Sdílená karta zakázky pro Zakázky + Sledované taby. */
export default function MatchCard({ match, onPress, onToggleStar, onExclude }: Props) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const tender = match.tender;
  const isNew = !match.viewedAt;
  const starred = tender.starred === true;
  const deadlineLabel = t("matches", "deadline", { date: "{date}" });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.titleRow}>
        <Text style={styles.cardTitle} numberOfLines={3}>
          {tender.title}
        </Text>
        <View style={styles.priceTag}>
          {isNew && <View style={styles.newDot} />}
          {tender.estimatedValue ? (
            <Text style={styles.priceText}>{formatCompactMoney(tender.estimatedValue)}</Text>
          ) : null}
        </View>
      </View>
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
      <View style={styles.cardActions}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onToggleStar(tender.id, !starred);
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={[styles.actionIcon, starred && styles.actionIconStarred]}>
            {starred ? "★" : "☆"}
          </Text>
        </Pressable>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onExclude(tender.id);
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.actionIcon}>👎</Text>
        </Pressable>
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

/** Kompaktní formát ceny: 1.5M, 0.5M, 23.46M (CZK suffix vynecháno). */
function formatCompactMoney(value: number): string {
  const m = value / 1_000_000;
  return `${parseFloat(m.toFixed(2))}M`;
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    cardPressed: { borderColor: colors.text },
    titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    priceTag: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingTop: 2 },
    priceText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.link },
    cardTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, lineHeight: 22, flex: 1 },
    cardMeta: { marginTop: spacing.md },
    cardMetaText: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs },
    cardMetaSub: { fontSize: fontSize.xs, color: colors.textSubtle },
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
  });
