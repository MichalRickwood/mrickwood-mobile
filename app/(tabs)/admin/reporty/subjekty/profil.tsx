import { useMemo } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppScrollView } from "@/components/AppScroll";
import {
  RepBadge, RepBars, RepHint, RepKpi, RepLink, RepRow, RepSection, RepState, RepTable,
  castkaKratce, cislo, datum, num, podil, pomer, zkrat,
} from "@/components/ReportUi";
import {
  reportChyba, reportyApi,
  type OrgRow, type ProfilDodavatele, type ProfilZadavatele, type SoutezRow, type ZadaniZaklad,
} from "@/lib/reporty-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, spacing, type Colors } from "@/constants/theme";

type Kind = "dodavatel" | "zadavatel";

/**
 * Profil jednoho subjektu — dodavatel (co vyhrál, kde soutěží, s kým se potkává)
 * nebo zadavatel (co zadává, komu, za kolik proti odhadu).
 *
 * Objemy jsou v EUR (server je přepočítává), ceny jednotlivých zadání v původní
 * měně řádku — proto se `currency` bere vždy z konkrétního řádku, ne z profilu.
 */
export default function ReportProfilScreen() {
  const { country, ident, kind, nazev } = useLocalSearchParams<{
    country: string; ident: string; kind: Kind; nazev?: string;
  }>();
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const jeDodavatel = kind !== "zadavatel";

  // Jeden dotaz pro obě role — `kind` je v klíči, takže se profily nemíchají.
  const q = useQuery<ProfilDodavatele | ProfilZadavatele>({
    queryKey: ["rep-profil", String(kind), String(country), String(ident)],
    queryFn: ({ signal }) =>
      jeDodavatel
        ? reportyApi.dodavatel(String(country), String(ident), signal)
        : reportyApi.zadavatel(String(country), String(ident), signal),
    enabled: !!country && !!ident,
    retry: false,
  });

  const chyba = q.error ? reportChyba(q.error) : null;
  const data = q.data;

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
            <Hlavicka org={data.org} kind={jeDodavatel ? "dodavatel" : "zadavatel"} nahradniNazev={nazev} />
            {jeDodavatel ? (
              <Dodavatel data={data as ProfilDodavatele} />
            ) : (
              <Zadavatel data={data as ProfilZadavatele} />
            )}
          </>
        ) : null}

        <View style={{ height: spacing.xl }} />
      </AppScrollView>
    </SafeAreaView>
  );
}

function Hlavicka({ org, kind, nahradniNazev }: { org: OrgRow; kind: Kind; nahradniNazev?: string }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <RepSection>
      <Text style={s.title}>{org.name ?? nahradniNazev ?? "–"}</Text>
      <View style={s.badges}>
        <RepBadge text={org.country} />
        {org.reg_no ? <RepBadge text={org.reg_no} /> : null}
        <RepBadge text={kind === "dodavatel" ? t("admin", "repSupplier") : t("admin", "repBuyer")} tone="yes" />
      </View>
      <RepRow label={t("admin", "repPeriod")} value={`${datum(org.first_seen)} – ${datum(org.last_seen)}`} />
      {num(org.n_aliases) ? <RepRow label={t("admin", "repAliases")} value={cislo(org.n_aliases)} /> : null}
    </RepSection>
  );
}

// ── Dodavatel ───────────────────────────────────────────────────────────────

function Dodavatel({ data }: { data: ProfilDodavatele }) {
  const { t } = useI18n();
  const st = data.stats;

  return (
    <>
      <RepSection title={t("admin", "repProfileSupplier")} hint={t("admin", "repRegistryNote")}>
        <RepKpi
          items={[
            { label: t("admin", "repWins"), value: cislo(st.vyher) },
            { label: t("admin", "repParticipations"), value: cislo(st.nabidek) },
            { label: t("admin", "repWinRate"), value: podil(st.uspesnost, 1) },
            { label: t("admin", "repVolumeWon"), value: castkaKratce(st.objem_eur, "EUR") },
          ]}
        />
        <RepRow label={`${t("admin", "repWins")} (registr)`} value={cislo(st.registr_n_won)} />
        <RepRow label={`${t("admin", "repParticipations")} (registr)`} value={cislo(st.registr_n_bids)} />
        <RepRow label={`${t("admin", "repVolumeWon")} (registr)`} value={castkaKratce(st.registr_objem_eur, "EUR")} />
      </RepSection>

      {data.vyhryPoLetech.length ? (
        <RepSection title={t("admin", "repVolumeByYear")}>
          <RepBars
            data={data.vyhryPoLetech
              .map((r) => ({ label: String(r.rok ?? "–"), value: num(r.objem_eur) ?? 0 }))
              .reverse()}
            formatValue={(v) => castkaKratce(v, "EUR")}
          />
        </RepSection>
      ) : null}

      {data.vyhryPoLetech.length ? (
        <RepSection title={t("admin", "repWinsByYear")}>
          <RepTable
            rows={data.vyhryPoLetech}
            cols={[
              { head: "rok", w: 56, cell: (r) => String(r.rok ?? "–") },
              { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.vyher) },
              { head: "objem", w: 116, n: true, cell: (r) => castkaKratce(r.objem_eur, "EUR") },
              { head: t("admin", "repCompetitive"), w: 74, n: true, cell: (r) => cislo(r.v_soutezi) },
              { head: t("admin", "repDirect"), w: 90, n: true, cell: (r) => cislo(r.prime) },
              { head: t("admin", "repPriceVsEstimate"), w: 100, n: true, cell: (r) => cislo(r.prum_pomer, 2) },
            ]}
          />
        </RepSection>
      ) : null}

      {data.ucastPoLetech.length ? (
        <RepSection title={t("admin", "repBidsByYear")}>
          <RepTable
            rows={data.ucastPoLetech}
            cols={[
              { head: "rok", w: 56, cell: (r) => String(r.rok ?? "–") },
              { head: t("admin", "repParticipations"), w: 72, n: true, cell: (r) => cislo(r.nabidek) },
              { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.vyher) },
              { head: t("admin", "repWinRate"), w: 84, n: true, cell: (r) => pomer(r.vyher, r.nabidek) },
              { head: t("admin", "repAvgBids"), w: 84, n: true, cell: (r) => cislo(r.prum_soupereru, 1) },
            ]}
          />
        </RepSection>
      ) : null}

      {data.zadavatele.length ? (
        <RepSection title={t("admin", "repTopBuyers")}>
          <RepTable
            rows={data.zadavatele}
            cols={[
              { head: "zadavatel", w: 200, cell: (r) => zkrat(r.buyer_name, 60) },
              { head: t("admin", "repRegNo"), w: 88, cell: (r) => r.buyer_reg ?? "–" },
              { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.vyher) },
              { head: "objem", w: 116, n: true, cell: (r) => castkaKratce(r.objem_eur, "EUR") },
              { head: "naposled", w: 88, cell: (r) => datum(r.posledni) },
            ]}
          />
        </RepSection>
      ) : null}

      {data.cpv.length ? (
        <RepSection title={t("admin", "repCpvMix")}>
          <RepBars
            data={data.cpv.map((r) => ({ label: r.cpv3 ?? "–", value: num(r.vyher) ?? 0 }))}
            formatValue={(v) => cislo(v)}
          />
        </RepSection>
      ) : null}

      {data.soupeReri.length ? (
        <RepSection title={t("admin", "repRivals")}>
          <RepTable
            rows={data.soupeReri}
            cols={[
              { head: "firma", w: 200, cell: (r) => zkrat(r.bidder_name, 60) },
              { head: t("admin", "repRegNo"), w: 88, cell: (r) => r.bidder_reg ?? "–" },
              { head: "společných", w: 90, n: true, cell: (r) => cislo(r.spolecnych) },
              { head: "jejich výher", w: 92, n: true, cell: (r) => cislo(r.jejich_vyher) },
            ]}
          />
        </RepSection>
      ) : null}

      <PosledniZadani rows={data.posledni} sZadavatelem />
    </>
  );
}

// ── Zadavatel ───────────────────────────────────────────────────────────────

function Zadavatel({ data }: { data: ProfilZadavatele }) {
  const { t } = useI18n();
  const p = data.prehled;

  return (
    <>
      <RepSection title={t("admin", "repProfileBuyer")} hint={t("admin", "repRegistryNote")}>
        <RepKpi
          items={[
            { label: t("admin", "repAwards"), value: cislo(p.zadani) },
            { label: "objem", value: castkaKratce(p.objem_eur, "EUR") },
            { label: t("admin", "repAvgBids"), value: cislo(p.prum_nabidek, 1), hint: `n = ${cislo(p.s_poctem)}` },
            {
              label: t("admin", "repOneBidShare"),
              value: pomer(p.jedna_nabidka, p.s_poctem),
              hint: `n = ${cislo(p.s_poctem)}`,
            },
            { label: t("admin", "repPriceVsEstimate"), value: cislo(p.prum_pomer, 2) },
            { label: t("admin", "repCompetitive"), value: cislo(p.souteze) },
            { label: t("admin", "repDirect"), value: cislo(p.prima) },
            { label: t("admin", "repCancelled"), value: cislo(p.zrusenych) },
          ]}
        />
        <RepRow label={t("admin", "repPeriod")} value={`${datum(p.od)} – ${datum(p.do)}`} />
      </RepSection>

      {data.poLetech.length ? (
        <RepSection title={t("admin", "repTendersByYear")}>
          <RepBars
            data={data.poLetech.map((r) => ({ label: String(r.rok ?? "–"), value: num(r.zadani) ?? 0 })).reverse()}
          />
          <RepTable
            rows={data.poLetech}
            cols={[
              { head: "rok", w: 56, cell: (r) => String(r.rok ?? "–") },
              { head: t("admin", "repAwards"), w: 66, n: true, cell: (r) => cislo(r.zadani) },
              { head: "objem", w: 116, n: true, cell: (r) => castkaKratce(r.objem_eur, "EUR") },
              { head: t("admin", "repCompetitive"), w: 74, n: true, cell: (r) => cislo(r.souteze) },
              { head: t("admin", "repAvgBids"), w: 80, n: true, cell: (r) => cislo(r.prum_nabidek, 1) },
              { head: t("admin", "repOneBidShare"), w: 100, n: true, cell: (r) => pomer(r.jedna_nabidka, r.s_poctem) },
              { head: t("admin", "repPriceVsEstimate"), w: 100, n: true, cell: (r) => cislo(r.prum_pomer, 2) },
            ]}
          />
        </RepSection>
      ) : null}

      {data.vitezove.length ? (
        <RepSection title={t("admin", "repTopWinners")}>
          <RepTable
            rows={data.vitezove}
            cols={[
              { head: "firma", w: 200, cell: (r) => zkrat(r.winner_name, 60) },
              { head: t("admin", "repRegNo"), w: 88, cell: (r) => r.winner_reg ?? "–" },
              { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.vyher) },
              { head: "podíl", w: 62, n: true, cell: (r) => pomer(r.vyher, data.prehled.zadani) },
              { head: "objem", w: 116, n: true, cell: (r) => castkaKratce(r.objem_eur, "EUR") },
              { head: "naposled", w: 88, cell: (r) => datum(r.posledni) },
            ]}
          />
        </RepSection>
      ) : null}

      {data.cpv.length ? (
        <RepSection title={t("admin", "repCpvMix")}>
          <RepBars data={data.cpv.map((r) => ({ label: r.cpv3 ?? "–", value: num(r.zadani) ?? 0 }))} />
        </RepSection>
      ) : null}

      {data.kriteria.length ? (
        <RepSection title={t("admin", "repCriteria")}>
          <RepTable
            rows={data.kriteria}
            cols={[
              { head: "kritérium", w: 240, cell: (r) => zkrat(r.kriterium, 70) },
              { head: t("admin", "repAwards"), w: 66, n: true, cell: (r) => cislo(r.zadani) },
            ]}
          />
        </RepSection>
      ) : null}

      <PosledniZadani rows={data.posledni} />

      {data.souteze.length ? (
        <RepSection title={t("admin", "repLiveTenders")}>
          <RepTable<SoutezRow>
            rows={data.souteze}
            cols={[
              { head: t("admin", "repPublished"), w: 84, cell: (r) => datum(r.publishedAt) },
              { head: t("admin", "repPortal"), w: 96, cell: (r) => r.portalType ?? "–" },
              { head: "název", w: 210, cell: (r) => zkrat(r.title, 70) },
              { head: t("admin", "repEstimate"), w: 110, n: true, cell: (r) => castkaKratce(r.estimatedValue, r.currency ?? "") },
              { head: t("admin", "repDeadline"), w: 84, cell: (r) => datum(r.deadlineAt) },
              { head: "stav", w: 74, cell: (r) => (num(r.isActive) ? "běží" : "uzavřeno") },
            ]}
          />
        </RepSection>
      ) : null}
    </>
  );
}

/** Poslední zadání — společné pro obě role, jen dodavatel má navíc sloupec zadavatele.
 *  Odkaz na zdroj se otevírá v prohlížeči (řádek pod tabulkou, aby šel trefit prstem). */
function PosledniZadani({
  rows,
  sZadavatelem,
}: {
  rows: (ZadaniZaklad & { cpv: string | null; buyer_name?: string | null })[];
  sZadavatelem?: boolean;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!rows.length) return null;

  return (
    <RepSection title={t("admin", "repLastAwards")}>
      <RepTable
        rows={rows}
        cols={[
          { head: "datum", w: 84, cell: (r) => datum(r.award_date) },
          { head: "zdroj", w: 74, cell: (r) => r.source ?? "–" },
          ...(sZadavatelem
            ? [{ head: "zadavatel", w: 150, cell: (r: (typeof rows)[number]) => zkrat(r.buyer_name, 40) }]
            : []),
          { head: "zakázka", w: 210, cell: (r) => zkrat(r.title, 70) },
          { head: "CPV", w: 80, cell: (r) => r.cpv ?? "–" },
          { head: "cena", w: 116, n: true, cell: (r) => castkaKratce(r.final_value, r.currency ?? "") },
          { head: t("admin", "repEstimate"), w: 116, n: true, cell: (r) => castkaKratce(r.est_value, r.currency ?? "") },
          { head: "nab.", w: 48, n: true, cell: (r) => cislo(r.bid_count) },
        ]}
        max={15}
      />
      <View style={s.links}>
        {rows.slice(0, 5).map((r) =>
          r.raw_ref ? <RepLink key={String(r.id)} url={r.raw_ref} title={zkrat(r.title, 48)} /> : null,
        )}
        {rows.some((r) => r.raw_ref) ? <RepHint>{t("admin", "repOpenSource")}</RepHint> : null}
      </View>
    </RepSection>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg },
    title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, lineHeight: 24 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    links: { gap: spacing.xs },
  });
