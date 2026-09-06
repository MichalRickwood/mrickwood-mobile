import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScrollView } from "@/components/AppScroll";
import { RepBadge, RepHint, RepKpi, RepLink, RepRow, RepSection, RepState } from "@/components/ReportUi";
import { castkaMena, cislo, datum, num, zkrat } from "@/lib/reporty-format";
import { menaZeme } from "@/lib/countries";
import { naProfil } from "@/lib/reporty-nav";
import type { Num } from "@/lib/reporty-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, spacing, type Colors } from "@/constants/theme";

/** Řádek zadání, jak ho předává tabulka, ze které se sem kliklo. */
interface ZadaniParam {
  id?: Num;
  source?: string | null;
  award_date?: string | null;
  title?: string | null;
  cpv?: string | null;
  est_value?: Num;
  final_value?: Num;
  currency?: string | null;
  value_eur?: Num;
  bid_count?: Num;
  is_competitive?: Num;
  raw_ref?: string | null;
  buyer_name?: string | null;
  buyer_reg?: string | null;
  winner_name?: string | null;
  winner_reg?: string | null;
  offered_value?: Num;
  is_winner?: number | null;
  rank_no?: Num;
  bid_currency?: string | null;
}

/**
 * Detail jednoho zadání (výsledku soutěže).
 *
 * Zadání není živá zakázka z portálu — nemá vlastní stránku v appce, takže se sem
 * předá rovnou řádek z tabulky, ze které uživatel klikl. Odtud vedou prokliky na
 * profil zadavatele i vítěze a odkaz na původní zdroj v prohlížeči.
 */
export default function ReportZadaniScreen() {
  const { row, country } = useLocalSearchParams<{ row: string; country: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const z = useMemo<ZadaniParam | null>(() => {
    try {
      return row ? (JSON.parse(String(row)) as ZadaniParam) : null;
    } catch {
      return null;
    }
  }, [row]);

  if (!z) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom"]}>
        <View style={{ padding: spacing.lg }}>
          <RepState error={t("admin", "repAwardNotFound")} errorTitle={t("admin", "repErrorTitle")} />
        </View>
      </SafeAreaView>
    );
  }

  const zeme = String(country || "CZ");
  // Cena je v měně řádku; když ji zdroj nedal, bereme národní měnu země.
  const mena = z.currency || menaZeme(zeme);
  const menaNabidky = z.bid_currency || mena;
  const soutez = num(z.is_competitive);
  const vyhral = z.is_winner;

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <AppScrollView contentContainerStyle={s.scroll}>
        <RepSection>
          <Text style={s.title}>{z.title ?? "–"}</Text>
          <View style={s.badges}>
            <RepBadge text={zeme} />
            {z.source ? <RepBadge text={z.source} /> : null}
            {soutez === 1 ? <RepBadge text={t("admin", "repBucketCompetitive")} tone="yes" /> : null}
            {soutez === 0 ? <RepBadge text={t("admin", "repBucketDirect")} tone="warn" /> : null}
            {num(z.bid_count) === 1 ? <RepBadge text={t("admin", "repBucketSingle")} tone="warn" /> : null}
          </View>
          <RepRow label="datum zadání" value={datum(z.award_date)} />
          <RepRow label="CPV" value={z.cpv ?? "–"} />
          <RepRow label={t("admin", "repEstimate")} value={castkaMena(z.est_value, mena)} />
          <RepRow label="vysoutěžená cena" value={castkaMena(z.final_value, mena)} />
          <RepRow label="nabídek" value={cislo(z.bid_count)} />
          {soutez === 0 ? <RepHint>{t("admin", "repDirectHint")}</RepHint> : null}
        </RepSection>

        {z.offered_value !== undefined || z.is_winner !== undefined ? (
          <RepSection title={t("admin", "repParticipationsTitle")}>
            <RepKpi
              items={[
                { label: t("admin", "repOffered"), value: castkaMena(z.offered_value, menaNabidky) },
                {
                  label: "výsledek",
                  value:
                    vyhral === 1 ? t("admin", "repWon")
                      : vyhral === 0 ? t("admin", "repLost")
                        : t("admin", "repOutcomeUnknown"),
                },
                ...(num(z.rank_no) !== null ? [{ label: t("admin", "repRank"), value: cislo(z.rank_no) }] : []),
              ]}
            />
          </RepSection>
        ) : null}

        <RepSection title={t("admin", "repBuyer")}>
          {z.buyer_name ? (
            <RepRow label={zkrat(z.buyer_name, 60)} value={z.buyer_reg ?? "–"} />
          ) : (
            <RepHint>{t("admin", "repEmpty")}</RepHint>
          )}
          {z.buyer_name ? (
            <RepLink
              onPress={() => naProfil(router, { country: zeme, ident: z.buyer_reg || z.buyer_name, kind: "zadavatel", nazev: z.buyer_name })}
              title={t("admin", "repOpenProfile")}
            />
          ) : null}
        </RepSection>

        <RepSection title="Vítěz">
          {z.winner_name ? (
            <>
              <RepRow label={zkrat(z.winner_name, 60)} value={z.winner_reg ?? "–"} />
              <RepLink
                onPress={() => naProfil(router, { country: zeme, ident: z.winner_reg || z.winner_name, kind: "dodavatel", nazev: z.winner_name })}
                title={t("admin", "repOpenProfile")}
              />
            </>
          ) : (
            <RepHint>{t("admin", "repEmpty")}</RepHint>
          )}
        </RepSection>

        {z.raw_ref ? (
          <RepSection>
            <RepLink url={z.raw_ref} title={t("admin", "repOpenInBrowser")} />
          </RepSection>
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
