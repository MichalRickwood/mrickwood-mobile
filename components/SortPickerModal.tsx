import { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export type SortKey = "newest" | "deadline" | "value";

interface Props {
  visible: boolean;
  value: SortKey;
  onClose: () => void;
  onPick: (sort: SortKey) => void;
}

const OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "newest", label: "Nejnovější" },
  { key: "deadline", label: "Nejbližší lhůta" },
  { key: "value", label: "Nejvyšší cena" },
];

export default function SortPickerModal({ visible, value, onClose, onPick }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Řazení</Text>
          {OPTIONS.map((opt) => {
            const active = opt.key === value;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  onPick(opt.key);
                  onClose();
                }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                  {opt.label}
                </Text>
                {active && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          })}
        </Pressable>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    card: {
      width: "100%",
      maxWidth: 320,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
    },
    title: {
      fontSize: fontSize.xs,
      color: colors.textSubtle,
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    rowLabel: { fontSize: fontSize.base, color: colors.text },
    rowLabelActive: { fontWeight: "600" },
    check: { fontSize: fontSize.base, color: colors.text, fontWeight: "700" },
  });
