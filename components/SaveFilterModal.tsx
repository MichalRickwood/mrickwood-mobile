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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { CZ_REGIONS } from "@/lib/nuts-cz";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import type { AdHocFilter } from "@/lib/ad-hoc-filter";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

interface Props {
  visible: boolean;
  adHoc: AdHocFilter;
  onClose: () => void;
  /** Callback po úspěšném uložení — caller přepne na nový filtr a vyčistí adhoc. */
  onSaved: (newFilterId: string) => void;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} mil`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} tis`;
  return String(n);
}

export default function SaveFilterModal({ visible, adHoc, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName("");
      setError(null);
    }
  }, [visible]);

  const create = useMutation({
    mutationFn: (input: Parameters<typeof endpoints.createFilter>[0]) =>
      endpoints.createFilter(input),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["filters"] });
      onSaved(res.filter.id);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Uložení selhalo.");
    },
  });

  function submit() {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Zadejte název filtru (alespoň 2 znaky).");
      return;
    }
    create.mutate({
      name: trimmed,
      regions: adHoc.regions,
      categories: adHoc.cpvPrefixes,
      industryTags: adHoc.industryTags,
      minValue: adHoc.minValue,
      maxValue: adHoc.maxValue,
      emailDigest: true,
    });
  }

  const regionLabels = useMemo(
    () =>
      adHoc.regions
        .map((c) => CZ_REGIONS.find((r) => r.code === c)?.labels.cs ?? c)
        .join(", "),
    [adHoc.regions],
  );

  const hasDeadline = !!(adHoc.deadlineFrom || adHoc.deadlineTo);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Uložit jako filtr</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Název filtru (např. Stavby Praha)"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <ScrollView style={styles.summary} showsVerticalScrollIndicator={false}>
            {adHoc.regions.length > 0 && (
              <SummaryRow styles={styles} label="Regiony" value={regionLabels} />
            )}
            {(adHoc.minValue != null || adHoc.maxValue != null) && (
              <SummaryRow
                styles={styles}
                label="Hodnota"
                value={`${adHoc.minValue ? `od ${formatMoney(adHoc.minValue)}` : ""}${
                  adHoc.minValue && adHoc.maxValue ? " " : ""
                }${adHoc.maxValue ? `do ${formatMoney(adHoc.maxValue)}` : ""} Kč`}
              />
            )}
            {adHoc.industryTags.length > 0 && (
              <SummaryRow
                styles={styles}
                label="Kategorie"
                value={`${adHoc.industryTags.length} tagů`}
              />
            )}
            {adHoc.cpvPrefixes.length > 0 && (
              <SummaryRow
                styles={styles}
                label="CPV"
                value={adHoc.cpvPrefixes.join(", ")}
              />
            )}
            {hasDeadline && (
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>
                  ⚠ Lhůta podání se neuloží — je jen pro dočasný filtr.
                </Text>
              </View>
            )}
          </ScrollView>

          {error && (
            <Text style={styles.error} numberOfLines={3}>
              {error}
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onClose}
              disabled={create.isPending}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Zrušit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              disabled={create.isPending}
              style={[styles.saveBtn, create.isPending && { opacity: 0.6 }]}
            >
              {create.isPending ? (
                <ActivityIndicator color={colors.accentForeground} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Uložit</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </TouchableOpacity>
    </Modal>
  );
}

function SummaryRow({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
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
      maxWidth: 400,
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
    summary: { marginTop: spacing.md, maxHeight: 240 },
    summaryRow: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    summaryLabel: {
      fontSize: fontSize.xs,
      color: colors.textSubtle,
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    summaryValue: { fontSize: fontSize.sm, color: colors.text, marginTop: 2 },
    warnBox: {
      marginTop: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.warningBg,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    warnText: { fontSize: fontSize.xs, color: colors.warning },
    error: {
      fontSize: fontSize.sm,
      color: colors.danger,
      marginTop: spacing.md,
      textAlign: "center",
    },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    cancelBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelBtnText: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: "500" },
    saveBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: "center",
      borderRadius: radius.md,
      backgroundColor: colors.accent,
    },
    saveBtnText: { fontSize: fontSize.sm, color: colors.accentForeground, fontWeight: "600" },
  });
