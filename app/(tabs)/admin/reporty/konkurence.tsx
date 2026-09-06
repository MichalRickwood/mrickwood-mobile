import { useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { AppScrollView } from "@/components/AppScroll";
import {
  RepBars, RepButton, RepField, RepHint, RepKpi, RepSection, RepState, RepTable,
  castkaKratce, cislo, podil, zkrat,
} from "@/components/ReportUi";
import {
  jePrazdno, jePrilisVelky, reportChyba, reportyApi,
  type KonkurenceData, type Segment,
} from "@/lib/reporty-api";
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
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [country, setCountry] = useState("CZ");
  const [cpv, setCpv] = useState("452");
  const [od, setOd] = useState(String(ROK - 2));
  const [doR, setDoR] = useState(String(ROK));
  const [buyer, setBuyer] = useState("");
  const [segment, setSegment] = useState<Segment | null>(null);

  const q = useQuery({
    queryKey: ["rep-konkurence", segment],
    queryFn: ({ signal }) => reportyApi.konkurence(segment as Segment, signal),
    enabled: !!segment,
    retry: false,
  });

  const cpvOk = /^\d{2,5}$/.test(cpv);
  const chyba = q.error ? reportChyba(q.error) : null;
  const d = q.data;
  const plne: KonkurenceData | null = d && !jePrazdno(d) && !jePrilisVelky(d) ? d : null;

  // Součet účastí přes všechny firmy = vývoj segmentu po letech.
  const poLetech = useMemo(() => {
    if (!plne) return [];
    const m = new Map<number, number>();
    for (const f of plne.ucastnici) for (const r of f.roky) m.set(r.rok, (m.get(r.rok) ?? 0) + r.n);
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([rok, n]) => ({ label: String(rok), value: n }));
  }, [plne]);

  const nacti = () =>
    setSegment({
      country: country.toUpperCase().slice(0, 2) || "CZ",
      cpv,
      rokOd: Number(od) || ROK - 2,
      rokDo: Number(doR) || ROK,
      buyer: buyer.trim() || undefined,
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
              label={`${t("admin", "repBuyerIco")} (${t("admin", "repOptional")})`}
              value={buyer}
              onChangeText={(v) => setBuyer(v.replace(/[^0-9A-Za-z]/g, "").slice(0, 32))}
              width={140}
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
                  { label: t("admin", "repTendersWithBids"), value: cislo(plne.soutezi_s_nabidkami) },
                  { label: t("admin", "repBidSample"), value: cislo(plne.vzorekNabidek) },
                ]}
              />
              {plne.strop ? <RepHint>{t("admin", "repKonkCap", { n: cislo(plne.strop) })}</RepHint> : null}
            </RepSection>

            {poLetech.length ? (
              <RepSection title={t("admin", "repKonkTrend")}>
                <RepBars data={poLetech} />
              </RepSection>
            ) : null}

            {plne.ucastnici.length ? (
              <RepSection title={t("admin", "repKonkFirms")}>
                <RepTable
                  rows={plne.ucastnici}
                  cols={[
                    { head: "firma", w: 200, cell: (r) => zkrat(r.name, 60) },
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

            {plne.vitezove.length ? (
              <RepSection title={t("admin", "repKonkWinners")}>
                <RepTable
                  rows={plne.vitezove}
                  cols={[
                    { head: "firma", w: 200, cell: (r) => zkrat(r.winner_name, 60) },
                    { head: t("admin", "repRegNo"), w: 88, cell: (r) => r.winner_reg ?? "–" },
                    { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.vyher) },
                    { head: "objem", w: 116, n: true, cell: (r) => castkaKratce(r.objem_eur, "EUR") },
                    { head: t("admin", "repPriceVsEstimate"), w: 100, n: true, cell: (r) => cislo(r.prum_pomer, 2) },
                  ]}
                />
              </RepSection>
            ) : null}

            {plne.dvojice.length ? (
              <RepSection title={t("admin", "repKonkPairs")} hint={t("admin", "repKonkPairsHint")}>
                <RepTable
                  rows={plne.dvojice}
                  cols={[
                    { head: "firma A", w: 180, cell: (r) => zkrat(r.a, 50) },
                    { head: "firma B", w: 180, cell: (r) => zkrat(r.b, 50) },
                    { head: "společných", w: 90, n: true, cell: (r) => cislo(r.n) },
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg },
    filterRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, flexWrap: "wrap" },
    btnWrap: { paddingBottom: 1, flexGrow: 1 },
  });
