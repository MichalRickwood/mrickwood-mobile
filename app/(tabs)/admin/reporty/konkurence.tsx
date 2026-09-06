import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppScrollView } from "@/components/AppScroll";
import {
  RepBars, RepButton, RepField, RepHint, RepKpi, RepLink, RepSection, RepState, RepTable,
} from "@/components/ReportUi";
import CountryField from "@/components/CountryField";
import CompanyLookupField, { type CompanyLookupResult } from "@/components/CompanyLookupField";
import { bezSmeti, castkaMenaKratce, cislo, jeSmeti, podil, zkrat } from "@/lib/reporty-format";
import { STRANKA, useStrankovani } from "@/lib/use-strankovani";
import { useVychoziZeme } from "@/lib/use-zeme";
import { naCenoveHladiny, naProfil } from "@/lib/reporty-nav";
import {
  jePrazdno, jePrilisVelky, menaKod, reportChyba, reportyApi,
  type KonkurenceData, type Segment, type VypisOpts,
} from "@/lib/reporty-api";
import { menaZeme } from "@/lib/countries";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { spacing, type Colors } from "@/constants/theme";

const ROK = new Date().getFullYear();

/**
 * Konkurence v segmentu — kdo se o zakázky uchází, kdo je vyhrává a kdo se s kým
 * potkává u jedné soutěže.
 *
 * Účastníci se počítají z nabídek (`vt_bid`), vítězové ze zadání (`vt_award`) —
 * proto se čísla nemusí krýt: zadání bez seznamu uchazečů má vítěze, ale žádné
 * účastníky. Když vzorek nabídek narazí na strop, obrazovka to řekne, protože
 * uříznutý vzorek podhodnotí velké firmy nejvíc.
 */
export default function ReportKonkurenceScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { vychoziZeme } = useVychoziZeme();
  // Proklik z profilu (CPV mix) předvyplní zemi, CPV i případného zadavatele.
  const vstup = useLocalSearchParams<{ country?: string; cpv?: string; buyer?: string; buyerNazev?: string }>();

  const [country, setCountry] = useState(vstup.country || vychoziZeme);
  const [cpv, setCpv] = useState(vstup.cpv || "452");
  const [od, setOd] = useState(String(ROK - 2));
  const [doR, setDoR] = useState(String(ROK));
  // Zadavatel jako v registraci: našeptávač → výběr → chip s IČO a názvem.
  const [zadavatelIco, setZadavatelIco] = useState(vstup.buyer ?? "");
  const [zadavatelNazev, setZadavatelNazev] = useState(vstup.buyerNazev ?? "");
  const [segment, setSegment] = useState<Segment | null>(
    vstup.cpv
      ? {
          country: (vstup.country || vychoziZeme).toUpperCase(),
          cpv: vstup.cpv,
          rokOd: ROK - 2,
          rokDo: ROK,
          buyer: vstup.buyer || undefined,
        }
      : null,
  );

  /** Došlápnutí další stránky jedné tabulky — bere tentýž segment, jen s offsetem. */
  const nactiStranku = useCallback(
    (o: VypisOpts) => reportyApi.konkurence(segment as Segment, o),
    [segment],
  );

  const q = useQuery({
    queryKey: ["rep-konkurence", segment],
    queryFn: ({ signal }) => reportyApi.konkurence(segment as Segment, { limit: STRANKA }, signal),
    enabled: !!segment,
    retry: false,
  });

  const cpvOk = /^\d{2,5}$/.test(cpv);
  const chyba = q.error ? reportChyba(q.error) : null;
  const d = q.data;
  const plne: KonkurenceData | null = d && !jePrazdno(d) && !jePrilisVelky(d) ? d : null;
  const mena = menaKod(plne?.mena, menaZeme(segment?.country ?? "CZ"));
  const str = useStrankovani(
    plne as unknown as Record<string, unknown> | undefined,
    nactiStranku as unknown as (o: VypisOpts) => Promise<Record<string, unknown>>,
    JSON.stringify(segment ?? {}),
  );

  // Součet účastí přes všechny firmy = vývoj segmentu po letech.
  const poLetech = useMemo(() => {
    if (!plne) return [];
    const m = new Map<number, number>();
    for (const f of ucastnici) for (const r of f.roky) m.set(r.rok, (m.get(r.rok) ?? 0) + r.n);
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([rok, n]) => ({ label: String(rok), value: n }));
  }, [plne]);

  const nacti = () =>
    setSegment({
      country: country.toUpperCase().slice(0, 2) || "CZ",
      cpv,
      rokOd: Number(od) || ROK - 2,
      rokDo: Number(doR) || ROK,
      // Server přijme IČO i název; posíláme to přesnější, co subjekt má.
      buyer: zadavatelIco || zadavatelNazev || undefined,
    });

  // Účastníci i vítězové bez útržků z rozsekaných tabulek na portálech.
  type UcastnikRow = { reg: string | null; name: string; ucasti: number; vyhry: number; podil_vyher: number | null; prum_cena_vs_odhad: number | null; roky: { rok: number; n: number }[] };
  type VitezRow = { winner_reg: string | null; winner_name: string | null; vyher: unknown; objem?: unknown; objem_eur: unknown; prum_pomer: unknown };
  type DvojiceRow = { a: string; aReg?: string | null; b: string; bReg?: string | null; n: number };
  const ucastnici = useMemo(() => bezSmeti(str.rows<UcastnikRow>("ucastnici"), (r) => r.name), [str]);
  const vitezove = useMemo(() => bezSmeti(str.rows<VitezRow>("vitezove"), (r) => r.winner_name), [str]);
  // Dvojice se zahodí, když je smetí kterákoli z obou stran.
  const dvojice = useMemo(
    () => str.rows<DvojiceRow>("dvojice").filter((d) => !jeSmeti(d.a) && !jeSmeti(d.b)),
    [str],
  );

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
          </View>
          <CompanyLookupField
            zdroj="reporty"
            jenNaseData
            country={country}
            value={zadavatelIco}
            resolvedName={zadavatelNazev}
            label={`${t("admin", "repBuyer")} (${t("admin", "repOptional")})`}
            placeholder={t("admin", "repSubjQPh")}
            onResolve={(v: CompanyLookupResult) => {
              setZadavatelIco(v.taxId);
              setZadavatelNazev(v.name);
            }}
            onClear={() => {
              setZadavatelIco("");
              setZadavatelNazev("");
            }}
          />
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
                  { label: t("admin", "repTendersWithBids"), value: cislo(plne.soutezi_s_nabidkami) },
                  { label: t("admin", "repBidSample"), value: cislo(plne.vzorekNabidek) },
                ]}
              />
              {plne.zadavatel ? <RepHint>{t("admin", "repBuyerMatched", { name: plne.zadavatel.name })}</RepHint> : null}
              {plne.strop ? <RepHint>{t("admin", "repKonkCap", { n: cislo(plne.strop) })}</RepHint> : null}
            </RepSection>

            {poLetech.length ? (
              <RepSection title={t("admin", "repKonkTrend")}>
                <RepBars data={poLetech} />
              </RepSection>
            ) : null}

            {ucastnici.length ? (
              <RepSection title={t("admin", "repKonkFirms")}>
                <RepTable
                  rows={ucastnici}
                  celkem={str.total("ucastnici")}
                  onVice={() => void str.vice("ucastnici")}
                  viceNacita={str.nacita === "ucastnici"}
                  cols={[
                    {
                      head: "firma", w: 200, cell: (r) => zkrat(r.name, 60),
                      tap: (r) => naProfil(router, { country: plne.segment.country, ident: r.reg || r.name, kind: "dodavatel", nazev: r.name }),
                    },
                    { head: t("admin", "repRegNo"), w: 88, cell: (r) => r.reg ?? "–" },
                    { head: t("admin", "repParticipations"), w: 72, n: true, cell: (r) => cislo(r.ucasti) },
                    { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.vyhry) },
                    { head: t("admin", "repWinRate"), w: 84, n: true, cell: (r) => podil(r.podil_vyher, 1) },
                    { head: t("admin", "repPriceVsEstimate"), w: 100, n: true, cell: (r) => cislo(r.prum_cena_vs_odhad, 2) },
                  ]}
                />
              </RepSection>
            ) : (
              <RepSection>
                <RepHint>{t("admin", "repKonkNoBids")}</RepHint>
              </RepSection>
            )}

            {vitezove.length ? (
              <RepSection title={t("admin", "repKonkWinners")}>
                <RepTable
                  rows={vitezove}
                  celkem={str.total("vitezove")}
                  onVice={() => void str.vice("vitezove")}
                  viceNacita={str.nacita === "vitezove"}
                  cols={[
                    {
                      head: "firma", w: 200, cell: (r) => zkrat(r.winner_name, 60),
                      tap: (r) => naProfil(router, { country: plne.segment.country, ident: r.winner_reg || r.winner_name, kind: "dodavatel", nazev: r.winner_name }),
                    },
                    { head: t("admin", "repRegNo"), w: 88, cell: (r) => r.winner_reg ?? "–" },
                    { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.vyher as never) },
                    { head: "objem", w: 120, n: true, cell: (r) => castkaMenaKratce((r.objem ?? r.objem_eur) as never, mena) },
                    { head: t("admin", "repPriceVsEstimate"), w: 100, n: true, cell: (r) => cislo(r.prum_pomer as never, 2) },
                  ]}
                />
              </RepSection>
            ) : null}

            {dvojice.length ? (
              <RepSection
                title={t("admin", "repKonkPairs")}
                hint={t("admin", "repKonkPairsHint")}
              >
                <RepTable
                  rows={dvojice}
                  celkem={str.total("dvojice")}
                  onVice={() => void str.vice("dvojice")}
                  viceNacita={str.nacita === "dvojice"}
                  cols={[
                    {
                      head: "firma A", w: 180, cell: (r) => zkrat(r.a, 50),
                      tap: (r) => naProfil(router, { country: plne.segment.country, ident: r.aReg || r.a, kind: "dodavatel", nazev: r.a }),
                    },
                    {
                      head: "firma B", w: 180, cell: (r) => zkrat(r.b, 50),
                      tap: (r) => naProfil(router, { country: plne.segment.country, ident: r.bReg || r.b, kind: "dodavatel", nazev: r.b }),
                    },
                    { head: "společných", w: 90, n: true, cell: (r) => cislo(r.n) },
                    {
                      head: t("admin", "repSharedTenders"), w: 116,
                      cell: () => t("admin", "repSharedTenders"),
                      // Profil firmy A zúžený na zakázky, kde podala i firma B.
                      tap: (r) => naProfil(router, {
                        country: plne.segment.country,
                        ident: r.aReg || r.a, kind: "dodavatel", nazev: r.a,
                        spolu: r.bReg || r.b, spoluNazev: r.b,
                      }),
                    },
                  ]}
                />
              </RepSection>
            ) : null}

            <RepSection>
              <RepLink
                onPress={() => naCenoveHladiny(router, { country: plne.segment.country, cpv: plne.segment.cpv, rokOd: plne.segment.rokOd, rokDo: plne.segment.rokDo })}
                title={t("admin", "repOpenPriceLevels")}
              />
            </RepSection>
          </>
        ) : null}

        <View style={{ height: spacing.xl }} />
      </AppScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg },
    filterRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, flexWrap: "wrap" },
    btnWrap: { paddingBottom: 1, flexGrow: 1 },
  });
