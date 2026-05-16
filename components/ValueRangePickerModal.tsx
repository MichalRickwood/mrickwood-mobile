import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
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
  initialMin: number | null;
  initialMax: number | null;
  onClose: () => void;
  onApply: (min: number | null, max: number | null) => void;
}

export default function ValueRangePickerModal({
  visible,
  initialMin,
  initialMax,
  onClose,
  onApply,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [minStr, setMinStr] = useState(initialMin != null ? String(initialMin) : "");
  const [maxStr, setMaxStr] = useState(initialMax != null ? String(initialMax) : "");

  useEffect(() => {
    if (visible) {
      setMinStr(initialMin != null ? String(initialMin) : "");
      setMaxStr(initialMax != null ? String(initialMax) : "");
    }
  }, [visible, initialMin, initialMax]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("matches", "filterFormValueRange")}</Text>
          <View style={styles.row}>
            <TextInput
              value={minStr}
              onChangeText={setMinStr}
              placeholder={t("matches", "filterFormMinPlaceholder")}
              placeholderTextColor={colors.textFaint}
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
            <Text style={styles.sep}>–</Text>
            <TextInput
              value={maxStr}
              onChangeText={setMaxStr}
              placeholder={t("matches", "filterFormMaxPlaceholder")}
              placeholderTextColor={colors.textFaint}
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => {
                onApply(null, null);
                onClose();
              }}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>{t("matches", "adHocClear")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onApply(minStr ? Number(minStr) || null : null, maxStr ? Number(maxStr) || null : null);
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
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, marginBottom: spacing.md, textAlign: "center" },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    sep: { fontSize: fontSize.base, color: colors.textSubtle },
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
