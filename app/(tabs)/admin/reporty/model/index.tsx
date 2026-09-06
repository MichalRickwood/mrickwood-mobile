import { useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppScrollView } from "@/components/AppScroll";
import {
  RepBadge, RepButton, RepField, RepHint, RepKpi, RepRow, RepSection, RepState, RepTable,
} from "@/components/ReportUi";
import CountryField from "@/components/CountryField";
import { castkaMenaKratce, cislo, datum, num, podil, zkrat } from "@/lib/reporty-format";
import { menaZeme } from "@/lib/countries";
import { useVychoziZeme } from "@/lib/use-zeme";
import { naPredikci } from "@/lib/reporty-nav";
import {
  MODEL_COUNTRIES, reportChyba, reportyApi,
  type KvalitaZeme, type ModelHledani, type PosledniPredikce,
} from "@/lib/reporty-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, spacing, type Colors } from "@/constants/theme";

/**
 * Model — co model předpověděl a jak mu to vychází.
 *
 * Země se vybírá jen z těch, pro které je model natrénovaný; u ostatních se
 * nedopočítává nic a obrazovka to řekne rovnou. Kvalita se ukazuje po zemích a
 * KAŽDÁ metrika nese n (počet vzorků) — metrika bez n se vůbec nezobrazí,
 * protože „pokrytí 0 %" ze čtyř vyhodnocených predikcí není údaj, ale šum.
 */
export default function ReportModelScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { vychoziZeme } = useVychoziZeme();
  // Stav filtrů drží obrazovka (ne URL) — po návratu z detailu zůstane zachovaný.
  const [country, setCountry] = useState<string>(vychoziZeme);
  const [dotaz, setDotaz] = useState("");
  const [hledane, setHledane] = useState("");

  const kvalita = useQuery({
    queryKey: ["rep-model-kvalita"],
    queryFn: ({ signal }) => reportyApi.modelKvalita(signal),
    retry: false,
  });

  const hledani = useQuery({
    queryKey: ["rep-model-hledani", country, hledane],
    queryFn: ({ signal }) => reportyApi.modelHledani(country, hledane, signal),
    enabled: hledane.length > 0,
    retry: false,
  });

  const zeme = kvalita.data?.modelCountries?.length ? kvalita.data.modelCountries : [...MODEL_COUNTRIES];
  const maModel = zeme.includes(country);
  const chybaKvalita = kvalita.error ? reportChyba(kvalita.error) : null;
  const chybaHledani = hledani.error ? reportChyba(hledani.error) : null;

  const predikce = (kvalita.data?.posledni ?? []).filter((p) => p.country === country);

  const otevri = (id: unknown) => naPredikci(router, id as never);
  const mena = menaZeme(country);

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <AppScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={kvalita.isRefetching || hledani.isRefetching}
            onRefresh={() => {
              void kvalita.refetch();
              if (hledane) void hledani.refetch();
            }}
            tintColor={colors.textSubtle}
          />
        }
      >
        <RepSection title={t("admin", "repFilters")} hint={t("admin", "repModelIntro")}>
          <CountryField label={t("admin", "repCountry")} value={country} onChange={setCountry} />
          <View style={s.filterRow}>
            <RepField
              label={t("admin", "repModelQ")}
              value={dotaz}
              onChangeText={setDotaz}
              placeholder={t("admin", "repModelQPh")}
            />
            <View style={s.btnWrap}>
              <RepButton title={t("admin", "repSearch")} onPress={() => setHledane(dotaz.trim())} disabled={!dotaz.trim()} />
            </View>
          </View>
          {!maModel ? <RepBadge text={t("admin", "repModelNoCountry")} tone="warn" /> : null}
        </RepSection>

        {chybaKvalita?.chybiNaServeru ? (
          <RepState error={t("admin", "repNotDeployed")} errorTitle={t("admin", "repErrorTitle")} />
        ) : null}

        {/* Výsledky hledání — jen když se hledalo. */}
        {hledane ? (
          <RepSection title={t("admin", "repModelFound")}>
            <RepState
              loading={hledani.isLoading}
              error={chybaHledani ? (chybaHledani.chybiNaServeru ? t("admin", "repNotDeployed") : chybaHledani.zprava) : null}
              errorTitle={t("admin", "repErrorTitle")}
              retryLabel={t("admin", "repRetry")}
              onRetry={() => void hledani.refetch()}
              empty={hledani.data && hledani.data.tenders.length === 0 ? t("admin", "repEmpty") : null}
            />
            {hledani.data && hledani.data.tenders.length > 0 ? (
              <RepTable<ModelHledani["tenders"][number]>
                rows={hledani.data.tenders}
                onRowPress={(r) => otevri(r.id)}
                cols={[
                  { head: "id", w: 76, cell: (r) => String(r.id ?? "–") },
                  { head: t("admin", "repPublished"), w: 84, cell: (r) => datum(r.publishedAt) },
                  { head: "název", w: 200, cell: (r) => zkrat(r.title, 70), tap: (r) => otevri(r.id) },
                  { head: t("admin", "repEstimate"), w: 116, n: true, cell: (r) => castkaMenaKratce(r.estimatedValue, r.currency || mena) },
                  { head: t("admin", "repDeadline"), w: 84, cell: (r) => datum(r.deadlineAt) },
                  { head: "zadavatel", w: 150, cell: (r) => zkrat(r.buyer, 40) },
                  { head: "predikce", w: 74, n: true, cell: (r) => (r.predikci > 0 ? cislo(r.predikci) : "–") },
                ]}
              />
            ) : null}
          </RepSection>
        ) : null}

        {/* Poslední uložené predikce pro vybranou zemi. */}
        <RepSection title={t("admin", "repModelLatest")}>
          <RepState
            loading={kvalita.isLoading}
            error={chybaKvalita && !chybaKvalita.chybiNaServeru ? chybaKvalita.zprava : null}
            errorTitle={t("admin", "repErrorTitle")}
            retryLabel={t("admin", "repRetry")}
            onRetry={() => void kvalita.refetch()}
            empty={kvalita.data && predikce.length === 0 ? t("admin", "repModelNoPredictions") : null}
          />
          {predikce.length > 0 ? (
            <RepTable<PosledniPredikce>
              rows={predikce}
              onRowPress={(r) => otevri(r.tender_id)}
              cols={[
                { head: "zakázka", w: 190, cell: (r) => zkrat(r.title, 65), tap: (r) => otevri(r.tender_id) },
                { head: "zadavatel", w: 150, cell: (r) => zkrat(r.buyer, 40) },
                { head: t("admin", "repEstimate"), w: 116, n: true, cell: (r) => castkaMenaKratce(r.est_value, mena) },
                { head: "P2", w: 52, n: true, cell: (r) => cislo(r.p2_bids, 1) },
                { head: "q50", w: 56, n: true, cell: (r) => cislo(r.q50, 2) },
                { head: t("admin", "repDeadline"), w: 84, cell: (r) => datum(r.deadlineAt) },
                { head: t("admin", "repPredictedAt"), w: 84, cell: (r) => datum(r.predicted_at) },
                { head: "skutečnost", w: 84, n: true, cell: (r) => cislo(r.eval_ratio, 2) },
              ]}
            />
          ) : null}
        </RepSection>

        {/* Kvalita po zemích — vždy celý přehled, ne jen vybraná země. */}
        <RepSection title={t("admin", "repModelQuality")} hint={t("admin", "repModelQualityHint")}>
          {(kvalita.data?.zeme ?? []).map((z) => (
            <KvalitaKarta key={z.country} z={z} vybrana={z.country === country} />
          ))}
          {(kvalita.data?.ostatni ?? []).map((z) => (
            <KvalitaKarta key={`o-${z.country}`} z={z} vybrana={false} />
          ))}
          {kvalita.data && !kvalita.data.zeme.some((z) => num(z.vyhodnoceno)) ? (
            <RepHint>{t("admin", "repModelNoEval")}</RepHint>
          ) : null}
        </RepSection>

        <View style={{ height: spacing.xl }} />
      </AppScrollView>
    </SafeAreaView>
  );
}

/** Jedna země v přehledu kvality. Metriky se přidávají jen s nenulovým n. */
function KvalitaKarta({ z, vybrana }: { z: KvalitaZeme; vybrana: boolean }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const pocet = num(z.n);
  const nPokryti = num(z.n_pokryti);
  const nP2 = num(z.n_p2);
  const nP1 = num(z.n_p1);

  const metriky: { label: string; value: string; hint?: string }[] = [];
  if (pocet) {
    metriky.push({ label: t("admin", "repPredictionsN"), value: cislo(pocet) });
    if (num(z.s_p1)) metriky.push({ label: t("admin", "repWithP1"), value: cislo(z.s_p1) });
    if (num(z.vyhodnoceno)) metriky.push({ label: t("admin", "repEvaluated"), value: cislo(z.vyhodnoceno) });
    // Průměry přes všechny uložené predikce — n je počet predikcí.
    if (num(z.prum_q50) !== null) metriky.push({ label: t("admin", "repAvgQ50"), value: cislo(z.prum_q50, 2), hint: `n = ${cislo(pocet)}` });
    if (num(z.prum_sirka) !== null) metriky.push({ label: t("admin", "repAvgWidth"), value: cislo(z.prum_sirka, 2), hint: `n = ${cislo(pocet)}` });
  }
  // Metriky ze zpětného vyhodnocení — bez n se neukazují vůbec.
  if (nPokryti) metriky.push({ label: t("admin", "repCoverage"), value: podil(z.pokryti80), hint: `n = ${cislo(nPokryti)}` });
  if (nP2) metriky.push({ label: t("admin", "repP2Mae"), value: cislo(z.p2_mae, 2), hint: `n = ${cislo(nP2)}` });
  if (nP1) metriky.push({ label: t("admin", "repP1Hit"), value: podil(z.p1_zasah), hint: `n = ${cislo(nP1)}` });

  return (
    <View style={[s.zemeCard, vybrana && s.zemeCardActive]}>
      <View style={s.zemeHead}>
        <Text style={s.zemeName}>{z.country}</Text>
        {/* Štítek se odvozuje z dat, ne ze `stav` ze serveru — ten chodí česky natvrdo. */}
        <RepBadge
          text={pocet ? t("admin", "repModelStored") : t("admin", "repModelNoCountry")}
          tone={pocet ? "yes" : "muted"}
        />
      </View>
      {pocet ? (
        <>
          <RepKpi items={metriky} />
          {z.model_version ? <RepRow label={t("admin", "repVersion")} value={z.model_version} /> : null}
          {z.posledni ? <RepRow label={t("admin", "repLastRun")} value={datum(z.posledni)} /> : null}
        </>
      ) : (
        <RepHint>{t("admin", "repModelNoPredictions")}</RepHint>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg },
    filterRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
    btnWrap: { paddingBottom: 1 },
    zemeCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.bg,
    },
    zemeCardActive: { borderColor: colors.borderHover },
    zemeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    zemeName: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  });
