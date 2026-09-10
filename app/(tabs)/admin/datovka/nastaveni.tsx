import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScrollView } from "@/components/AppScroll";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { AdminCard } from "@/components/AdminRow";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { IsdsClient } from "@/lib/isds/client";
import {
  biometrieDostupna,
  nacistMeta,
  nacistUdaje,
  smazatUdaje,
  ulozitUdaje,
  zapsatOvereni,
  type IsdsMeta,
} from "@/lib/isds/credentials";
import { jeIsdsHttpError, type IsdsEnv } from "@/lib/isds/types";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Přihlašovací údaje do datové schránky. Zůstávají výhradně v telefonu
 * (SecureStore za biometrií), server o nich nesmí vědět. Heslo drží stav
 * jen do stisku „Uložit" a hned se z něj maže.
 */
export default function DatovkaNastaveniScreen() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [meta, setMeta] = useState<IsdsMeta | null>(null);
  const [login, setLogin] = useState("");
  const [heslo, setHeslo] = useState("");
  const [prostredi, setProstredi] = useState<IsdsEnv>("test");
  const [busy, setBusy] = useState(false);

  const nacti = useCallback(() => {
    let zive = true;
    void (async () => {
      const m = await nacistMeta();
      if (!zive) return;
      setMeta(m);
      setProstredi(m.env);
    })();
    return () => {
      zive = false;
    };
  }, []);
  useFocusEffect(nacti);

  async function ulozit() {
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
      await ulozitUdaje({ login: login.trim(), password: heslo, env: prostredi }, t("admin", "dsBiometrieUlozeni"));
      // Heslo v paměti obrazovky nedržíme ani o vteřinu déle, než je nutné.
      setHeslo("");
      setLogin("");
      setMeta(await nacistMeta());
      Alert.alert(t("admin", "dsUlozenoOk"));
    } catch (e) {
      Alert.alert(t("admin", "dsChybaTitle"), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function overit() {
    setBusy(true);
    try {
      const udaje = await nacistUdaje(t("admin", "dsBiometrieOvereni"));
      if (!udaje) {
        Alert.alert(t("admin", "dsBiometrieZamitnuta"));
        return;
      }
      const klient = new IsdsClient(udaje);
      const uzivatel = await klient.getUserInfoFromLogin();
      const jmeno =
        [uzivatel.pnGivenNames, uzivatel.pnLastName].filter(Boolean).join(" ") || (uzivatel.firmName ?? "—");
      await zapsatOvereni(jmeno);
      setMeta(await nacistMeta());

      // Expirace hesla je hezká, ale nesmí shodit výsledek ověření.
      let expirace: string | null = null;
      try {
        expirace = await klient.getPasswordInfo();
      } catch {
        expirace = null;
      }
      const zprava =
        t("admin", "dsOverenoOk", { jmeno, role: uzivatel.userType ?? "—" }) +
        (expirace ? `\n${t("admin", "dsExpirace", { kdy: formatDatum(expirace, locale) })}` : "");
      Alert.alert(t("admin", "dsHotovoTitle"), zprava);
    } catch (e) {
      Alert.alert(
        t("admin", "dsChybaTitle"),
        jeIsdsHttpError(e) && e.status === 401 ? t("admin", "dsSpatneUdaje") : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  function smazat() {
    Alert.alert(t("admin", "dsSmazat"), t("admin", "dsSmazatPotvrzeni"), [
      { text: t("admin", "dsZrusit"), style: "cancel" },
      {
        text: t("admin", "dsSmazat"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            await smazatUdaje(t("admin", "dsBiometrieSmazani"));
            setMeta(await nacistMeta());
            Alert.alert(t("admin", "dsSmazanoOk"));
          })();
        },
      },
    ]);
  }

  const prostrediLabel = (e: IsdsEnv) =>
    e === "prod" ? t("admin", "dsProstrediProd") : t("admin", "dsProstrediTest");

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <AppScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AdminCard style={styles.card}>
          <Text style={styles.stav}>
            {meta?.ulozeno
              ? t("admin", "dsUlozeno", { prostredi: prostrediLabel(meta.env) })
              : t("admin", "dsNeulozeno")}
          </Text>
          {!!meta?.overenoAt && (
            <Text style={styles.hint}>
              {t("admin", "dsOverenoAt", { kdy: formatDatum(meta.overenoAt, locale) })}
              {meta.jmeno ? ` · ${meta.jmeno}` : ""}
            </Text>
          )}
        </AdminCard>

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
                <Text style={[styles.chipText, prostredi === e && styles.chipTextAktivni]}>
                  {prostrediLabel(e)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={ulozit} disabled={busy} style={[styles.btn, styles.btnPrimary, busy && styles.btnOff]}>
            <Text style={[styles.btnText, styles.btnTextPrimary]}>{t("admin", "dsUlozit")}</Text>
          </Pressable>
        </AdminCard>

        <AdminCard style={styles.card}>
          <Pressable
            onPress={overit}
            disabled={busy || !meta?.ulozeno}
            style={[styles.btn, (busy || !meta?.ulozeno) && styles.btnOff]}
          >
            <Text style={styles.btnText}>{t("admin", "dsOverit")}</Text>
          </Pressable>
          <Pressable
            onPress={smazat}
            disabled={busy || !meta?.ulozeno}
            style={[styles.btn, (busy || !meta?.ulozeno) && styles.btnOff]}
          >
            <Text style={[styles.btnText, styles.btnTextDanger]}>{t("admin", "dsSmazat")}</Text>
          </Pressable>
        </AdminCard>

        {busy && <ActivityIndicator color={colors.accent} />}
      </AppScrollView>
    </SafeAreaView>
  );
}

/** Datum a čas v jazyce aplikace; nečitelný vstup vrátíme beze změny. */
function formatDatum(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl },
    card: { padding: spacing.lg },
    stav: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    label: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.md, marginBottom: spacing.xs },
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
    btn: {
      marginTop: spacing.lg,
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
