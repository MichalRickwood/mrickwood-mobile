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
import { SUPPORTED_COUNTRIES } from "@/lib/company-lookup";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Picker zemí firmy — vlajka + ISO + lokalizovaný název. Stejný compact modal
 * styl jako DialCodePicker / LocaleSwitcher (overlay + centered card + search).
 */

// Vlajka emoji per ISO code. Pro country list bereme SUPPORTED_COUNTRIES z
// company-lookup, ten ale flag emoji nemá → mapujeme zde.
const FLAGS: Record<string, string> = {
  CZ: "🇨🇿", SK: "🇸🇰", DE: "🇩🇪", AT: "🇦🇹", PL: "🇵🇱", FR: "🇫🇷",
  GB: "🇬🇧", HU: "🇭🇺", IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱", BE: "🇧🇪",
  DK: "🇩🇰", FI: "🇫🇮", SE: "🇸🇪", IE: "🇮🇪", PT: "🇵🇹", RO: "🇷🇴",
  BG: "🇧🇬", HR: "🇭🇷", SI: "🇸🇮", EE: "🇪🇪", LV: "🇱🇻", LT: "🇱🇹",
  GR: "🇬🇷", CY: "🇨🇾", MT: "🇲🇹", LU: "🇱🇺",
};

interface Props {
  value: string;
  onChange: (countryCode: string) => void;
}

export default function CountryPicker({ value, onChange }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const current = SUPPORTED_COUNTRIES.find((c) => c.code === value);
  const filtered = search
    ? SUPPORTED_COUNTRIES.filter(
        (c) =>
          c.code.toLowerCase().includes(search.toLowerCase()) ||
          c.label.toLowerCase().includes(search.toLowerCase()),
      )
    : SUPPORTED_COUNTRIES;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Text style={styles.flag}>{FLAGS[value] ?? "🌐"}</Text>
        <Text style={styles.label} numberOfLines={1}>
          {current?.label ?? value}
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
            <Text style={styles.title}>{t("profileComplete", "countryLabel")}</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("settings", "searchPlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={styles.search}
              clearButtonMode="while-editing"
            />
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.code}
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
                    <Text style={styles.flagBig}>{FLAGS[item.code] ?? "🌐"}</Text>
                    <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>
                      {item.label}
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
    trigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    triggerPressed: { borderColor: colors.text },
    flag: { fontSize: 18 },
    label: { fontSize: fontSize.base, color: colors.text, flex: 1 },
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
    rowCode: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500" },
    check: { fontSize: fontSize.base, color: colors.accent, fontWeight: "700", marginLeft: spacing.sm },
    cancelBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, alignItems: "center" },
    cancelText: { color: colors.textSubtle, fontSize: fontSize.sm },
  });
