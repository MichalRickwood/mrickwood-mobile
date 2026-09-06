import { useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppScrollView } from "@/components/AppScroll";
import { RepBadge, RepHint, RepSection, RepState } from "@/components/ReportUi";
import CountryField from "@/components/CountryField";
import CompanyLookupField, { type CompanyLookupResult } from "@/components/CompanyLookupField";
import { bezSmeti, castkaMenaKratce, cislo, datum, num, zkrat } from "@/lib/reporty-format";
import { useVychoziZeme } from "@/lib/use-zeme";
import { naProfil } from "@/lib/reporty-nav";
import { reportChyba, reportyApi, type SubjektRow } from "@/lib/reporty-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Hledání v registru subjektů (`vt_org`) — podle názvu, IČ nebo aliasu.
 *
 * Jeden subjekt může být zároveň dodavatel i zadavatel, proto se z výsledku
 * neotevírá „profil", ale konkrétní role: tlačítko je aktivní jen pro tu, kterou
 * subjekt v datech opravdu má.
 */
export default function ReportSubjektyScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { vychoziZeme } = useVychoziZeme();

  const [country, setCountry] = useState(vychoziZeme);
  const [hledane, setHledane] = useState("");
  const [hledanaZeme, setHledanaZeme] = useState(vychoziZeme);

  const q = useQuery({
    queryKey: ["rep-subjekt-hledani", hledanaZeme, hledane],
    queryFn: ({ signal }) => reportyApi.subjektHledani(hledanaZeme, hledane, signal),
    enabled: hledane.length > 0,
    retry: false,
  });

  const chyba = q.error ? reportChyba(q.error) : null;
  // Útržky z rozsekaných tabulek na portálech do výsledků nepatří.
  const subjekty = useMemo(() => bezSmeti(q.data?.subjekty ?? [], (r) => r.name), [q.data]);

  /** Výběr z našeptávače otevře profil rovnou — bez mezikroku přes seznam. */
  const zNaseptavace = (v: CompanyLookupResult) => {
    // Subjekt bez IČO se dohledává podle přesného názvu.
    const ident = v.taxId || v.name;
    // Firma, která je jen zadavatel, se otevře jako zadavatel; jinak jako dodavatel.
    const kind = !v.jeDodavatel && v.jeZadavatel ? "zadavatel" : "dodavatel";
    naProfil(router, { country: v.country || country, ident, kind, nazev: v.name });
  };

  const otevri = (org: SubjektRow, kind: "dodavatel" | "zadavatel") =>
    // Profil se dohledává podle IČ, a když ho subjekt nemá, podle přesného názvu.
    naProfil(router, { country: hledanaZeme, ident: org.reg_no ?? org.name ?? "", kind, nazev: org.name ?? "" });

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <AppScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => hledane && void q.refetch()} tintColor={colors.textSubtle} />
        }
      >
        <RepSection title={t("admin", "repFilters")} hint={t("admin", "repSubjHint")}>
          <CountryField label={t("admin", "repCountry")} value={country} onChange={setCountry} />
          <CompanyLookupField
            zdroj="reporty"
            country={country}
            value=""
            resolvedName=""
            label={t("admin", "repSubjQ")}
            placeholder={t("admin", "repSubjQPh")}
            onResolve={(v) => {
              setHledanaZeme(country);
              setHledane(v.name);
              zNaseptavace(v);
            }}
            onClear={() => setHledane("")}
          />
        </RepSection>

        {hledane ? (
          <RepSection title={t("admin", "repSubjResults")}>
            <RepState
              loading={q.isLoading}
              error={chyba ? (chyba.chybiNaServeru ? t("admin", "repNotDeployed") : chyba.zprava) : null}
              errorTitle={t("admin", "repErrorTitle")}
              retryLabel={t("admin", "repRetry")}
              onRetry={() => void q.refetch()}
              empty={q.data && subjekty.length === 0 ? t("admin", "repEmpty") : null}
            />
            {subjekty.map((org) => {
              const jeDodavatel = !!num(org.is_supplier);
              const jeZadavatel = !!num(org.is_buyer);
              return (
                <View key={String(org.id)} style={s.orgCard}>
                  <Text style={s.orgName}>{zkrat(org.name, 70)}</Text>
                  <Text style={s.orgMeta}>
                    {[org.reg_no, org.sidlo ? zkrat(org.sidlo, 40) : null].filter(Boolean).join(" · ") || "–"} · {datum(org.first_seen)} – {datum(org.last_seen)}
                  </Text>
                  <View style={s.orgStats}>
                    <RepBadge text={`${t("admin", "repWins")}: ${cislo(org.n_won)}`} />
                    <RepBadge text={`${t("admin", "repParticipations")}: ${cislo(org.n_bids)}`} />
                    <RepBadge text={`${t("admin", "repAwards")}: ${cislo(org.n_awarded)}`} />
                    {num(org.value_won_eur) ? <RepBadge text={castkaMenaKratce(org.value_won_eur, "EUR")} /> : null}
                    {org.vNasichDatech === false ? <RepBadge text={t("admin", "repNotInOurData")} tone="warn" /> : null}
                  </View>
                  <View style={s.orgActions}>
                    <Pressable
                      onPress={() => otevri(org, "dodavatel")}
                      disabled={!jeDodavatel}
                      style={({ pressed }) => [s.action, !jeDodavatel && s.actionOff, pressed && jeDodavatel && s.actionPressed]}
                    >
                      <Text style={[s.actionText, !jeDodavatel && s.actionTextOff]}>{t("admin", "repSupplier")}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => otevri(org, "zadavatel")}
                      disabled={!jeZadavatel}
                      style={({ pressed }) => [s.action, !jeZadavatel && s.actionOff, pressed && jeZadavatel && s.actionPressed]}
                    >
                      <Text style={[s.actionText, !jeZadavatel && s.actionTextOff]}>{t("admin", "repBuyer")}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </RepSection>
        ) : (
          <RepHint>{t("admin", "repSubjHint")}</RepHint>
        )}

        <View style={{ height: spacing.xl }} />
      </AppScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg },
    filterRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
    orgCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.bg,
    },
    orgName: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
    orgMeta: { fontSize: fontSize.xs, color: colors.textSubtle },
    orgStats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    orgActions: { flexDirection: "row", gap: spacing.sm },
    action: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    actionPressed: { borderColor: colors.text },
    actionOff: { opacity: 0.35 },
    actionText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
    actionTextOff: { color: colors.textFaint },
  });
