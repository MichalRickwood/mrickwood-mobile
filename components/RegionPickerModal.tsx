import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { CZ_REGIONS, regionLabel } from "@/lib/nuts-cz";
import { endpoints } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

interface Props {
  visible: boolean;
  initial: string[];
  onClose: () => void;
  onApply: (regions: string[]) => void;
}

const COUNTRY_LABELS: Record<string, { cs: string; en: string; de: string }> = {
  CZ: { cs: "Česká republika", en: "Czech Republic", de: "Tschechien" },
  SK: { cs: "Slovensko", en: "Slovakia", de: "Slowakei" },
  DE: { cs: "Německo", en: "Germany", de: "Deutschland" },
  AT: { cs: "Rakousko", en: "Austria", de: "Österreich" },
  PL: { cs: "Polsko", en: "Poland", de: "Polen" },
  FR: { cs: "Francie", en: "France", de: "Frankreich" },
  ES: { cs: "Španělsko", en: "Spain", de: "Spanien" },
  IT: { cs: "Itálie", en: "Italy", de: "Italien" },
  NL: { cs: "Nizozemsko", en: "Netherlands", de: "Niederlande" },
  BE: { cs: "Belgie", en: "Belgium", de: "Belgien" },
  PT: { cs: "Portugalsko", en: "Portugal", de: "Portugal" },
  SE: { cs: "Švédsko", en: "Sweden", de: "Schweden" },
  FI: { cs: "Finsko", en: "Finland", de: "Finnland" },
  DK: { cs: "Dánsko", en: "Denmark", de: "Dänemark" },
  IE: { cs: "Irsko", en: "Ireland", de: "Irland" },
  NO: { cs: "Norsko", en: "Norway", de: "Norwegen" },
  CH: { cs: "Švýcarsko", en: "Switzerland", de: "Schweiz" },
};

function countryName(iso: string, locale: string): string {
  const l = COUNTRY_LABELS[iso];
  if (!l) return iso;
  return l[locale as "cs" | "en" | "de"] ?? l.en;
}

export default function RegionPickerModal({ visible, initial, onClose, onApply }: Props) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initial);
  const [activeCountries, setActiveCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setSelected(initial);
    setLoading(true);
    (async () => {
      try {
        const subs = await endpoints.listSubscriptions();
        const codes = subs
          .filter((s) => s.service === "LEADS" && s.scope && s.state !== "CANCELED" && s.state !== "SUSPENDED")
          .map((s) => s.scope as string);
        const unique = Array.from(new Set(codes));
        // CZ first, pak ostatní abecedně
        unique.sort((a, b) => (a === "CZ" ? -1 : b === "CZ" ? 1 : a.localeCompare(b)));
        setActiveCountries(unique.length > 0 ? unique : ["CZ"]);
      } catch {
        setActiveCountries(["CZ"]);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, initial]);

  function toggle(code: string) {
    setSelected((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));
  }

  // CZ má NUTS-3 chips (14 krajů), ostatní země mají jeden "Celá země" chip
  // s ISO codem (backend matchuje na t.country).
  function chipsForCountry(country: string): { code: string; label: string }[] {
    if (country === "CZ") {
      return CZ_REGIONS.map((r) => ({ code: r.code, label: regionLabel(r.code, locale) }));
    }
    return [{ code: country, label: t("matches", "filterFormAllRegions") }];
  }

  function selectAllInCountry(country: string) {
    const chips = chipsForCountry(country);
    const codes = chips.map((c) => c.code);
    const allSelected = codes.every((c) => selected.includes(c));
    if (allSelected) {
      setSelected((prev) => prev.filter((c) => !codes.includes(c)));
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...codes])));
    }
  }

  function handleAddCountry() {
    onClose();
    router.push("/(onboarding)/countries");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("matches", "filterFormRegions")}</Text>
          {loading ? (
            <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
              <ActivityIndicator color={colors.textSubtle} />
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {activeCountries.map((country) => {
                const chips = chipsForCountry(country);
                const codes = chips.map((c) => c.code);
                const allSelectedHere = codes.every((c) => selected.includes(c));
                const selectedCountHere = codes.filter((c) => selected.includes(c)).length;
                return (
                  <View key={country} style={styles.countrySection}>
                    <Pressable
                      onPress={() => selectAllInCountry(country)}
                      style={({ pressed }) => [styles.countryHeader, pressed && { opacity: 0.85 }]}
                    >
                      <Image
                        source={{ uri: `https://flagcdn.com/24x18/${country.toLowerCase()}.png` }}
                        style={styles.flag}
                      />
                      <Text style={styles.countryName}>{countryName(country, locale)}</Text>
                      <Text style={styles.countryCount}>
                        {selectedCountHere}/{codes.length}
                      </Text>
                      <View style={[styles.countryCheck, allSelectedHere && styles.countryCheckOn]}>
                        {allSelectedHere && <Text style={styles.countryCheckMark}>✓</Text>}
                      </View>
                    </Pressable>
                    <View style={styles.grid}>
                      {chips.map((c) => {
                        const active = selected.includes(c.code);
                        return (
                          <Pressable
                            key={c.code}
                            onPress={() => toggle(c.code)}
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {c.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
              <Pressable onPress={handleAddCountry} style={styles.addCountryBtn}>
                <Text style={styles.addCountryText}>＋ {t("settings", "billingAddCountry")}</Text>
              </Pressable>
            </ScrollView>
          )}
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
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing.xl },
    card: { width: "100%", maxWidth: 420, maxHeight: "85%", backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
    title: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, marginBottom: spacing.md, textAlign: "center" },
    body: { maxHeight: 500 },
    countrySection: { marginBottom: spacing.lg },
    countryHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.bg, marginBottom: spacing.sm },
    flag: { width: 24, height: 18, borderRadius: 2 },
    countryName: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    countryCount: { fontSize: fontSize.xs, color: colors.textSubtle, marginRight: spacing.xs },
    countryCheck: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    countryCheckOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    countryCheckMark: { color: colors.accentForeground, fontSize: 12, fontWeight: "700" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
    chipTextActive: { color: colors.accentForeground, fontWeight: "600" },
    addCountryBtn: { marginTop: spacing.md, paddingVertical: spacing.sm + 2, alignItems: "center", borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border },
    addCountryText: { fontSize: fontSize.sm, color: colors.link, fontWeight: "500" },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    clearBtn: { flex: 1, paddingVertical: spacing.md, alignItems: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
    clearBtnText: { fontSize: fontSize.sm, color: colors.textSubtle, fontWeight: "500" },
    applyBtn: { flex: 1, paddingVertical: spacing.md, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.accent },
    applyBtnText: { fontSize: fontSize.sm, color: colors.accentForeground, fontWeight: "600" },
  });
