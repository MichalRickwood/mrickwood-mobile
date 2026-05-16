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
  initialFrom: string | null; // ISO YYYY-MM-DD
  initialTo: string | null;
  onClose: () => void;
  onApply: (from: string | null, to: string | null) => void;
}

/** Konvertuje DD.MM.YYYY → ISO YYYY-MM-DD, nebo null pokud invalid/empty. */
function parseCzechDate(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dd = d.padStart(2, "0");
  const mm = mo.padStart(2, "0");
  const dt = new Date(`${y}-${mm}-${dd}T00:00:00Z`);
  if (isNaN(dt.getTime())) return null;
  return `${y}-${mm}-${dd}`;
}

function isoToCzech(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export default function DeadlinePickerModal({
  visible,
  initialFrom,
  initialTo,
  onClose,
  onApply,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [fromStr, setFromStr] = useState(isoToCzech(initialFrom));
  const [toStr, setToStr] = useState(isoToCzech(initialTo));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setFromStr(isoToCzech(initialFrom));
      setToStr(isoToCzech(initialTo));
      setError(null);
    }
  }, [visible, initialFrom, initialTo]);

  function apply() {
    setError(null);
    const from = parseCzechDate(fromStr);
    const to = parseCzechDate(toStr);
    if (fromStr.trim() && !from) {
      setError("Neplatný formát data 'od' (DD.MM.YYYY)");
      return;
    }
    if (toStr.trim() && !to) {
      setError("Neplatný formát data 'do' (DD.MM.YYYY)");
      return;
    }
    onApply(from, to);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Lhůta podání</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Od</Text>
              <TextInput
                value={fromStr}
                onChangeText={setFromStr}
                placeholder="DD.MM.YYYY"
                placeholderTextColor={colors.textFaint}
                keyboardType="numbers-and-punctuation"
                style={styles.input}
                maxLength={10}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Do</Text>
              <TextInput
                value={toStr}
                onChangeText={setToStr}
                placeholder="DD.MM.YYYY"
                placeholderTextColor={colors.textFaint}
                keyboardType="numbers-and-punctuation"
                style={styles.input}
                maxLength={10}
              />
            </View>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
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
            <TouchableOpacity onPress={apply} style={styles.applyBtn}>
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
    title: {
      fontSize: fontSize.lg,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    row: { flexDirection: "row", gap: spacing.sm },
    label: {
      fontSize: fontSize.xs,
      color: colors.textSubtle,
      fontWeight: "500",
      marginBottom: spacing.xs,
    },
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
    error: { fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.sm },
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
