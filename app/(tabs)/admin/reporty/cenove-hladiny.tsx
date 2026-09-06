import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppScrollView } from "@/components/AppScroll";
import {
  RepBars, RepButton, RepField, RepHint, RepKpi, RepLink, RepRow, RepSection, RepState, RepTable,
} from "@/components/ReportUi";
import CountryField from "@/components/CountryField";
import { bezSmeti, castkaMenaKratce, cislo, podil, pomer, zkrat } from "@/lib/reporty-format";
import { menaZeme } from "@/lib/countries";
import { naKonkurenci, naProfil } from "@/lib/reporty-nav";
import { useVychoziZeme } from "@/lib/use-zeme";
import {
  jePrazdno, jePrilisVelky, menaKod, reportChyba, reportyApi,
  type CenoveHladinyData, type Kvartily, type Segment, type VypisOpts,
} from "@/lib/reporty-api";
import { STRANKA, useStrankovani } from "@/lib/use-strankovani";
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
  const router = useRouter();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { vychoziZeme: zemeUzivatele } = useVychoziZeme();
  // Proklik z profilu (CPV mix) předvyplní zemi i CPV a rovnou načte.
  const vstup = useLocalSearchParams<{ country?: string; cpv?: string; od?: string; do?: string }>();

  const [country, setCountry] = useState(vstup.country || zemeUzivatele);
  const [cpv, setCpv] = useState(vstup.cpv || "45");
  const [od, setOd] = useState(vstup.od || String(ROK - 2));
  const [doR, setDoR] = useState(vstup.do || String(ROK));
  const [nuts, setNuts] = useState("");
  const [segment, setSegment] = useState<Segment | null>(
    vstup.cpv
      ? {
          country: (vstup.country || zemeUzivatele).toUpperCase(),
          cpv: vstup.cpv,
          rokOd: Number(vstup.od) || ROK - 2,
          rokDo: Number(vstup.do) || ROK,
        }
      : null,
  );

  /** Došlápnutí další stránky jedné tabulky — tentýž segment, jen s offsetem. */
  const nactiStranku = useCallback(
    (o: VypisOpts) => reportyApi.cenoveHladiny(segment as Segment, o),
    [segment],
  );

  const q = useQuery({
    queryKey: ["rep-cenove-hladiny", segment],
    queryFn: ({ signal }) => reportyApi.cenoveHladiny(segment as Segment, { limit: STRANKA }, signal),
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

  /** Klik na rok v trendu = tentýž segment, ale jen ten rok. */
  const zuzNaRok = (rok: number) => {
    setOd(String(rok));
    setDoR(String(rok));
    setSegment((p) => (p ? { ...p, rokOd: rok, rokDo: rok } : p));
  };

  const mena = menaKod(plne?.mena, menaZeme(segment?.country ?? "CZ"));
  const str = useStrankovani(
    plne as unknown as Record<string, unknown> | undefined,
    nactiStranku as unknown as (o: VypisOpts) => Promise<Record<string, unknown>>,
    JSON.stringify(segment ?? {}),
  );
  // Vítězové bez útržků z rozsekaných tabulek na portálech.
  type VitezRow = { reg: string | null; name: string; n: number; objem?: number; eur?: number };
  const vitezove = useMemo(() => bezSmeti(str.rows<VitezRow>("vitezove"), (r) => r.name), [str]);

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
            <CountryField label={t("admin", "repCountry")} value={country} onChange={setCountry} />
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

            <KvartilySekce title={t("admin", "repCenyPrices")} k={plne.ceny} mena={mena} />
            <KvartilySekce title={t("admin", "repCenyEstimates")} k={plne.odhady} mena={mena} />
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
                <RepHint>{t("admin", "repBucketsHint")}</RepHint>
                {plne.kose ? (
                  <RepTable
                    rows={[plne.kose]}
                    cols={[
                      { head: t("admin", "repBucketCompetitive"), w: 90, n: true, cell: (r) => cislo(r.soutez) },
                      { head: t("admin", "repBucketSingle"), w: 96, n: true, cell: (r) => cislo(r.jedina) },
                      { head: t("admin", "repBucketDirect"), w: 96, n: true, cell: (r) => cislo(r.prime) },
                      { head: t("admin", "repBucketUnknown"), w: 88, n: true, cell: (r) => cislo(r.neznamo) },
                    ]}
                  />
                ) : null}
              </RepSection>
            ) : null}

            {plne.roky.length ? (
              <RepSection title={t("admin", "repTrendByYear")}>
                <RepBars
                  data={[...plne.roky].reverse().map((r) => ({ label: String(r.rok), value: r.median_cena ?? r.median_eur ?? 0 }))}
                  formatValue={(v) => castkaMenaKratce(v, mena)}
                />
                <RepTable
                  rows={plne.roky}
                  cols={[
                    // Rok otevře tentýž segment zúžený na jediný rok.
                    { head: "rok", w: 56, cell: (r) => String(r.rok), tap: (r) => zuzNaRok(r.rok) },
                    { head: t("admin", "repAwards"), w: 66, n: true, cell: (r) => cislo(r.n) },
                    { head: t("admin", "repMedianPrice"), w: 120, n: true, cell: (r) => castkaMenaKratce(r.median_cena ?? r.median_eur, mena) },
                    { head: t("admin", "repMedianRatio"), w: 100, n: true, cell: (r) => cislo(r.median_pomer, 3) },
                    { head: t("admin", "repAvgBids"), w: 80, n: true, cell: (r) => cislo(r.prum_nabidek, 1) },
                    { head: "objem", w: 120, n: true, cell: (r) => castkaMenaKratce(r.objem ?? r.objem_eur, mena) },
                  ]}
                />
              </RepSection>
            ) : null}

            {vitezove.length ? (
              <RepSection title={t("admin", "repTopWinners")}>
                <RepTable
                  rows={vitezove}
                  celkem={str.total("vitezove")}
                  onVice={() => void str.vice("vitezove")}
                  viceNacita={str.nacita === "vitezove"}
                  cols={[
                    {
                      head: "firma", w: 210, cell: (r) => zkrat(r.name, 60),
                      tap: (r) => naProfil(router, { country: plne.segment.country, ident: r.reg || r.name, kind: "dodavatel", nazev: r.name }),
                    },
                    { head: t("admin", "repRegNo"), w: 88, cell: (r) => r.reg ?? "–" },
                    { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.n) },
                    { head: "objem", w: 120, n: true, cell: (r) => castkaMenaKratce(r.objem ?? r.eur, mena) },
                  ]}
                />
              </RepSection>
            ) : null}

            <RepSection>
              <RepLink
                onPress={() => naKonkurenci(router, { country: plne.segment.country, cpv: plne.segment.cpv })}
                title={t("admin", "repOpenCompetition")}
              />
            </RepSection>
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
  const fmt = (v: number | null) => (v === null ? "–" : mena ? castkaMenaKratce(v, mena) : cislo(v, des));

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
