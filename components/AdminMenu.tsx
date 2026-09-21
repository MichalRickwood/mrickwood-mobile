import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Pill tlačítko, které otevře modal se seznamem položek — stejný vzor jako
 * FilterPicker, jen obecný. Používá se tam, kde by jinak v záhlaví byla řada
 * tlačítek vedle sebe a obrazovka se stala nečitelnou.
 */
export interface MenuPolozka {
  label: string;
  onPress: () => void;
  /** Červeně — pro akce, které něco zahodí. */
  destructive?: boolean;
  /** Zvýrazněná hlavní akce. */
  primary?: boolean;
  disabled?: boolean;
  /** Krátké vysvětlení pod popiskem. */
  popis?: string;
}

export default function AdminMenu({
  label,
  polozky,
  variant = "ghost",
}: {
  label: string;
  polozky: MenuPolozka[];
  variant?: "ghost" | "primary";
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.pill, variant === "primary" && styles.pillPrimary]}>
        <Text style={[styles.pillText, variant === "primary" && styles.pillTextPrimary]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.caret, variant === "primary" && styles.pillTextPrimary]}>⌄</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView>
              {polozky.map((p, i) => (
                <Pressable
                  key={i}
                  disabled={p.disabled}
                  onPress={() => {
                    setOpen(false);
                    p.onPress();
                  }}
                  style={[styles.row, i > 0 && styles.rowBorder, p.disabled && styles.rowDisabled]}
                >
                  <Text
                    style={[
                      styles.rowText,
                      p.primary && styles.rowTextPrimary,
                      p.destructive && styles.rowTextDanger,
                    ]}
                  >
                    {p.label}
                  </Text>
                  {p.popis ? <Text style={styles.rowHint}>{p.popis}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexShrink: 1,
    },
    pillPrimary: { backgroundColor: colors.text, borderColor: colors.text },
    pillText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600", flexShrink: 1 },
    pillTextPrimary: { color: colors.bg },
    caret: { color: colors.textSubtle, fontSize: fontSize.sm },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg },
    sheet: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      maxHeight: "70%",
      overflow: "hidden",
    },
    row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    rowDisabled: { opacity: 0.4 },
    rowText: { color: colors.text, fontSize: fontSize.base },
    rowTextPrimary: { fontWeight: "700" },
    rowTextDanger: { color: colors.danger },
    rowHint: { color: colors.textSubtle, fontSize: fontSize.xs, marginTop: 2 },
  });
