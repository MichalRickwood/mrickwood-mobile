import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { AdminCard } from "@/components/AdminRow";
import { adminApi, type VymPripad, type VymStavPripadu } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import {
  STAV_DOPISU_KLIC,
  STAV_PRIPADU_KLIC,
  STUPEN_KLIC,
  TYP_VYTEZENI_KLIC,
  formatCastka,
  formatDatum,
} from "@/lib/vymahani-format";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const STAVY: VymStavPripadu[] = ["OTEVRENY", "ODPOVEZENO", "VYRESENO", "ZAMITNUTO", "NEDORUCITELNY"];

/**
 * Přehled vymáhání — souhrn, seznam případů s filtrem na stav a rozbalovací
 * detail (odeslané dopisy, došlé odpovědi a co z nich AI vytěžila).
 */
export default function DatovkaPrehledScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [filtr, setFiltr] = useState<VymStavPripadu | "VSE">("VSE");
  const [rozbaleny, setRozbaleny] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ["ds-prehled", filtr],
    queryFn: ({ signal }) =>
      adminApi.getVymahaniPrehled(filtr === "VSE" ? {} : { stav: filtr }, signal),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      </SafeAreaView>
    );
  }

  const souhrn = query.data?.souhrn;
  const pripady = query.data?.pripady ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <AppScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.textSubtle}
          />
        }
      >
        {!!souhrn && (
          <AdminCard style={styles.card}>
            <View style={styles.souhrnRada}>
              <Souhrn label={t("admin", "dsSouhrnOtevrene")} hodnota={souhrn.otevrene} styles={styles} />
              <Souhrn label={t("admin", "dsSouhrnOdpovezeno")} hodnota={souhrn.odpovezeno} styles={styles} />
              <Souhrn label={t("admin", "dsSouhrnVyreseno")} hodnota={souhrn.vyreseno} styles={styles} />
            </View>
            <View style={styles.souhrnRada}>
              <Souhrn label={t("admin", "dsSouhrnNedorucitelne")} hodnota={souhrn.nedorucitelne} styles={styles} />
              <Souhrn label={t("admin", "dsSouhrnCekaNavrh")} hodnota={souhrn.cekaNavrh} styles={styles} />
            </View>
          </AdminCard>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtry}>
          {(["VSE", ...STAVY] as const).map((s) => (
            <Pressable key={s} onPress={() => setFiltr(s)} style={[styles.chip, filtr === s && styles.chipAktivni]}>
              <Text style={[styles.chipText, filtr === s && styles.chipTextAktivni]}>
                {s === "VSE" ? t("admin", "dsFiltrVse") : t("admin", STAV_PRIPADU_KLIC[s])}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {query.isError && <Text style={styles.prazdno}>{t("admin", "dsChybaNacteni")}</Text>}
        {!query.isError && pripady.length === 0 && <Text style={styles.prazdno}>{t("admin", "dsPrehledEmpty")}</Text>}

        {pripady.map((p) => (
          <RadekPripadu
            key={p.id}
            pripad={p}
            rozbaleny={rozbaleny === p.id}
            onPrepnout={() => setRozbaleny(rozbaleny === p.id ? null : p.id)}
          />
        ))}
      </AppScrollView>
    </SafeAreaView>
  );
}

function Souhrn({
  label,
  hodnota,
  styles,
}: {
  label: string;
  hodnota: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.souhrnPolozka}>
      <Text style={styles.souhrnCislo}>{hodnota}</Text>
      <Text style={styles.souhrnLabel}>{label}</Text>
    </View>
  );
}

/** Případ = jedna zakázka, kterou vymáháme. Rozbalením se ukáže celá historie. */
function RadekPripadu({
  pripad,
  rozbaleny,
  onPrepnout,
}: {
  pripad: VymPripad;
  rozbaleny: boolean;
  onPrepnout: () => void;
}) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <AdminCard style={styles.card}>
      <Pressable onPress={onPrepnout}>
        <View style={styles.headRow}>
          <Text style={styles.stavBadge}>{t("admin", STAV_PRIPADU_KLIC[pripad.stav])}</Text>
          {pripad.stupen > 0 && (
            <Text style={styles.stupen}>{t("admin", "dsStupenLabel", { n: pripad.stupen })}</Text>
          )}
          <Text style={styles.spoustec}>
            {t("admin", pripad.spoustec === "smlouva_v_registru" ? "dsSpoustecSmlouva" : "dsSpoustec3m")}
          </Text>
        </View>
        <Text style={styles.nazev} numberOfLines={rozbaleny ? undefined : 2}>
          {pripad.nazev}
        </Text>
        <Text style={styles.meta}>
          {pripad.zadavatel} · IČO {pripad.ico}
          {pripad.databoxId ? ` · ${pripad.databoxId}` : ""}
        </Text>
        <Text style={styles.meta}>
          {t("admin", "dsLhuta")} {formatDatum(pripad.lhutaAt, locale)}
        </Text>
      </Pressable>

      {rozbaleny && (
        <View style={styles.detail}>
          <Text style={styles.label}>{t("admin", "dsDopisyLabel")}</Text>
          {pripad.dopisy.map((d, i) => (
            <Text key={i} style={styles.radek}>
              {t("admin", "dsStupenLabel", { n: d.stupen })} · {t("admin", STAV_DOPISU_KLIC[d.stav])}
              {d.odeslanoAt ? ` · ${formatDatum(d.odeslanoAt, locale)}` : ""}
              {d.dorucenoAt ? ` → ${formatDatum(d.dorucenoAt, locale)}` : ""}
              {d.dmId ? ` · ${d.dmId}` : ""}
            </Text>
          ))}

          <Text style={styles.label}>{t("admin", "dsOdpovediLabel")}</Text>
          {pripad.odpovedi.length === 0 && <Text style={styles.radek}>{t("admin", "dsZadneOdpovedi")}</Text>}
          {pripad.odpovedi.map((o) => (
            <View key={o.dmId} style={styles.odpoved}>
              <Text style={styles.radek}>
                {formatDatum(o.dodanoAt, locale)} · {o.predmet ?? o.dmId}
              </Text>
              {!!o.vytezeno && (
                <View style={styles.vytezeno}>
                  <Text style={styles.radekSilny}>
                    {t("admin", "dsVytezeno")}: {t("admin", TYP_VYTEZENI_KLIC[o.vytezeno.typ] ?? "dsTypJine")}
                    {` · ${t("admin", "dsJistota")} ${Math.round(o.vytezeno.jistota * 100)} %`}
                  </Text>
                  {!!o.vytezeno.vitez && (
                    <Text style={styles.radek}>
                      {t("admin", "dsVitez")}: {o.vytezeno.vitez.nazev}
                      {o.vytezeno.vitez.cena != null ? ` · ${formatCastka(o.vytezeno.vitez.cena, locale)}` : ""}
                    </Text>
                  )}
                  {!!o.vytezeno.ucastnici?.length && (
                    <Text style={styles.radek}>
                      {t("admin", "dsUcastnici")}: {o.vytezeno.ucastnici.map((u) => u.nazev).join(", ")}
                    </Text>
                  )}
                  {!!o.vytezeno.poznamka && <Text style={styles.radek}>{o.vytezeno.poznamka}</Text>}
                </View>
              )}
            </View>
          ))}

          {pripad.stupen > 0 && (
            <Text style={styles.hint}>
              {t("admin", STUPEN_KLIC[pripad.stupen] ?? "dsStupen1")}
            </Text>
          )}
        </View>
      )}
    </AdminCard>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl },
    spinner: { marginTop: spacing.xxl },
    card: { padding: spacing.lg },
    souhrnRada: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.sm },
    souhrnPolozka: { flex: 1 },
    souhrnCislo: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
    souhrnLabel: { fontSize: fontSize.xs, color: colors.textSubtle },
    filtry: { gap: spacing.sm, paddingBottom: spacing.md },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipAktivni: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontSize: fontSize.sm, color: colors.text },
    chipTextAktivni: { color: colors.accentForeground, fontWeight: "600" },
    prazdno: { fontSize: fontSize.base, color: colors.textSubtle, textAlign: "center", marginVertical: spacing.xl },
    headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
    stavBadge: {
      fontSize: fontSize.xs,
      fontWeight: "700",
      color: colors.accentForeground,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      overflow: "hidden",
    },
    stupen: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: "600" },
    spoustec: { fontSize: fontSize.xs, color: colors.textSubtle, flex: 1, textAlign: "right" },
    nazev: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    meta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    detail: { marginTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    label: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.md, marginBottom: spacing.xs },
    radek: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: 2 },
    radekSilny: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600", marginBottom: 2 },
    odpoved: { marginBottom: spacing.sm },
    vytezeno: {
      marginTop: spacing.xs,
      padding: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.bg,
    },
    hint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.md },
  });
