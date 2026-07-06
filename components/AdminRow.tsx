import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/lib/theme-context";
import type { HealthBand } from "@/lib/admin-api";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/** Barvy pro health band badge. */
export function bandColors(band: HealthBand, colors: Colors): { color: string; bg: string } {
  switch (band) {
    case "critical":
      return { color: colors.danger, bg: colors.dangerBg };
    case "at_risk":
      return { color: colors.warning, bg: colors.warningBg };
    case "champion":
    case "healthy":
      return { color: colors.success, bg: colors.successBg };
    default:
      return { color: colors.textSubtle, bg: colors.bg };
  }
}

/**
 * Řádek v seznamu (rozcestník / list položek) — sjednocené styly s settings.
 * Volitelný `right` slot (badge, částka…) a `chevron`.
 */
export function AdminRow({
  label,
  hint,
  right,
  chevron = true,
  onPress,
}: {
  label: string;
  hint?: string;
  right?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.rowPressed : null]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {right}
      {chevron ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

/** Card wrapper (skupina řádků). */
export function AdminCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Barevný badge (health band, status…). */
export function AdminBadge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
      <Text style={{ color, fontSize: fontSize.xs, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowPressed: { backgroundColor: colors.bg },
    label: { fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
    hint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    chevron: { fontSize: 22, color: colors.textFaint, marginLeft: spacing.xs },
  });
