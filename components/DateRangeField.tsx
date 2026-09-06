import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DeadlinePickerModal from "@/components/DeadlinePickerModal";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Období od–do jako jedna komponenta: pole ukazuje zvolený rozsah, klepnutí otevře kalendář
 * s výběrem rozsahu (tentýž, který používá filtr lhůt), s omezením min/max a rychlými volbami.
 * Hodnoty YYYY-MM-DD; prázdné = bez omezení. Stejné chování má web (`DateRangeField`).
 */
export default function DateRangeField({
  od, do: doD, onChange, label, minDate = "2016-07-01", maxDate,
}: { od?: string; do?: string; onChange: (od?: string, doD?: string) => void; label?: string; minDate?: string; maxDate?: string }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const dnes = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fmt = (v?: string) => (v ? v.split("-").reverse().map((x, i) => (i < 2 ? String(Number(x)) : x)).join(". ") : "");
  const text = od || doD ? `${fmt(od) || "…"} – ${fmt(doD) || t("admin", "repObdobiDnes")}` : t("admin", "repObdobiVse");
  const presets = [
    { label: t("admin", "repObdobiLetos"), from: `${dnes.getFullYear()}-01-01`, to: null },
    { label: t("admin", "repObdobiLoni"), from: `${dnes.getFullYear() - 1}-01-01`, to: `${dnes.getFullYear() - 1}-12-31` },
    { label: t("admin", "repObdobi12m"), from: iso(new Date(dnes.getFullYear() - 1, dnes.getMonth(), dnes.getDate())), to: null },
    { label: t("admin", "repObdobi3y"), from: iso(new Date(dnes.getFullYear() - 3, dnes.getMonth(), dnes.getDate())), to: null },
    { label: t("admin", "repObdobiVse"), from: null, to: null },
  ];
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label ?? t("admin", "repObdobi")}</Text>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [s.field, pressed && { opacity: 0.7 }]}>
        <Text style={s.fieldText}>📅 {text}</Text>
      </Pressable>
      <DeadlinePickerModal
        visible={open}
        initialFrom={od ?? null}
        initialTo={doD ?? null}
        onClose={() => setOpen(false)}
        onApply={(f, tt) => onChange(f ?? undefined, tt ?? undefined)}
        minDate={minDate}
        maxDate={maxDate ?? iso(dnes)}
        title={t("admin", "repObdobi")}
        presets={presets}
      />
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: { marginBottom: spacing.sm },
    label: { fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 },
    field: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.card },
    fieldText: { fontSize: fontSize.sm, color: colors.text },
  });
