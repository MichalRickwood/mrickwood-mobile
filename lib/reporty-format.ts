import type { Num } from "./reporty-api";

/**
 * Formátování čísel, měn a dat pro Veritra · Reporty + čištění názvů firem.
 *
 * Oddělené od `components/ReportUi.tsx` schválně: jsou to čisté funkce bez
 * React Native, takže se dají spustit (a ověřit proti ukázkovým odpovědím API)
 * v Node bez celého RN runtime.
 *
 * Dvě pravidla, na kterých tu všechno stojí:
 *  1. Chybějící hodnota je pomlčka, NIKDY nula — v reportech znamená „nemáme
 *     data" něco jiného než „je to nula" (počet nabídek, objem, poměr k odhadu).
 *  2. Vstup může být řetězec. Z MariaDB chodí `SUM()`/`AVG()`/`DECIMAL` jako
 *     text, takže `Number()` musí proběhnout tady, ne v obrazovce.
 *
 * Locale je natvrdo `cs-CZ` — admin sekce je interní nástroj a čísla se v ní
 * porovnávají s webovou verzí reportů, která formátuje stejně.
 */

const LOCALE = "cs-CZ";

/** Pevná mezera. Odděluje číslo od jednotky (%, měna) — v úzkých buňkách tabulky
 *  by se obyčejná mezera zlomila a „27,1" zůstalo na jiném řádku než „%". */
const NBSP = "\u00a0";

/** Číslo z DB (může přijít řetězcem) na `number`, nebo null. */
export const num = (v: Num): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Číslo v české notaci. Chybějící hodnota je pomlčka — ne nula. */
export const cislo = (v: Num, des = 0): string => {
  const n = num(v);
  return n === null ? "–" : n.toLocaleString(LOCALE, { maximumFractionDigits: des, minimumFractionDigits: des });
};

/** Zlomek 0–1 jako procenta. */
export const podil = (v: Num, des = 0): string => {
  const n = num(v);
  return n === null
    ? "–"
    : `${(100 * n).toLocaleString(LOCALE, { maximumFractionDigits: des, minimumFractionDigits: des })}${NBSP}%`;
};

/** Podíl a/b v procentech. Nulový jmenovatel je pomlčka, ne dělení nulou. */
export const pomer = (a: Num, b: Num, des = 0): string => {
  const x = num(a);
  const y = num(b);
  return x === null || !y
    ? "–"
    : `${((100 * x) / y).toLocaleString(LOCALE, { maximumFractionDigits: des, minimumFractionDigits: des })}${NBSP}%`;
};

/** Datum bez času (vstup je ISO řetězec z DB). */
export const datum = (v: unknown): string => (v ? String(v).slice(0, 10) : "–");

/** Částka s měnou. Měna se bere z odpovědi — EUR tam, kde server přepočítal. */
export const castka = (v: Num, mena = "EUR", des = 0): string => {
  const n = num(v);
  if (n === null) return "–";
  const c = n.toLocaleString(LOCALE, { maximumFractionDigits: des, minimumFractionDigits: des });
  return mena ? `${c}${NBSP}${mena}` : c;
};

/** Velké částky zkráceně — do dlaždic a tabulek, kde se plné číslo nevejde. */
export const castkaKratce = (v: Num, mena = "EUR"): string => {
  const n = num(v);
  if (n === null) return "–";
  const jednotka = (x: number, suf: string, des: number) => {
    const c = x.toLocaleString(LOCALE, { maximumFractionDigits: des });
    return mena ? `${c}${NBSP}${suf}${mena}` : `${c}${NBSP}${suf}`.trim();
  };
  const a = Math.abs(n);
  if (a >= 1e9) return jednotka(n / 1e9, "mld. ", 2);
  if (a >= 1e6) return jednotka(n / 1e6, "mil. ", 1);
  if (a >= 1e4) return jednotka(n / 1e3, "tis. ", 0);
  return castka(n, mena);
};

/** Zkrácení textu na délku `n` s výpustkou. */
export const zkrat = (s: string | null | undefined, n: number): string =>
  !s ? "–" : s.length > n ? `${s.slice(0, n - 1)}…` : s;

// ── Měny ────────────────────────────────────────────────────────────────────

/**
 * Částka v dané měně přes `Intl` (`style: "currency"`), tj. správný symbol i pozice
 * podle jazyka. Neznámý nebo prázdný kód měny by `Intl` shodil `RangeError`em —
 * pak se vrátí aspoň číslo s kódem za ním, ať uživatel nepřijde o hodnotu.
 */
export const castkaMena = (v: Num, mena: string | null | undefined, locale = LOCALE, des = 0): string => {
  const n = num(v);
  if (n === null) return "–";
  const kod = (mena ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(kod)) {
    try {
      return n.toLocaleString(locale, {
        style: "currency", currency: kod,
        maximumFractionDigits: des, minimumFractionDigits: des,
      });
    } catch {
      /* engine měnu nezná — spadneme na tvar „číslo KÓD" */
    }
  }
  return castka(n, kod, des);
};

/** Zkrácená částka v dané měně (tis./mil./mld.) — do tabulek a dlaždic. */
export const castkaMenaKratce = (v: Num, mena: string | null | undefined): string =>
  castkaKratce(v, (mena ?? "").trim().toUpperCase());

// ── Čištění názvů ───────────────────────────────────────────────────────────

/**
 * Útržky, které se do dat propsaly z rozsekaných tabulek na portálech — nejsou to
 * firmy, ale kusy hlaviček („Dodavatel", „Zadávacího řízení"). Opravuje se to na
 * straně dat; tohle je dočasná pojistka, aby se smetí neukazovalo v seznamech.
 *
 * Porovnává se CELÝ název, ne podřetězec — „Dodavatel stavby s.r.o." je legitimní
 * firma a filtr ji nesmí spolknout.
 */
const SMETI_CELE = new Set([
  "dodavatel", "dodavatele", "spolecnost", "spolecnosti", "uchazec", "uchazece",
  "ucastnik", "ucastnika", "zadavaciho rizeni", "zadavatel", "vitez", "nazev",
]);

/** Malá písmena bez diakritiky — ať „Uchazeč" a „uchazec" spadnou na totéž. */
const bezDiakritiky = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[.,;:]/g, " ").replace(/\s+/g, " ").trim();

/** True = název je smetí a do seznamu firem nepatří. */
export function jeSmeti(nazev: string | null | undefined): boolean {
  const raw = (nazev ?? "").trim();
  if (raw.length < 3) return true;
  const n = bezDiakritiky(raw);
  if (!n || n.length < 3) return true;
  if (SMETI_CELE.has(n)) return true;
  // Nejčastější případ: název začínající útržkem hlavičky tabulky.
  if (n.startsWith("zadavaciho rizeni")) return true;
  return false;
}

/** Odfiltruje smetí ze seznamu podle vybraného pole s názvem. */
export const bezSmeti = <T,>(rows: T[], nazev: (r: T) => string | null | undefined): T[] =>
  rows.filter((r) => !jeSmeti(nazev(r)));
