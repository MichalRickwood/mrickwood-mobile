import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { DIAL_CODES } from "@/lib/dial-codes";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Picker telefonní předvolby — stejný compact modal styl jako LocaleSwitcher
 * (overlay + centered card s row+flag+name+check), ale s vyhledáváním protože
 * položek je 200+.
 */
interface Props {
  value: string;
  onChange: (code: string) => void;
}

export default function DialCodePicker({ value, onChange }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const current = DIAL_CODES.find((d) => d.code === value);
  const filtered = search
    ? DIAL_CODES.filter(
        (d) =>
          d.code.includes(search) ||
          d.iso.toLowerCase().includes(search.toLowerCase()) ||
          d.label.toLowerCase().includes(search.toLowerCase()),
      )
    : DIAL_CODES;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      >
        <Text style={styles.flag}>{current?.flag ?? "🌐"}</Text>
        <Text style={styles.dial} numberOfLines={1}>
          {current?.code ?? "+?"}
        </Text>
      </Pressable>

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
            <Text style={styles.title}>{t("profileComplete", "phoneLabel")}</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("settings", "searchPlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={styles.search}
              autoFocus={false}
              clearButtonMode="while-editing"
            />
            <FlatList
              data={filtered}
              keyExtractor={(d) => `${d.iso}-${d.code}`}
              renderItem={({ item }) => {
                const active = item.code === value;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onChange(item.code);
                      setSearch("");
                      setOpen(false);
                    }}
                    style={[styles.row, active && styles.rowActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.flagBig}>{item.flag}</Text>
                    <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>
                      {item.iso}
                    </Text>
                    <Text style={styles.rowCode}>{item.code}</Text>
                    {active && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />
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
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillPressed: { borderColor: colors.text },
    flag: { fontSize: 16 },
    dial: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
    chevron: { fontSize: 10, color: colors.textSubtle, marginLeft: 2 },
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
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.base,
      backgroundColor: colors.bg,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    list: { flexGrow: 0 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      gap: spacing.sm,
    },
    rowActive: { backgroundColor: colors.bg },
    flagBig: { fontSize: 22 },
    rowText: { fontSize: fontSize.base, color: colors.text, flex: 1 },
    rowTextActive: { fontWeight: "600" },
    rowCode: { fontSize: fontSize.base, color: colors.textSubtle, fontWeight: "500" },
    check: { fontSize: fontSize.base, color: colors.accent, fontWeight: "700", marginLeft: spacing.sm },
    cancelBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, alignItems: "center" },
    cancelText: { color: colors.textSubtle, fontSize: fontSize.sm },
  });
