import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { LeadFilterRow } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Pill button + centered modal (LocaleSwitcher style) pro výběr aktivního filtru.
 * X uvnitř pillu (jen když je filtr aktivní) okamžitě filter zruší a vrátí 'Všechny'.
 * Modal nabízí: list filtrů s edit ikonou + "+ Nový filtr".
 */
interface Props {
  filters: LeadFilterRow[];
  activeId: string | null;
  onPick: (id: string | null) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export default function FilterPicker({ filters, activeId, onPick, onAdd, onEdit }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const active = filters.find((f) => f.id === activeId) ?? null;
  const label = active?.name ?? t("matches", "filterAll");

  return (
    <>
      <View style={styles.pill}>
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.pillTouch, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.pillLabel} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
        {active && (
          <Pressable
            onPress={() => onPick(null)}
            hitSlop={6}
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.clearIcon}>✕</Text>
          </Pressable>
        )}
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{t("matches", "filterPickerTitle")}</Text>
            {filters.length === 0 ? (
              <Text style={styles.emptyText}>{t("matches", "filterPickerEmpty")}</Text>
            ) : (
              <FlatList
                data={filters}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isActive = item.id === activeId;
                  return (
                    <View style={styles.row}>
                      <TouchableOpacity
                        onPress={() => {
                          onPick(item.id);
                          setOpen(false);
                        }}
                        style={[styles.rowMain, isActive && styles.rowActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.rowText, isActive && styles.rowTextActive]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {isActive && <Text style={styles.check}>✓</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setOpen(false);
                          onEdit(item.id);
                        }}
                        style={styles.editBtn}
                        activeOpacity={0.7}
                        hitSlop={6}
                      >
                        <Text style={styles.editIcon}>✎</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
                style={styles.list}
                showsVerticalScrollIndicator={false}
              />
            )}
            <TouchableOpacity
              onPress={() => {
                setOpen(false);
                onAdd();
              }}
              style={styles.addBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>+ {t("matches", "filterAdd")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{t("settings", "cancel")}</Text>
            </TouchableOpacity>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: spacing.md,
      paddingRight: 4,
      paddingVertical: 2,
      borderRadius: radius.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      maxWidth: 220,
    },
    pillTouch: { paddingVertical: spacing.xs, paddingRight: spacing.xs },
    pillLabel: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    clearBtn: {
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      marginLeft: 4,
    },
    clearIcon: { fontSize: 12, color: colors.textSubtle, fontWeight: "600" },
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
    emptyText: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      textAlign: "center",
      paddingVertical: spacing.lg,
    },
    list: { flexGrow: 0 },
    row: { flexDirection: "row", alignItems: "center" },
    rowMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    rowActive: { backgroundColor: colors.bg },
    rowText: { fontSize: fontSize.base, color: colors.text, flex: 1 },
    rowTextActive: { fontWeight: "600" },
    check: { fontSize: fontSize.base, color: colors.accent, fontWeight: "700" },
    editBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    editIcon: { fontSize: fontSize.base, color: colors.textSubtle },
    sep: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
    addBtn: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      alignItems: "center",
    },
    addBtnText: { color: colors.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
    cancelBtn: { marginTop: spacing.sm, paddingVertical: spacing.sm, alignItems: "center" },
    cancelText: { color: colors.textSubtle, fontSize: fontSize.sm },
  });
