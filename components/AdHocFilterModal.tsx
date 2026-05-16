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
import { CZ_REGIONS } from "@/lib/nuts-cz";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export interface AdHocFilter {
  regions: string[];
  minValue: number | null;
  maxValue: number | null;
}

export const EMPTY_AD_HOC: AdHocFilter = { regions: [], minValue: null, maxValue: null };

export function isAdHocActive(f: AdHocFilter): boolean {
  return f.regions.length > 0 || f.minValue != null || f.maxValue != null;
}

interface Props {
  visible: boolean;
  initial: AdHocFilter;
  onClose: () => void;
  onApply: (f: AdHocFilter) => void;
}

/** Modal pro jednorázový (nepersistovaný) filtr nad current view zakázek.
 *  Regiony multi-pick + value range. Apply pošle zpět callerovi, ten dál
 *  do query params /api/mobile/matches. */
export default function AdHocFilterModal({ visible, initial, onClose, onApply }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [regions, setRegions] = useState<string[]>(initial.regions);
  const [minValue, setMinValue] = useState(initial.minValue != null ? String(initial.minValue) : "");
  const [maxValue, setMaxValue] = useState(initial.maxValue != null ? String(initial.maxValue) : "");

  useEffect(() => {
    if (visible) {
      setRegions(initial.regions);
      setMinValue(initial.minValue != null ? String(initial.minValue) : "");
      setMaxValue(initial.maxValue != null ? String(initial.maxValue) : "");
    }
  }, [visible, initial]);

  function toggleRegion(code: string) {
    setRegions((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("matches", "adHocTitle")}</Text>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>{t("matches", "filterFormRegions")}</Text>
            <View style={styles.regionGrid}>
              {CZ_REGIONS.map((r) => {
                const active = regions.includes(r.code);
                return (
                  <Pressable
                    key={r.code}
                    onPress={() => toggleRegion(r.code)}
                    style={[styles.regionChip, active && styles.regionChipActive]}
                  >
                    <Text style={[styles.regionChipText, active && styles.regionChipTextActive]}>
                      {r.labels.cs}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, styles.mt]}>{t("matches", "filterFormValueRange")}</Text>
            <View style={styles.valueRow}>
              <TextInput
                value={minValue}
                onChangeText={setMinValue}
                placeholder={t("matches", "filterFormMinPlaceholder")}
                placeholderTextColor={colors.textFaint}
                keyboardType="numeric"
                style={[styles.input, { flex: 1 }]}
              />
              <Text style={styles.valueSep}>–</Text>
              <TextInput
                value={maxValue}
                onChangeText={setMaxValue}
                placeholder={t("matches", "filterFormMaxPlaceholder")}
                placeholderTextColor={colors.textFaint}
                keyboardType="numeric"
                style={[styles.input, { flex: 1 }]}
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => {
                onApply(EMPTY_AD_HOC);
                onClose();
              }}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>{t("matches", "adHocClear")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onApply({
                  regions,
                  minValue: minValue ? Number(minValue) || null : null,
                  maxValue: maxValue ? Number(maxValue) || null : null,
                });
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
      padding: spacing.xl,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      maxHeight: "80%",
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
      marginBottom: spacing.md,
      textAlign: "center",
    },
    body: { maxHeight: 400 },
    label: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
    mt: { marginTop: spacing.lg },
    regionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    regionChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    regionChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    regionChipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
    regionChipTextActive: { color: colors.accentForeground, fontWeight: "600" },
    valueRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    valueSep: { fontSize: fontSize.base, color: colors.textSubtle },
    input: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.base,
      color: colors.text,
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
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
