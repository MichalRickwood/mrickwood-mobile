/**
 * 2FA — potvrzení přihlášení na webu nebo na novém zařízení (lib/mfa.ts). Otevře ji push
 * `type: "login-challenge"` i kontrola čekajících výzev po návratu do aplikace. Uživatel vybere
 * číslo, které vidí na obrazovce počítače (shoda čísel chrání proti nechtěnému odkliknutí).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { endpoints } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { bcp47 } from "@/lib/i18n/translations";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

type Vyzva = { id: string; prohlizec: string | null; ip: string | null; kanal: string; createdAt: string; expiresAt: string; moznosti: number[] };

export default function PotvrzeniPrihlaseni() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [vyzvy, setVyzvy] = useState<Vyzva[] | null>(null);
  const [zprava, setZprava] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const nacti = useCallback(async () => {
    try { setVyzvy((await endpoints.mfaVyzvy()).data.vyzvy); } catch { setVyzvy([]); }
  }, []);
  useEffect(() => { void nacti(); }, [nacti]);

  async function rozhodni(v: Vyzva, akce: "schvalit" | "zamitnout", cislo?: number) {
    setBusy(v.id);
    try {
      const { data } = await endpoints.mfaRozhodni(v.id, { akce, cislo });
      const text = { schvaleno: t("mfa", "schvaleno"), zamitnuto: t("mfa", "zamitnuto"), spatne_cislo: t("mfa", "spatne"), neplatna: t("mfa", "neplatna") }[data.vysledek];
      setZprava(text);
      if (data.vysledek !== "spatne_cislo") await nacti();
    } catch {
      setZprava(t("auth", "errGeneric"));
    } finally { setBusy(null); }
  }

  const zavrit = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.titulek}>{t("mfa", "titulek")}</Text>
        {zprava && <Text style={styles.zprava}>{zprava}</Text>}
        {vyzvy == null ? <ActivityIndicator /> : vyzvy.length === 0 ? (
          <Text style={styles.muted}>{t("mfa", "zadna")}</Text>
        ) : vyzvy.map((v) => (
          <View key={v.id} style={styles.karta}>
            <Text style={styles.text}>{t("mfa", "kde", { prohlizec: v.prohlizec ?? "—" })}</Text>
            <Text style={styles.muted}>
              {new Date(v.createdAt).toLocaleTimeString(bcp47(locale), { hour: "2-digit", minute: "2-digit" })}{v.ip ? ` · IP ${v.ip}` : ""}
            </Text>
            <Text style={[styles.text, { marginTop: spacing.lg }]}>{t("mfa", "vyberte")}</Text>
            <View style={styles.cisla}>
              {v.moznosti.map((c) => (
                <Pressable key={c} disabled={busy === v.id} onPress={() => void rozhodni(v, "schvalit", c)}
                  style={({ pressed }) => [styles.cislo, pressed && styles.pressed]} accessibilityRole="button">
                  <Text style={styles.cisloText}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable disabled={busy === v.id} onPress={() => void rozhodni(v, "zamitnout")} style={styles.zamitnout} hitSlop={8}>
              <Text style={styles.zamitnoutText}>{t("mfa", "nebylJsem")}</Text>
            </Pressable>
          </View>
        ))}
        <Pressable onPress={zavrit} style={styles.zavrit} hitSlop={8}>
          <Text style={styles.link}>OK</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl, flexGrow: 1, justifyContent: "center" },
    titulek: { color: colors.text, fontSize: fontSize.xl, fontWeight: "700", textAlign: "center", marginBottom: spacing.lg },
    zprava: { color: colors.text, fontSize: fontSize.base, textAlign: "center", marginBottom: spacing.lg, fontWeight: "600" },
    text: { color: colors.text, fontSize: fontSize.base, textAlign: "center" },
    muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: "center", marginTop: spacing.xs },
    karta: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
    cisla: { flexDirection: "row", justifyContent: "center", gap: spacing.md, marginTop: spacing.md },
    cislo: { width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    cisloText: { color: colors.accentForeground, fontSize: 28, fontWeight: "700" },
    pressed: { opacity: 0.8 },
    zamitnout: { alignItems: "center", marginTop: spacing.lg },
    zamitnoutText: { color: colors.danger, fontSize: fontSize.base, fontWeight: "600" },
    zavrit: { alignItems: "center", marginTop: spacing.lg },
    link: { color: colors.link, fontSize: fontSize.base, fontWeight: "600" },
  });
