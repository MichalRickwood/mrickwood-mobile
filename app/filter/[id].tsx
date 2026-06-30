import { useEffect, useMemo, useRef, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { endpoints, type LeadFilterInput, type ZadavatelOption } from "@/lib/endpoints";
import { regionLabel } from "@/lib/nuts-cz";
import RegionPickerModal from "@/components/RegionPickerModal";
import ValueRangePickerModal from "@/components/ValueRangePickerModal";
import CategoryPickerModal from "@/components/CategoryPickerModal";
import CpvPickerModal from "@/components/CpvPickerModal";
import ZadavatelPickerModal from "@/components/ZadavatelPickerModal";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

/**
 * Filter create/edit. Route: /filter/new pro nový, /filter/[id] pro úpravu.
 * Krok 1 Název. Krok 2 mode (keywords|industry|cpv) — jeden režim, picker modal
 * pro kategorie/CPV jako u ad-hoc filtru. Krok 3 hodnota, Krok 4 kraje.
 * Pokročilé: emailDigest. Explicitní Uložit.
 */
type FilterMode = "keywords" | "industry" | "cpv";

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function valueRangeLabel(min: number | null, max: number | null, anyLabel: string): string {
  if (min == null && max == null) return anyLabel;
  if (min != null && max != null) return `${fmtMoney(min)} – ${fmtMoney(max)} Kč`;
  if (min != null) return `od ${fmtMoney(min)} Kč`;
  return `do ${fmtMoney(max!)} Kč`;
}

export default function FilterFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
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
  const [mode, setMode] = useState<FilterMode>("industry");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [industryTags, setIndustryTags] = useState<string[]>([]);
  const [cpvPrefixes, setCpvPrefixes] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [zadavatele, setZadavatele] = useState<ZadavatelOption[]>([]);
  const [minValue, setMinValue] = useState<number | null>(null);
  const [maxValue, setMaxValue] = useState<number | null>(null);
  const [emailDigest, setEmailDigest] = useState(true);

  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [valuePickerOpen, setValuePickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [cpvPickerOpen, setCpvPickerOpen] = useState(false);
  const [zadavatelPickerOpen, setZadavatelPickerOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydratuj formulář pouze jednou — react-query může v pozadí refetchnout
  // ["filters"] a `existing` dostane novou referenci, což by jinak přemazalo
  // rozpracované změny uživatele.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (existing && !hydratedRef.current) {
      setName(existing.name);
      setKeywords(existing.keywords);
      setIndustryTags(existing.industryTags ?? []);
      setCpvPrefixes(existing.categories ?? []);
      setRegions(existing.regions);
      setMinValue(existing.minValue);
      setMaxValue(existing.maxValue);
      setEmailDigest(existing.emailDigest);
      const icos = existing.zadavatelIcos ?? [];
      if (icos.length) {
        // Placeholder hned, názvy dotáhneme z API (include = uložená IČO).
        setZadavatele(icos.map((ico) => ({ ico, nazev: ico })));
        endpoints
          .searchZadavatele(undefined, icos)
          .then((rows) => setZadavatele(icos.map((ico) => rows.find((r) => r.ico === ico) ?? { ico, nazev: ico })))
          .catch(() => {});
      }
      if (existing.industryTags?.length) setMode("industry");
      else if (existing.categories?.length) setMode("cpv");
      else if (existing.keywords?.length) setMode("keywords");
      else setMode("industry");
      hydratedRef.current = true;
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
      keywords: mode === "keywords" ? keywords : [],
      industryTags: mode === "industry" ? industryTags : [],
      categories: mode === "cpv" ? cpvPrefixes : [],
      regions,
      zadavatelIcos: zadavatele.map((z) => z.ico),
      minValue,
      maxValue,
      emailDigest,
    };
    setSaving(true);
    try {
      if (isNew) {
        const created = await endpoints.createFilter(input);
        qc.setQueryData(["pendingPickFilterId"], created.filter.id);
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

  const screenTitle = isNew
    ? t("matches", "filterAdd")
    : t("matches", "filterFormEditTitle");
  const screenOptions = {
    title: screenTitle,
    headerShown: true,
    headerBackTitle: t("settings", "back"),
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.text,
    headerTitleStyle: { fontSize: fontSize.base, fontWeight: "600" as const },
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <Stack.Screen options={screenOptions} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSubtle} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isNew && !existing) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <Stack.Screen options={screenOptions} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{t("matches", "filterFormNotFound")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const regionsSummary =
    regions.length === 0
      ? t("matches", "filterFormAllRegions")
      : regions.length === 1
        ? regionLabel(regions[0], locale)
        : t("matches", "filterFormPickCount", { count: String(regions.length) });

  const valueSummary = valueRangeLabel(minValue, maxValue, t("matches", "filterFormValueAny"));

  const zadavatelSummary =
    zadavatele.length === 0
      ? t("matches", "filterFormZadavatelAll")
      : zadavatele.length === 1
        ? zadavatele[0].nazev
        : t("matches", "filterFormPickCount", { count: String(zadavatele.length) });

  const industrySummary =
    industryTags.length === 0
      ? t("matches", "filterFormPickEmpty")
      : t("matches", "filterFormPickCount", { count: String(industryTags.length) });

  const cpvSummary =
    cpvPrefixes.length === 0
      ? t("matches", "filterFormPickEmpty")
      : t("matches", "filterFormPickCount", { count: String(cpvPrefixes.length) });

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={screenOptions} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Step 1: Name */}
          <View style={styles.field}>
            <Text style={styles.stepLabel}>{t("matches", "filterFormStep1")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("matches", "filterFormNamePlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />
          </View>

          {/* Step 2: Mode tabs + content */}
          <View style={styles.field}>
            <Text style={styles.stepLabel}>{t("matches", "filterFormStep2")}</Text>
            <View style={styles.modeRow}>
              <ModeTab
                styles={styles}
                label={t("matches", "filterFormModeKeywords")}
                active={mode === "keywords"}
                onPress={() => setMode("keywords")}
              />
              <ModeTab
                styles={styles}
                label={t("matches", "filterFormModeIndustry")}
                active={mode === "industry"}
                onPress={() => setMode("industry")}
              />
              <ModeTab
                styles={styles}
                label={t("matches", "filterFormModeCpv")}
                active={mode === "cpv"}
                onPress={() => setMode("cpv")}
              />
            </View>

            {mode === "keywords" && (
              <View style={styles.modeContent}>
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
            )}

            {mode === "industry" && (
              <Pressable
                onPress={() => setCategoryPickerOpen(true)}
                style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
              >
                <Text
                  style={[
                    styles.pickerRowText,
                    industryTags.length === 0 && styles.pickerRowEmpty,
                  ]}
                >
                  {industrySummary}
                </Text>
                <Text style={styles.pickerRowChevron}>›</Text>
              </Pressable>
            )}

            {mode === "cpv" && (
              <Pressable
                onPress={() => setCpvPickerOpen(true)}
                style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
              >
                <Text
                  style={[
                    styles.pickerRowText,
                    cpvPrefixes.length === 0 && styles.pickerRowEmpty,
                  ]}
                >
                  {cpvSummary}
                </Text>
                <Text style={styles.pickerRowChevron}>›</Text>
              </Pressable>
            )}
          </View>

          {/* Step 3: Value range */}
          <View style={styles.field}>
            <Text style={styles.stepLabel}>{t("matches", "filterFormStep3")}</Text>
            <Pressable
              onPress={() => setValuePickerOpen(true)}
              style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
            >
              <Text
                style={[
                  styles.pickerRowText,
                  minValue == null && maxValue == null && styles.pickerRowEmpty,
                ]}
              >
                {valueSummary}
              </Text>
              <Text style={styles.pickerRowChevron}>›</Text>
            </Pressable>
          </View>

          {/* Step 4: Regions */}
          <View style={styles.field}>
            <Text style={styles.stepLabel}>{t("matches", "filterFormStep4")}</Text>
            <Pressable
              onPress={() => setRegionPickerOpen(true)}
              style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.pickerRowText}>{regionsSummary}</Text>
              <Text style={styles.pickerRowChevron}>›</Text>
            </Pressable>
          </View>

          {/* Step 5: Zadavatel (volitelné) */}
          <View style={styles.field}>
            <Text style={styles.stepLabel}>{t("matches", "filterFormStep5")}</Text>
            <Pressable
              onPress={() => setZadavatelPickerOpen(true)}
              style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.pickerRowText, zadavatele.length === 0 && styles.pickerRowEmpty]}>
                {zadavatelSummary}
              </Text>
              <Text style={styles.pickerRowChevron}>›</Text>
            </Pressable>
          </View>

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

      <RegionPickerModal
        visible={regionPickerOpen}
        initial={regions}
        onClose={() => setRegionPickerOpen(false)}
        onApply={setRegions}
      />
      <ValueRangePickerModal
        visible={valuePickerOpen}
        initialMin={minValue}
        initialMax={maxValue}
        onClose={() => setValuePickerOpen(false)}
        onApply={(min, max) => {
          setMinValue(min);
          setMaxValue(max);
        }}
      />
      <CategoryPickerModal
        visible={categoryPickerOpen}
        initial={industryTags}
        onClose={() => setCategoryPickerOpen(false)}
        onApply={setIndustryTags}
      />
      <CpvPickerModal
        visible={cpvPickerOpen}
        initial={cpvPrefixes}
        onClose={() => setCpvPickerOpen(false)}
        onApply={setCpvPrefixes}
      />
      <ZadavatelPickerModal
        visible={zadavatelPickerOpen}
        initial={zadavatele}
        onClose={() => setZadavatelPickerOpen(false)}
        onApply={setZadavatele}
      />
    </SafeAreaView>
  );
}

function ModeTab({
  styles,
  label,
  active,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeTab,
        active && styles.modeTabActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    field: { marginBottom: spacing.lg },
    stepLabel: {
      fontSize: fontSize.sm,
      fontWeight: "700",
      color: colors.text,
      marginBottom: spacing.sm,
    },
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
    modeRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
    modeTab: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
    },
    modeTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    modeTabText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
    modeTabTextActive: { color: colors.accentForeground, fontWeight: "600" },
    modeContent: {},
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    pickerRowText: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    pickerRowEmpty: { color: colors.textSubtle, fontWeight: "400" },
    pickerRowChevron: { fontSize: 20, color: colors.textSubtle, fontWeight: "300", marginLeft: spacing.sm },
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
