import { useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { nactiClaudeSession } from "@/lib/claude-session-api";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Tlačítko „otevřít v Claude". Vyžádá si ze serveru předvyplněné zadání
 * i s kontextem a otevře `claude://` — appka zadání jen předvyplní, neodesílá.
 *
 * Kdo Claude nainstalovaný nemá, dostane zadání v modalu jako vybíratelný text
 * (schránka by znamenala nativní závislost navíc a kvůli jednomu tlačítku se
 * nevyplatí přebuildovat appku).
 */
export default function OpenInClaude({
  kind,
  id,
  label,
  variant = "ghost",
}: {
  kind: string;
  id?: string;
  label: string;
  variant?: "primary" | "ghost";
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  async function stiskni() {
    setBusy(true);
    try {
      const d = await nactiClaudeSession(kind, id);
      try {
        await Linking.openURL(d.url);
      } catch {
        // Claude appka není nainstalovaná (nebo iOS odmítl scheme) — ukaž zadání.
        setFallback(d.prompt);
      }
    } catch (e) {
      setFallback(e instanceof Error ? e.message : "Zadání se nepodařilo připravit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={stiskni}
        disabled={busy}
        style={[styles.btn, variant === "primary" && styles.btnPrimary, busy && styles.btnBusy]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={variant === "primary" ? colors.bg : colors.textSubtle} />
        ) : (
          <Text style={[styles.btnText, variant === "primary" && styles.btnTextPrimary]}>{label}</Text>
        )}
      </Pressable>

      <Modal visible={fallback !== null} animationType="slide" onRequestClose={() => setFallback(null)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Zadání pro Claude</Text>
          <Text style={styles.modalHint}>
            Claude appku se nepodařilo otevřít. Označ text níže, zkopíruj a vlož do nové konverzace.
          </Text>
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
    btnBusy: { opacity: 0.6 },
    btnText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600" },
    btnTextPrimary: { color: colors.bg },
    modal: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md },
    modalTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: "700", marginTop: spacing.xxl },
    modalHint: { color: colors.textSubtle, fontSize: fontSize.sm },
    modalBody: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
    modalText: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  });
