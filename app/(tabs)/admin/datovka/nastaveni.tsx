import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { useQueryClient } from "@tanstack/react-query";
import { AdminCard } from "@/components/AdminRow";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { IsdsClient } from "@/lib/isds/client";
import {
  biometrieDostupna,
  nacistUcty,
  nacistUdajeSchranky,
  smazatUcet,
  uklidStareKlice,
  ulozitUcet,
  zapsatOvereniUctu,
  type IsdsUcet,
} from "@/lib/isds/credentials";
import { jeIsdsHttpError, nazevDrzitele, type IsdsEnv } from "@/lib/isds/types";
import { formatDatumCas } from "@/lib/vymahani-format";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Seznam datových schránek, ke kterým má telefon údaje (RWX, Bricky, Cloud IS…).
 *
 * Údaje zůstávají výhradně v telefonu, heslo zvlášť pro každou schránku za
 * biometrií. ID schránky a název držitele se berou z GetOwnerInfoFromLogin,
 * aby je uživatel neopisoval — a aby se schránka nedala založit s ID, které
 * k zadanému přihlášení nepatří.
 */
export default function DatovkaNastaveniScreen() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const qc = useQueryClient();
  const [ucty, setUcty] = useState<IsdsUcet[] | null>(null);
  const [login, setLogin] = useState("");
  const [heslo, setHeslo] = useState("");
  const [prostredi, setProstredi] = useState<IsdsEnv>("test");
  const [busy, setBusy] = useState(false);
  const [hledaAktualizaci, setHledaAktualizaci] = useState(false);

  /** Přečíst účty a zároveň zneplatnit cache, ze které čte obrazovka Dnešní návrh. */
  const obnovUcty = useCallback(async () => {
    setUcty(await nacistUcty());
    await qc.invalidateQueries({ queryKey: ["ds-ucty"] });
    await qc.invalidateQueries({ queryKey: ["ds-chybejici"] });
  }, [qc]);

  const nacti = useCallback(() => {
    let zive = true;
    void (async () => {
      // Pozůstatky jednoschránkové verze v Keychainu zahodíme, ať se k nim
      // nikdo nedostane; nikdo je nestihl naplnit (build se nedistribuoval).
      await uklidStareKlice();
      const u = await nacistUcty();
      if (zive) setUcty(u);
    })();
    return () => {
      zive = false;
    };
  }, []);
  useFocusEffect(nacti);

  /**
   * Která verze kódu právě běží. Opravy se do telefonu posílají jako
   * aktualizace přes vzduch (EAS Update) a ta se použije až při dalším startu —
   * bez tohohle řádku se nedá poznat, jestli hlášená chyba platí, nebo je to
   * ještě starý kód (10. 9. 2026: biometrie „pořád dvakrát" byla stará verze).
   */
  const verzeApp = Constants.expoConfig?.version ?? "?";
  const aktualizaceZ = Updates.createdAt ? formatDatumCas(Updates.createdAt.toISOString(), locale) : null;

  /** Stáhne novou verzi kódu a restartuje aplikaci. */
  async function zkontrolovatAktualizaci() {
    setHledaAktualizaci(true);
    try {
      const vysledek = await Updates.checkForUpdateAsync();
      if (!vysledek.isAvailable) {
        Alert.alert(t("admin", "dsVerzeTitle"), t("admin", "dsAktualizaceZadna"));
        return;
      }
      Alert.alert(t("admin", "dsVerzeTitle"), t("admin", "dsAktualizaceStahuje"));
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      Alert.alert(t("admin", "dsChybaTitle"), t("admin", "dsAktualizaceChyba", { duvod: (e as Error).message }));
    } finally {
      setHledaAktualizaci(false);
    }
  }

  const prostrediLabel = (e: IsdsEnv) =>
    e === "prod" ? t("admin", "dsProstrediProd") : t("admin", "dsProstrediTest");

  /** Přidání schránky = ověření údajů proti ISDS a teprve pak uložení. */
  async function pridat() {
    if (!login.trim() || !heslo) {
      Alert.alert(t("admin", "dsVyplnUdaje"));
      return;
    }
    if (!(await biometrieDostupna())) {
      Alert.alert(t("admin", "dsChybaTitle"), t("admin", "dsBiometrieChybi"));
      return;
    }
    setBusy(true);
    try {
      const klient = new IsdsClient({ login: login.trim(), password: heslo, env: prostredi });
      const drzitel = await klient.getOwnerInfoFromLogin();
      if (!drzitel.dbID) {
        Alert.alert(t("admin", "dsChybaTitle"), t("admin", "dsOvereniSelhaloId"));
        return;
      }
      // Jméno přihlášené osoby je jen pro zobrazení — nesmí shodit přidání.
      let uzivatel: string | null = null;
      try {
        const u = await klient.getUserInfoFromLogin();
        uzivatel = [u.pnGivenNames, u.pnLastName].filter(Boolean).join(" ") || null;
      } catch {
        uzivatel = null;
      }

      const nazev = nazevDrzitele(drzitel);
      await ulozitUcet(
        {
          dbId: drzitel.dbID,
          nazev,
          login: login.trim(),
          env: prostredi,
          overenoAt: new Date().toISOString(),
          uzivatel,
        },
        heslo,
        t("admin", "dsBiometrieUlozeni"),
      );
      // Heslo v paměti obrazovky nedržíme ani o vteřinu déle, než je nutné.
      setHeslo("");
      setLogin("");
      await obnovUcty();
      Alert.alert(t("admin", "dsHotovoTitle"), t("admin", "dsPridanoOk", { nazev, dbId: drzitel.dbID }));
    } catch (e) {
      Alert.alert(t("admin", "dsChybaTitle"), chybaText(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function overit(ucet: IsdsUcet) {
    setBusy(true);
    try {
      const pristup = await nacistUdajeSchranky(ucet.dbId, t("admin", "dsBiometrieOdemknout", { schranka: ucet.nazev }));
      if (!pristup) {
        Alert.alert(t("admin", "dsBiometrieZamitnuta"));
        return;
      }
      const klient = new IsdsClient(pristup);
      const u = await klient.getUserInfoFromLogin();
      const jmeno = [u.pnGivenNames, u.pnLastName].filter(Boolean).join(" ") || (u.firmName ?? "—");
      await zapsatOvereniUctu(ucet.dbId, jmeno);
      await obnovUcty();

      // Expirace hesla je hezká, ale nesmí shodit výsledek ověření.
      let expirace: string | null = null;
      try {
        expirace = await klient.getPasswordInfo();
      } catch {
        expirace = null;
      }
      Alert.alert(
        t("admin", "dsHotovoTitle"),
        t("admin", "dsOverenoOk", { jmeno, role: u.userType ?? "—" }) +
          (expirace ? `\n${t("admin", "dsExpirace", { kdy: formatDatumCas(expirace, locale) })}` : ""),
      );
    } catch (e) {
      Alert.alert(t("admin", "dsChybaTitle"), chybaText(e, t));
    } finally {
      setBusy(false);
    }
  }

  function smazat(ucet: IsdsUcet) {
    Alert.alert(
      t("admin", "dsSmazatSchranku"),
      t("admin", "dsSmazatPotvrzeniSchranka", { nazev: ucet.nazev }),
      [
        { text: t("admin", "dsZrusit"), style: "cancel" },
        {
          text: t("admin", "dsSmazatSchranku"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              await smazatUcet(ucet.dbId, t("admin", "dsBiometrieSmazani"));
              await obnovUcty();
              Alert.alert(t("admin", "dsSmazanoOk"));
            })();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <AppScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.sekce}>{t("admin", "dsUctyTitle")}</Text>

        {ucty === null && <ActivityIndicator color={colors.accent} />}
        {ucty !== null && ucty.length === 0 && (
          <AdminCard style={styles.card}>
            <Text style={styles.hint}>{t("admin", "dsUctyPrazdne")}</Text>
          </AdminCard>
        )}

        {(ucty ?? []).map((u) => (
          <AdminCard key={u.dbId} style={styles.card}>
            <Text style={styles.nazev}>{u.nazev}</Text>
            <Text style={styles.meta}>
              {t("admin", "dsSchrankaLabel")} {u.dbId} · {u.login} · {prostrediLabel(u.env)}
            </Text>
            {!!u.overenoAt && (
              <Text style={styles.hint}>
                {t("admin", "dsOverenoAt", { kdy: formatDatumCas(u.overenoAt, locale) })}
                {u.uzivatel ? ` · ${u.uzivatel}` : ""}
              </Text>
            )}
            <View style={styles.radaAkci}>
              <Pressable onPress={() => void overit(u)} disabled={busy} style={[styles.btn, busy && styles.btnOff]}>
                <Text style={styles.btnText}>{t("admin", "dsOverit")}</Text>
              </Pressable>
              <Pressable onPress={() => smazat(u)} disabled={busy} style={[styles.btn, busy && styles.btnOff]}>
                <Text style={[styles.btnText, styles.btnTextDanger]}>{t("admin", "dsSmazatSchranku")}</Text>
              </Pressable>
            </View>
          </AdminCard>
        ))}

        <Text style={styles.sekce}>{t("admin", "dsPridatTitle")}</Text>
        <AdminCard style={styles.card}>
          <Text style={styles.label}>{t("admin", "dsLogin")}</Text>
          <TextInput
            style={styles.input}
            value={login}
            onChangeText={setLogin}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t("admin", "dsLogin")}
            placeholderTextColor={colors.textFaint}
          />
          <Text style={styles.label}>{t("admin", "dsHeslo")}</Text>
          <TextInput
            style={styles.input}
            value={heslo}
            onChangeText={setHeslo}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t("admin", "dsHeslo")}
            placeholderTextColor={colors.textFaint}
          />
          <Text style={styles.hint}>{t("admin", "dsHesloHint")}</Text>

          <Text style={styles.label}>{t("admin", "dsProstredi")}</Text>
          <View style={styles.prepinac}>
            {(["test", "prod"] as IsdsEnv[]).map((e) => (
              <Pressable
                key={e}
                onPress={() => setProstredi(e)}
                style={[styles.chip, prostredi === e && styles.chipAktivni]}
              >
                <Text style={[styles.chipText, prostredi === e && styles.chipTextAktivni]}>{prostrediLabel(e)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.hint}>{t("admin", "dsPridatHint")}</Text>
          <Pressable onPress={() => void pridat()} disabled={busy} style={[styles.btn, styles.btnPrimary, busy && styles.btnOff]}>
            <Text style={[styles.btnText, styles.btnTextPrimary]}>{t("admin", "dsPridat")}</Text>
          </Pressable>
        </AdminCard>

        <Text style={[styles.sekce, styles.sekceOdsazena]}>{t("admin", "dsVerzeTitle")}</Text>
        <AdminCard style={styles.card}>
          <Text style={styles.meta}>{t("admin", "dsVerzeApp", { verze: verzeApp })}</Text>
          <Text style={styles.hint}>
            {aktualizaceZ
              ? t("admin", "dsVerzeAktualizace", { kdy: aktualizaceZ })
              : t("admin", "dsVerzeVestavena")}
          </Text>
          <Pressable
            onPress={() => void zkontrolovatAktualizaci()}
            disabled={hledaAktualizaci}
            style={[styles.btn, hledaAktualizaci && styles.btnOff]}
          >
            <Text style={styles.btnText}>{t("admin", "dsZkontrolovatAktualizaci")}</Text>
          </Pressable>
        </AdminCard>

        {busy && <ActivityIndicator color={colors.accent} />}
      </AppScrollView>
    </SafeAreaView>
  );
}

/** 401 z ISDS má vlastní hlášku — je to nejčastější chyba při zadávání údajů. */
function chybaText(e: unknown, t: (s: "admin", k: "dsSpatneUdaje") => string): string {
  if (jeIsdsHttpError(e) && e.status === 401) return t("admin", "dsSpatneUdaje");
  return (e as Error).message;
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl },
    sekce: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: "600", marginBottom: spacing.sm },
    sekceOdsazena: { marginTop: spacing.xl },
    card: { padding: spacing.lg },
    nazev: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    label: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.md, marginBottom: spacing.xs },
    meta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    hint: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.xs },
    input: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.base,
      color: colors.text,
    },
    prepinac: { flexDirection: "row", gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipAktivni: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontSize: fontSize.sm, color: colors.text },
    chipTextAktivni: { color: colors.accentForeground, fontWeight: "600" },
    radaAkci: { flexDirection: "row", gap: spacing.sm },
    btn: {
      flex: 1,
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    btnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
    btnOff: { opacity: 0.5 },
    btnText: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    btnTextPrimary: { color: colors.accentForeground },
    btnTextDanger: { color: colors.danger },
  });
