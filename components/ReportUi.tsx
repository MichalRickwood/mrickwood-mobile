import { useMemo } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import { cislo } from "@/lib/reporty-format";

/**
 * Stavební prvky obrazovek Veritra · Reporty.
 *
 * Reporty jsou husté tabulky nad miliony řádků — na mobilu se nedají naskládat
 * do jedné mřížky, proto: karta se sekcí, dlaždice pro souhrnná čísla, řádky
 * label/hodnota, vodorovně rolovatelná tabulka a jednoduchý sloupcový graf
 * z `View`ů (žádná grafová knihovna — nepřidáváme závislost kvůli pěti sloupcům).
 */

// ── Formátování ─────────────────────────────────────────────────────────────

/** Formátovací funkce žijí v `lib/reporty-format` (čisté, bez React Native, a proto
 *  ověřitelné proti ukázkovým odpovědím API). Tady se jen přeexportují, ať obrazovky
 *  importují prvky i formátování z jednoho místa. */
export { castka, castkaKratce, cislo, datum, num, podil, pomer, zkrat } from "@/lib/reporty-format";

// ── Prvky ───────────────────────────────────────────────────────────────────

/** Karta jedné sekce reportu. */
export function RepSection({
  title,
  hint,
  right,
  children,
}: {
  title?: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.section}>
      {title ? (
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/** Mřížka souhrnných čísel. Položky bez hodnoty se dají vynechat už voláním. */
export function RepKpi({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!items.length) return null;
  return (
    <View style={s.kpiGrid}>
      {items.map((it) => (
        <View key={it.label} style={s.kpiTile}>
          <Text style={s.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {it.value}
          </Text>
          <Text style={s.kpiLabel}>{it.label}</Text>
          {it.hint ? <Text style={s.kpiHint}>{it.hint}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** Řádek label → hodnota. */
export function RepRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.kvRow}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={[s.kvValue, mono && s.mono]}>{value}</Text>
    </View>
  );
}

export interface RepColumn<T> {
  /** Hlavička sloupce. */
  head: string;
  /** Šířka v px — tabulka roluje vodorovně, takže se nic nesmršťuje. */
  w: number;
  /** Číselný sloupec = zarovnat vpravo, tabulární číslice. */
  n?: boolean;
  cell: (row: T) => string;
}

/** Tabulka s vodorovným rolováním uvnitř rámečku (ne celé stránky). */
export function RepTable<T>({
  cols,
  rows,
  onRowPress,
  max,
}: {
  cols: RepColumn<T>[];
  rows: T[];
  onRowPress?: (row: T) => void;
  /** Strop řádků — zbytek se schová za hlášku „a další". */
  max?: number;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const shown = max ? rows.slice(0, max) : rows;
  const total = cols.reduce((a, c) => a + c.w, 0);
  return (
    <View style={s.tableWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: total }}>
        <View>
          <View style={s.trHead}>
            {cols.map((c) => (
              <Text key={c.head} style={[s.th, { width: c.w }, c.n && s.right]} numberOfLines={1}>
                {c.head}
              </Text>
            ))}
          </View>
          {shown.map((r, i) => {
            const body = cols.map((c) => (
              <Text key={c.head} style={[s.td, { width: c.w }, c.n && s.rightMono]} numberOfLines={2}>
                {c.cell(r)}
              </Text>
            ));
            return onRowPress ? (
              <Pressable key={i} onPress={() => onRowPress(r)} style={({ pressed }) => [s.tr, pressed && s.trPressed]}>
                {body}
              </Pressable>
            ) : (
              <View key={i} style={s.tr}>
                {body}
              </View>
            );
          })}
        </View>
      </ScrollView>
      {max && rows.length > max ? <Text style={s.tableMore}>… a dalších {rows.length - max}</Text> : null}
    </View>
  );
}

/** Vodorovné sloupce — trend po letech, rozdělení počtu nabídek. Bez knihovny. */
export function RepBars({
  data,
  formatValue,
}: {
  data: { label: string; value: number; note?: string }[];
  formatValue?: (v: number) => string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const max = Math.max(...data.map((d) => d.value), 0);
  if (!data.length || max <= 0) return null;
  const fmt = formatValue ?? ((v: number) => cislo(v));
  return (
    <View style={s.bars}>
      {data.map((d) => (
        <View key={d.label} style={s.barRow}>
          <Text style={s.barLabel} numberOfLines={1}>
            {d.label}
          </Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.max(2, (100 * d.value) / max)}%` }]} />
          </View>
          <Text style={s.barValue} numberOfLines={1}>
            {fmt(d.value)}
          </Text>
        </View>
      ))}
      {data.some((d) => d.note) ? (
        <Text style={s.hint}>{data.filter((d) => d.note).map((d) => `${d.label}: ${d.note}`).join(" · ")}</Text>
      ) : null}
    </View>
  );
}

/** Přepínač hodnot (země, druh profilu…). */
export function RepChips<T extends string>({
  values,
  value,
  onChange,
  labels,
}: {
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {values.map((v) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[s.chip, value === v && s.chipActive]}>
          <Text style={[s.chipText, value === v && s.chipTextActive]}>{labels?.[v] ?? v}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Textové pole filtru s popiskem. */
export function RepField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  width,
  autoCapitalize = "none",
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad";
  width?: number;
  autoCapitalize?: "none" | "characters";
  maxLength?: number;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[s.field, width ? { width } : { flex: 1, minWidth: 120 }]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
        style={s.input}
      />
    </View>
  );
}

/** Primární tlačítko filtru. */
export function RepButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.btn, disabled && s.btnDisabled, pressed && !disabled && s.btnPressed]}
    >
      <Text style={s.btnText}>{title}</Text>
    </Pressable>
  );
}

/** Odkaz otevíraný v prohlížeči (zdroj zadání, profil zadavatele). */
export function RepLink({ url, title }: { url: string | null | undefined; title: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!url) return <Text style={s.body}>{title}</Text>;
  return (
    <Pressable onPress={() => void Linking.openURL(url).catch(() => {})}>
      <Text style={s.link}>{title}</Text>
    </Pressable>
  );
}

/** Sdílené stavy: načítání / chyba / prázdno. `chybiNaServeru` = OTA předběhla backend. */
export function RepState({
  loading,
  error,
  errorTitle,
  retryLabel,
  onRetry,
  empty,
}: {
  loading?: boolean;
  error?: string | null;
  errorTitle?: string;
  retryLabel?: string;
  onRetry?: () => void;
  empty?: string | null;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (loading) return <ActivityIndicator color={colors.textSubtle} style={{ marginTop: spacing.xxl }} />;
  if (error) {
    return (
      <View style={s.stateBox}>
        {errorTitle ? <Text style={s.stateTitle}>{errorTitle}</Text> : null}
        <Text style={s.stateBody}>{error}</Text>
        {onRetry && retryLabel ? (
          <Pressable onPress={onRetry} style={s.retry}>
            <Text style={s.retryText}>{retryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (empty) return <Text style={s.empty}>{empty}</Text>;
  return null;
}

/** Popiska/vysvětlivka pod nadpisem. */
export function RepHint({ children }: { children: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={s.hint}>{children}</Text>;
}

export function RepBadge({ text, tone = "muted" }: { text: string; tone?: "muted" | "yes" | "no" | "warn" }) {
  const { colors } = useTheme();
  const map = {
    muted: { color: colors.textMuted, bg: colors.bg },
    yes: { color: colors.success, bg: colors.successBg },
    no: { color: colors.danger, bg: colors.dangerBg },
    warn: { color: colors.warning, bg: colors.warningBg },
  } as const;
  const c = map[tone];
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
      <Text style={{ color: c.color, fontSize: fontSize.xs, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}

export const makeReportStyles = makeStyles;

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    section: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    sectionTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text, flexShrink: 1 },
    hint: { fontSize: fontSize.xs, color: colors.textSubtle, lineHeight: 16 },
    body: { fontSize: fontSize.sm, color: colors.text },
    link: { fontSize: fontSize.sm, color: colors.link, textDecorationLine: "underline" },
    mono: { fontVariant: ["tabular-nums"] },

    kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    kpiTile: {
      flexGrow: 1,
      flexBasis: "30%",
      minWidth: 96,
      backgroundColor: colors.bg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    kpiValue: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
    kpiLabel: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    kpiHint: { fontSize: 10, color: colors.textFaint, marginTop: 1 },

    kvRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    kvLabel: { fontSize: fontSize.sm, color: colors.textSubtle, flexShrink: 1 },
    kvValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600", textAlign: "right", flexShrink: 1 },

    tableWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" },
    trHead: { flexDirection: "row", backgroundColor: colors.bg },
    th: { fontSize: 11, fontWeight: "700", color: colors.textMuted, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
    tr: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    trPressed: { backgroundColor: colors.bg },
    td: { fontSize: 11, color: colors.text, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
    right: { textAlign: "right" },
    rightMono: { textAlign: "right", fontVariant: ["tabular-nums"] },
    tableMore: { fontSize: fontSize.xs, color: colors.textSubtle, padding: spacing.sm, backgroundColor: colors.bg },

    bars: { gap: spacing.xs },
    barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    barLabel: { fontSize: fontSize.xs, color: colors.textMuted, width: 48 },
    barTrack: { flex: 1, height: 14, backgroundColor: colors.bg, borderRadius: radius.sm, overflow: "hidden" },
    barFill: { height: 14, backgroundColor: colors.accent, borderRadius: radius.sm },
    barValue: { fontSize: fontSize.xs, color: colors.text, width: 92, textAlign: "right", fontVariant: ["tabular-nums"] },

    chips: { gap: spacing.sm, paddingVertical: 2 },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    chipTextActive: { color: colors.accentForeground, fontWeight: "700" },

    field: { gap: 4 },
    fieldLabel: { fontSize: fontSize.xs, color: colors.textSubtle },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.text,
    },

    btn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPressed: { backgroundColor: colors.accentHover },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "700" },

    stateBox: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    stateTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
    stateBody: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
    retry: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    retryText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    empty: { textAlign: "center", color: colors.textSubtle, marginTop: spacing.xl, fontSize: fontSize.sm },
  });
}
