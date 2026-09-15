import { useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  nactiClaudeSession,
  spustSessionNaServeru,
  stavSessionNaServeru,
} from "@/lib/claude-session-api";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme-context";
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
  const styles = makeStyles(colors);
  const [busy, setBusy] = useState(false);
  const [hotovo, setHotovo] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);

  /** Počká, až runner session zvedne. Delší čekání = strop souběžných session. */
  async function pockejNaSpusteni(requestId: string): Promise<string | null> {
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const stav = await stavSessionNaServeru(requestId).catch(() => null);
      if (stav?.status === "RUNNING") return stav.sessionName ?? "session";
      if (stav?.status === "FAILED") throw new Error(stav.errorMsg || "Session se nepodařilo spustit.");
    }
    return null;
  }

  async function stiskni() {
    setBusy(true);
    try {
      const req = await spustSessionNaServeru(kind, id);
      const jmeno = await pockejNaSpusteni(req.id);
      setHotovo(
        jmeno
          ? `Session ${jmeno} běží na serveru. Otevři appku Claude — najdeš ji pod Remote Control.`
          : "Session je ve frontě. Na serveru běží maximum session naráz; jakmile se uvolní místo, naskočí. Zkus za chvíli appku Claude.",
      );
    } catch (e) {
      // Nepovedlo se spustit na serveru — nabídni aspoň text do běžné konverzace.
      try {
        const d = await nactiClaudeSession(kind, id);
        setFallback(
          `Session na serveru se spustit nepodařila (${e instanceof Error ? e.message : "neznámá chyba"}).\n\n` +
            `Níže je zadání — označ, zkopíruj a vlož do nové konverzace v Claude. Nebude mít přístup k datům, ale poradí.\n\n` +
            d.prompt,
        );
      } catch {
        setFallback(e instanceof Error ? e.message : "Session se nepodařilo spustit.");
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
            <Text style={styles.sheetTitle}>Session běží na serveru</Text>
            <Text style={styles.sheetText}>{hotovo}</Text>
            <Pressable
              onPress={() => {
                setHotovo(null);
                void Linking.openURL("claude://").catch(() => {});
              }}
              style={[styles.btn, styles.btnPrimary, styles.sheetBtn]}
            >
              <Text style={[styles.btnText, styles.btnTextPrimary]}>Otevřít Claude</Text>
            </Pressable>
            <Pressable onPress={() => setHotovo(null)} style={[styles.btn, styles.sheetBtn]}>
              <Text style={styles.btnText}>Zavřít</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={fallback !== null} animationType="slide" onRequestClose={() => setFallback(null)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Zadání pro Claude</Text>
          <ScrollView style={styles.modalBody}>
            <Text selectable style={styles.modalText}>
              {fallback}
            </Text>
          </ScrollView>
          <Pressable onPress={() => setFallback(null)} style={[styles.btn, styles.btnPrimary]}>
            <Text style={[styles.btnText, styles.btnTextPrimary]}>Zavřít</Text>
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
