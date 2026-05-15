import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fontSize, radius, spacing } from "@/constants/theme";

/**
 * Generický bottom-sheet picker. Použití:
 *   <Picker
 *     items={[{ value: "CZ", label: "Česká republika" }, ...]}
 *     value={country}
 *     onChange={setCountry}
 *     placeholder="Vyberte zemi"
 *     searchable
 *   />
 */

export interface PickerItem {
  value: string;
  label: string;
}

interface Props {
  items: PickerItem[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  searchable?: boolean;
  disabled?: boolean;
}

export default function Picker({ items, value, onChange, placeholder, searchable, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = items.find((i) => i.value === value);

  const filtered = search
    ? items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.trigger,
          disabled && styles.triggerDisabled,
          pressed && styles.triggerPressed,
        ]}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.cancelBtn}>Zrušit</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>{placeholder}</Text>
            <View style={{ width: 60 }} />
          </View>
          {searchable && (
            <View style={styles.searchWrap}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Hledat…"
                placeholderTextColor={colors.textFaint}
                style={styles.searchInput}
                autoFocus
                clearButtonMode="while-editing"
              />
            </View>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.value}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                  setSearch("");
                }}
                style={({ pressed }) => [
                  styles.item,
                  pressed && { backgroundColor: colors.bg },
                ]}
              >
                <Text style={styles.itemText}>{item.label}</Text>
                {item.value === value && <Text style={styles.check}>✓</Text>}
              </Pressable>
            )}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerDisabled: { opacity: 0.5 },
  triggerPressed: { borderColor: colors.text },
  triggerText: { fontSize: fontSize.base, color: colors.text, flex: 1 },
  placeholder: { color: colors.textFaint },
  chevron: { fontSize: fontSize.sm, color: colors.textSubtle, marginLeft: spacing.sm },
  sheet: { flex: 1, backgroundColor: colors.card },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: { fontSize: fontSize.base, color: colors.link, width: 60 },
  sheetTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
  searchWrap: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    backgroundColor: colors.bg,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  itemText: { fontSize: fontSize.base, color: colors.text, flex: 1 },
  check: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
  sep: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
});
