import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import ReportyFirmaSheet, { type VyberFirmy } from "@/components/ReportyFirmaSheet";
import { endpoints } from "@/lib/endpoints";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter, type Router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { AppScrollView } from "@/components/AppScroll";
import {
  RepBadge, RepBars, RepHint, RepKpi, RepRow, RepSection, RepState, RepTable,
} from "@/components/ReportUi";
import {
  bezSmeti, castkaMena, castkaMenaKratce, cislo, datum, num, podil, pomer, zkrat,
} from "@/lib/reporty-format";
import { menaZeme } from "@/lib/countries";
import { naCenoveHladiny, naKonkurenci, naProfil, naZadani, naZakazku } from "@/lib/reporty-nav";
import { STRANKA, useStrankovani } from "@/lib/use-strankovani";
import {
  menaKod, reportChyba, reportyApi,
  type Kos, type Kose, type OrgRow, type ProfilDodavatele, type ProfilZadavatele,
  type SmlouvaRow, type SmlouvyBlok, type SoutezRow, type UcastRow, type VypisOpts,
  type ZadaniDodavatele, type ZadaniZadavatele,
} from "@/lib/reporty-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

type Kind = "dodavatel" | "zadavatel";
interface Zuzeni { od?: string; do?: string; rok?: number; kos?: Kos; spolu?: string; spoluNazev?: string }

/**
 * Profil jednoho subjektu — dodavatel (co vyhrál, co podal, s kým se potkává) nebo
 * zadavatel (co zadává, komu, za kolik proti odhadu).
 *
 * MĚNA: server posílá `mena` a částky v poli `objem` už v ní. Profil české firmy tak
 * počítá v korunách; na eura se přejde jen tam, kde se v datech míchá víc měn
 * (`mena.smisena`). Nic se tu nepřepočítává — jen se čte, co přišlo.
 *
 * KOŠE: „soutěž / jediná nabídka / bez soutěže" se rozhoduje podle počtu nabídek,
 * ne podle příznaku zdroje — ten u malých zakázek hlásí soutěž i tam, kde zadavatel
 * oslovil jedinou firmu.
 */
const zeSoutezi = (p?: { puvod?: string | null; n?: number | string | null }[] | null) =>
  (p ?? []).filter((r) => r.puvod === "soutez" || r.puvod === "soutez_odvozena").reduce((a, r) => a + Number(r.n ?? 0), 0);

export default function ReportProfilScreen() {
  const { country, ident, kind, nazev, spolu, spoluNazev } = useLocalSearchParams<{
    country: string; ident: string; kind: Kind; nazev?: string;
    spolu?: string; spoluNazev?: string;
  }>();
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  // Výběr firmy, role a období — z parametrů (proklik), jinak moje firma z profilu účtu; mění se oknem zespoda.
  const [vyber, setVyber] = useState<VyberFirmy>({
    country: String(country || "CZ"), ident: String(ident ?? ""), nazev: nazev ? String(nazev) : "",
    kind: kind === "zadavatel" ? "zadavatel" : "dodavatel",
  });
  // Z menu (bez parametru) se nejdřív otevře okno s předvyplněnou mojí firmou a obdobím „vše";
  // profil se načte až po „Použít". Z prokliku (s parametrem) rovnou.
  const [sheet, setSheet] = useState(!ident);
  const [potvrzeno, setPotvrzeno] = useState(!!ident);
  const jeDodavatel = vyber.kind !== "zadavatel";
  // Proklik z dvojice konkurentů otevře profil rovnou zúžený na společné zakázky.
  const [zuzeni, setZuzeni] = useState<Zuzeni>(
    spolu ? { spolu: String(spolu), spoluNazev: spoluNazev ? String(spoluNazev) : undefined } : {},
  );

  const zeme = vyber.country;
  const dotaz = vyber.ident;

  // Bez parametru = profil mé firmy (IČO a název z účtu); když účet firmu nemá, otevře se výběr.
  const ucet = useQuery({ queryKey: ["account-profile-v2"], queryFn: () => endpoints.getProfileV2(), enabled: !dotaz, staleTime: 300_000 });
  useEffect(() => {
    if (dotaz || !ucet.data) return;
    const a = ucet.data;
    if (a.ico || a.company) setVyber((v) => ({ ...v, country: (a.country || v.country).toUpperCase(), ident: a.ico || a.company || "", nazev: a.company || "" }));
  }, [dotaz, ucet.data]);

  // Zúžení jde na server (kontrakt zná `rok`, `kos`, `spolu`) — filtruje se v celých
  // datech, ne jen v načtené stránce.
  const zaklad = useCallback(
    (o: VypisOpts = {}): VypisOpts => ({ rok: zuzeni.rok, kos: zuzeni.kos, spolu: zuzeni.spolu, od: zuzeni.od, do: zuzeni.do, ...o }),
    [zuzeni],
  );

  const nacti = useCallback(
    (o: VypisOpts) =>
      jeDodavatel
        ? reportyApi.dodavatel(zeme, dotaz, zaklad(o))
        : reportyApi.zadavatel(zeme, dotaz, zaklad(o)),
    [jeDodavatel, zeme, dotaz, zaklad],
  );

  const q = useQuery<ProfilDodavatele | ProfilZadavatele>({
    queryKey: ["rep-profil", vyber.kind, zeme, dotaz, zuzeni.rok ?? "", zuzeni.kos ?? "", zuzeni.spolu ?? "", zuzeni.od ?? "", zuzeni.do ?? ""],
    queryFn: ({ signal }) =>
      jeDodavatel
        ? reportyApi.dodavatel(zeme, dotaz, zaklad({ limit: STRANKA }), signal)
        : reportyApi.zadavatel(zeme, dotaz, zaklad({ limit: STRANKA }), signal),
    enabled: !!zeme && !!dotaz && potvrzeno,
    retry: false,
  });

  const data = q.data;
  const chyba = q.error ? reportChyba(q.error) : null;
  const mena = menaKod(data?.mena, menaZeme(zeme));
  const str = useStrankovani(
    data as unknown as Record<string, unknown> | undefined,
    nacti as unknown as (o: VypisOpts) => Promise<Record<string, unknown>>,
    `${vyber.kind}|${zeme}|${dotaz}|${zuzeni.rok ?? ""}|${zuzeni.kos ?? ""}|${zuzeni.spolu ?? ""}|${zuzeni.od ?? ""}|${zuzeni.do ?? ""}`,
  );

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable onPress={() => setSheet(true)} hitSlop={8} style={s.headerTitleBtn}>
              <Text style={s.headerTitleText} numberOfLines={1}>{vyber.nazev || t("admin", "repSubjektyTitle")}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textSubtle} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={() => setSheet(true)} hitSlop={8} style={s.headerFilterBtn}>
              <Ionicons name="options-outline" size={22} color={colors.text} />
              {zuzeni.od || zuzeni.do ? <View style={s.headerBadge} /> : null}
            </Pressable>
          ),
        }}
      />
      <ReportyFirmaSheet
        visible={sheet}
        initial={{ ...vyber, od: zuzeni.od, do: zuzeni.do }}
        onClose={() => setSheet(false)}
        onApply={(v) => { setVyber({ country: v.country, ident: v.ident, nazev: v.nazev, kind: v.kind }); setZuzeni((z) => ({ ...z, od: v.od, do: v.do })); setPotvrzeno(true); }}
      />
      {!potvrzeno && !sheet ? (
        <Pressable onPress={() => setSheet(true)} style={{ margin: spacing.lg }}>
          <Text style={{ color: colors.link, fontSize: fontSize.base }}>{t("admin", "repFirmaVybrat")} ›</Text>
        </Pressable>
      ) : null}
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
            <ZuzeniLista zuzeni={zuzeni} onZmen={setZuzeni} />
            {jeDodavatel ? (
              <Dodavatel data={data as ProfilDodavatele} zeme={zeme} mena={mena} router={router} zuzeni={zuzeni} onZuz={setZuzeni} str={str} />
            ) : (
              <Zadavatel data={data as ProfilZadavatele} zeme={zeme} mena={mena} router={router} zuzeni={zuzeni} onZuz={setZuzeni} str={str} />
            )}
            <Smlouvy blok={data.smlouvy} zeme={zeme} str={str} />
          </>
        ) : null}

        <View style={{ height: spacing.xl }} />
      </AppScrollView>
    </SafeAreaView>
  );
}

type Str = ReturnType<typeof useStrankovani>;


/** Aktivní zúžení jako zrušitelné štítky. */
function ZuzeniLista({ zuzeni, onZmen }: { zuzeni: Zuzeni; onZmen: (z: Zuzeni) => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!zuzeni.rok && !zuzeni.kos && !zuzeni.spolu && !zuzeni.od && !zuzeni.do) return null;
  return (
    <View style={s.zuzeni}>
      {zuzeni.od || zuzeni.do ? (
        <Pressable onPress={() => onZmen({ ...zuzeni, od: undefined, do: undefined })} style={s.zuzeniChip}>
          <Text style={s.zuzeniText}>{zuzeni.od ?? "…"} – {zuzeni.do ?? "…"} ✕</Text>
        </Pressable>
      ) : null}
      {zuzeni.rok ? (
        <Pressable onPress={() => onZmen({ ...zuzeni, rok: undefined })} style={s.zuzeniChip}>
          <Text style={s.zuzeniText}>{t("admin", "repFilterYear", { rok: zuzeni.rok })} ✕</Text>
        </Pressable>
      ) : null}
      {zuzeni.kos ? (
        <Pressable onPress={() => onZmen({ ...zuzeni, kos: undefined })} style={s.zuzeniChip}>
          <Text style={s.zuzeniText}>{kosNazev(zuzeni.kos, t)} ✕</Text>
        </Pressable>
      ) : null}
      {zuzeni.spolu ? (
        <Pressable onPress={() => onZmen({ ...zuzeni, spolu: undefined, spoluNazev: undefined })} style={s.zuzeniChip}>
          <Text style={s.zuzeniText}>{t("admin", "repSharedTenders")}: {zkrat(zuzeni.spoluNazev ?? zuzeni.spolu, 24)} ✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type T = ReturnType<typeof useI18n>["t"];
const kosNazev = (k: Kos, t: T): string =>
  k === "soutez" ? t("admin", "repBucketCompetitive")
    : k === "jedina" ? t("admin", "repBucketSingle")
      : k === "prime" ? t("admin", "repBucketDirect")
        : t("admin", "repBucketUnknown");

/** Rozpad podle druhu řízení jako klikatelné dlaždice. */
function KoseSekce({ kose, onZuz }: { kose: Kose | undefined; onZuz: (k: Kos) => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!kose) return null;
  const polozky: Kos[] = ["soutez", "jedina", "prime", "neznamo"];
  return (
    <RepSection title={t("admin", "repBuckets")} hint={t("admin", "repBucketsHint")}>
      <View style={s.kose}>
        {polozky.map((k) => (
          <Pressable key={k} onPress={() => onZuz(k)} style={({ pressed }) => [s.kosTile, pressed && s.kosTilePressed]}>
            <Text style={s.kosValue}>{cislo(kose[k])}</Text>
            <Text style={s.kosLabel}>{kosNazev(k, t)}</Text>
          </Pressable>
        ))}
      </View>
    </RepSection>
  );
}

// ── Dodavatel ───────────────────────────────────────────────────────────────

function Dodavatel({
  data, zeme, mena, router, zuzeni, onZuz, str,
}: {
  data: ProfilDodavatele; zeme: string; mena: string; router: Router;
  zuzeni: Zuzeni; onZuz: (z: Zuzeni) => void; str: Str;
}) {
  const { t } = useI18n();
  const st = data.stats;
  const zadavatele = useMemo(
    () => bezSmeti(str.rows<{ buyer_reg: string | null; buyer_name: string | null; vyher: unknown; objem?: unknown; objem_eur: unknown; posledni: unknown }>("zadavatele"), (r) => r.buyer_name),
    [str],
  );
  const soupeReri = useMemo(
    () => bezSmeti(str.rows<{ bidder_reg: string | null; bidder_name: string | null; spolecnych: unknown; jejich_vyher: unknown }>("soupeReri"), (r) => r.bidder_name),
    [str],
  );
  const posledni = str.rows<ZadaniDodavatele>("posledni");
  const ucasti = str.rows<UcastRow>("ucasti");

  return (
    <>
      <RepSection title={t("admin", "repProfileSupplier")} hint={t("admin", "repRegistryNote")}>
        <RepKpi
          items={[
            { label: t("admin", "repWinsAwards"), value: cislo(st.vyher), hint: st.vyher_s_ico != null ? t("admin", "repByIco", { n: cislo(st.vyher_s_ico) }) : undefined },
            ...(num(data.smlouvy?.celkem) ? [{ label: t("admin", "repContractsInRegistry"), value: cislo(data.smlouvy?.celkem) }] : []),
            ...(zeSoutezi(data.smlouvy?.podlePuvodu) ? [{ label: t("admin", "repContractsFromCompetitions"), value: cislo(zeSoutezi(data.smlouvy?.podlePuvodu)) }] : []),
            { label: t("admin", "repParticipations"), value: cislo(st.nabidek), hint: st.nabidek_s_ico != null ? t("admin", "repByIco", { n: cislo(st.nabidek_s_ico) }) : undefined },
            { label: t("admin", "repWinRate"), value: podil(st.uspesnost, 1) },
            { label: t("admin", "repVolumeWon"), value: castkaMenaKratce(st.objem ?? st.objem_eur, st.objem != null ? mena : "EUR") },
            ...(num(st.neznamych) ? [{ label: t("admin", "repOutcomeUnknown"), value: cislo(st.neznamych) }] : []),
          ]}
        />
        {num(st.vyher_jen_nazev) ? <RepHint>{t("admin", "repNameOnlyHint", { n: cislo(st.vyher_jen_nazev) })}</RepHint> : null}
        {st.registr_prepocet ? <RepHint>{t("admin", "repRegistryRecalc", { d: datum(st.registr_prepocet) })}</RepHint> : null}
      </RepSection>

      <KoseSekce kose={st.kose} onZuz={(k) => onZuz({ ...zuzeni, kos: k })} />

      {data.vyhryPoLetech.length ? (
        <RepSection title={t("admin", "repWinsByYear")}>
          <RepBars
            data={data.vyhryPoLetech.map((r) => ({ label: String(r.rok ?? "–"), value: num(r.objem ?? r.objem_eur) ?? 0 })).reverse()}
            formatValue={(v) => castkaMenaKratce(v, mena)}
          />
          <RepTable
            rows={data.vyhryPoLetech}
            cols={[
              { head: "rok", w: 56, cell: (r) => String(r.rok ?? "–"), tap: (r) => onZuz({ ...zuzeni, rok: Number(r.rok) || undefined }) },
              { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.vyher) },
              { head: "objem", w: 120, n: true, cell: (r) => castkaMenaKratce(r.objem ?? r.objem_eur, mena) },
              { head: t("admin", "repBucketCompetitive"), w: 74, n: true, cell: (r) => cislo(r.kose?.soutez ?? r.v_soutezi), tap: () => onZuz({ ...zuzeni, kos: "soutez" }) },
              { head: t("admin", "repBucketSingle"), w: 90, n: true, cell: (r) => cislo(r.kose?.jedina), tap: () => onZuz({ ...zuzeni, kos: "jedina" }) },
              { head: t("admin", "repBucketDirect"), w: 90, n: true, cell: (r) => cislo(r.kose?.prime ?? r.prime), tap: () => onZuz({ ...zuzeni, kos: "prime" }) },
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
              { head: "rok", w: 56, cell: (r) => String(r.rok ?? "–"), tap: (r) => onZuz({ ...zuzeni, rok: Number(r.rok) || undefined }) },
              { head: t("admin", "repParticipations"), w: 72, n: true, cell: (r) => cislo(r.nabidek) },
              { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.vyher) },
              { head: t("admin", "repWinRate"), w: 84, n: true, cell: (r) => pomer(r.vyher, r.nabidek) },
              { head: t("admin", "repOutcomeUnknown"), w: 84, n: true, cell: (r) => cislo(r.neznamych) },
              { head: t("admin", "repAvgBids"), w: 84, n: true, cell: (r) => cislo(r.prum_soupereru, 1) },
            ]}
          />
        </RepSection>
      ) : null}

      {zadavatele.length ? (
        <RepSection title={t("admin", "repTopBuyers")}>
          <RepTable
            rows={zadavatele}
            celkem={str.total("zadavatele")}
            onVice={() => void str.vice("zadavatele")}
            viceNacita={str.nacita === "zadavatele"}
            cols={[
              {
                head: "zadavatel", w: 200, cell: (r) => zkrat(r.buyer_name, 60),
                tap: (r) => naProfil(router, { country: zeme, ident: r.buyer_reg || r.buyer_name, kind: "zadavatel", nazev: r.buyer_name }),
              },
              { head: t("admin", "repRegNo"), w: 96, cell: (r) => r.buyer_reg ?? "–" },
              { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.vyher as never) },
              { head: "objem", w: 120, n: true, cell: (r) => castkaMenaKratce((r.objem ?? r.objem_eur) as never, mena) },
              { head: "naposled", w: 88, cell: (r) => datum(r.posledni) },
            ]}
          />
        </RepSection>
      ) : null}

      <CpvMix
        rows={data.cpv.map((c) => ({ cpv3: c.cpv3, n: num(c.vyher) ?? 0, objem: c.objem ?? c.objem_eur }))}
        zeme={zeme} mena={mena} router={router} popisPoctu={t("admin", "repWins")}
      />

      {soupeReri.length ? (
        <RepSection title={t("admin", "repRivals")} hint={t("admin", "repRivalsHint")}>
          <RepTable
            rows={soupeReri}
            celkem={str.total("soupeReri")}
            onVice={() => void str.vice("soupeReri")}
            viceNacita={str.nacita === "soupeReri"}
            cols={[
              {
                head: "firma", w: 190, cell: (r) => zkrat(r.bidder_name, 60),
                tap: (r) => naProfil(router, { country: zeme, ident: r.bidder_reg || r.bidder_name, kind: "dodavatel", nazev: r.bidder_name }),
              },
              { head: t("admin", "repRegNo"), w: 96, cell: (r) => r.bidder_reg ?? "–" },
              { head: "společných", w: 90, n: true, cell: (r) => cislo(r.spolecnych as never) },
              { head: "jejich výher", w: 92, n: true, cell: (r) => cislo(r.jejich_vyher as never) },
              {
                head: t("admin", "repSharedTenders"), w: 104,
                cell: () => t("admin", "repSharedTenders"),
                tap: (r) => onZuz({ ...zuzeni, spolu: r.bidder_reg || r.bidder_name || undefined, spoluNazev: r.bidder_name ?? undefined }),
              },
            ]}
          />
        </RepSection>
      ) : null}

      <RepSection title={t("admin", "repParticipationsTitle")} hint={t("admin", "repParticipationsHint")}>
        {ucasti.length === 0 ? (
          <RepHint>{t("admin", "repNothingToShow")}</RepHint>
        ) : (
          <RepTable<UcastRow>
            rows={ucasti}
            celkem={str.total("ucasti")}
            onVice={() => void str.vice("ucasti")}
            viceNacita={str.nacita === "ucasti"}
            onRowPress={(r) => naZadani(router, r, zeme)}
            cols={[
              { head: "datum", w: 84, cell: (r) => datum(r.award_date) },
              { head: "zakázka", w: 200, cell: (r) => zkrat(r.title, 70), tap: (r) => naZadani(router, r, zeme) },
              {
                head: "zadavatel", w: 160, cell: (r) => zkrat(r.buyer_name, 44),
                tap: (r) => naProfil(router, { country: zeme, ident: r.buyer_reg || r.buyer_name, kind: "zadavatel", nazev: r.buyer_name }),
              },
              { head: t("admin", "repOffered"), w: 120, n: true, cell: (r) => castkaMenaKratce(r.offered_value, r.bid_currency || r.currency || mena) },
              { head: "cena vítěze", w: 120, n: true, cell: (r) => castkaMenaKratce(r.final_value, r.currency || mena) },
              {
                head: "výsledek", w: 84,
                cell: (r) => (r.is_winner === 1 ? t("admin", "repWon") : r.is_winner === 0 ? t("admin", "repLost") : t("admin", "repOutcomeUnknown")),
              },
              { head: t("admin", "repSource"), w: 56, cell: (r) => (r.raw_ref ? "↗" : ""), url: (r) => r.raw_ref },
            ]}
          />
        )}
      </RepSection>

      <PosledniZadani
        rows={posledni} zeme={zeme} mena={mena} router={router} sZadavatelem
        celkem={str.total("posledni")} onVice={() => void str.vice("posledni")} nacita={str.nacita === "posledni"}
      />
    </>
  );
}

// ── Zadavatel ───────────────────────────────────────────────────────────────

function Zadavatel({
  data, zeme, mena, router, zuzeni, onZuz, str,
}: {
  data: ProfilZadavatele; zeme: string; mena: string; router: Router;
  zuzeni: Zuzeni; onZuz: (z: Zuzeni) => void; str: Str;
}) {
  const { t } = useI18n();
  const p = data.prehled;
  const vitezove = useMemo(
    () => bezSmeti(str.rows<{ winner_reg: string | null; winner_name: string | null; vyher: unknown; objem?: unknown; objem_eur: unknown; posledni: unknown }>("vitezove"), (r) => r.winner_name),
    [str],
  );
  const posledni = str.rows<ZadaniZadavatele>("posledni");
  const souteze = str.rows<SoutezRow>("souteze");

  return (
    <>
      <RepSection title={t("admin", "repProfileBuyer")} hint={t("admin", "repRegistryNote")}>
        <RepKpi
          items={[
            { label: t("admin", "repAwards"), value: cislo(p.zadani) },
            { label: "objem", value: castkaMenaKratce(p.objem ?? p.objem_eur, p.objem != null ? mena : "EUR") },
            { label: t("admin", "repAvgBids"), value: cislo(p.prum_nabidek, 1), hint: `n = ${cislo(p.s_poctem)}` },
            { label: t("admin", "repOneBidShare"), value: pomer(p.jedna_nabidka, p.s_poctem), hint: `n = ${cislo(p.s_poctem)}` },
            { label: t("admin", "repPriceVsEstimate"), value: cislo(p.prum_pomer, 2) },
            { label: t("admin", "repCancelled"), value: cislo(p.zrusenych) },
          ]}
        />
        <RepRow label={t("admin", "repPeriod")} value={`${datum(p.od)} – ${datum(p.do)}`} />
        {num(p.jen_nazev) ? <RepHint>{t("admin", "repNameOnlyHint", { n: cislo(p.jen_nazev) })}</RepHint> : null}
        {p.registr_prepocet ? <RepHint>{t("admin", "repRegistryRecalc", { d: datum(p.registr_prepocet) })}</RepHint> : null}
      </RepSection>

      <KoseSekce kose={p.kose} onZuz={(k) => onZuz({ ...zuzeni, kos: k })} />

      {data.poLetech.length ? (
        <RepSection title={t("admin", "repTendersByYear")}>
          <RepBars data={data.poLetech.map((r) => ({ label: String(r.rok ?? "–"), value: num(r.zadani) ?? 0 })).reverse()} />
          <RepTable
            rows={data.poLetech}
            cols={[
              { head: "rok", w: 56, cell: (r) => String(r.rok ?? "–"), tap: (r) => onZuz({ ...zuzeni, rok: Number(r.rok) || undefined }) },
              { head: t("admin", "repAwards"), w: 66, n: true, cell: (r) => cislo(r.zadani) },
              { head: "objem", w: 120, n: true, cell: (r) => castkaMenaKratce(r.objem ?? r.objem_eur, mena) },
              { head: t("admin", "repBucketCompetitive"), w: 74, n: true, cell: (r) => cislo(r.kose?.soutez ?? r.souteze), tap: () => onZuz({ ...zuzeni, kos: "soutez" }) },
              { head: t("admin", "repBucketSingle"), w: 90, n: true, cell: (r) => cislo(r.kose?.jedina ?? r.jedna_nabidka), tap: () => onZuz({ ...zuzeni, kos: "jedina" }) },
              { head: t("admin", "repAvgBids"), w: 80, n: true, cell: (r) => cislo(r.prum_nabidek, 1) },
              { head: t("admin", "repPriceVsEstimate"), w: 100, n: true, cell: (r) => cislo(r.prum_pomer, 2) },
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
                head: "firma", w: 190, cell: (r) => zkrat(r.winner_name, 60),
                tap: (r) => naProfil(router, { country: zeme, ident: r.winner_reg || r.winner_name, kind: "dodavatel", nazev: r.winner_name }),
              },
              { head: t("admin", "repRegNo"), w: 96, cell: (r) => r.winner_reg ?? "–" },
              { head: t("admin", "repWins"), w: 62, n: true, cell: (r) => cislo(r.vyher as never) },
              { head: "podíl", w: 62, n: true, cell: (r) => pomer(r.vyher as never, data.prehled.zadani) },
              { head: "objem", w: 120, n: true, cell: (r) => castkaMenaKratce((r.objem ?? r.objem_eur) as never, mena) },
              { head: "naposled", w: 88, cell: (r) => datum(r.posledni) },
            ]}
          />
        </RepSection>
      ) : null}

      <CpvMix
        rows={data.cpv.map((c) => ({ cpv3: c.cpv3, n: num(c.zadani) ?? 0, objem: c.objem ?? c.objem_eur }))}
        zeme={zeme} mena={mena} router={router} popisPoctu={t("admin", "repAwards")}
        buyer={data.org.reg_no ?? undefined} buyerNazev={data.org.name ?? undefined}
      />

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

      <PosledniZadani
        rows={posledni} zeme={zeme} mena={mena} router={router} sVitezem
        celkem={str.total("posledni")} onVice={() => void str.vice("posledni")} nacita={str.nacita === "posledni"}
      />

      {souteze.length ? (
        <RepSection title={t("admin", "repLiveTenders")}>
          <RepTable<SoutezRow>
            rows={souteze}
            celkem={str.total("souteze")}
            onVice={() => void str.vice("souteze")}
            viceNacita={str.nacita === "souteze"}
            onRowPress={(r) => naZakazku(router, r.id)}
            cols={[
              { head: t("admin", "repPublished"), w: 84, cell: (r) => datum(r.publishedAt) },
              { head: t("admin", "repPortal"), w: 96, cell: (r) => r.portalType ?? "–" },
              { head: "název", w: 210, cell: (r) => zkrat(r.title, 70), tap: (r) => naZakazku(router, r.id) },
              { head: t("admin", "repEstimate"), w: 120, n: true, cell: (r) => castkaMenaKratce(r.estimatedValue, r.currency || mena) },
              { head: t("admin", "repDeadline"), w: 84, cell: (r) => datum(r.deadlineAt) },
              { head: "stav", w: 80, cell: (r) => (num(r.isActive) ? t("admin", "repActive") : t("admin", "repClosed")) },
              { head: t("admin", "repSource"), w: 56, cell: (r) => (r.sourceUrl ? "↗" : ""), url: (r) => r.sourceUrl },
            ]}
          />
        </RepSection>
      ) : null}
    </>
  );
}

// ── Sdílené sekce ───────────────────────────────────────────────────────────

/** CPV mix s prokliky do cenových hladin a konkurence pro daný prefix. */
function CpvMix({
  rows, zeme, mena, router, popisPoctu, buyer, buyerNazev,
}: {
  rows: { cpv3: string | null; n: number; objem: unknown }[];
  zeme: string; mena: string; router: Router; popisPoctu: string;
  buyer?: string; buyerNazev?: string;
}) {
  const { t } = useI18n();
  if (!rows.length) return null;
  return (
    <RepSection title={t("admin", "repCpvMix")}>
      <RepTable
        rows={rows}
        cols={[
          { head: "CPV", w: 64, cell: (r) => r.cpv3 ?? "–" },
          { head: popisPoctu, w: 66, n: true, cell: (r) => cislo(r.n) },
          { head: "objem", w: 120, n: true, cell: (r) => castkaMenaKratce(r.objem as never, mena) },
          {
            head: t("admin", "repOpenPriceLevels"), w: 104,
            cell: () => t("admin", "repOpenPriceLevels"),
            tap: (r) => { if (r.cpv3) naCenoveHladiny(router, { country: zeme, cpv: r.cpv3 }); },
          },
          {
            head: t("admin", "repOpenCompetition"), w: 96,
            cell: () => t("admin", "repOpenCompetition"),
            tap: (r) => { if (r.cpv3) naKonkurenci(router, { country: zeme, cpv: r.cpv3, buyer, buyerNazev }); },
          },
        ]}
      />
    </RepSection>
  );
}

/**
 * Poslední zadání. Odkaz na zdroj je sloupcem v řádku (ne zvláštním seznamem pod
 * tabulkou) a klik na řádek otevře detail zadání.
 */
function PosledniZadani({
  rows, zeme, mena, router, sZadavatelem, sVitezem, celkem, onVice, nacita,
}: {
  rows: (ZadaniDodavatele | ZadaniZadavatele)[];
  zeme: string; mena: string; router: Router;
  sZadavatelem?: boolean; sVitezem?: boolean;
  celkem?: number; onVice?: () => void; nacita?: boolean;
}) {
  const { t } = useI18n();
  type R = (typeof rows)[number];
  if (!rows.length) {
    return (
      <RepSection title={t("admin", "repLastAwards")} hint={t("admin", "repWinsHint")}>
        <RepHint>{t("admin", "repNothingToShow")}</RepHint>
      </RepSection>
    );
  }
  return (
    <RepSection title={t("admin", "repLastAwards")} hint={t("admin", "repWinsHint")}>
      <RepTable<R>
        rows={rows}
        celkem={celkem}
        onVice={onVice}
        viceNacita={nacita}
        onRowPress={(r) => naZadani(router, r, zeme)}
        cols={[
          { head: "datum", w: 84, cell: (r) => datum(r.award_date) },
          { head: "zakázka", w: 200, cell: (r) => zkrat(r.title, 70), tap: (r) => naZadani(router, r, zeme) },
          ...(sZadavatelem
            ? [{
                head: "zadavatel", w: 160, cell: (r: R) => zkrat(r.buyer_name, 44),
                tap: (r: R) => naProfil(router, { country: zeme, ident: r.buyer_reg || r.buyer_name, kind: "zadavatel" as const, nazev: r.buyer_name }),
              }]
            : []),
          ...(sVitezem
            ? [{
                head: "vítěz", w: 160, cell: (r: R) => zkrat(r.winner_name, 44),
                tap: (r: R) => naProfil(router, { country: zeme, ident: r.winner_reg || r.winner_name, kind: "dodavatel" as const, nazev: r.winner_name }),
              }]
            : []),
          { head: "CPV", w: 80, cell: (r) => r.cpv ?? "–" },
          { head: "cena", w: 120, n: true, cell: (r) => castkaMenaKratce(r.final_value, r.currency || mena) },
          { head: t("admin", "repEstimate"), w: 120, n: true, cell: (r) => castkaMenaKratce(r.est_value, r.currency || mena) },
          { head: "nab.", w: 48, n: true, cell: (r) => cislo(r.bid_count) },
          { head: t("admin", "repSource"), w: 56, cell: (r) => (r.raw_ref ? "↗" : ""), url: (r) => r.raw_ref },
        ]}
      />
    </RepSection>
  );
}

/**
 * Smlouvy z registru smluv — jiný zdroj než výsledky zadávacích řízení. Dokresluje
 * zadání bez soutěže, která portály jako „přímé" neoznačí.
 */
function Smlouvy({ blok, zeme, str }: { blok: SmlouvyBlok | null | undefined; zeme: string; str: Str }) {
  const { t } = useI18n();
  // Sekce dává smysl jen pro ČR — jinde obdobu registru nemáme.
  if (zeme !== "CZ") return null;
  if (!blok) {
    return (
      <RepSection title={t("admin", "repContracts")} hint={t("admin", "repContractsHint")}>
        <RepHint>{t("admin", "repContractsPending")}</RepHint>
      </RepSection>
    );
  }
  const mena = blok.mena || "CZK";
  const radky = str.rows<SmlouvaRow>("smlouvy");
  const rows = radky.length ? radky : (blok.radky ?? []);
  return (
    <RepSection
      title={t("admin", "repContracts")}
      hint={t("admin", "repContractsCut", { n: cislo(blok.orezOd ?? 300000) })}
    >
      <RepKpi
        items={[
          { label: t("admin", "repContractsCount"), value: cislo(blok.celkem) },
          { label: t("admin", "repContractsVolume"), value: castkaMenaKratce(blok.objem, mena) },
        ]}
      />
      {blok.roky?.length ? (
        <RepBars
          data={[...blok.roky].reverse().map((r) => ({ label: String(r.rok ?? "–"), value: num(r.objem) ?? 0 }))}
          formatValue={(v) => castkaMenaKratce(v, mena)}
        />
      ) : null}
      {rows.length ? (
        <RepTable<SmlouvaRow>
          rows={rows}
          celkem={num(blok.celkem) ?? undefined}
          onVice={() => void str.vice("smlouvy")}
          viceNacita={str.nacita === "smlouvy"}
          cols={[
            { head: "datum", w: 84, cell: (r) => datum(r.datumUzavreni) },
            { head: t("admin", "repSubject"), w: 210, cell: (r) => zkrat(r.predmet, 70) },
            { head: t("admin", "repCounterparty"), w: 170, cell: (r) => zkrat(r.zadavatelNazev, 46) },
            { head: t("admin", "repSupplier"), w: 170, cell: (r) => zkrat(r.dodavatelNazev, 46) },
            { head: t("admin", "repAmount"), w: 130, n: true, cell: (r) => castkaMena(r.hodnotaVcetneDph ?? r.hodnotaBezDph, mena) },
            { head: t("admin", "repOrigin"), w: 100, cell: (r) => t("admin", (`repOrigin_${r.puvod ?? "neurceno"}`) as "repOrigin_neurceno") },
            { head: "kategorie", w: 120, cell: (r) => zkrat(r.kategorie, 30) },
            { head: t("admin", "repSource"), w: 56, cell: (r) => (r.smlouvaUrl ? "↗" : ""), url: (r) => r.smlouvaUrl },
          ]}
        />
      ) : null}
    </RepSection>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg },
    title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, lineHeight: 24 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    headerTitleBtn: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 220 },
    headerTitleText: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
    headerFilterBtn: { padding: 4 },
    headerBadge: { position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    zuzeni: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
    zuzeniChip: {
      backgroundColor: colors.accent,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    zuzeniText: { color: colors.accentForeground, fontSize: fontSize.xs, fontWeight: "700" },
    kose: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    kosTile: {
      flexGrow: 1,
      flexBasis: "22%",
      minWidth: 84,
      backgroundColor: colors.bg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    kosTilePressed: { borderColor: colors.text },
    kosValue: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
    kosLabel: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  });
