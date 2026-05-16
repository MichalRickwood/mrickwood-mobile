import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

interface Props {
  visible: boolean;
  initial: string[];
  onClose: () => void;
  onApply: (cpvPrefixes: string[]) => void;
}

// Pár běžných CZ divizí (2-digit) pro rychlý výběr
const COMMON_DIVISIONS: Array<{ code: string; label: string }> = [
  { code: "30", label: "30 — Kancelářské stroje" },
  { code: "33", label: "33 — Zdravotnické zařízení" },
  { code: "34", label: "34 — Doprava a vozidla" },
  { code: "39", label: "39 — Nábytek a vybavení" },
  { code: "44", label: "44 — Stavební materiál" },
  { code: "45", label: "45 — Stavební práce" },
  { code: "48", label: "48 — Software" },
  { code: "50", label: "50 — Údržba a opravy" },
  { code: "60", label: "60 — Doprava (služby)" },
  { code: "71", label: "71 — Architekt./inženýrské služby" },
  { code: "72", label: "72 — IT služby" },
  { code: "79", label: "79 — Podnikové služby" },
  { code: "90", label: "90 — Odpadové hospodářství" },
];

export default function CpvPickerModal({ visible, initial, onClose, onApply }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [prefixes, setPrefixes] = useState<string[]>(initial);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (visible) {
      setPrefixes(initial);
      setInput("");
    }
  }, [visible, initial]);

  function addPrefix(p: string) {
    const clean = p.replace(/[^0-9]/g, "").slice(0, 8);
    if (!clean || clean.length < 2) return;
    if (prefixes.includes(clean)) return;
    setPrefixes((prev) => [...prev, clean]);
    setInput("");
  }

  function remove(p: string) {
    setPrefixes((prev) => prev.filter((x) => x !== p));
  }

  function toggleDivision(code: string) {
    if (prefixes.includes(code)) {
      remove(code);
    } else {
      setPrefixes((prev) => [...prev, code]);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>CPV kódy</Text>
          <Text style={styles.help}>
            Zadejte prefix CPV kódu (např. 4520 pro pozemní stavby) nebo vyberte
            z divizí níže.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="44, 4520, 71200…"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={8}
              style={styles.input}
              onSubmitEditing={() => addPrefix(input)}
              returnKeyType="done"
            />
            <Pressable
              onPress={() => addPrefix(input)}
              disabled={input.length < 2}
              style={({ pressed }) => [
                styles.addBtn,
                input.length < 2 && { opacity: 0.4 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.addBtnText}>Přidat</Text>
            </Pressable>
          </View>

          {prefixes.length > 0 && (
            <View style={styles.selectedRow}>
              {prefixes.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => remove(p)}
                  style={styles.selectedChip}
                >
                  <Text style={styles.selectedChipText}>{p} ×</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.divisionsLabel}>Běžné divize</Text>
          <ScrollView style={styles.divisions} showsVerticalScrollIndicator={false}>
            <View style={styles.divisionsGrid}>
              {COMMON_DIVISIONS.map((d) => {
                const active = prefixes.includes(d.code);
                return (
                  <Pressable
                    key={d.code}
                    onPress={() => toggleDivision(d.code)}
                    style={[styles.division, active && styles.divisionActive]}
                  >
                    <Text style={[styles.divisionText, active && styles.divisionTextActive]}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => {
                onApply([]);
                onClose();
              }}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>{t("matches", "adHocClear")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onApply(prefixes);
                onClose();
              }}
              style={styles.applyBtn}
            >
              <Text style={styles.applyBtnText}>{t("matches", "adHocApply")}</Text>
            </TouchableOpacity>
          </View>
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
      padding: spacing.lg,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "85%",
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    help: {
      fontSize: fontSize.xs,
      color: colors.textSubtle,
      textAlign: "center",
      marginBottom: spacing.md,
      lineHeight: 16,
    },
    inputRow: { flexDirection: "row", gap: spacing.sm },
    input: {
      flex: 1,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.base,
      color: colors.text,
    },
    addBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
      justifyContent: "center",
    },
    addBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
    selectedRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    selectedChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.full,
      backgroundColor: colors.accent,
    },
    selectedChipText: { color: colors.accentForeground, fontSize: fontSize.xs, fontWeight: "600" },
    divisionsLabel: {
      fontSize: fontSize.xs,
      color: colors.textSubtle,
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    divisions: { maxHeight: 240 },
    divisionsGrid: { gap: spacing.xs },
    division: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    divisionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    divisionText: { fontSize: fontSize.xs, color: colors.text },
    divisionTextActive: { color: colors.accentForeground, fontWeight: "600" },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    clearBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearBtnText: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: "500" },
    applyBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: "center",
      borderRadius: radius.md,
      backgroundColor: colors.accent,
    },
    applyBtnText: { fontSize: fontSize.sm, color: colors.accentForeground, fontWeight: "600" },
  });
