import { useMemo } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppScrollView } from "@/components/AppScroll";
import {
  RepBadge, RepHint, RepKpi, RepLink, RepRow, RepSection, RepState, RepTable,
  castka, castkaKratce, cislo, datum, num, podil, zkrat,
} from "@/components/ReportUi";
import { reportChyba, reportyApi, type BidRow, type Num, type P1Radek, type Predikce } from "@/lib/reporty-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, spacing, type Colors } from "@/constants/theme";

/**
 * Detail zakázky s predikcí — P1 (kdo se přihlásí), P2 (kolik nabídek), P3 (za kolik).
 *
 * P3 se ukládá jako POMĚR k odhadu zadavatele (q10/q50/q90), ne jako částka. Absolutní
 * cenu proto dopočítáváme až tady, a jen když zakázka odhad má — jinak zůstane poměr,
 * protože vynásobit chybějící odhad by dalo tiše nulu.
 */
export default function ReportModelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const q = useQuery({
    queryKey: ["rep-model-detail", id],
    queryFn: ({ signal }) => reportyApi.modelDetail(String(id), signal),
    enabled: !!id,
    retry: false,
  });

  const chyba = q.error ? reportChyba(q.error) : null;
  const data = q.data;
  const posledni: Predikce | undefined = data?.predikce[0];
  const odhad = num(data?.tender.estimatedValue);
  const mena = data?.tender.currency ?? "";

  /** Poměr → absolutní cena. Bez odhadu vrací null (nedopočítáváme z ničeho). */
  const cena = (kvantil: Num): string => {
    const k = num(kvantil);
    return odhad === null || k === null ? "–" : castkaKratce(k * odhad, mena);
  };

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <AppScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.textSubtle} />}
      >
        <RepState
          loading={q.isLoading}
          error={chyba ? (chyba.chybiNaServeru ? t("admin", "repNotDeployed") : chyba.zprava) : null}
          errorTitle={t("admin", "repErrorTitle")}
          retryLabel={t("admin", "repRetry")}
          onRetry={() => void q.refetch()}
        />

        {data ? (
          <>
            <RepSection>
              <Text style={s.title}>{data.tender.title ?? "–"}</Text>
              <View style={s.badges}>
                <RepBadge text={data.tender.country} />
                {data.tender.portalType ? <RepBadge text={data.tender.portalType} /> : null}
                <RepBadge
                  text={num(data.tender.isActive) ? t("admin", "repActive") : t("admin", "repClosed")}
                  tone={num(data.tender.isActive) ? "yes" : "muted"}
                />
                {!data.maModel ? <RepBadge text={t("admin", "repModelNoCountry")} tone="warn" /> : null}
              </View>
              <RepRow label={t("admin", "repBuyer")} value={`${data.tender.buyer ?? "–"}${data.tender.buyer_ico ? ` (${data.tender.buyer_ico})` : ""}`} mono={false} />
              <RepRow label="CPV" value={data.tender.cpvCode ?? "–"} />
              <RepRow label="NUTS" value={data.tender.nuts ?? "–"} />
              <RepRow label={t("admin", "repEstimate")} value={odhad === null ? "–" : castka(odhad, mena)} />
              <RepRow label={t("admin", "repProcedure")} value={data.tender.procedureType ?? "–"} mono={false} />
              <RepRow label={t("admin", "repPublished")} value={datum(data.tender.publishedAt)} />
              <RepRow label={t("admin", "repDeadline")} value={datum(data.tender.deadlineAt)} />
              <RepLink url={data.tender.sourceUrl} title={t("admin", "repOpenSource")} />
            </RepSection>

            {!posledni ? (
              <RepSection title={t("admin", "repDetailTitle")}>
                <RepHint>{t("admin", "repNoPrediction")}</RepHint>
              </RepSection>
            ) : (
              <>
                <RepSection title={t("admin", "repP2Title")}>
                  <RepKpi
                    items={[
                      { label: t("admin", "repP2Title"), value: cislo(posledni.p2_bids, 1) },
                      { label: t("admin", "repPredictedAt"), value: datum(posledni.predicted_at) },
                      ...(posledni.model_version ? [{ label: t("admin", "repVersion"), value: posledni.model_version }] : []),
                      ...(num(posledni.eval_bids) !== null
                        ? [{ label: t("admin", "repReality"), value: cislo(posledni.eval_bids) }]
                        : []),
                    ]}
                  />
                </RepSection>

                <RepSection title={t("admin", "repP3Title")} hint={t("admin", "repP3Hint")}>
                  <RepTable<{ k: string; q: Num }>
                    rows={[
                      { k: "q10", q: posledni.q10 },
                      { k: "q50", q: posledni.q50 },
                      { k: "q90", q: posledni.q90 },
                    ] satisfies { k: string; q: Num }[]}
                    cols={[
                      { head: "kvantil", w: 80, cell: (r) => r.k },
                      { head: "poměr k odhadu", w: 120, n: true, cell: (r) => cislo(r.q, 3) },
                      { head: "cena", w: 140, n: true, cell: (r) => cena(r.q) },
                    ]}
                  />
                  {odhad === null ? <RepHint>{t("admin", "repNoEstimate")}</RepHint> : null}
                  {num(posledni.eval_ratio) !== null ? (
                    <RepRow label={`${t("admin", "repReality")} — ${t("admin", "repCenyRatio")}`} value={cislo(posledni.eval_ratio, 3)} />
                  ) : null}
                </RepSection>

                <RepSection title={t("admin", "repP1Title")}>
                  {posledni.p1.length === 0 ? (
                    <RepHint>{t("admin", "repP1None")}</RepHint>
                  ) : (
                    <RepTable<P1Radek>
                      rows={posledni.p1}
                      cols={[
                        { head: "#", w: 32, n: true, cell: (r) => String(posledni.p1.indexOf(r) + 1) },
                        { head: "firma", w: 210, cell: (r) => zkrat(r.nazev, 60) },
                        { head: t("admin", "repRegNo"), w: 88, cell: (r) => r.ico ?? "–" },
                        { head: t("admin", "repProbability"), w: 100, n: true, cell: (r) => podil(r.p, 1) },
                      ]}
                    />
                  )}
                  {num(posledni.eval_hit_p1) !== null ? (
                    <RepRow label={t("admin", "repP1Hit")} value={num(posledni.eval_hit_p1) ? "✓" : "✗"} />
                  ) : null}
                </RepSection>

                {data.predikce.length > 1 ? (
                  <RepSection title={t("admin", "repOlderPredictions")}>
                    <RepTable<Predikce>
                      rows={data.predikce.slice(1)}
                      cols={[
                        { head: t("admin", "repVersion"), w: 64, cell: (r) => r.model_version ?? "–" },
                        { head: "kdy", w: 84, cell: (r) => datum(r.predicted_at) },
                        { head: "P2", w: 52, n: true, cell: (r) => cislo(r.p2_bids, 1) },
                        { head: "q10", w: 56, n: true, cell: (r) => cislo(r.q10, 2) },
                        { head: "q50", w: 56, n: true, cell: (r) => cislo(r.q50, 2) },
                        { head: "q90", w: 56, n: true, cell: (r) => cislo(r.q90, 2) },
                        { head: t("admin", "repEvaluated"), w: 88, cell: (r) => datum(r.evaluated_at) },
                      ]}
                    />
                  </RepSection>
                ) : null}
              </>
            )}

            <RepSection title={t("admin", "repReality")}>
              {!data.link || !data.award ? (
                <RepHint>{t("admin", "repNoLink")}</RepHint>
              ) : (
                <>
                  <RepRow label="zdroj" value={data.award.source ?? "–"} />
                  <RepRow label="datum zadání" value={datum(data.award.award_date)} />
                  <RepRow label="vítěz" value={data.award.winner_name ?? "–"} mono={false} />
                  <RepRow
                    label="cena"
                    value={castka(data.award.final_value, data.award.currency ?? mena)}
                  />
                  <RepRow label="nabídek" value={cislo(data.award.bid_count)} />
                  <RepLink url={data.award.raw_ref} title={t("admin", "repOpenSource")} />
                  {data.bids.length === 0 ? (
                    <RepHint>{t("admin", "repNoBidders")}</RepHint>
                  ) : (
                    <RepTable<BidRow>
                      rows={data.bids}
                      cols={[
                        { head: "firma", w: 200, cell: (r) => zkrat(r.bidder_name, 60) },
                        { head: t("admin", "repRegNo"), w: 88, cell: (r) => r.bidder_reg ?? "–" },
                        { head: "cena", w: 120, n: true, cell: (r) => castkaKratce(r.offered_value, data.award?.currency ?? mena) },
                        { head: "vítěz", w: 56, n: true, cell: (r) => (num(r.is_winner) ? "✓" : "") },
                      ]}
                    />
                  )}
                </>
              )}
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
    title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, lineHeight: 24 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  });
