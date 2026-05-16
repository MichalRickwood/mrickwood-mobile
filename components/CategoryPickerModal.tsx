import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

interface Props {
  visible: boolean;
  initial: string[];
  onClose: () => void;
  onApply: (tagIds: string[]) => void;
}

export default function CategoryPickerModal({ visible, initial, onClose, onApply }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selected, setSelected] = useState<string[]>(initial);
  const taxonomy = useQuery({
    queryKey: ["taxonomy", "industry"],
    queryFn: () => endpoints.industryTaxonomy(),
    staleTime: Infinity,
    enabled: visible,
  });

  useEffect(() => {
    if (visible) setSelected(initial);
  }, [visible, initial]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const grouped = useMemo(() => {
    if (!taxonomy.data) return [];
    return taxonomy.data.areas.map((a) => ({
      area: a,
      tags: taxonomy.data!.tags.filter((tag) => tag.area === a.id),
    }));
  }, [taxonomy.data]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Kategorie</Text>
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {taxonomy.isLoading ? (
              <View style={styles.loader}>
                <ActivityIndicator color={colors.textSubtle} />
              </View>
            ) : (
              grouped.map((g) => (
                <View key={g.area.id} style={styles.areaBlock}>
                  <Text style={styles.areaHeader}>
                    {g.area.icon} {g.area.label}
                  </Text>
                  <View style={styles.tagGrid}>
                    {g.tags.map((tag) => {
                      const active = selected.includes(tag.id);
                      return (
                        <Pressable
                          key={tag.id}
                          onPress={() => toggle(tag.id)}
                          style={[styles.tag, active && styles.tagActive]}
                        >
                          <Text style={[styles.tagText, active && styles.tagTextActive]}>
                            {tag.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
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
                onApply(selected);
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
      marginBottom: spacing.md,
      textAlign: "center",
    },
    body: { maxHeight: 500 },
    loader: { paddingVertical: spacing.xxl, alignItems: "center" },
    areaBlock: { marginBottom: spacing.lg },
    areaHeader: {
      fontSize: fontSize.sm,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.sm,
    },
    tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    tag: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    tagActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    tagText: { fontSize: fontSize.xs, color: colors.text },
    tagTextActive: { color: colors.accentForeground, fontWeight: "600" },
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
