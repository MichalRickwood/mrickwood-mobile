import { useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { AppScrollView } from "@/components/AppScroll";
import {
  RepBars, RepButton, RepField, RepHint, RepKpi, RepRow, RepSection, RepState, RepTable,
  castkaKratce, cislo, num, podil, pomer, zkrat,
} from "@/components/ReportUi";
import {
  jePrazdno, jePrilisVelky, reportChyba, reportyApi,
  type CenoveHladinyData, type Kvartily, type Segment,
} from "@/lib/reporty-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, spacing, type Colors } from "@/constants/theme";

const ROK = new Date().getFullYear();

/**
 * Cenové hladiny v segmentu země × CPV prefix × roky (volitelně NUTS).
 *
 * Kvartily se počítají z EUR (server přepočítává kurzem z téhož řádku), proto se
 * u nich vypisuje EUR a měny v segmentu zvlášť — v CZ segmentu je skoro všechno
 * CZK a míchat obojí v jednom čísle by lhalo.
 */
export default function ReportCenoveHladinyScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [country, setCountry] = useState("CZ");
  const [cpv, setCpv] = useState("45");
  const [od, setOd] = useState(String(ROK - 2));
  const [doR, setDoR] = useState(String(ROK));
  const [nuts, setNuts] = useState("");
  const [segment, setSegment] = useState<Segment | null>(null);

  const q = useQuery({
    queryKey: ["rep-cenove-hladiny", segment],
    queryFn: ({ signal }) => reportyApi.cenoveHladiny(segment as Segment, signal),
    enabled: !!segment,
    retry: false,
  });

  const cpvOk = /^\d{2,5}$/.test(cpv);
  const chyba = q.error ? reportChyba(q.error) : null;
  const d = q.data;
  const plne: CenoveHladinyData | null = d && !jePrazdno(d) && !jePrilisVelky(d) ? d : null;

  const nacti = () =>
    setSegment({
      country: country.toUpperCase().slice(0, 2) || "CZ",
      cpv,
      rokOd: Number(od) || ROK - 2,
      rokDo: Number(doR) || ROK,
      nuts: nuts.trim().toUpperCase() || undefined,
    });

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <AppScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => segment && void q.refetch()} tintColor={colors.textSubtle} />
        }
      >
        <RepSection title={t("admin", "repFilters")}>
          <View style={s.filterRow}>
            <RepField
              label={t("admin", "repCountry")}
              value={country}
              onChangeText={(v) => setCountry(v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
              width={72}
              autoCapitalize="characters"
              maxLength={2}
            />
            <RepField
              label={t("admin", "repCpv")}
              value={cpv}
              onChangeText={(v) => setCpv(v.replace(/\D/g, "").slice(0, 5))}
              placeholder={t("admin", "repCpvHint")}
              keyboardType="number-pad"
              width={104}
            />
            <RepField
              label={`NUTS (${t("admin", "repOptional")})`}
              value={nuts}
              onChangeText={(v) => setNuts(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
              autoCapitalize="characters"
              width={104}
            />
          </View>
          <View style={s.filterRow}>
            <RepField label={t("admin", "repYearFrom")} value={od} onChangeText={(v) => setOd(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" width={92} />
            <RepField label={t("admin", "repYearTo")} value={doR} onChangeText={(v) => setDoR(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" width={92} />
            <View style={s.btnWrap}>
              <RepButton title={t("admin", "repLoad")} onPress={nacti} disabled={!cpvOk} />
            </View>
          </View>
          {!cpvOk ? <RepHint>{t("admin", "repCpvInvalid")}</RepHint> : null}
        </RepSection>

        <RepState
          loading={q.isLoading}
          error={chyba ? (chyba.chybiNaServeru ? t("admin", "repNotDeployed") : chyba.zprava) : null}
          errorTitle={t("admin", "repErrorTitle")}
          retryLabel={t("admin", "repRetry")}
          onRetry={() => void q.refetch()}
        />

        {d && jePrazdno(d) ? <RepSection><RepHint>{t("admin", "repSegmentEmpty")}</RepHint></RepSection> : null}
        {d && jePrilisVelky(d) ? (
          <RepSection>
            <RepHint>{t("admin", "repSegmentTooBig", { n: cislo(d.prekroceno) })}</RepHint>
          </RepSection>
        ) : null}

        {plne ? (
          <>
            <RepSection title={t("admin", "repSample")}>
              <RepKpi
                items={[
                  { label: t("admin", "repAwards"), value: cislo(plne.pocet) },
                  { label: t("admin", "repCompetitive"), value: cislo(plne.stats.souteze) },
                  { label: t("admin", "repDirect"), value: cislo(plne.stats.prima) },
                  {
                    label: t("admin", "repAvgBids"),
                    value: cislo(plne.stats.prum_nabidek, 1),
                    hint: `n = ${cislo(plne.stats.s_poctem_nabidek)}`,
                  },
                  {
                    label: t("admin", "repOneBidShare"),
                    value: podil(plne.stats.podil_jedne_nabidky, 1),
                    hint: `n = ${cislo(plne.stats.s_poctem_nabidek)}`,
                  },
                  { label: t("admin", "repPriceEqualsEstimate"), value: cislo(plne.stats.cena_rovna_odhadu) },
                ]}
              />
              {plne.meny.length ? (
                <RepHint>
                  {t("admin", "repCenyEurNote", {
                    meny: plne.meny.map((m) => `${m.currency} ${cislo(m.n)}×`).join(", "),
                  })}
                </RepHint>
              ) : null}
            </RepSection>

            <KvartilySekce title={t("admin", "repCenyPrices")} k={plne.ceny} mena="EUR" />
            <KvartilySekce title={t("admin", "repCenyEstimates")} k={plne.odhady} mena="EUR" />
            <KvartilySekce title={t("admin", "repCenyRatio")} k={plne.pomer} des={3} />

            {plne.rozdeleniNabidek.length ? (
              <RepSection title={t("admin", "repBidDistribution")}>
                <RepBars
                  data={plne.rozdeleniNabidek.map((r) => ({
                    label: r.posledni ? t("admin", "repBidsTenPlus") : String(r.bid_count),
                    value: r.n,
                  }))}
                  formatValue={(v) => `${cislo(v)} (${pomer(v, plne.stats.s_poctem_nabidek)})`}
                />
              </RepSection>
            ) : null}

            {plne.roky.length ? (
              <RepSection title={t("admin", "repTrendByYear")}>
                <RepBars
                  data={[...plne.roky].reverse().map((r) => ({ label: String(r.rok), value: r.median_eur ?? 0 }))}
                  formatValue={(v) => castkaKratce(v, "EUR")}
                />
                <RepTable
                  rows={plne.roky}
                  cols={[
                    { head: "rok", w: 56, cell: (r) => String(r.rok) },
                    { head: t("admin", "repAwards"), w: 66, n: true, cell: (r) => cislo(r.n) },
                    { head: t("admin", "repMedianPrice"), w: 116, n: true, cell: (r) => castkaKratce(r.median_eur, "EUR") },
                    { head: t("admin", "repMedianRatio"), w: 100, n: true, cell: (r) => cislo(r.median_pomer, 3) },
                    { head: t("admin", "repAvgBids"), w: 80, n: true, cell: (r) => cislo(r.prum_nabidek, 1) },
                    { head: "objem", w: 116, n: true, cell: (r) => castkaKratce(r.objem_eur, "EUR") },
                  ]}
                />
              </RepSection>
            ) : null}

            {plne.vitezove.length ? (
              <RepSection title={t("admin", "repTopWinners")}>
                <RepTable
                  rows={plne.vitezove}
                  cols={[
                    { head: "firma", w: 210, cell: (r) => zkrat(r.name, 60) },
                    { head: t("admin", "repRegNo"), w: 88, cell: (r) => r.reg ?? "–" },
                    { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.n) },
                    { head: "objem", w: 116, n: true, cell: (r) => castkaKratce(r.eur, "EUR") },
                  ]}
                />
              </RepSection>
            ) : null}
          </>
        ) : null}

        <View style={{ height: spacing.xl }} />
      </AppScrollView>
    </SafeAreaView>
  );
}

/** Kvartilová tabulka. `n` je součást výstupu — bez něj by se čísla nedala vážit. */
function KvartilySekce({ title, k, mena, des = 0 }: { title: string; k: Kvartily; mena?: string; des?: number }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const fmt = (v: number | null) => (v === null ? "–" : mena ? castkaKratce(v, mena) : cislo(v, des));

  if (!k?.n) {
    return (
      <RepSection title={title}>
        <RepHint>{t("admin", "repNoPriceData")}</RepHint>
      </RepSection>
    );
  }
  return (
    <RepSection title={title} right={<Text style={s.n}>n = {cislo(k.n)}</Text>}>
      <RepRow label={t("admin", "repMin")} value={fmt(k.min)} />
      <RepRow label={t("admin", "repQ1")} value={fmt(k.q1)} />
      <RepRow label={t("admin", "repMedian")} value={fmt(k.median)} />
      <RepRow label={t("admin", "repQ3")} value={fmt(k.q3)} />
      <RepRow label={t("admin", "repMax")} value={fmt(k.max)} />
    </RepSection>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg },
    filterRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, flexWrap: "wrap" },
    btnWrap: { paddingBottom: 1, flexGrow: 1 },
    n: { fontSize: fontSize.xs, color: colors.textSubtle, fontVariant: ["tabular-nums"] },
  });
