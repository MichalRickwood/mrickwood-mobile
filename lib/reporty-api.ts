import { api, ApiError } from "./api";

/**
 * Veritra · Reporty — typovaný klient pro `/api/v2/admin/veritra-reporty`
 * (owner-only, stejná bearer autentizace jako zbytek `lib/admin-api.ts`).
 *
 * Jediný endpoint, druh reportu se volí parametrem `kind`. Odpověď chodí ve v2
 * obálce `{ data }`, chyba jako `{ error: { code, message } }` — rozbaluje se tady,
 * obrazovky dostanou rovnou payload.
 *
 * ČÍSLA CHODÍ JAKO ŘETĚZCE. Zdroj je MariaDB přes mysql2: `COUNT()` se vrátí číslem,
 * ale `SUM()`, `AVG()` a `DECIMAL` sloupce řetězcem („7911658449.88"). Proto je všude
 * typ `Num` a na formátování se používá `cislo()` / `podil()` z `components/ReportUi`,
 * které si `Number()` udělají samy. Nikdy nepočítat s těmito poli přímo aritmetikou.
 */

const BASE = "/api/v2/admin/veritra-reporty";

type Env<T> = { data: T };

/** Hodnota z DB — číslo, řetězec s číslem, nebo chybějící. Viz poznámka výše. */
export type Num = number | string | null | undefined;
/** Datum z DB jako ISO řetězec (`"2026-09-05T12:58:18.000Z"`). */
export type DateStr = string | null | undefined;

/**
 * Dlouhá tabulka ze serveru: stránka řádků + kolik jich je v datech celkem.
 * `celkem` je počet v datech, ne na stránce — díky tomu jde napsat „20 z 5 493".
 */
export interface Blok<T> { radky: T[]; celkem: number; offset: number; limit: number }

/**
 * Server přechází z holých polí na bloky. Dokud nasazená verze může být obojí,
 * čtou se tabulky přes `radky()` / `celkem()`, ne přímo — jinak by starší backend
 * shodil obrazovku na `undefined.radky`.
 */
export type MozneBlok<T> = Blok<T> | T[];

export const radky = <T>(b: MozneBlok<T> | null | undefined): T[] =>
  Array.isArray(b) ? b : (b?.radky ?? []);

export const celkem = <T>(b: MozneBlok<T> | null | undefined): number =>
  Array.isArray(b) ? b.length : (b?.celkem ?? 0);

/**
 * Měna, ve které jsou částky v odpovědi. `smisena` = v segmentu se míchá víc měn,
 * takže server přepočetl na EUR; jinak jsou částky v národní měně a nepřepočítávají se.
 */
export interface Mena { kod: string; podil?: number; smisena?: boolean }

/** Kód měny z odpovědi; starší backend posílal jen řetězec. */
export const menaKod = (m: Mena | string | null | undefined, nahrada: string): string =>
  (typeof m === "string" ? m : m?.kod) || nahrada;

/**
 * Druh řízení podle POČTU NABÍDEK, ne podle příznaku zdroje — ten u písemných zpráv
 * k malým zakázkám hlásí „soutěž" i tam, kde zadavatel oslovil jedinou firmu.
 */
export type Kos = "soutez" | "jedina" | "prime" | "neznamo";
export type Kose = Record<Kos, number>;

/**
 * Tentýž rozpad, jak ho vedle `kose` posílá SQL — ploché sloupce jako řetězce.
 * V UI se sahá na `kose`; tohle je tu, aby typy odpovídaly skutečné odpovědi.
 */
export interface KoseSloupce {
  k_soutez?: Num; k_jedina?: Num; k_prime?: Num; k_neznamo?: Num;
}

/** Země s natrénovaným modelem — zrcadlí `MODEL_COUNTRIES` na serveru. Odpověď ho
 *  posílá taky (`modelCountries`), tohle je jen výchozí hodnota pro první render. */
export const MODEL_COUNTRIES = ["CZ", "IT", "SK", "SI", "HU", "PT"] as const;

// ── 1. Model ────────────────────────────────────────────────────────────────

export interface KvalitaZeme {
  country: string;
  /** „uložené predikce" | „model pro tuto zemi není" */
  stav: string;
  model_version?: string | null;
  n?: Num;
  s_p1?: Num;
  vyhodnoceno?: Num;
  prvni?: DateStr;
  posledni?: DateStr;
  prum_p2?: Num;
  prum_q50?: Num;
  prum_sirka?: Num;
  /** Podíl skutečností, které padly do intervalu q10–q90. Bez `n_pokryti` neukazovat. */
  pokryti80?: Num;
  n_pokryti?: Num;
  /** Průměrná absolutní chyba předpovězeného počtu nabídek. Bez `n_p2` neukazovat. */
  p2_mae?: Num;
  n_p2?: Num;
  /** Podíl trefených vítězů v P1. Bez `n_p1` neukazovat. */
  p1_zasah?: Num;
  n_p1?: Num;
}

export interface PosledniPredikce {
  tender_id: Num;
  country: string;
  model_version: string | null;
  predicted_at: DateStr;
  est_value: Num;
  p2_bids: Num;
  q10: Num;
  q50: Num;
  q90: Num;
  eval_ratio: Num;
  evaluated_at: DateStr;
  title: string | null;
  deadlineAt: DateStr;
  isActive: Num;
  buyer: string | null;
}

export interface ModelKvalita {
  zeme: KvalitaZeme[];
  /** Země mimo `MODEL_COUNTRIES`, které přesto mají uložené predikce. */
  ostatni: KvalitaZeme[];
  posledni: PosledniPredikce[];
  modelCountries: string[];
}

export interface TenderRow {
  id: Num;
  country: string;
  portalType: string | null;
  title: string | null;
  estimatedValue: Num;
  currency: string | null;
  cpvCode: string | null;
  nuts: string | null;
  deadlineAt: DateStr;
  publishedAt: DateStr;
  isActive: Num;
  sourceUrl: string | null;
  procedureType: string | null;
  tenderType?: string | null;
  buyer: string | null;
  buyer_ico: string | null;
}

/** Soutěž z portálu ve výpisu zadavatele. */
export interface SoutezRow {
  id: Num;
  portalType: string | null;
  title: string | null;
  estimatedValue: Num;
  currency: string | null;
  publishedAt: DateStr;
  deadlineAt: DateStr;
  isActive: Num;
  sourceUrl: string | null;
}

export interface ModelHledani {
  zeme: string;
  dotaz: string;
  maModel: boolean;
  modelCountries: string[];
  tenders: (TenderRow & { predikci: number; predikceZ: DateStr })[];
}

/** Jeden pravděpodobný uchazeč z P1. `ico` je null, když zdroj IČ nedal a firma
 *  se drží jen pod normalizovaným názvem. */
export interface P1Radek {
  firm: string;
  p: number;
  nazev: string;
  ico: string | null;
}

export interface Predikce {
  id: Num;
  model_version: string | null;
  predicted_at: DateStr;
  est_value: Num;
  /** P2 — očekávaný počet nabídek. */
  p2_bids: Num;
  /** P3 — poměr vysoutěžené ceny k odhadu (ne absolutní cena). */
  q10: Num;
  q50: Num;
  q90: Num;
  p1_top: string | null;
  eval_award_id: Num;
  eval_bids: Num;
  eval_ratio: Num;
  eval_hit_p1: Num;
  evaluated_at: DateStr;
  p1: P1Radek[];
}

/** Společná část řádku zadání (`vt_award`) napříč reporty. */
export interface ZadaniZaklad {
  id: Num;
  source: string | null;
  title: string | null;
  est_value: Num;
  final_value: Num;
  currency: string | null;
  value_eur: Num;
  bid_count: Num;
  award_date: DateStr;
  is_competitive: Num;
  raw_ref: string | null;
}

/** Zadání spárované s predikcí — nese vítěze, ale ne CPV. */
export interface AwardRow extends ZadaniZaklad {
  winner_name: string | null;
  winner_reg: string | null;
}

/** Poslední zadání v profilu dodavatele. Vítěz tu NENÍ: vítězem je sám profilovaný
 *  subjekt, takže ho dotaz nevybírá — proto se nedá použít `AwardRow`. */
export type ZadaniDodavatele = ZadaniZaklad & {
  cpv: string | null; buyer_name: string | null; buyer_reg?: string | null;
  winner_name?: string | null; winner_reg?: string | null;
  source_id?: string | null; kos?: Kos;
};

/** Poslední zadání v profilu zadavatele — zrcadlově nese vítěze, ale ne zadavatele. */
export type ZadaniZadavatele = ZadaniZaklad & {
  cpv: string | null;
  buyer_name?: string | null;
  buyer_reg?: string | null;
  winner_name: string | null;
  winner_reg: string | null;
  source_id?: string | null;
  kos?: Kos;
};

export interface BidRow {
  bidder_name?: string | null;
  bidder_reg?: string | null;
  offered_value?: Num;
  is_winner?: Num;
  [k: string]: unknown;
}

export interface ModelDetail {
  tender: TenderRow;
  zeme: string;
  maModel: boolean;
  predikce: Predikce[];
  link: { award_id: Num; method: string | null; confidence: Num } | null;
  award: AwardRow | null;
  bids: BidRow[];
}

// ── 2. Dodavatelé a zadavatelé ──────────────────────────────────────────────

export interface OrgRow {
  id: Num;
  country: string;
  reg_no: string | null;
  name: string | null;
  name_norm?: string | null;
  /** Jen v profilu — ten čte `SELECT *`, hledání vybírá jmenovitě. */
  reg_scheme?: string | null;
  match_key?: string | null;
  vat_id?: string | null;
  updated_at?: DateStr;
  is_buyer: Num;
  is_supplier: Num;
  n_won: Num;
  n_bids: Num;
  n_awarded: Num;
  value_won_eur: Num;
  first_seen: DateStr;
  last_seen: DateStr;
  n_aliases: Num;
}

/**
 * Řádek našeptávače. Kromě registru Veritry sem u ČR přitékají i firmy z ARESu —
 * ty mají `vNasichDatech: false` a všechny čítače nulové, protože o nich žádná
 * zadání neznáme. V UI se to musí říct, jinak vypadají jako firma bez zakázek.
 */
export interface SubjektRow extends OrgRow {
  zdroj?: "registr" | "ares";
  sidlo?: string | null;
  zanik?: string | null;
  vNasichDatech?: boolean;
  poznamka?: string | null;
}

export interface SubjektHledani {
  zeme: string;
  dotaz: string;
  /** Vyplněné, když se nepodařilo dosáhnout na ARES — registr se i tak vrátí. */
  aresChyba?: string | null;
  subjekty: SubjektRow[];
}

/** IČO a názvy, pod kterými subjekt v datech vystupuje. */
export interface Identita { reg_no: string | null; nazvy: string[] }

export interface ProfilDodavatele {
  zeme: string;
  org: OrgRow;
  mena?: Mena | string | null;
  identita?: Identita;
  /** Filtry, které server na výpisy skutečně použil — vrací se zpátky, ať jdou odklepnout. */
  filtry?: { rok?: number; kos?: Kos; spolu?: string };
  /**
   * Pozor na dvojí čísla: `registr_*` se přepočítává jednou týdně a sčítá i názvové
   * varianty, kdežto ostatní se počítá teď. Rozpad `*_s_ico` / `*_jen_nazev` říká,
   * kolik z toho stojí na jistém spárování podle IČO a kolik jen na shodě názvu.
   */
  stats: KoseSloupce & {
    vyher: Num; vyher_s_ico?: Num; vyher_jen_nazev?: Num;
    /** V měně z `mena.kod`. */
    objem?: Num;
    objem_eur: Num;
    nabidek: Num; nabidek_s_ico?: Num; nabidek_jen_nazev?: Num;
    vyherZNabidek: Num; prohry?: Num;
    /** Zdroj výsledek nedal — není to prohra. */
    neznamych?: Num;
    uspesnost: Num;
    s_cenou: Num;
    registr_n_won: Num; registr_n_bids: Num; registr_objem_eur: Num;
    registr_prepocet?: DateStr;
    kose?: Kose;
  };
  vyhryPoLetech: (KoseSloupce & {
    rok: Num; vyher: Num; objem?: Num; objem_eur: Num; objem_mena?: Num;
    v_soutezi?: Num; prime?: Num; prum_pomer: Num; kose?: Kose;
  })[];
  ucastPoLetech: { rok: Num; nabidek: Num; vyher: Num; neznamych?: Num; prum_soupereru: Num }[];
  cpv: { cpv3: string | null; vyher: Num; objem?: Num; objem_eur: Num; objem_mena?: Num }[];
  zadavatele: MozneBlok<{
    buyer_reg: string | null; buyer_name: string | null; vyher: Num;
    objem?: Num; objem_eur: Num; objem_mena?: Num; posledni: DateStr;
  }>;
  posledni: MozneBlok<ZadaniDodavatele>;
  /** Co subjekt podal, bez ohledu na výsledek (výhry jsou podmnožina). */
  ucasti?: MozneBlok<UcastRow>;
  soupeReri: MozneBlok<{
    bidder_reg: string | null; bidder_name: string | null; spolecnych: Num; jejich_vyher: Num;
  }>;
  /** Podle čeho se výhry párovaly: `reg` = jistá shoda IČO, `name` = jen shoda názvu. */
  vyhryPodle?: "reg" | "name";
  smlouvy?: SmlouvyBlok | null;
}

/**
 * Jedna podaná nabídka. `is_winner === null` znamená, že zdroj výsledek neuvedl —
 * NENÍ to prohra a v UI se musí lišit od nuly, jinak by profil tvrdil něco,
 * co v datech není.
 */
export interface UcastRow extends ZadaniZaklad {
  buyer_name: string | null;
  buyer_reg: string | null;
  cpv: string | null;
  winner_name: string | null;
  winner_reg: string | null;
  /** NAŠE nabídka — vedle `final_value`, což je cena vítěze. */
  offered_value: Num;
  is_winner: number | null;
  rank_no: Num;
  bid_currency: string | null;
  bidder_reg?: string | null;
  source_id?: string | null;
  kos?: Kos;
}

/**
 * Smlouvy z registru smluv (jen ČR). Doplňuje obrázek tam, kde zadání z portálů
 * mlčí — „přímé zadání" v našich datech je jen to, co portál sám takto označil.
 *
 * ⚠️ Registr smluv neobsahuje smlouvy pod 300 tis. Kč, takže počty i objemy jsou
 * zdola oříznuté; v UI se to musí napsat.
 */
export interface SmlouvyBlok {
  celkem: Num;
  objem: Num;
  mena?: string | null;
  /** ⚠️ Spodní hranice zveřejňování (300 000 Kč). Menší smlouvy v datech VŮBEC nejsou,
   *  takže počet i objem jsou zdola oříznuté — v UI to musí být vidět. */
  orezOd?: Num;
  roky?: { rok: string | null; n: Num; objem: Num }[];
  radky?: SmlouvaRow[];
  offset?: Num;
  limit?: Num;
}

export interface SmlouvaRow {
  id?: Num;
  datumUzavreni?: string | null;
  zadavatelNazev?: string | null;
  zadavatelIco?: string | null;
  dodavatelNazev?: string | null;
  dodavatelIco?: string | null;
  predmet?: string | null;
  hodnotaBezDph?: Num;
  hodnotaVcetneDph?: Num;
  kategorie?: string | null;
  smlouvaUrl?: string | null;
}

export interface ProfilZadavatele {
  zeme: string;
  org: OrgRow;
  mena?: Mena | string | null;
  identita?: Identita;
  filtry?: { rok?: number; kos?: Kos };
  prehled: KoseSloupce & {
    zadani: Num; objem?: Num; objem_eur: Num; objem_mena?: Num;
    s_ico?: Num; jen_nazev?: Num;
    souteze: Num; prima: Num; neurceno: Num;
    prum_nabidek: Num; jedna_nabidka: Num; s_poctem: Num;
    prum_pomer: Num; zrusenych: Num;
    od: DateStr; do: DateStr;
    registr_prepocet?: DateStr;
    kose?: Kose;
  };
  poLetech: (KoseSloupce & {
    rok: Num; zadani: Num; objem?: Num; objem_eur: Num; objem_mena?: Num;
    souteze: Num; prima: Num; prum_nabidek: Num; jedna_nabidka: Num; s_poctem: Num;
    prum_pomer: Num; kose?: Kose;
  })[];
  cpv: { cpv3: string | null; zadani: Num; objem?: Num; objem_eur: Num; objem_mena?: Num }[];
  kriteria: { kriterium: string | null; zadani: Num }[];
  vitezove: MozneBlok<{
    winner_reg: string | null; winner_name: string | null; vyher: Num;
    objem?: Num; objem_eur: Num; objem_mena?: Num; posledni: DateStr;
  }>;
  posledni: MozneBlok<ZadaniZadavatele>;
  souteze: MozneBlok<SoutezRow>;
  smlouvy?: SmlouvyBlok | null;
}

// ── 3. Cenové hladiny / 4. Konkurence ───────────────────────────────────────

export interface Segment {
  country: string;
  cpv: string;
  rokOd: number;
  rokDo: number;
  nuts?: string;
  buyer?: string;
}

export interface Kvartily {
  n: number;
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
}

/** Segment bez jediného řádku. */
export interface SegmentPrazdny { segment: Segment; pocet: number; prazdno: true }
/** Segment přes strop — server odmítl počítat, filtr se musí zúžit. */
export interface SegmentPrilisVelky { segment: Segment; pocet: number; vice: true; prekroceno: number }

export interface CenoveHladinyData {
  segment: Segment;
  pocet: number;
  vzorek: number;
  /** Vysoutěžená cena v EUR. */
  ceny: Kvartily;
  /** Odhad přepočtený do EUR kurzem z téhož řádku. */
  odhady: Kvartily;
  /** Poměr vysoutěžená cena / odhad. */
  pomer: Kvartily;
  stats: {
    souteze: number; prima: number; neurceno: number;
    s_poctem_nabidek: number; jedna_nabidka: number;
    podil_jedne_nabidky: number | null;
    prum_nabidek: number | null;
    cena_rovna_odhadu: number;
  };
  meny: { currency: string; n: number }[];
  /** `posledni: true` = koš „10 a víc nabídek". */
  rozdeleniNabidek: { bid_count: number; n: number; posledni: boolean }[];
  vitezove: MozneBlok<{ reg: string | null; name: string; n: number; objem?: number; eur?: number }>;
  roky: {
    rok: number; n: number; objem?: number; objem_eur?: number;
    median_cena?: number | null; median_eur?: number | null;
    median_pomer: number | null; prum_nabidek: number | null;
  }[];
  mena?: Mena | string | null;
  kose?: Kose;
}

export interface KonkurenceData {
  segment: Segment;
  pocet: number;
  vzorekNabidek: number;
  soutezi_s_nabidkami: number;
  /** Nenulové = vzorek nabídek narazil na strop, čísla jsou uříznutá. */
  strop: number | null;
  vitezove: MozneBlok<{
    winner_reg: string | null; winner_name: string | null; vyher: Num;
    objem?: Num; objem_eur: Num; objem_mena?: Num; prum_pomer: Num;
  }>;
  ucastnici: MozneBlok<{
    reg: string | null; name: string; ucasti: number; vyhry: number;
    podil_vyher: number | null; prum_cena_vs_odhad: number | null;
    roky: { rok: number; n: number }[];
  }>;
  dvojice: MozneBlok<{ a: string; aReg?: string | null; b: string; bReg?: string | null; n: number }>;
  mena?: Mena | string | null;
  /** Na koho se filtr zadavatele nakonec chytil (IČO i název se hledají volně). */
  zadavatel?: { reg_no: string | null; name: string } | null;
}

export type CenoveHladiny = CenoveHladinyData | SegmentPrazdny | SegmentPrilisVelky;
export type Konkurence = KonkurenceData | SegmentPrazdny | SegmentPrilisVelky;

export const jePrazdno = (r: unknown): r is SegmentPrazdny =>
  !!r && typeof r === "object" && (r as SegmentPrazdny).prazdno === true;
export const jePrilisVelky = (r: unknown): r is SegmentPrilisVelky =>
  !!r && typeof r === "object" && (r as SegmentPrilisVelky).vice === true;

/** Detail jednoho zadání (`kind=zadani`): řádek zadání + všichni uchazeči s cenou a výsledkem. */
export interface ZadaniUchazec {
  id: Num; bidder_name: string | null; bidder_reg: string | null; offered_value: Num;
  currency: string | null; rank_no: Num; is_winner: number | null;
}
export interface ZadaniDetail {
  zadani: Record<string, unknown> & {
    id: Num; country: string; source: string; title: string | null; award_date: string | null; buyer_name: string | null;
    buyer_reg: string | null; winner_name: string | null; winner_reg: string | null; est_value: Num; final_value: Num;
    currency: string | null; bid_count: Num; is_competitive: Num; raw_ref: string | null; cpv: string | null;
    procedure_type: string | null;
  };
  uchazeci: ZadaniUchazec[];
  souteze: { tender_id: Num; method: string; confidence: Num; title: string | null; deadlineAt: string | null; isActive: Num }[];
  pocty: { hlaseno: number | null; znamych: number; s_cenou: number };
}

// ── Klient ──────────────────────────────────────────────────────────────────

type Params = Record<string, string | number | undefined>;

async function nacti<T>(params: Params, signal?: AbortSignal): Promise<T> {
  const r = await api.get<Env<T>>(BASE, { params, signal });
  return r.data;
}

/**
 * Volitelné parametry, které web do kontraktu teprve doplňuje: stránkování a
 * zúžení výpisů (rok, koš, společné zakázky dvou firem). Posílají se jen když
 * je obrazovka opravdu nastaví — starší backend je prostě ignoruje.
 */
export interface VypisOpts {
  /** Společný počet řádků pro všechny tabulky v odpovědi (1–100). */
  limit?: number;
  /** Offset jedné tabulky: klíč = název bloku v odpovědi (`ucasti`, `posledni`, …). */
  off?: Record<string, number>;
  /** Jen zadání/účasti z daného roku. */
  rok?: number;
  /** Druh řízení podle počtu nabídek. */
  kos?: Kos;
  /** IČO nebo přesný název druhé firmy — jen zakázky, kde soutěžily spolu. */
  spolu?: string;
}

/** Rozloží `off` na `off_<blok>` parametry podle kontraktu. */
const vypis = (o?: VypisOpts): Params => {
  if (!o) return {};
  const p: Params = { limit: o.limit, rok: o.rok, kos: o.kos, spolu: o.spolu };
  for (const [klic, hodnota] of Object.entries(o.off ?? {})) {
    if (Number.isFinite(hodnota) && hodnota > 0) p[`off_${klic}`] = Math.floor(hodnota);
  }
  return p;
};

export const reportyApi = {
  modelKvalita: (signal?: AbortSignal) => nacti<ModelKvalita>({ kind: "model-kvalita" }, signal),
  modelHledani: (country: string, q: string, signal?: AbortSignal) =>
    nacti<ModelHledani>({ kind: "model-hledani", country, q }, signal),
  modelDetail: (id: string | number, signal?: AbortSignal) =>
    nacti<ModelDetail>({ kind: "model-detail", q: String(id) }, signal),
  zadani: (id: string | number, signal?: AbortSignal) =>
    nacti<ZadaniDetail>({ kind: "zadani", q: String(id) }, signal),

  subjektHledani: (country: string, q: string, signal?: AbortSignal) =>
    nacti<SubjektHledani>({ kind: "subjekt-hledani", country, q }, signal),
  dodavatel: (country: string, q: string, o?: VypisOpts, signal?: AbortSignal) =>
    nacti<ProfilDodavatele>({ kind: "dodavatel", country, q, ...vypis(o) }, signal),
  zadavatel: (country: string, q: string, o?: VypisOpts, signal?: AbortSignal) =>
    nacti<ProfilZadavatele>({ kind: "zadavatel", country, q, ...vypis(o) }, signal),

  cenoveHladiny: (s: Segment, o?: VypisOpts, signal?: AbortSignal) =>
    nacti<CenoveHladiny>({ kind: "cenove-hladiny", country: s.country, cpv: s.cpv, od: s.rokOd, do: s.rokDo, nuts: s.nuts || undefined, ...vypis(o) }, signal),
  konkurence: (s: Segment, o?: VypisOpts, signal?: AbortSignal) =>
    nacti<Konkurence>({ kind: "konkurence", country: s.country, cpv: s.cpv, od: s.rokOd, do: s.rokDo, nuts: s.nuts || undefined, buyer: s.buyer || undefined, ...vypis(o) }, signal),
};

/**
 * Rozliší „backend tenhle report ještě neumí" od běžné chyby.
 *
 * OTA update může k uživateli dorazit dřív než nasazení webu. Chybějící routa se
 * projeví jako 404/403 s HTML tělem (Next vrátí stránku, ne JSON), kdežto skutečná
 * chyba reportu přijde jako v2 obálka `{ error: { code, message } }` — i u 404
 * („Subjekt v registru není"), které se má ukázat normálně jako hláška z API.
 */
export function reportChyba(e: unknown): { chybiNaServeru: boolean; zprava: string } {
  if (e instanceof ApiError) {
    const maJsonChybu = !!e.body && typeof e.body === "object" && "error" in e.body;
    if (!maJsonChybu && (e.status === 404 || e.status === 403 || e.status === 405 || e.status === 501)) {
      return { chybiNaServeru: true, zprava: "" };
    }
    return { chybiNaServeru: false, zprava: e.message };
  }
  return { chybiNaServeru: false, zprava: e instanceof Error ? e.message : String(e) };
}
