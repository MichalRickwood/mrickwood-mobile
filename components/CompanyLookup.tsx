import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { endpoints } from "@/lib/endpoints";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

export interface CompanyData {
  country: string; // ISO 3166-1 alpha-2 ("" = OTHER/nezvoleno)
  ico: string; // IČO / VAT / local tax ID
  name: string;
  address: string;
  dic: string; // DIČ / EU VAT ("CZ14235111")
}

interface SearchRow {
  taxId: string;
  name: string;
  address: string;
}

/**
 * Cross-border výběr firmy — zrcadlí webový CompanyLookup. 3 režimy dle země:
 *  - CZ/SK/FR (full): kombinované vyhledávání podle NÁZVU i IČO + dropdown (ARES/RPO/SIRENE)
 *  - ostatní EU: ověření DIČ (VAT) přes VIES, nebo ruční zadání
 *  - GB/jiné: ruční zadání
 * Lookup přes veřejný /api/public/company-lookup. Ruční lze v jakékoli zemi.
 */

const LOOKUP_COUNTRIES = [
  "CZ", "SK", "DE", "AT", "PL", "HU", "BE", "BG", "CY", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "RO", "SE", "SI",
];
const FULL_COVERAGE = ["CZ", "SK", "FR"];
const MANUAL_ONLY = ["GB"];
const ALL_COUNTRIES = [...LOOKUP_COUNTRIES, ...MANUAL_ONLY, "OTHER"];

function defaultCountry(locale: string): string {
  return locale === "de" ? "DE" : locale === "sk" ? "SK" : "CZ";
}
function flagUrl(iso: string): string {
  return `https://flagcdn.com/24x18/${iso.toLowerCase()}.png`;
}
function idDigitLen(c: string): number {
  return c === "FR" ? 9 : 8; // CZ/SK IČO = 8, FR SIREN = 9
}

export default function CompanyLookup({
  value,
  onChange,
}: {
  value: CompanyData;
  onChange: (d: CompanyData) => void;
}) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [country, setCountry] = useState(value.country || defaultCountry(locale));
  const [modalOpen, setModalOpen] = useState(false);
  const [manual, setManual] = useState(false);

  // Full-coverage: kombinované vyhledávání (název + IČO)
  const [query, setQuery] = useState(
    value.name && value.country && FULL_COVERAGE.includes(value.country)
      ? `${value.name} (${value.ico})`
      : "",
  );
  const [selected, setSelected] = useState(
    !!value.name && FULL_COVERAGE.includes(value.country),
  );
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // EU VIES
  const [vat, setVat] = useState(value.dic || "");
  const [viesStatus, setViesStatus] = useState<"idle" | "loading" | "found" | "notfound">(
    value.name && !FULL_COVERAGE.includes(value.country) ? "found" : "idle",
  );

  // Ruční / editovatelné name+address
  const [companyName, setCompanyName] = useState(value.name);
  const [address, setAddress] = useState(value.address);
  const [taxId, setTaxId] = useState(value.ico);

  const isFullCoverage = FULL_COVERAGE.includes(country) && !manual;
  const isEuVies =
    LOOKUP_COUNTRIES.includes(country) &&
    !FULL_COVERAGE.includes(country) &&
    !MANUAL_ONLY.includes(country) &&
    !manual;
  const isManual = !isFullCoverage && !isEuVies;

  function pickCountry(iso: string) {
    setCountry(iso);
    setModalOpen(false);
    setManual(false);
    setQuery("");
    setSelected(false);
    setResults([]);
    setVat("");
    setViesStatus("idle");
    setCompanyName("");
    setAddress("");
    setTaxId("");
    onChange({ country: iso === "OTHER" ? "" : iso, ico: "", name: "", address: "", dic: "" });
  }

  // ── Full-coverage: search by name / byId ──────────────────────────────────
  async function runSearch(q: string) {
    setSearching(true);
    try {
      const r = await endpoints.companyLookup(country, { q });
      setResults(r.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }
  async function runById(id: string) {
    setSearching(true);
    try {
      const r = await endpoints.companyLookup(country, { id });
      setResults(r.found && r.name ? [{ taxId: r.taxId ?? id, name: r.name, address: r.address ?? "" }] : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }
  function onQueryChange(v: string) {
    setQuery(v);
    setSelected(false);
    onChange({ country, ico: "", name: "", address: "", dic: "" });
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const clean = v.replace(/\s/g, "");
    if (/^\d+$/.test(clean) && clean.length > 0) {
      if (clean.length === idDigitLen(country)) {
        searchTimer.current = setTimeout(() => runById(clean), 250);
      } else {
        setResults([]);
      }
    } else if (v.trim().length >= 3) {
      searchTimer.current = setTimeout(() => runSearch(v.trim()), 350);
    } else {
      setResults([]);
    }
  }
  function selectResult(c: SearchRow) {
    setQuery(`${c.name} (${c.taxId})`);
    setSelected(true);
    setResults([]);
    onChange({ country, ico: c.taxId, name: c.name, address: c.address, dic: "" });
  }

  // ── EU VIES ───────────────────────────────────────────────────────────────
  async function runVies() {
    if (!vat.trim()) return;
    setViesStatus("loading");
    try {
      const r = await endpoints.companyLookup(country, { id: vat.trim() });
      if (r.found) {
        setViesStatus("found");
        const validName = r.name && r.name.replace(/[-\s]/g, "").length > 1 ? r.name : "";
        const nm = validName || companyName;
        const ad = r.address || address;
        setCompanyName(nm);
        setAddress(ad);
        onChange({ country, ico: r.taxId || vat.trim(), name: nm, address: ad, dic: r.vatNumber || vat.trim() });
      } else {
        setViesStatus("notfound");
        onChange({ country, ico: vat.trim(), name: companyName, address, dic: "" });
      }
    } catch {
      setViesStatus("notfound");
    }
  }

  function editField(field: "name" | "address" | "taxId", v: string) {
    const c = country === "OTHER" ? "" : country;
    if (field === "name") {
      setCompanyName(v);
      onChange({ ...value, country: c, name: v });
    } else if (field === "address") {
      setAddress(v);
      onChange({ ...value, country: c, address: v });
    } else {
      setTaxId(v);
      onChange({ ...value, country: c, ico: v });
    }
  }

  const CountryButton = (
    <Pressable style={styles.countryBtn} onPress={() => setModalOpen(true)}>
      {country !== "OTHER" && <Image source={{ uri: flagUrl(country) }} style={styles.flag} />}
      <Text style={styles.countryCode}>{country}</Text>
      <Text style={styles.chevron}>▾</Text>
    </Pressable>
  );

  const euManualFields = (viesStatus === "found" || viesStatus === "notfound") && (
    <View style={styles.manualFields}>
      <TextInput
        value={companyName}
        onChangeText={(v) => editField("name", v)}
        placeholder={t("companyLookup", "namePlaceholder")}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        autoCapitalize="words"
      />
      <TextInput
        value={address}
        onChangeText={(v) => editField("address", v)}
        placeholder={t("companyLookup", "addressPlaceholder")}
        placeholderTextColor={colors.textFaint}
        style={[styles.input, { marginTop: spacing.sm }]}
      />
    </View>
  );

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{t("companyLookup", "label")}</Text>
        {!MANUAL_ONLY.includes(country) && country !== "OTHER" && (
          <Pressable onPress={() => setManual((m) => !m)} hitSlop={6}>
            <Text style={styles.manualToggle}>
              {manual ? t("companyLookup", "useLookup") : t("companyLookup", "manualToggle")}
            </Text>
          </Pressable>
        )}
      </View>

      {/* ── CZ/SK/FR — kombinované vyhledávání (název + IČO) ── */}
      {isFullCoverage && (
        <>
          <View style={styles.row}>
            {CountryButton}
            <View style={{ flex: 1 }}>
              <TextInput
                value={query}
                onChangeText={onQueryChange}
                editable={!selected}
                placeholder={t("companyLookup", "searchPlaceholder")}
                placeholderTextColor={colors.textFaint}
                style={[styles.input, selected && styles.inputSelected]}
                autoCorrect={false}
              />
              {searching && (
                <ActivityIndicator size="small" color={colors.textSubtle} style={styles.inputSpinner} />
              )}
              {selected && (
                <Pressable
                  onPress={() => {
                    setQuery("");
                    setSelected(false);
                    onChange({ country, ico: "", name: "", address: "", dic: "" });
                  }}
                  style={styles.clearBtn}
                  hitSlop={8}
                >
                  <Text style={styles.clearX}>✕</Text>
                </Pressable>
              )}
            </View>
          </View>
          {!selected && results.length > 0 && (
            <View style={styles.dropdown}>
              <FlatList
                data={results}
                keyExtractor={(r, i) => `${r.taxId}-${i}`}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 200 }}
                renderItem={({ item }) => (
                  <Pressable style={styles.resultRow} onPress={() => selectResult(item)}>
                    <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.resultMeta} numberOfLines={1}>
                      {item.taxId}{item.address ? ` · ${item.address}` : ""}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          )}
        </>
      )}

      {/* ── Ostatní EU — VIES (DIČ) + ručně ── */}
      {isEuVies && (
        <>
          <View style={styles.row}>
            {CountryButton}
            <TextInput
              value={vat}
              onChangeText={(v) => {
                setVat(v.toUpperCase());
                if (viesStatus !== "idle") setViesStatus("idle");
              }}
              placeholder={t("companyLookup", "vatPlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={[styles.input, { flex: 1 }]}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Pressable
              onPress={runVies}
              disabled={viesStatus === "loading" || !vat.trim()}
              style={({ pressed }) => [styles.verifyBtn, (viesStatus === "loading" || !vat.trim()) && { opacity: 0.5 }, pressed && { opacity: 0.7 }]}
            >
              {viesStatus === "loading" ? (
                <ActivityIndicator color={colors.accentForeground} size="small" />
              ) : (
                <Text style={styles.verifyText}>{t("companyLookup", "verify")}</Text>
              )}
            </Pressable>
          </View>
          {viesStatus === "found" && companyName ? (
            <Text style={styles.foundText}>✓ {companyName}</Text>
          ) : viesStatus === "found" ? (
            <Text style={styles.hint}>{t("companyLookup", "viesVerified")}</Text>
          ) : viesStatus === "notfound" ? (
            <Text style={styles.hint}>{t("companyLookup", "notFound")}</Text>
          ) : (
            <Text style={styles.hint}>{t("companyLookup", "viesHint")}</Text>
          )}
          {euManualFields}
        </>
      )}

      {/* ── GB / jiné / ruční ── */}
      {isManual && (
        <>
          <View style={styles.row}>
            {CountryButton}
            <TextInput
              value={taxId}
              onChangeText={(v) => editField("taxId", v)}
              placeholder={t("companyLookup", "taxIdPlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={[styles.input, { flex: 1 }]}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          <View style={styles.manualFields}>
            <TextInput
              value={companyName}
              onChangeText={(v) => editField("name", v)}
              placeholder={t("companyLookup", "namePlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              autoCapitalize="words"
            />
            <TextInput
              value={address}
              onChangeText={(v) => editField("address", v)}
              placeholder={t("companyLookup", "addressPlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={[styles.input, { marginTop: spacing.sm }]}
            />
          </View>
        </>
      )}

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("companyLookup", "countryLabel")}</Text>
            <FlatList
              data={ALL_COUNTRIES}
              keyExtractor={(c) => c}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable style={styles.countryRow} onPress={() => pickCountry(item)}>
                  {item !== "OTHER" ? (
                    <Image source={{ uri: flagUrl(item) }} style={styles.flag} />
                  ) : (
                    <Text style={styles.globe}>🌐</Text>
                  )}
                  <Text style={styles.countryRowText}>
                    {item === "OTHER" ? t("companyLookup", "other") : item}
                  </Text>
                  {item === country && <Text style={styles.check}>✓</Text>}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
    label: { fontSize: fontSize.xs, color: c.textMuted, textTransform: "uppercase", fontWeight: "600" },
    manualToggle: { fontSize: fontSize.xs, color: c.link, fontWeight: "500" },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    countryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm + 2,
    },
    flag: { width: 24, height: 18, borderRadius: 2 },
    globe: { fontSize: 18, width: 24, textAlign: "center" },
    countryCode: { fontSize: fontSize.sm, color: c.text, fontWeight: "600" },
    chevron: { fontSize: 10, color: c.textSubtle },
    input: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.base,
      color: c.text,
    },
    inputSelected: { borderColor: c.success, backgroundColor: c.successBg, paddingRight: 36 },
    inputSpinner: { position: "absolute", right: spacing.md, top: 0, bottom: 0 },
    clearBtn: { position: "absolute", right: spacing.sm, top: 0, bottom: 0, justifyContent: "center", paddingHorizontal: spacing.xs },
    clearX: { color: c.textSubtle, fontSize: fontSize.base },
    dropdown: {
      marginTop: spacing.xs,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    resultRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    resultName: { fontSize: fontSize.sm, color: c.text, fontWeight: "500" },
    resultMeta: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: 1 },
    verifyBtn: {
      backgroundColor: c.accent,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 72,
    },
    verifyText: { color: c.accentForeground, fontSize: fontSize.sm, fontWeight: "600" },
    foundText: { fontSize: fontSize.xs, color: c.success, marginTop: spacing.xs, fontWeight: "500" },
    hint: { fontSize: fontSize.xs, color: c.textSubtle, marginTop: spacing.xs },
    manualFields: { marginTop: spacing.sm },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.xl },
    modalCard: { backgroundColor: c.bg, borderRadius: radius.lg, padding: spacing.lg },
    modalTitle: { fontSize: fontSize.base, fontWeight: "700", color: c.text, marginBottom: spacing.md },
    countryRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 2 },
    countryRowText: { flex: 1, fontSize: fontSize.base, color: c.text },
    check: { color: c.accent, fontSize: fontSize.base, fontWeight: "700" },
  });
