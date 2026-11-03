/**
 * 2FA — přihlášení do aplikace na novém zařízení (lib/mfa.ts). Ukáže číslo, které uživatel vybere
 * na jiném přihlášeném zařízení, a ptá se serveru, dokud nepotvrdí. Bez jiného zařízení záložní kód.
 */
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { endpoints } from "@/lib/endpoints";
import { cekajiciMfa, prijmiPrihlaseni, zrusMfa } from "@/lib/mfa";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { AuthBrand, AuthError, AuthHeader, AuthTextField } from "@/components/AuthUi";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export default function MfaScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { applySession } = useAuth();
  const vyzva = cekajiciMfa();
  const [kodRezim, setKodRezim] = useState(!!vyzva?.kodPovinny);
  const [kod, setKod] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [konec, setKonec] = useState(false);

  useEffect(() => {
    if (!vyzva || kodRezim || konec) return;
    const id = setInterval(async () => {
      try {
        const r = await endpoints.mobileMfa({ vyzva: vyzva.vyzva });
        if ("token" in r) { clearInterval(id); applySession(await prijmiPrihlaseni(r)); return; }
        if ("stav" in r && r.stav !== "ceka" && r.stav !== "schvaleno") { clearInterval(id); setKonec(true); }
      } catch { /* síť — zkusíme za chvíli znovu */ }
    }, 2000);
    return () => clearInterval(id);
  }, [vyzva, kodRezim, konec, applySession]);

  async function odeslatKod() {
    if (!vyzva || busy) return;
    setBusy(true);
    setChyba(null);
    try {
      const r = await endpoints.mobileMfa({ vyzva: vyzva.vyzva, kod: kod.trim() });
      if ("token" in r) applySession(await prijmiPrihlaseni(r));
      else setChyba("stav" in r && r.stav === "neplatna" ? t("mfa", "vyprselo") : t("mfa", "kodSpatne"));
    } catch {
      setChyba(t("auth", "errGeneric"));
    } finally { setBusy(false); }
  }

  const zpet = () => { zrusMfa(); router.replace("/(auth)/login"); };

  return (
    <SafeAreaView style={styles.safe}>
      <AuthHeader />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthBrand title={t("mfa", "noveTitulek")} />
          {!vyzva || konec ? (
            <Text style={styles.text}>{t("mfa", "vyprselo")}</Text>
          ) : kodRezim ? (
            <>
              <Text style={styles.text}>{t("mfa", "kodPopis")}</Text>
              {chyba && <AuthError message={chyba} />}
              <AuthTextField label={t("mfa", "kodPole")} icon="key-outline" value={kod} onChangeText={setKod}
                placeholder="abcd-efgh" autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={() => void odeslatKod()} />
              <Pressable onPress={() => void odeslatKod()} disabled={busy || kod.trim().length < 8}
                style={({ pressed }) => [styles.btnPrimary, (busy || kod.trim().length < 8) && styles.disabled, pressed && styles.pressed]}>
                {busy ? <ActivityIndicator color={colors.accentForeground} /> : <Text style={styles.btnPrimaryText}>{t("mfa", "kodPotvrdit")}</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.text}>{t("mfa", "novePopis")}</Text>
              <Text style={styles.cislo} accessibilityLiveRegion="polite">{vyzva.cislo}</Text>
              <Text style={styles.muted}>{t("mfa", "cekam")}</Text>
              <Pressable onPress={() => setKodRezim(true)} style={styles.linkRow} hitSlop={8}>
                <Text style={styles.link}>{t("mfa", "kodOdkaz")}</Text>
              </Pressable>
            </>
          )}
          <Pressable onPress={zpet} style={styles.linkRow} hitSlop={8}>
            <Text style={styles.link}>{t("mfa", "zpet")}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: { padding: spacing.xl, flexGrow: 1, justifyContent: "center", paddingBottom: spacing.xxl * 2 },
    text: { color: colors.text, fontSize: fontSize.base, textAlign: "center", marginTop: spacing.md },
    muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: "center" },
    cislo: { color: colors.text, fontSize: 64, fontWeight: "700", textAlign: "center", marginVertical: spacing.xl, fontVariant: ["tabular-nums"] },
    btnPrimary: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: spacing.md + 2, alignItems: "center", marginTop: spacing.xl },
    btnPrimaryText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.85 },
    linkRow: { alignItems: "center", marginTop: spacing.xl },
    link: { color: colors.link, fontSize: fontSize.base, fontWeight: "600" },
  });
