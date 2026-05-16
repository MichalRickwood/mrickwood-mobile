import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { endpoints, type LeadFilterInput, type LeadFilterRow } from "@/lib/endpoints";
import { CZ_REGIONS, regionLabel } from "@/lib/nuts-cz";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Filter create/edit screen. Route: /filter/new pro nový, /filter/[id] pro úpravu.
 * Simplified form: name + keywords (chips) + regions (multi-pick) + value range
 * + emailDigest. Bez CPV / industry tagů — pokročilé na webu.
 */
export default function FilterFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isNew = id === "new";

  const list = useQuery({
    queryKey: ["filters"],
    queryFn: () => endpoints.myFilters(),
    enabled: !isNew,
  });
  const existing = !isNew ? list.data?.filters.find((f) => f.id === id) ?? null : null;
  const loading = !isNew && list.isLoading;

  const [name, setName] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");
  const [emailDigest, setEmailDigest] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Načti existing data
  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setKeywords(existing.keywords);
      setRegions(existing.regions);
      setMinValue(existing.minValue != null ? String(existing.minValue) : "");
      setMaxValue(existing.maxValue != null ? String(existing.maxValue) : "");
      setEmailDigest(existing.emailDigest);
    }
  }, [existing]);

  function addKeyword() {
    const k = keywordInput.trim();
    if (!k || keywords.includes(k)) {
      setKeywordInput("");
      return;
    }
    setKeywords([...keywords, k]);
    setKeywordInput("");
  }
  function removeKeyword(k: string) {
    setKeywords(keywords.filter((x) => x !== k));
  }
  function toggleRegion(code: string) {
    setRegions((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));
  }

  async function onSave() {
    if (saving) return;
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("matches", "filterFormErrName"));
      return;
    }
    const input: LeadFilterInput = {
      name: trimmedName,
      keywords,
      regions,
      minValue: minValue ? Number(minValue) || null : null,
      maxValue: maxValue ? Number(maxValue) || null : null,
      emailDigest,
    };
    setSaving(true);
    try {
      if (isNew) {
        await endpoints.createFilter(input);
      } else {
        await endpoints.updateFilter(id, input);
      }
      await qc.invalidateQueries({ queryKey: ["filters"] });
      await qc.invalidateQueries({ queryKey: ["matches"] });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("matches", "filterFormErrSave"));
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (isNew) return;
    Alert.alert(
      t("matches", "filterFormConfirmDeleteTitle"),
      t("matches", "filterFormConfirmDeleteBody", { name: existing?.name ?? "" }),
      [
        { text: t("settings", "cancel"), style: "cancel" },
        {
          text: t("matches", "filterFormDelete"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await endpoints.deleteFilter(id);
              await qc.invalidateQueries({ queryKey: ["filters"] });
              await qc.invalidateQueries({ queryKey: ["matches"] });
              router.back();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t("matches", "filterFormErrSave"));
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.safe}>
        <Stack.Screen options={{ title: t("matches", "filterAdd"), headerBackTitle: "Zpět" }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSubtle} />
        </View>
      </View>
    );
  }

  if (!isNew && !existing) {
    return (
      <View style={styles.safe}>
        <Stack.Screen options={{ title: t("matches", "filterAdd"), headerBackTitle: "Zpět" }} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{t("matches", "filterFormNotFound")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen
        options={{
          title: isNew ? t("matches", "filterAdd") : t("matches", "filterFormEditTitle"),
          headerBackTitle: "Zpět",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: fontSize.sm, fontWeight: "600" },
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>{t("matches", "filterFormName")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("matches", "filterFormNamePlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />
          </View>

          {/* Keywords chips */}
          <View style={styles.field}>
            <Text style={styles.label}>{t("matches", "filterFormKeywords")}</Text>
            <Text style={styles.help}>{t("matches", "filterFormKeywordsHelp")}</Text>
            <View style={styles.chipInputRow}>
              <TextInput
                value={keywordInput}
                onChangeText={setKeywordInput}
                onSubmitEditing={addKeyword}
                placeholder={t("matches", "filterFormKeywordsPlaceholder")}
                placeholderTextColor={colors.textFaint}
                style={[styles.input, styles.chipInput]}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              <Pressable onPress={addKeyword} style={styles.chipAdd}>
                <Text style={styles.chipAddText}>+</Text>
              </Pressable>
            </View>
            {keywords.length > 0 && (
              <View style={styles.chipsRow}>
                {keywords.map((k) => (
                  <Pressable key={k} onPress={() => removeKeyword(k)} style={styles.chip}>
                    <Text style={styles.chipText}>{k}</Text>
                    <Text style={styles.chipX}>×</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Regions multi-select */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("matches", "filterFormRegions")} {regions.length > 0 && `(${regions.length})`}
            </Text>
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
          </View>

          {/* Value range */}
          <View style={styles.field}>
            <Text style={styles.label}>{t("matches", "filterFormValueRange")}</Text>
            <View style={styles.valueRow}>
              <TextInput
                value={minValue}
                onChangeText={setMinValue}
                placeholder={t("matches", "filterFormMinPlaceholder")}
                placeholderTextColor={colors.textFaint}
                keyboardType="numeric"
                style={[styles.input, styles.valueInput]}
              />
              <Text style={styles.valueSep}>–</Text>
              <TextInput
                value={maxValue}
                onChangeText={setMaxValue}
                placeholder={t("matches", "filterFormMaxPlaceholder")}
                placeholderTextColor={colors.textFaint}
                keyboardType="numeric"
                style={[styles.input, styles.valueInput]}
              />
            </View>
          </View>

          {/* Email digest */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t("matches", "filterFormEmailDigest")}</Text>
              <Text style={styles.help}>{t("matches", "filterFormEmailDigestHelp")}</Text>
            </View>
            <Switch
              value={emailDigest}
              onValueChange={setEmailDigest}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.card}
              ios_backgroundColor={colors.border}
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={onSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              saving && styles.btnDisabled,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.saveBtnText}>
              {saving ? t("matches", "filterFormSaving") : t("matches", "filterFormSave")}
            </Text>
          </Pressable>

          {!isNew && (
            <Pressable
              onPress={onDelete}
              disabled={deleting || saving}
              style={({ pressed }) => [
                styles.deleteBtn,
                (deleting || saving) && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.deleteBtnText}>
                {deleting ? t("matches", "filterFormDeleting") : t("matches", "filterFormDelete")}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    field: { marginBottom: spacing.lg },
    label: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
    help: { fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: spacing.sm, lineHeight: 16 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.base,
      color: colors.text,
    },
    chipInputRow: { flexDirection: "row", gap: spacing.sm },
    chipInput: { flex: 1 },
    chipAdd: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      borderRadius: radius.md,
    },
    chipAddText: { color: colors.accentForeground, fontSize: 24, fontWeight: "600", lineHeight: 26 },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    chipText: { fontSize: fontSize.sm, color: colors.text },
    chipX: { fontSize: fontSize.lg, color: colors.textSubtle, marginLeft: spacing.xs },
    regionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    regionChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    regionChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    regionChipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
    regionChipTextActive: { color: colors.accentForeground, fontWeight: "600" },
    valueRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    valueInput: { flex: 1 },
    valueSep: { fontSize: fontSize.base, color: colors.textSubtle },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      marginBottom: spacing.md,
    },
    saveBtn: {
      marginTop: spacing.lg,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    saveBtnText: { color: colors.accentForeground, fontSize: fontSize.base, fontWeight: "600" },
    deleteBtn: {
      marginTop: spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    deleteBtnText: { color: colors.danger, fontSize: fontSize.sm, fontWeight: "600" },
    btnDisabled: { opacity: 0.4 },
    btnPressed: { opacity: 0.7 },
    errorBox: { padding: spacing.md, backgroundColor: colors.dangerBg, borderRadius: radius.md, marginTop: spacing.md },
    errorBoxText: { fontSize: fontSize.sm, color: colors.danger },
    errorText: { fontSize: fontSize.sm, color: colors.danger, textAlign: "center" },
  });
