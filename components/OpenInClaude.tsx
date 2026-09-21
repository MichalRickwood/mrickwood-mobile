import { useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  nactiClaudeSession,
  spustSessionNaServeru,
  stavSessionNaServeru,
} from "@/lib/claude-session-api";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Tlačítko „otevřít v Claude".
 *
 * Spustí Claude session NA SERVERU — tedy session s přístupem k repozitářům,
 * databázi a nástrojům, ne obyčejný chat s předvyplněným textem. Server ji
 * zvedne do ~10 vteřin a session se objeví v appce Claude pod Remote Control.
 *
 * Když se to nepovede, spadneme na starou cestu: zadání jako text, který si
 * uživatel vloží do běžné konverzace. Lepší než nic, ale bez přístupu k datům.
 */
export default function OpenInClaude({
  kind,
  id,
  label,
  variant = "ghost",
}: {
  kind: string;
  id?: string;
  /** Prázdný popisek = jen ikona (do řádku seznamu, kde není místo). */
  label?: string;
  variant?: "primary" | "ghost" | "ikona";
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(colors);
  const [busy, setBusy] = useState(false);
  const [hotovo, setHotovo] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);

  /**
   * Počká na runner a pak na adresu session.
   *
   * Přicházejí odděleně: nejdřív se session spustí, teprve při připojení
   * Remote Control jí claude.ai přidělí adresu. Teprve ta otevře appku přímo
   * v téhle session — bez ní bychom uživatele poslali hledat ji do seznamu.
   */
  async function pockejNaSpusteni(requestId: string): Promise<string | null> {
    let jmeno: string | null = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const stav = await stavSessionNaServeru(requestId).catch(() => null);
      if (stav?.status === "FAILED") throw new Error(stav.errorMsg || "Session se nepodařilo spustit.");
      if (stav?.status === "RUNNING") jmeno = stav.sessionName ?? "session";
      if (stav?.sessionUrl) {
        setUrl(stav.sessionUrl);
        return jmeno;
      }
    }
    return jmeno;
  }

  async function stiskni() {
    setBusy(true);
    setUrl(null);
    try {
      const req = await spustSessionNaServeru(kind, id);
      const jmeno = await pockejNaSpusteni(req.id);
      setHotovo(
        jmeno ? t("admin", "claudeBezi", { jmeno }) : t("admin", "claudeFronta"),
      );
    } catch (e) {
      // Nepovedlo se spustit na serveru — nabídni aspoň text do běžné konverzace.
      try {
        const d = await nactiClaudeSession(kind, id);
        setFallback(
          t("admin", "claudeFallback", {
            chyba: e instanceof Error ? e.message : "?",
            zadani: d.prompt,
          }),
        );
      } catch {
        setFallback(e instanceof Error ? e.message : t("admin", "claudeSelhaloObecne"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={(e) => {
          // V řádku seznamu je tlačítko uvnitř Pressable, který otevírá detail —
          // bez tohohle by klik udělal obojí.
          e.stopPropagation();
          void stiskni();
        }}
        disabled={busy}
        style={[
          styles.btn,
          variant === "primary" && styles.btnPrimary,
          variant === "ikona" && styles.btnIkona,
          busy && styles.btnBusy,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={variant === "primary" ? colors.bg : colors.textSubtle} />
        ) : (
          <View style={styles.btnObsah}>
            {/* Hvězdička je značka, kterou se Claude označuje ve vlastním rozhraní.
                Až bude po ruce oficiální symbol Anthropic, vymění se jen tady. */}
            <MaterialCommunityIcons
              name="asterisk"
              size={variant === "ikona" ? 18 : 14}
              color={variant === "primary" ? colors.bg : colors.text}
            />
            {label ? (
              <Text style={[styles.btnText, variant === "primary" && styles.btnTextPrimary]}>{label}</Text>
            ) : null}
          </View>
        )}
      </Pressable>

      <Modal visible={hotovo !== null} transparent animationType="fade" onRequestClose={() => setHotovo(null)}>
        <Pressable style={styles.overlay} onPress={() => setHotovo(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t("admin", "claudeTitulek")}</Text>
            <Text style={styles.sheetText}>
              {hotovo}
              {url ? "" : t("admin", "claudeBezAdresy")}
            </Text>
            <Pressable
              onPress={() => {
                setHotovo(null);
                // S adresou skočíme rovnou do téhle session, bez ní aspoň do appky.
                void Linking.openURL(url ?? "claude://").catch(() => {});
              }}
              style={[styles.btn, styles.btnPrimary, styles.sheetBtn]}
            >
              <Text style={[styles.btnText, styles.btnTextPrimary]}>
                {url ? t("admin", "claudeOtevritSession") : t("admin", "claudeOtevritClaude")}
              </Text>
            </Pressable>
            <Pressable onPress={() => setHotovo(null)} style={[styles.btn, styles.sheetBtn]}>
              <Text style={styles.btnText}>{t("admin", "claudeZavrit")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={fallback !== null} animationType="slide" onRequestClose={() => setFallback(null)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{t("admin", "claudeZadaniTitulek")}</Text>
          <ScrollView style={styles.modalBody}>
            <Text selectable style={styles.modalText}>
              {fallback}
            </Text>
          </ScrollView>
          <Pressable onPress={() => setFallback(null)} style={[styles.btn, styles.btnPrimary]}>
            <Text style={[styles.btnText, styles.btnTextPrimary]}>{t("admin", "claudeZavrit")}</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    btn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimary: { backgroundColor: colors.text, borderColor: colors.text },
    btnIkona: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderColor: colors.border },
    btnObsah: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    btnBusy: { opacity: 0.6 },
    btnText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600" },
    btnTextPrimary: { color: colors.bg },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg },
    sheet: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
    sheetTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: "700" },
    sheetText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20 },
    sheetBtn: { marginTop: spacing.xs },
    modal: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md },
    modalTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: "700", marginTop: spacing.xxl },
    modalBody: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
    modalText: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  });
