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
import { endpoints } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

interface Props {
  visible: boolean;
  initial: string[];
  onClose: () => void;
  onApply: (cpvPrefixes: string[]) => void;
}

interface CpvEntry {
  prefix: string;
  label: string;
  level: "oddil" | "skupina" | "trida" | "kategorie" | "podkategorie";
}

const STRIP_RX = /[\u0300-\u036f]/g;
function fold(s: string): string {
  return s.normalize("NFD").replace(STRIP_RX, "").toLowerCase();
}

export default function CpvPickerModal({ visible, initial, onClose, onApply }: Props) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selected, setSelected] = useState<string[]>(initial);
  const [parentStack, setParentStack] = useState<string[]>([]); // prefix chain ["", "44", "445"]
  const [query, setQuery] = useState("");

  const catalog = useQuery({
    queryKey: ["taxonomy", "cpv", locale],
    queryFn: () => endpoints.cpvCatalog(locale),
    staleTime: Infinity,
    enabled: visible,
  });

  useEffect(() => {
    if (visible) {
      setSelected(initial);
      setParentStack([]);
      setQuery("");
    }
  }, [visible, initial]);

  // Build children index once
  const byPrefix = useMemo(() => {
    const m = new Map<string, CpvEntry>();
    if (catalog.data) {
      for (const e of catalog.data.entries) m.set(e.prefix, e);
    }
    return m;
  }, [catalog.data]);

  const childrenOf = useMemo(() => {
    const m = new Map<string, CpvEntry[]>();
    if (catalog.data) {
      for (const e of catalog.data.entries) {
        if (e.level === "oddil") continue;
        const parent = e.prefix.slice(0, -1);
        const arr = m.get(parent);
        if (arr) arr.push(e);
        else m.set(parent, [e]);
      }
      for (const arr of m.values()) arr.sort((a, b) => a.prefix.localeCompare(b.prefix));
    }
    return m;
  }, [catalog.data]);

  const topLevel = useMemo(
    () => (catalog.data?.entries.filter((e) => e.level === "oddil") ?? []).sort((a, b) => a.prefix.localeCompare(b.prefix)),
    [catalog.data],
  );

  // List zobrazujeme: pokud query, search výsledky; jinak děti aktuálního parent (nebo top-level)
  const currentParent = parentStack[parentStack.length - 1] ?? "";
  const listEntries: CpvEntry[] = useMemo(() => {
    if (!catalog.data) return [];
    const q = query.trim();
    if (q) {
      const digits = q.replace(/[^0-9]/g, "");
      const folded = fold(q);
      const out: CpvEntry[] = [];
      for (const e of catalog.data.entries) {
        const codeMatch = digits && e.prefix.startsWith(digits);
        const labelMatch = folded && fold(e.label).includes(folded);
        if (codeMatch || labelMatch) {
          out.push(e);
          if (out.length >= 80) break;
        }
      }
      return out;
    }
    return currentParent ? (childrenOf.get(currentParent) ?? []) : topLevel;
  }, [catalog.data, query, currentParent, childrenOf, topLevel]);

  function toggle(prefix: string) {
    setSelected((prev) => (prev.includes(prefix) ? prev.filter((x) => x !== prefix) : [...prev, prefix]));
  }

  function isSelectedOrCovered(prefix: string): "selected" | "covered" | null {
    if (selected.includes(prefix)) return "selected";
    // Covered if any selected prefix is a parent
    if (selected.some((s) => s.length < prefix.length && prefix.startsWith(s))) return "covered";
    return null;
  }

  function drillInto(prefix: string) {
    if (childrenOf.has(prefix)) {
      setParentStack((prev) => [...prev, prefix]);
      setQuery("");
    }
  }

  function popBreadcrumb(level: number) {
    setParentStack((prev) => prev.slice(0, level));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("filters", "cpvTitle")}</Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("filters", "cpvSearchPlaceholder")}
            placeholderTextColor={colors.textFaint}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />

          {!query && parentStack.length > 0 && (
            <View style={styles.pathStack}>
              <Pressable
                onPress={() => popBreadcrumb(0)}
                style={({ pressed }) => [styles.pathRow, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.pathArrow}>↑</Text>
                <Text style={styles.pathText}>{t("filters", "cpvAll")}</Text>
              </Pressable>
              {parentStack.slice(0, -1).map((p, idx) => {
                const entry = byPrefix.get(p);
                return (
                  <Pressable
                    key={p}
                    onPress={() => popBreadcrumb(idx + 1)}
                    style={({ pressed }) => [
                      styles.pathRow,
                      { paddingLeft: spacing.md + (idx + 1) * 12 },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={styles.pathArrow}>↑</Text>
                    <Text style={styles.pathText} numberOfLines={1}>
                      {p} · {entry?.label ?? "?"}
                    </Text>
                  </Pressable>
                );
              })}
              {/* Current level (non-clickable) */}
              {(() => {
                const cur = parentStack[parentStack.length - 1];
                const entry = byPrefix.get(cur);
                return (
                  <View
                    style={[
                      styles.pathRow,
                      styles.pathRowCurrent,
                      { paddingLeft: spacing.md + parentStack.length * 12 },
                    ]}
                  >
                    <Text style={styles.pathBullet}>●</Text>
                    <Text style={[styles.pathText, styles.pathCurrent]} numberOfLines={2}>
                      {cur} · {entry?.label ?? "?"}
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}

          {selected.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.selectedWrap}
              contentContainerStyle={styles.selectedRow}
            >
              {selected.map((p) => (
                <Pressable key={p} onPress={() => toggle(p)} style={styles.selectedChip}>
                  <Text style={styles.selectedChipText}>{p} ×</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {catalog.isLoading ? (
              <View style={styles.loader}>
                <ActivityIndicator color={colors.textSubtle} />
              </View>
            ) : listEntries.length === 0 ? (
              <Text style={styles.empty}>
                {query ? t("filters", "cpvNoResults") : t("filters", "cpvEmpty")}
              </Text>
            ) : (
              listEntries.map((e) => {
                const state = isSelectedOrCovered(e.prefix);
                const hasChildren = childrenOf.has(e.prefix);
                return (
                  <View key={e.prefix} style={styles.row}>
                    <Pressable
                      onPress={() => toggle(e.prefix)}
                      style={({ pressed }) => [
                        styles.checkBtn,
                        state === "selected" && styles.checkBtnActive,
                        state === "covered" && styles.checkBtnCovered,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      {state === "selected" && <Text style={styles.checkMark}>✓</Text>}
                      {state === "covered" && <Text style={styles.checkMark}>·</Text>}
                    </Pressable>
                    <Pressable
                      onPress={() => (hasChildren ? drillInto(e.prefix) : toggle(e.prefix))}
                      style={({ pressed }) => [styles.entryBtn, pressed && { opacity: 0.7 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryLabel} numberOfLines={2}>
                          {e.label}
                        </Text>
                        <Text style={styles.entryMeta}>
                          {e.prefix} · {levelLabel(e.level, t)}
                        </Text>
                      </View>
                      {hasChildren && <Text style={styles.entryArrow}>›</Text>}
                    </Pressable>
                  </View>
                );
              })
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

function levelLabel(
  level: CpvEntry["level"],
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (level === "oddil") return t("filters", "cpvLevelOddil");
  if (level === "skupina") return t("filters", "cpvLevelSkupina");
  if (level === "trida") return t("filters", "cpvLevelTrida");
  if (level === "kategorie") return t("filters", "cpvLevelKategorie");
  return t("filters", "cpvLevelPodkategorie");
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
      maxWidth: 480,
      maxHeight: "90%",
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
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.sm,
      color: colors.text,
    },
    pathStack: {
      marginTop: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.xs,
    },
    pathRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 1,
    },
    pathRowCurrent: { backgroundColor: colors.card },
    pathArrow: { color: colors.link, fontSize: fontSize.sm, fontWeight: "700", width: 14 },
    pathBullet: { color: colors.text, fontSize: 10, width: 14 },
    pathText: { flex: 1, fontSize: fontSize.xs, color: colors.link },
    pathCurrent: { color: colors.text, fontWeight: "600" },
    selectedWrap: { marginTop: spacing.sm, maxHeight: 32 },
    selectedRow: { flexDirection: "row", gap: spacing.xs },
    selectedChip: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.full,
      backgroundColor: colors.accent,
    },
    selectedChipText: { color: colors.accentForeground, fontSize: fontSize.xs, fontWeight: "600" },
    body: { marginTop: spacing.sm, maxHeight: 420 },
    loader: { paddingVertical: spacing.xxl, alignItems: "center" },
    empty: {
      paddingVertical: spacing.xl,
      textAlign: "center",
      color: colors.textSubtle,
      fontSize: fontSize.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    checkBtn: {
      width: 26,
      height: 26,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    checkBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    checkBtnCovered: { backgroundColor: colors.bg, borderColor: colors.textSubtle },
    checkMark: { color: colors.accentForeground, fontSize: 14, fontWeight: "700" },
    entryBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    entryLabel: { fontSize: fontSize.sm, color: colors.text, lineHeight: 18 },
    entryMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    entryArrow: { fontSize: 20, color: colors.textFaint },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
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
