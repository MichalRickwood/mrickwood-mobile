import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { cislo } from "@/lib/reporty-format";
import { DATA_COUNTRIES, nazevZeme, vlajka, zemeSerazene } from "@/lib/countries";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Výběr země pro reporty — vlajka, název v jazyce appky a vyhledávání.
 *
 * Nabízí jen země, pro které máme data (`lib/countries`), a u každé ukazuje, kolik
 * zadání za ní stojí — u zemí s pár stovkami řádků je to varování, že report vyjde
 * skoro prázdný.
 *
 * Liší se od `components/CountryPicker.tsx`, který nabízí země podle podpory
 * fakturačních rejstříků (jiný seznam, jiný účel); tenhle jede podle dat Veritry.
 */
export default function CountryField({
  value,
  onChange,
  label,
  /** Úzký trigger (vlajka + kód) do řádku s dalšími filtry. */
  compact = false,
}: {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [hledej, setHledej] = useState("");

  const zeme = useMemo(() => zemeSerazene(locale), [locale]);
  const filtrovane = useMemo(() => {
    const q = hledej.trim().toLowerCase();
    if (!q) return zeme;
    // Hledá se podle názvu i podle kódu — „CZ" i „Česko" musí najít totéž.
    return zeme.filter((z) => z.nazev.toLowerCase().includes(q) || z.code.toLowerCase().includes(q));
  }, [zeme, hledej]);

  const vybrat = (code: string) => {
    onChange(code);
    setOpen(false);
    setHledej("");
  };

  return (
    <View style={compact ? undefined : s.field}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.trigger, compact && s.triggerCompact, pressed && s.triggerPressed]}
      >
        <Text style={s.flag}>{vlajka(value)}</Text>
        <Text style={s.triggerText} numberOfLines={1}>
          {compact ? value : nazevZeme(value, locale)}
        </Text>
        <Text style={s.caret}>⌄</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setOpen(false)}>
          <Pressable style={s.card} onPress={() => {}}>
            <Text style={s.cardTitle}>{t("admin", "repCountry")}</Text>
            <TextInput
              value={hledej}
              onChangeText={setHledej}
              placeholder={t("admin", "repCountrySearch")}
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              autoFocus
              style={s.search}
            />
            <FlatList
              data={filtrovane}
              keyExtractor={(z) => z.code}
              keyboardShouldPersistTaps="handled"
              style={s.list}
              ListEmptyComponent={<Text style={s.empty}>{t("admin", "repEmpty")}</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => vybrat(item.code)}
                  style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                >
                  <Text style={s.flag}>{item.vlajka}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName} numberOfLines={1}>{item.nazev}</Text>
                    <Text style={s.rowMeta}>
                      {item.code} · {t("admin", "repCountryRows", { n: cislo(DATA_COUNTRIES[item.code]) })}
                    </Text>
                  </View>
                  {item.code === value ? <Text style={s.check}>✓</Text> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    field: { gap: 4, flexGrow: 1, minWidth: 150 },
    fieldLabel: { fontSize: fontSize.xs, color: colors.textSubtle },
    trigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    triggerCompact: { paddingHorizontal: spacing.sm },
    triggerPressed: { borderColor: colors.borderHover },
    triggerText: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    flag: { fontSize: 18 },
    caret: { fontSize: fontSize.sm, color: colors.textFaint },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.lg },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
      maxHeight: "80%",
    },
    cardTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    search: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.text,
    },
    list: { flexGrow: 0 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowPressed: { backgroundColor: colors.bg },
    rowName: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    rowMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 1 },
    check: { fontSize: fontSize.base, color: colors.success, fontWeight: "700" },
    empty: { textAlign: "center", color: colors.textSubtle, padding: spacing.lg, fontSize: fontSize.sm },
  });
