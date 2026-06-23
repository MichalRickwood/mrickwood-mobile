import { useMemo, useState } from "react";
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

/**
 * Cross-border výběr firmy — zrcadlí webový CompanyLookup. Výběr země → lookup
 * (CZ/SK/FR full přes ARES/RPO/SIRENE, ostatní EU přes VIES) přes veřejný
 * /api/public/company-lookup; GB/jiné = ruční zadání. Lze přepnout na ruční
 * v jakékoli zemi.
 */

// Země s API lookupem (ostatní = ruční). Pořadí ~jako web.
const LOOKUP_COUNTRIES = [
  "CZ", "SK", "DE", "AT", "PL", "HU", "BE", "BG", "CY", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "RO", "SE", "SI",
];
// Země bez free API ani VIES → vždy ruční.
const MANUAL_ONLY = ["GB"];
const ALL_COUNTRIES = [...LOOKUP_COUNTRIES, ...MANUAL_ONLY, "OTHER"];

function defaultCountry(locale: string): string {
  return locale === "de" ? "DE" : locale === "sk" ? "SK" : "CZ";
}
function flagUrl(iso: string): string {
  return `https://flagcdn.com/24x18/${iso.toLowerCase()}.png`;
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
  const [id, setId] = useState(value.ico);
  const [looking, setLooking] = useState(false);
  const [status, setStatus] = useState<"idle" | "found" | "notfound">(value.name ? "found" : "idle");
  const [companyName, setCompanyName] = useState(value.name);
  const [address, setAddress] = useState(value.address);
  const [manual, setManual] = useState(false);

  const isManualCountry = country === "OTHER" || MANUAL_ONLY.includes(country) || !LOOKUP_COUNTRIES.includes(country);
  const isLookup = !isManualCountry && !manual;

  function pickCountry(iso: string) {
    setCountry(iso);
    setModalOpen(false);
    setId("");
    setCompanyName("");
    setAddress("");
    setStatus("idle");
    setManual(false);
    onChange({ country: iso === "OTHER" ? "" : iso, ico: "", name: "", address: "", dic: "" });
  }

  async function doLookup() {
    const clean = id.replace(/\s/g, "");
    if (!clean) return;
    setLooking(true);
    try {
      const r = await endpoints.companyLookup(country, { id: clean });
      if (r.found) {
        setStatus("found");
        // VIES (DE/AT/ES) vrací maskovaný/prázdný název ("---") kvůli ochraně
        // dat — VAT je ověřený, ale název/adresu doplní uživatel ručně.
        const validName = r.name && r.name.replace(/[-\s]/g, "").length > 1 ? r.name : "";
        const nm = validName || companyName;
        const ad = r.address || address;
        setCompanyName(nm);
        setAddress(ad);
        onChange({
          country,
          ico: r.taxId || clean,
          name: nm,
          address: ad,
          dic: r.vatNumber || "",
        });
      } else {
        setStatus("notfound");
        onChange({ country, ico: clean, name: companyName, address, dic: "" });
      }
    } finally {
      setLooking(false);
    }
  }

  // Ruční editace name/address (lookup found-bez-dat, notfound, nebo manuální země).
  function setManualField(field: "name" | "address" | "id", v: string) {
    if (field === "name") {
      setCompanyName(v);
      onChange({ ...value, country: country === "OTHER" ? "" : country, name: v });
    } else if (field === "address") {
      setAddress(v);
      onChange({ ...value, country: country === "OTHER" ? "" : country, address: v });
    } else {
      setId(v);
      onChange({ ...value, country: country === "OTHER" ? "" : country, ico: v });
    }
  }

  const showManualFields = isManualCountry || manual || status === "found" || status === "notfound";

  const CountryButton = (
    <Pressable style={styles.countryBtn} onPress={() => setModalOpen(true)}>
      {country !== "OTHER" && <Image source={{ uri: flagUrl(country) }} style={styles.flag} />}
      <Text style={styles.countryCode}>{country}</Text>
      <Text style={styles.chevron}>▾</Text>
    </Pressable>
  );

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{t("companyLookup", "label")}</Text>
        {!isManualCountry && (
          <Pressable onPress={() => setManual((m) => !m)} hitSlop={6}>
            <Text style={styles.manualToggle}>
              {manual ? t("companyLookup", "useLookup") : t("companyLookup", "manualToggle")}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Lookup země: země + ID/VAT + Ověřit */}
      {isLookup ? (
        <View style={styles.row}>
          {CountryButton}
          <TextInput
            value={id}
            onChangeText={(v) => {
              setId(v);
              if (status !== "idle") setStatus("idle");
            }}
            placeholder={t("companyLookup", "idPlaceholder")}
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { flex: 1 }]}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Pressable
            onPress={doLookup}
            disabled={looking || !id.trim()}
            style={({ pressed }) => [styles.verifyBtn, (looking || !id.trim()) && { opacity: 0.5 }, pressed && { opacity: 0.7 }]}
          >
            {looking ? (
              <ActivityIndicator color={colors.accentForeground} size="small" />
            ) : (
              <Text style={styles.verifyText}>{t("companyLookup", "verify")}</Text>
            )}
          </Pressable>
        </View>
      ) : (
        // Ruční země: země + tax ID
        <View style={styles.row}>
          {CountryButton}
          <TextInput
            value={id}
            onChangeText={(v) => setManualField("id", v)}
            placeholder={t("companyLookup", "taxIdPlaceholder")}
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { flex: 1 }]}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
      )}

      {status === "found" && companyName ? (
        <Text style={styles.foundText}>✓ {companyName}</Text>
      ) : status === "notfound" ? (
        <Text style={styles.hint}>{t("companyLookup", "notFound")}</Text>
      ) : null}

      {/* Ruční pole name/address (manuální země, override, nebo když lookup nevrátil) */}
      {showManualFields && (
        <View style={styles.manualFields}>
          <TextInput
            value={companyName}
            onChangeText={(v) => setManualField("name", v)}
            placeholder={t("companyLookup", "namePlaceholder")}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCapitalize="words"
          />
          <TextInput
            value={address}
            onChangeText={(v) => setManualField("address", v)}
            placeholder={t("companyLookup", "addressPlaceholder")}
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { marginTop: spacing.sm }]}
          />
        </View>
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
