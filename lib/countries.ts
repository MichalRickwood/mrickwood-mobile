import type { Locale } from "./i18n/translations";
import { bcp47 } from "./i18n/translations";

/**
 * Země a měny pro Veritra · Reporty.
 *
 * Seznam NENÍ „všechny státy světa", ale přesně ty, pro které máme v `vt_award`
 * data — zjištěno dotazem `SELECT country, COUNT(*) FROM vt_award GROUP BY country`
 * (6. 9. 2026). Nabízet zemi, na kterou report vrátí prázdno, by byla past.
 *
 * `EU` není stát, ale zadavatelé evropských institucí (TED), a `XK` je Kosovo —
 * obojí je v datech reálně a do výběru patří.
 */

/** Kód země → počet zadání v datech. Pořadí = podle objemu dat, ne abecedy. */
export const DATA_COUNTRIES: Record<string, number> = {
  IT: 7270739, FR: 4067600, PT: 3231307, ES: 2157165, PL: 1464794, DE: 1457072,
  RO: 1090613, CZ: 959387, SK: 667530, GB: 553295, TR: 510572, LT: 448573,
  BG: 397760, HR: 336804, SI: 330501, NL: 308065, GE: 275205, HU: 235207,
  LV: 175331, MK: 174542, CH: 159508, SE: 157649, JP: 149088, AT: 134042,
  RS: 124595, IE: 101712, DK: 89881, EE: 80326, FI: 79125, XK: 66037,
  NO: 58725, BE: 51847, EU: 30408, GR: 30071, LU: 16197, CY: 15050,
  MT: 7421, IS: 6196, AL: 2643, MD: 1105, LI: 420, BA: 186,
  UA: 175, ME: 151, US: 66, CN: 40, AM: 27, AZ: 8,
};

export const COUNTRY_CODES = Object.keys(DATA_COUNTRIES);

/**
 * Národní měna země — nejčastější `currency` v jejích zadáních (tentýž dotaz
 * s `GROUP BY country, currency`). Používá se tam, kde řádek vlastní `currency`
 * nenese; když ho nese, má přednost on.
 *
 * Chorvatsko je EUR (přechod 2023, EUR už převažuje nad HRK), Bulharsko zatím BGN.
 */
export const NARODNI_MENA: Record<string, string> = {
  AL: "EUR", AM: "EUR", AT: "EUR", AZ: "EUR", BA: "EUR", BE: "EUR", BG: "BGN",
  CH: "CHF", CN: "EUR", CY: "EUR", CZ: "CZK", DE: "EUR", DK: "DKK", EE: "EUR",
  ES: "EUR", EU: "EUR", FI: "EUR", FR: "EUR", GB: "GBP", GE: "GEL", GR: "EUR",
  HR: "EUR", HU: "HUF", IE: "EUR", IS: "ISK", IT: "EUR", JP: "JPY", LI: "CHF",
  LT: "EUR", LU: "EUR", LV: "EUR", MD: "MDL", ME: "EUR", MK: "MKD", MT: "EUR",
  NL: "EUR", NO: "NOK", PL: "PLN", PT: "EUR", RO: "RON", RS: "RSD", SE: "SEK",
  SI: "EUR", SK: "EUR", TR: "TRY", UA: "EUR", US: "USD", XK: "EUR",
};

/** Měna země; neznámá země → EUR (jediná rozumná společná jednotka našich dat). */
export const menaZeme = (country: string): string =>
  NARODNI_MENA[country?.toUpperCase()] ?? "EUR";

/**
 * Vlajka jako emoji spočítaná z ISO kódu — dva regional indicator symboly.
 * Žádná knihovna ani mapa: 'C','Z' → U+1F1E8 U+1F1FF → 🇨🇿.
 * Kód, který nejsou dvě písmena (nebo který systém neumí vykreslit), zůstane textem.
 */
export function vlajka(iso: string): string {
  const k = (iso ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(k)) return "";
  return String.fromCodePoint(...[...k].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Záložní názvy — používají se, když engine nemá `Intl.DisplayNames`. */
const NAZVY_CS: Record<string, string> = {
  IT: "Itálie", FR: "Francie", PT: "Portugalsko", ES: "Španělsko", PL: "Polsko",
  DE: "Německo", RO: "Rumunsko", CZ: "Česko", SK: "Slovensko", GB: "Spojené království",
  TR: "Turecko", LT: "Litva", BG: "Bulharsko", HR: "Chorvatsko", SI: "Slovinsko",
  NL: "Nizozemsko", GE: "Gruzie", HU: "Maďarsko", LV: "Lotyšsko", MK: "Severní Makedonie",
  CH: "Švýcarsko", SE: "Švédsko", JP: "Japonsko", AT: "Rakousko", RS: "Srbsko",
  IE: "Irsko", DK: "Dánsko", EE: "Estonsko", FI: "Finsko", XK: "Kosovo",
  NO: "Norsko", BE: "Belgie", EU: "Evropská unie", GR: "Řecko", LU: "Lucembursko",
  CY: "Kypr", MT: "Malta", IS: "Island", AL: "Albánie", MD: "Moldavsko",
  LI: "Lichtenštejnsko", BA: "Bosna a Hercegovina", UA: "Ukrajina", ME: "Černá Hora",
  US: "Spojené státy", CN: "Čína", AM: "Arménie", AZ: "Ázerbájdžán",
};

const NAZVY_EN: Record<string, string> = {
  IT: "Italy", FR: "France", PT: "Portugal", ES: "Spain", PL: "Poland",
  DE: "Germany", RO: "Romania", CZ: "Czechia", SK: "Slovakia", GB: "United Kingdom",
  TR: "Türkiye", LT: "Lithuania", BG: "Bulgaria", HR: "Croatia", SI: "Slovenia",
  NL: "Netherlands", GE: "Georgia", HU: "Hungary", LV: "Latvia", MK: "North Macedonia",
  CH: "Switzerland", SE: "Sweden", JP: "Japan", AT: "Austria", RS: "Serbia",
  IE: "Ireland", DK: "Denmark", EE: "Estonia", FI: "Finland", XK: "Kosovo",
  NO: "Norway", BE: "Belgium", EU: "European Union", GR: "Greece", LU: "Luxembourg",
  CY: "Cyprus", MT: "Malta", IS: "Iceland", AL: "Albania", MD: "Moldova",
  LI: "Liechtenstein", BA: "Bosnia and Herzegovina", UA: "Ukraine", ME: "Montenegro",
  US: "United States", CN: "China", AM: "Armenia", AZ: "Azerbaijan",
};

/** Cache `Intl.DisplayNames` po locale — vytvářet ho na každý řádek seznamu je drahé. */
const displayCache = new Map<string, Intl.DisplayNames | null>();

function display(locale: string): Intl.DisplayNames | null {
  if (displayCache.has(locale)) return displayCache.get(locale) ?? null;
  let d: Intl.DisplayNames | null = null;
  try {
    // Hermes nemusí mít `Intl.DisplayNames` — pak padáme na statické názvy níž.
    d = typeof Intl !== "undefined" && "DisplayNames" in Intl
      ? new Intl.DisplayNames([locale], { type: "region" })
      : null;
  } catch {
    d = null;
  }
  displayCache.set(locale, d);
  return d;
}

/**
 * Název země v jazyce appky. `EU` a `XK` nejsou regiony podle CLDR ve všech
 * verzích ICU, proto se statická mapa zkouší i po `Intl` — vrátí-li kód zpátky
 * nezměněný, není to překlad.
 */
export function nazevZeme(iso: string, locale: Locale | string): string {
  const k = (iso ?? "").toUpperCase();
  const d = display(bcp47(String(locale)));
  if (d) {
    try {
      const n = d.of(k);
      if (n && n !== k) return n;
    } catch {
      /* neplatný kód (EU, XK) — spadneme na statickou mapu */
    }
  }
  if (String(locale).startsWith("cs")) return NAZVY_CS[k] ?? k;
  return NAZVY_EN[k] ?? NAZVY_CS[k] ?? k;
}

/** Země seřazené podle názvu v jazyce appky (řadí se podle daného jazyka, ne ASCII). */
export function zemeSerazene(locale: Locale | string): { code: string; nazev: string; vlajka: string }[] {
  const bcp = bcp47(String(locale));
  const list = COUNTRY_CODES.map((code) => ({ code, nazev: nazevZeme(code, locale), vlajka: vlajka(code) }));
  try {
    const col = new Intl.Collator(bcp);
    return list.sort((a, b) => col.compare(a.nazev, b.nazev));
  } catch {
    return list.sort((a, b) => a.nazev.localeCompare(b.nazev));
  }
}

/**
 * Výchozí země podle nastavení uživatele: region z locale zařízení (Michal má
 * CZ), jinak odvození z jazyka, jinak CZ. Bere se jen země, pro kterou máme data.
 */
export function vychoziZeme(regionCode?: string | null, languageCode?: string | null): string {
  const region = (regionCode ?? "").toUpperCase();
  if (region && region in DATA_COUNTRIES) return region;
  const jazyk = (languageCode ?? "").toLowerCase();
  const dleJazyka: Record<string, string> = {
    cs: "CZ", sk: "SK", de: "DE", it: "IT", fr: "FR", pl: "PL", nl: "NL",
    es: "ES", pt: "PT", ja: "JP", en: "GB", hu: "HU", sl: "SI", ro: "RO",
  };
  const z = dleJazyka[jazyk];
  return z && z in DATA_COUNTRIES ? z : "CZ";
}
