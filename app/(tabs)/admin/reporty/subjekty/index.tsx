import { useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppScrollView } from "@/components/AppScroll";
import {
  RepBadge, RepButton, RepField, RepHint, RepSection, RepState,
  castkaKratce, cislo, datum, num, zkrat,
} from "@/components/ReportUi";
import { reportChyba, reportyApi, type OrgRow } from "@/lib/reporty-api";
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

  const [country, setCountry] = useState("CZ");
  const [dotaz, setDotaz] = useState("");
  const [hledane, setHledane] = useState("");
  const [hledanaZeme, setHledanaZeme] = useState("CZ");

  const q = useQuery({
    queryKey: ["rep-subjekt-hledani", hledanaZeme, hledane],
    queryFn: ({ signal }) => reportyApi.subjektHledani(hledanaZeme, hledane, signal),
    enabled: hledane.length > 0,
    retry: false,
  });

  const chyba = q.error ? reportChyba(q.error) : null;

  const hledej = () => {
    const d = dotaz.trim();
    if (!d) return;
    setHledanaZeme(country.toUpperCase().slice(0, 2) || "CZ");
    setHledane(d);
  };

  const otevri = (org: OrgRow, kind: "dodavatel" | "zadavatel") =>
    router.push({
      pathname: "/(tabs)/admin/reporty/subjekty/profil",
      // Profil se dohledává podle IČ, a když ho subjekt nemá, podle přesného názvu.
      params: { country: hledanaZeme, ident: org.reg_no ?? org.name ?? "", kind, nazev: org.name ?? "" },
    });

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
              label={t("admin", "repSubjQ")}
              value={dotaz}
              onChangeText={setDotaz}
              placeholder={t("admin", "repSubjQPh")}
            />
          </View>
          <RepButton title={t("admin", "repSearch")} onPress={hledej} disabled={!dotaz.trim()} />
        </RepSection>

        {hledane ? (
          <RepSection title={t("admin", "repSubjResults")}>
            <RepState
              loading={q.isLoading}
              error={chyba ? (chyba.chybiNaServeru ? t("admin", "repNotDeployed") : chyba.zprava) : null}
              errorTitle={t("admin", "repErrorTitle")}
              retryLabel={t("admin", "repRetry")}
              onRetry={() => void q.refetch()}
              empty={q.data && q.data.subjekty.length === 0 ? t("admin", "repEmpty") : null}
            />
            {(q.data?.subjekty ?? []).map((org) => {
              const jeDodavatel = !!num(org.is_supplier);
              const jeZadavatel = !!num(org.is_buyer);
              return (
                <View key={String(org.id)} style={s.orgCard}>
                  <Text style={s.orgName}>{zkrat(org.name, 70)}</Text>
                  <Text style={s.orgMeta}>
                    {org.reg_no ?? "–"} · {datum(org.first_seen)} – {datum(org.last_seen)}
                    {num(org.n_aliases) ? ` · ${t("admin", "repAliases")}: ${cislo(org.n_aliases)}` : ""}
                  </Text>
                  <View style={s.orgStats}>
                    <RepBadge text={`${t("admin", "repWins")}: ${cislo(org.n_won)}`} />
                    <RepBadge text={`${t("admin", "repParticipations")}: ${cislo(org.n_bids)}`} />
                    <RepBadge text={`${t("admin", "repAwards")}: ${cislo(org.n_awarded)}`} />
                    {num(org.value_won_eur) ? <RepBadge text={castkaKratce(org.value_won_eur, "EUR")} /> : null}
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
