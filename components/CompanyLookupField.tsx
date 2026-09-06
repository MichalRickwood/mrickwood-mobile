import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  FULL_COVERAGE_COUNTRIES,
  lookupCompanyById,
  searchCompaniesByName,
  type CompanySearchResult,
} from "@/lib/company-lookup";
import { reportyApi, type SubjektRow } from "@/lib/reporty-api";
import { cislo, jeSmeti, zkrat } from "@/lib/reporty-format";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { fontSize, radius, spacing, type Colors } from "@/constants/theme";

const DEBOUNCE_MS = 300;

export interface CompanyLookupResult {
  taxId: string;
  name: string;
  address: string;
  vatNumber?: string | null;
  /** Dál jen ze zdroje `reporty` — volající podle toho otevře profil nebo doplní filtr. */
  country?: string;
  /** false = firma je z rejstříku, ale v datech o zakázkách ji zatím nemáme. */
  vNasichDatech?: boolean;
  jeDodavatel?: boolean;
  jeZadavatel?: boolean;
}

/** Řádek našeptávače — sjednocuje fakturační rejstříky a náš registr firem. */
type Navrh = CompanySearchResult & {
  vatNumber?: string | null;
  vNasichDatech?: boolean;
  jeDodavatel?: boolean;
  jeZadavatel?: boolean;
  vyher?: number;
  nabidek?: number;
  zadani?: number;
  zanik?: string | null;
};

interface Props {
  country: string;
  /** Aktuální IČO/Tax ID — input se sync z props (např. po async loadu). */
  value: string;
  /** Pokud je vyplněn IČO i název → zobrazíme "chip" (vyřešeno) místo search inputu. */
  resolvedName: string;
  onResolve: (data: CompanyLookupResult) => void;
  /** Volá se když user smaže výběr (X v chipu) — caller by měl nullovat ico/name/address/dic. */
  onClear: () => void;
  label: string;
  placeholder?: string;
  /**
   * Odkud brát návrhy.
   *  - `fakturace` (výchozí) — rejstříky pro fakturační údaje (ARES, VIES, SIRENE…);
   *    fulltext umí jen CZ/SK/FR, jinde se hledá podle IČO.
   *  - `reporty` — náš registr firem ze zakázek (+ ARES u ČR). Funguje pro všechny
   *    země, které Reporty nabízejí, a u každé firmy rovnou ukáže, kolik toho má v datech.
   */
  zdroj?: "fakturace" | "reporty";
  /** Reporty: skryje firmy, které v našich datech nejsou (do filtrů, kde by nedávaly smysl). */
  jenNaseData?: boolean;
}

/**
 * Mobilní varianta web CompanyLookup. Pro CZ/SK/FR jednotné pole "search by
 * name OR ID" — debounce → fetch → dropdown výsledků pod inputem. Pro ostatní
 * země pouze byId lookup (digits → fetch).
 */
export default function CompanyLookupField({
  country,
  value,
  resolvedName,
  onResolve,
  onClear,
  label,
  placeholder,
  zdroj = "fakturace",
  jenNaseData = false,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Navrh[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync z props když caller načte data async (init z DB)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Reset výsledků při změně země
  useEffect(() => {
    setResults([]);
    setShowResults(false);
    setError(null);
  }, [country]);

  const jeReporty = zdroj === "reporty";
  const isFullCoverage = (FULL_COVERAGE_COUNTRIES as readonly string[]).includes(country);
  const idDigitLen = country === "FR" ? 9 : 8;

  /** Náš registr firem ze zakázek — jediný zdroj, který pokrývá všechny země Reportů. */
  async function hledejVRegistru(q: string, signal: AbortSignal): Promise<Navrh[]> {
    const r = await reportyApi.subjektHledani(country, q, signal);
    return (r.subjekty ?? [])
      .filter((x: SubjektRow) => !jeSmeti(x.name))
      .filter((x: SubjektRow) => !jenNaseData || x.vNasichDatech !== false)
      .map((x: SubjektRow) => ({
        taxId: x.reg_no ? String(x.reg_no) : "",
        country: String(x.country ?? country),
        name: String(x.name ?? ""),
        address: x.sidlo ?? "",
        vNasichDatech: x.vNasichDatech !== false,
        jeDodavatel: !!Number(x.is_supplier),
        jeZadavatel: !!Number(x.is_buyer),
        vyher: Number(x.n_won) || 0,
        nabidek: Number(x.n_bids) || 0,
        zadani: Number(x.n_awarded) || 0,
        zanik: x.zanik ?? null,
      }));
  }

  function trigger(q: string) {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);
    setError(null);
    const clean = q.replace(/\s/g, "");
    const isDigits = /^\d+$/.test(clean) && clean.length > 0;

    const promise: Promise<Navrh[]> = jeReporty
      ? hledejVRegistru(q, ctrl.signal)
      : isDigits && clean.length === idDigitLen
        ? lookupCompanyById(country, clean, ctrl.signal).then((r) =>
            r.found
              ? [
                  {
                    taxId: r.taxId,
                    country: r.country,
                    name: r.name,
                    address: r.address,
                    vatNumber: r.vatNumber ?? null,
                  },
                ]
              : [],
          )
        : isFullCoverage && q.length >= 3 && !isDigits
          ? searchCompaniesByName(country, q, ctrl.signal)
          : Promise.resolve([]);

    promise
      .then((items) => {
        if (ctrl.signal.aborted) return;
        setResults(items);
        setShowResults(items.length > 0);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setError((e as Error).message);
        setResults([]);
        setShowResults(false);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setSearching(false);
      });
  }

  function onChangeText(v: string) {
    setQuery(v);
    onClear?.();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!v.trim()) {
      setResults([]);
      setShowResults(false);
      setSearching(false);
      return;
    }
    debounceTimer.current = setTimeout(() => trigger(v.trim()), DEBOUNCE_MS);
  }

  function selectResult(r: Navrh) {
    // V Reportech se firma může vést jen pod názvem (bez IČO) — do pole patří to,
    // co uživatele identifikuje, ne prázdný řetězec.
    setQuery(jeReporty ? r.taxId || r.name : r.taxId);
    setShowResults(false);
    setResults([]);
    onResolve({
      taxId: r.taxId,
      name: r.name,
      address: r.address,
      vatNumber: r.vatNumber ?? null,
      country: r.country,
      vNasichDatech: r.vNasichDatech,
      jeDodavatel: r.jeDodavatel,
      jeZadavatel: r.jeZadavatel,
    });
  }

  function clearResolved() {
    setQuery("");
    setResults([]);
    setShowResults(false);
    setError(null);
    onClear();
  }

  const isResolved = jeReporty ? !!resolvedName : !!value && !!resolvedName;

  if (isResolved) {
    return (
      <View style={styles.wrap}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.chip}>
          <View style={styles.chipText}>
            <Text style={styles.chipName} numberOfLines={2}>
              {resolvedName}
            </Text>
            {value ? (
              <Text style={styles.chipMeta}>
                {t("settings", "billingProfileIco")} {value}
              </Text>
            ) : (
              <Text style={styles.chipMeta}>{t("admin", "repNoRegNo")}</Text>
            )}
          </View>
          <Pressable
            onPress={clearResolved}
            hitSlop={10}
            style={({ pressed }) => [styles.chipClose, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.chipCloseText}>✕</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={query}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t("settings", "billingProfileIco")}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {searching && (
        <View style={styles.searchingRow}>
          <ActivityIndicator size="small" color={colors.textSubtle} />
          <Text style={styles.searchingText}>{t("profileComplete", "lookupSearching")}</Text>
        </View>
      )}
      {showResults && results.length > 0 && (
        <View style={styles.dropdown}>
          {results.slice(0, 8).map((r, idx) => (
            <Pressable
              key={`${r.taxId}-${idx}`}
              onPress={() => selectResult(r)}
              style={({ pressed }) => [
                styles.row,
                idx < results.length - 1 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.rowName} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {[r.taxId, r.address ? zkrat(r.address, 44) : null].filter(Boolean).join(" · ") || "—"}
              </Text>
              {jeReporty ? (
                r.vNasichDatech === false ? (
                  <Text style={styles.rowWarn} numberOfLines={1}>
                    {t("admin", "repNotInOurData")}
                  </Text>
                ) : (
                  <Text style={styles.rowStats} numberOfLines={1}>
                    {t("admin", "repWins")} {cislo(r.vyher)} · {t("admin", "repParticipations")} {cislo(r.nabidek)} · {t("admin", "repAwards")} {cislo(r.zadani)}
                    {r.zanik ? ` · ${t("admin", "repDefunct")}` : ""}
                  </Text>
                )
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
      {!searching && !showResults && error && (
        <Text style={styles.error}>{t("profileComplete", "lookupError", { message: error })}</Text>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: {},
    label: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: "500", marginBottom: spacing.xs },
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
    searchingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
    searchingText: { fontSize: fontSize.xs, color: colors.textSubtle },
    dropdown: {
      marginTop: spacing.xs,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    rowPressed: { backgroundColor: colors.bg },
    rowName: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
    rowMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    rowStats: { fontSize: 10, color: colors.textFaint, marginTop: 1 },
    rowWarn: { fontSize: 10, color: colors.warning, marginTop: 1, fontWeight: "600" },
    error: { fontSize: fontSize.xs, color: colors.warning, marginTop: spacing.xs },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    chipText: { flex: 1, paddingRight: spacing.sm },
    chipName: { fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
    chipMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
    chipClose: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
    chipCloseText: { fontSize: fontSize.base, color: colors.textSubtle },
  });
