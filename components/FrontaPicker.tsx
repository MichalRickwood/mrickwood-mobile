import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";
import type { WorkQueueId } from "@/lib/admin-api";

export interface FrontaVolba {
  id: WorkQueueId | "VSE";
  label: string;
  /** Počet otevřených úkolů — vpravo u položky, ať je vidět, kde se co hromadí. */
  pocet?: number;
}

interface Props {
  visible: boolean;
  title: string;
  value: WorkQueueId | "VSE";
  options: FrontaVolba[];
  onClose: () => void;
  onPick: (id: WorkQueueId | "VSE") => void;
}

/**
 * Výběr fronty (session) v modálu. Na telefonu se pět front vedle sebe nevejde
 * a část možností zůstávala mimo obrazovku — proto dropdown, ne pruh tlačítek.
 */
export default function FrontaPicker({ visible, title, value, options, onClose, onPick }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {options.map((opt) => {
            const active = opt.id === value;
            return (
              <Pressable
                key={opt.id}
                onPress={() => { onPick(opt.id); onClose(); }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{opt.label}</Text>
                <View style={styles.right}>
                  {opt.pocet !== undefined && opt.pocet > 0 && (
                    <Text style={styles.count}>{opt.pocet}</Text>
                  )}
                  {active && <Text style={styles.check}>✓</Text>}
                </View>
              </Pressable>
            );
          })}
        </Pressable>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.lg },
    card: { backgroundColor: c.card, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
    title: { fontSize: fontSize.base, fontWeight: "700", color: c.text, marginBottom: spacing.xs },
    row: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: spacing.sm, paddingHorizontal: spacing.xs,
    },
    rowLabel: { fontSize: fontSize.base, color: c.text },
    rowLabelActive: { fontWeight: "700", color: c.accent },
    right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    count: { fontSize: fontSize.xs, color: c.textSubtle },
    check: { fontSize: fontSize.base, color: c.accent },
  });
