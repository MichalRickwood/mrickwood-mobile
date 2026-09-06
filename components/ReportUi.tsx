import { useEffect, useMemo, useState } from "react";
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
  /** Buňka je odkaz — proklik na profil firmy, detail zakázky, segment. */
  tap?: (row: T) => void;
  /** Buňka otevře URL v prohlížeči (zdroj zadání). Vylučuje se s `tap`. */
  url?: (row: T) => string | null | undefined;
}

/** Kolik řádků tabulky ukázat napoprvé a o kolik přidávat. */
export const STRANKA = 20;

/**
 * Tabulka s vodorovným rolováním uvnitř rámečku (ne celé stránky) a stránkováním.
 *
 * `celkem` je počet, který zná server (když ho posílá) — jinak se bere délka pole.
 * Rozdíl je podstatný: pole je uříznuté na stropu dotazu, takže „zobrazeno 20 z 40"
 * by u serverem oříznutého výpisu lhalo o tom, kolik toho ve skutečnosti existuje.
 */
export function RepTable<T>({
  cols,
  rows,
  onRowPress,
  celkem,
  onVice,
  viceNacita,
}: {
  cols: RepColumn<T>[];
  rows: T[];
  onRowPress?: (row: T) => void;
  celkem?: number | null;
  /** Načtení další stránky ze serveru. Bez něj se stránkuje jen v už načtených řádcích. */
  onVice?: () => void;
  viceNacita?: boolean;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [videt, setVidet] = useState(STRANKA);

  // Nová data (jiný filtr, jiný profil) → zpátky na první stránku.
  useEffect(() => setVidet(STRANKA), [rows]);

  const shown = rows.slice(0, videt);
  const total = celkem ?? rows.length;
  const width = cols.reduce((a, c) => a + c.w, 0);
  // Další řádky buď máme doma, nebo si o ně musíme říct serveru.
  const viceDoma = videt < rows.length;
  const viceNaServeru = !viceDoma && !!onVice && rows.length < total;

  return (
    <View style={s.tableWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: width }}>
        <View>
          <View style={s.trHead}>
            {cols.map((c) => (
              <Text key={c.head} style={[s.th, { width: c.w }, c.n && s.right]} numberOfLines={1}>
                {c.head}
              </Text>
            ))}
          </View>
          {shown.map((r, i) => {
            const body = cols.map((c) => {
              const text = c.cell(r);
              const url = c.url?.(r);
              const akce = c.tap ? () => c.tap?.(r) : url ? () => void Linking.openURL(url).catch(() => {}) : null;
              if (!akce) {
                return (
                  <Text key={c.head} style={[s.td, { width: c.w }, c.n && s.rightMono]} numberOfLines={2}>
                    {text}
                  </Text>
                );
              }
              return (
                <Pressable key={c.head} onPress={akce} style={{ width: c.w }} hitSlop={4}>
                  <Text style={[s.td, s.tdLink, c.n && s.rightMono, { width: c.w }]} numberOfLines={2}>
                    {text}
                  </Text>
                </Pressable>
              );
            });
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
      {total > STRANKA || viceNaServeru ? (
        <View style={s.tableFoot}>
          <Text style={s.tableCount}>
            {cislo(shown.length)} / {cislo(total)}
          </Text>
          {viceDoma || viceNaServeru ? (
            <Pressable
              onPress={() => (viceDoma ? setVidet((v) => v + STRANKA) : onVice?.())}
              disabled={viceNacita}
              style={({ pressed }) => [s.viceBtn, pressed && s.viceBtnPressed]}
            >
              {viceNacita ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={s.viceText}>+ {cislo(Math.min(STRANKA, total - shown.length))}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
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

/** Odkaz — buď do prohlížeče (`url`), nebo na jinou obrazovku (`onPress`). */
export function RepLink({
  url,
  onPress,
  title,
}: {
  url?: string | null;
  onPress?: () => void;
  title: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const akce = onPress ?? (url ? () => void Linking.openURL(url).catch(() => {}) : null);
  if (!akce) return <Text style={s.body}>{title}</Text>;
  return (
    <Pressable onPress={akce} hitSlop={6}>
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
    tdLink: { color: colors.link, textDecorationLine: "underline" },
    tableFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    tableCount: { fontSize: fontSize.xs, color: colors.textSubtle, fontVariant: ["tabular-nums"] },
    viceBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      minWidth: 56,
      alignItems: "center",
    },
    viceBtnPressed: { borderColor: colors.text },
    viceText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "700" },

    bars: { gap: spacing.xs },
    barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    barLabel: { fontSize: fontSize.xs, color: colors.textMuted, width: 48 },
    barTrack: { flex: 1, height: 14, backgroundColor: colors.bg, borderRadius: radius.sm, overflow: "hidden" },
    barFill: { height: 14, backgroundColor: colors.accent, borderRadius: radius.sm },
    barValue: { fontSize: fontSize.xs, color: colors.text, width: 92, textAlign: "right", fontVariant: ["tabular-nums"] },


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
