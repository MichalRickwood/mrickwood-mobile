import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { endpoints, type ZadavatelOption } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

interface Props {
  visible: boolean;
  initial: ZadavatelOption[];
  onClose: () => void;
  onApply: (zadavatele: ZadavatelOption[]) => void;
}

export default function ZadavatelPickerModal({ visible, initial, onClose, onApply }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selected, setSelected] = useState<ZadavatelOption[]>(initial);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (visible) {
      setSelected(initial);
      setQuery("");
      setDebounced("");
    }
  }, [visible, initial]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const results = useQuery({
    queryKey: ["zadavatele", debounced],
    queryFn: () => endpoints.searchZadavatele(debounced || undefined),
    enabled: visible && debounced.length >= 2,
    staleTime: 60_000,
  });

  const isSelected = (ico: string) => selected.some((s) => s.ico === ico);
  function toggle(z: ZadavatelOption) {
    setSelected((prev) => (prev.some((s) => s.ico === z.ico) ? prev.filter((s) => s.ico !== z.ico) : [...prev, z]));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("filters", "zadavatelTitle")}</Text>

          {selected.length > 0 && (
            <View style={styles.chipsRow}>
              {selected.map((z) => (
                <Pressable key={z.ico} onPress={() => toggle(z)} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>{z.nazev}</Text>
                  <Text style={styles.chipX}>×</Text>
                </Pressable>
              ))}
            </View>
          )}

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("matches", "filterFormZadavatelSearch")}
            placeholderTextColor={colors.textFaint}
            style={styles.search}
            autoCorrect={false}
          />

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {debounced.length < 2 ? (
              <Text style={styles.hint}>{t("matches", "filterFormZadavatelEmpty")}</Text>
            ) : results.isLoading ? (
              <View style={styles.loader}><ActivityIndicator color={colors.textSubtle} /></View>
            ) : (results.data ?? []).length === 0 ? (
              <Text style={styles.hint}>{t("matches", "filterFormZadavatelNoResults")}</Text>
            ) : (
              (results.data ?? []).map((z) => {
                const active = isSelected(z.ico);
                return (
                  <Pressable key={z.ico} onPress={() => toggle(z)} style={[styles.row, active && styles.rowActive]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{z.nazev}</Text>
                      <Text style={styles.rowIco}>IČO {z.ico}</Text>
                    </View>
                    {active && <Text style={styles.rowCheck}>✓</Text>}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => { onApply([]); onClose(); }} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>{t("matches", "adHocClear")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { onApply(selected); onClose(); }} style={styles.applyBtn}>
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
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
    card: { width: "100%", maxWidth: 420, maxHeight: "85%", backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
    title: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, marginBottom: spacing.md, textAlign: "center" },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
    chip: { flexDirection: "row", alignItems: "center", maxWidth: "100%", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.accent, gap: spacing.xs },
    chipText: { fontSize: fontSize.xs, color: colors.accentForeground, fontWeight: "600", flexShrink: 1 },
    chipX: { fontSize: fontSize.sm, color: colors.accentForeground },
    search: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.sm, color: colors.text },
    body: { maxHeight: 380, marginTop: spacing.sm },
    loader: { paddingVertical: spacing.xl, alignItems: "center" },
    hint: { fontSize: fontSize.xs, color: colors.textSubtle, textAlign: "center", paddingVertical: spacing.lg },
    row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, marginBottom: spacing.xs },
    rowActive: { borderColor: colors.accent, backgroundColor: colors.card },
    rowName: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    rowIco: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 1 },
    rowCheck: { fontSize: 16, color: colors.accent, fontWeight: "700", marginLeft: spacing.sm },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    clearBtn: { flex: 1, paddingVertical: spacing.md, alignItems: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
    clearBtnText: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: "500" },
    applyBtn: { flex: 1, paddingVertical: spacing.md, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.accent },
    applyBtnText: { fontSize: fontSize.sm, color: colors.accentForeground, fontWeight: "600" },
  });
