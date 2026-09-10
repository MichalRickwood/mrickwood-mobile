import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminCard } from "@/components/AdminRow";
import { adminApi, type VymDopis } from "@/lib/admin-api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { nacistUcty } from "@/lib/isds/credentials";
import {
  chybejiciSchranky,
  odeslatDopisy,
  stahnoutOdpovedi,
  type VymPrubeh,
  type VymTexty,
} from "@/lib/isds/vymahani";
import { prepnoutVyrazeni, useVyrazene, vycistitVyrazeni } from "@/lib/isds/vyrazene";
import { STUPEN_KLIC, formatCastka, formatDatum, jePlacenyPrijemce } from "@/lib/vymahani-format";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export const DAVKA_KEY = ["ds-davka"] as const;

/**
 * Dnešní návrh — dopisy, které server připravil a čekají na schválení.
 *
 * Tok: biometrie → schválení na serveru (vrátí PDF) → pro každý dopis
 * FindDataBox (kontrola OVM) + CreateMessage → nahlášení výsledků →
 * stažení došlých odpovědí a doručenek. Bez telefonu se neodešle nic.
 */
export default function DatovkaIndexScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const vyrazene = useVyrazene();
  const [prubeh, setPrubeh] = useState<VymPrubeh | null>(null);

  const davka = useQuery({
    queryKey: DAVKA_KEY,
    queryFn: ({ signal }) => adminApi.getVymahaniDavka(signal),
  });
  // Účty se čtou bez biometrie (hesla v seznamu nejsou), takže je můžeme
  // držet v cache a hlídat, jestli má telefon údaje ke všem odesílatelům.
  const ucty = useQuery({
    queryKey: ["ds-ucty"],
    queryFn: () => nacistUcty(),
    // Účty se mění na sousední obrazovce (Nastavení). Bez `staleTime: 0` a
    // refetchi při návratu držela cache prázdný seznam z doby před přidáním
    // schránky a „Schválit a odeslat" pak jen skočilo zpátky do Nastavení.
    staleTime: 0,
  });
  const chybi = useQuery({
    queryKey: ["ds-chybejici", davka.data?.dopisy.length ?? 0, ucty.data?.length ?? 0],
    queryFn: () => (davka.data ? chybejiciSchranky(davka.data) : Promise.resolve([])),
    enabled: !!davka.data && !!ucty.data,
  });

  // Návrat z Nastavení: přečíst účty znovu, ať tlačítko ví o právě přidané schránce.
  useFocusEffect(
    useCallback(() => {
      void ucty.refetch();
    }, [ucty]),
  );

  const dopisy = davka.data?.dopisy ?? [];
  const kOdeslaniPocet = dopisy.filter((d) => !vyrazene.has(d.id)).length;
  const bezUdaju = ucty.data ? ucty.data.length === 0 : false;

  /** Texty biometrických promptů a hlášek, které jdou serveru do `chyba`. */
  const texty: VymTexty = {
    odemknout: (schranka) => t("admin", "dsBiometrieOdemknout", { schranka }),
    schrankaChybi: (dbId) => t("admin", "dsSchrankaChybi", { dbId }),
    overeniOdmitnuto: (schranka) => t("admin", "dsOvereniOdmitnuto", { schranka }),
  };

  function popisPrubehu(p: VymPrubeh): string {
    const i = p.hotovo + 1;
    switch (p.faze) {
      case "overovani":
        return t("admin", "dsFazeOverovani", { i, n: p.celkem });
      case "odesilani":
        return t("admin", "dsFazeOdesilani", { i, n: p.celkem });
      case "hlaseni":
        return t("admin", "dsFazeHlaseni");
      case "seznam":
        return t("admin", "dsFazeSeznam");
      case "stahovani":
        return t("admin", "dsFazeStahovani", { i, n: p.celkem });
      case "dorucenky":
        return t("admin", "dsFazeDorucenky", { i, n: p.celkem });
    }
  }

  function doNastaveni() {
    router.push("/(tabs)/admin/datovka/nastaveni");
  }

  /** Schválení + odeslání + automatické stažení odpovědí. */
  function schvalitAOdeslat() {
    if (bezUdaju) {
      doNastaveni();
      return;
    }
    Alert.alert(t("admin", "dsPotvrditTitle"), t("admin", "dsPotvrditBody", { n: kOdeslaniPocet }), [
      { text: t("admin", "dsZrusit"), style: "cancel" },
      { text: t("admin", "dsPotvrditOk"), style: "destructive", onPress: () => void spustit() },
    ]);
  }

  async function spustit() {
    setPrubeh({ faze: "overovani", hotovo: 0, celkem: kOdeslaniPocet });
    try {
      const kOdeslani = await adminApi.schvalitVymahaniDavku({
        dopisIds: dopisy.filter((d) => !vyrazene.has(d.id)).map((d) => d.id),
        vyradit: [...vyrazene],
      });
      // Hesla čte orchestrátor sám, jedno biometrické odemčení na schránku;
      // do stavu komponenty se nikdy nedostanou.
      const odeslano = await odeslatDopisy(kOdeslani, dopisy, texty, setPrubeh);
      // Odpovědi se stahují rovnou po odeslání, ze všech nastavených schránek.
      const stazeno = await stahnoutOdpovedi(davka.data?.stazenoOd ?? null, texty, setPrubeh);

      vycistitVyrazeni();
      void qc.invalidateQueries({ queryKey: DAVKA_KEY });
      void qc.invalidateQueries({ queryKey: ["ds-prehled"] });
      Alert.alert(
        t("admin", "dsHotovoTitle"),
        `${t("admin", "dsHotovoOdeslano", { odeslano: odeslano.odeslano, chyby: odeslano.chyby })}\n` +
          t("admin", "dsHotovoStazeno", { stazeno: stazeno.stazeno, dorucenky: stazeno.dorucenky }) +
          shrnutiChyb(odeslano.vysledky.map((v) => v.chyba).filter(Boolean) as string[], stazeno.chyby),
      );
    } catch (e) {
      Alert.alert(t("admin", "dsChybaTitle"), (e as Error).message);
    } finally {
      setPrubeh(null);
    }
  }

  /** Samostatné stažení odpovědí — bez odesílání čehokoli. */
  async function jenStahnout() {
    if (bezUdaju) {
      doNastaveni();
      return;
    }
    setPrubeh({ faze: "seznam", hotovo: 0, celkem: 0 });
    try {
      const stazeno = await stahnoutOdpovedi(davka.data?.stazenoOd ?? null, texty, setPrubeh);
      void qc.invalidateQueries({ queryKey: DAVKA_KEY });
      void qc.invalidateQueries({ queryKey: ["ds-prehled"] });
      Alert.alert(
        t("admin", "dsHotovoTitle"),
        t("admin", "dsHotovoStazeno", { stazeno: stazeno.stazeno, dorucenky: stazeno.dorucenky }) +
          shrnutiChyb([], stazeno.chyby),
      );
    } catch (e) {
      Alert.alert(t("admin", "dsChybaTitle"), (e as Error).message);
    } finally {
      setPrubeh(null);
    }
  }

  function shrnutiChyb(odeslani: string[], stazeni: string[]): string {
    const vse = [...odeslani, ...stazeni];
    if (vse.length === 0) return "";
    return `\n\n${t("admin", "dsChybyTitle")}:\n${vse.slice(0, 8).join("\n")}`;
  }

  if (davka.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <AppScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={davka.isRefetching}
            onRefresh={() => {
              void davka.refetch();
              void ucty.refetch();
            }}
            tintColor={colors.textSubtle}
          />
        }
      >
        {bezUdaju && (
          <AdminCard style={styles.card}>
            <Text style={styles.varovani}>{t("admin", "dsNoCreds")}</Text>
            <Pressable onPress={doNastaveni} style={[styles.btn, styles.btnPrimary]}>
              <Text style={[styles.btnText, styles.btnTextPrimary]}>{t("admin", "dsNoCredsBtn")}</Text>
            </Pressable>
          </AdminCard>
        )}

        {davka.isError && (
          <AdminCard style={styles.card}>
            <Text style={styles.varovani}>{t("admin", "dsChybaNacteni")}</Text>
            <Pressable onPress={() => void davka.refetch()} style={styles.btn}>
              <Text style={styles.btnText}>{t("admin", "dsZkusitZnovu")}</Text>
            </Pressable>
          </AdminCard>
        )}

        {!!davka.data && (
          <AdminCard style={styles.card}>
            <Text style={styles.souhrn}>{t("admin", "dsPocetPripadu", { n: davka.data.pocetPripadu })}</Text>
            {davka.data.cekaOdpovedi && <Text style={styles.hint}>{t("admin", "dsCekaOdpovedi")}</Text>}
            {!!chybi.data?.length && (
              <Text style={styles.varovaniText}>
                {t("admin", "dsChybejiciSchranky", {
                  seznam: chybi.data.map((s) => `${s.nazev} (${s.dbId})`).join(", "),
                })}
              </Text>
            )}
          </AdminCard>
        )}

        {dopisy.length === 0 ? (
          <Text style={styles.prazdno}>{t("admin", "dsDavkaEmpty")}</Text>
        ) : (
          dopisy.map((d) => (
            <RadekDopisu
              key={d.id}
              dopis={d}
              vyrazeny={vyrazene.has(d.id)}
              onOtevrit={() => router.push(`/(tabs)/admin/datovka/dopis/${d.id}`)}
              onVyradit={() => prepnoutVyrazeni(d.id)}
            />
          ))
        )}

        <View style={styles.akce}>
          <Pressable
            onPress={schvalitAOdeslat}
            disabled={prubeh !== null || kOdeslaniPocet === 0}
            style={[styles.btn, styles.btnPrimary, (prubeh !== null || kOdeslaniPocet === 0) && styles.btnOff]}
          >
            <Text style={[styles.btnText, styles.btnTextPrimary]}>
              {t("admin", "dsSchvalitBtn", { n: kOdeslaniPocet })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void jenStahnout()}
            disabled={prubeh !== null}
            style={[styles.btn, prubeh !== null && styles.btnOff]}
          >
            <Text style={styles.btnText}>{t("admin", "dsStahnoutBtn")}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(tabs)/admin/datovka/prehled")} style={styles.btn}>
            <Text style={styles.btnText}>{t("admin", "dsPrehledBtn")}</Text>
          </Pressable>
          <Pressable onPress={doNastaveni} style={styles.btn}>
            <Text style={styles.btnText}>{t("admin", "dsNastaveniBtn")}</Text>
          </Pressable>
        </View>
      </AppScrollView>

      {prubeh !== null && (
        <View style={styles.prekryv} pointerEvents="auto">
          <View style={styles.prubehKarta}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.prubehText}>{popisPrubehu(prubeh)}</Text>
            {!!prubeh.popis && (
              <Text style={styles.prubehPopis} numberOfLines={2}>
                {prubeh.popis}
              </Text>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

/** Jeden dopis v dávce — štítek stupně, příjemce, zakázka a přepínač vyřazení. */
function RadekDopisu({
  dopis,
  vyrazeny,
  onOtevrit,
  onVyradit,
}: {
  dopis: VymDopis;
  vyrazeny: boolean;
  onOtevrit: () => void;
  onVyradit: () => void;
}) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <AdminCard style={[styles.card, vyrazeny && styles.cardVyrazeny] as object}>
      <Pressable onPress={onOtevrit}>
        <View style={styles.headRow}>
          <Text style={styles.badge}>
            {t("admin", "dsStupenLabel", { n: dopis.stupen })} · {t("admin", STUPEN_KLIC[dopis.stupen] ?? "dsStupen1")}
          </Text>
          <Text style={styles.spoustec}>
            {t("admin", dopis.spoustec === "smlouva_v_registru" ? "dsSpoustecSmlouva" : "dsSpoustec3m")}
          </Text>
        </View>
        <View style={styles.prijemceRada}>
          <Text style={styles.prijemce}>{dopis.prijemce.nazev}</Text>
          {jePlacenyPrijemce(dopis.prijemce.typ) && (
            <Text style={styles.placena}>{t("admin", "dsPlacenaZprava")}</Text>
          )}
        </View>
        <Text style={styles.zakazkaNazev} numberOfLines={2}>
          {dopis.zakazka.nazev}
        </Text>
        <Text style={styles.meta}>
          {formatCastka(dopis.zakazka.hodnota, locale)}
          {dopis.zakazka.lhutaAt ? ` · ${t("admin", "dsLhuta")} ${formatDatum(dopis.zakazka.lhutaAt, locale)}` : ""}
        </Text>
      </Pressable>
      <Pressable onPress={onVyradit} style={styles.vyraditBtn}>
        <Text style={[styles.vyraditText, vyrazeny && styles.vyraditTextAktivni]}>
          {vyrazeny ? t("admin", "dsVratit") : t("admin", "dsVyradit")}
        </Text>
      </Pressable>
    </AdminCard>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl },
    spinner: { marginTop: spacing.xxl },
    card: { padding: spacing.lg },
    cardVyrazeny: { opacity: 0.45 },
    souhrn: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    hint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.xs },
    varovani: { fontSize: fontSize.base, color: colors.text },
    varovaniText: { fontSize: fontSize.sm, color: colors.warning, marginTop: spacing.xs, fontWeight: "600" },
    prazdno: { fontSize: fontSize.base, color: colors.textSubtle, textAlign: "center", marginVertical: spacing.xl },
    headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
    badge: {
      fontSize: fontSize.xs,
      fontWeight: "700",
      color: colors.accentForeground,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      overflow: "hidden",
    },
    spoustec: { fontSize: fontSize.xs, color: colors.textSubtle, flex: 1 },
    prijemceRada: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    prijemce: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    placena: {
      fontSize: fontSize.xs,
      fontWeight: "700",
      color: colors.warning,
      backgroundColor: colors.warningBg,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      overflow: "hidden",
    },
    zakazkaNazev: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
    meta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.xs },
    vyraditBtn: { marginTop: spacing.md, alignSelf: "flex-start" },
    vyraditText: { fontSize: fontSize.sm, color: colors.link, fontWeight: "600" },
    vyraditTextAktivni: { color: colors.warning },
    akce: { marginTop: spacing.lg, gap: spacing.sm },
    btn: {
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      backgroundColor: colors.card,
    },
    btnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
    btnOff: { opacity: 0.5 },
    btnText: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    btnTextPrimary: { color: colors.accentForeground },
    prekryv: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
    prubehKarta: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: "center",
      gap: spacing.md,
      minWidth: 220,
    },
    prubehText: { fontSize: fontSize.base, color: colors.text, fontWeight: "600", textAlign: "center" },
    prubehPopis: { fontSize: fontSize.xs, color: colors.textSubtle, textAlign: "center" },
  });
