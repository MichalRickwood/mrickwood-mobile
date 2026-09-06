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
export type ZadaniDodavatele = ZadaniZaklad & { cpv: string | null; buyer_name: string | null };

/** Poslední zadání v profilu zadavatele — zrcadlově nese vítěze, ale ne zadavatele. */
export type ZadaniZadavatele = ZadaniZaklad & {
  cpv: string | null;
  winner_name: string | null;
  winner_reg: string | null;
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

export interface SubjektHledani {
  zeme: string;
  dotaz: string;
  subjekty: OrgRow[];
}

export interface ProfilDodavatele {
  zeme: string;
  org: OrgRow;
  /** Pozor: `registr_*` sčítá i názvové varianty subjektu, zbytek jen řádky
   *  dohledatelné podle IČ / přesného názvu — čísla se nemusí rovnat. */
  stats: {
    vyher: Num;
    objem_eur: Num;
    nabidek: Num;
    vyherZNabidek: Num;
    uspesnost: Num;
    s_cenou: Num;
    registr_n_won: Num;
    registr_n_bids: Num;
    registr_objem_eur: Num;
  };
  vyhryPoLetech: { rok: Num; vyher: Num; objem_eur: Num; v_soutezi: Num; prime: Num; prum_pomer: Num }[];
  ucastPoLetech: { rok: Num; nabidek: Num; vyher: Num; prum_soupereru: Num }[];
  zadavatele: { buyer_reg: string | null; buyer_name: string | null; vyher: Num; objem_eur: Num; posledni: DateStr }[];
  cpv: { cpv3: string | null; vyher: Num; objem_eur: Num }[];
  posledni: ZadaniDodavatele[];
  soupeReri: { bidder_reg: string | null; bidder_name: string | null; spolecnych: Num; jejich_vyher: Num }[];
}

export interface ProfilZadavatele {
  zeme: string;
  org: OrgRow;
  prehled: {
    zadani: Num;
    objem_eur: Num;
    souteze: Num;
    prima: Num;
    neurceno: Num;
    prum_nabidek: Num;
    jedna_nabidka: Num;
    s_poctem: Num;
    prum_pomer: Num;
    zrusenych: Num;
    od: DateStr;
    do: DateStr;
  };
  poLetech: {
    rok: Num; zadani: Num; objem_eur: Num; souteze: Num; prima: Num;
    prum_nabidek: Num; jedna_nabidka: Num; s_poctem: Num; prum_pomer: Num;
  }[];
  vitezove: { winner_reg: string | null; winner_name: string | null; vyher: Num; objem_eur: Num; posledni: DateStr }[];
  cpv: { cpv3: string | null; zadani: Num; objem_eur: Num }[];
  kriteria: { kriterium: string | null; zadani: Num }[];
  posledni: ZadaniZadavatele[];
  /** Živé/archivní soutěže z portálů. Užší výběr sloupců než `TenderRow` — dotaz jede
   *  přes `tenders` a bere jen to, co se vejde do výpisu. */
  souteze: SoutezRow[];
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
  vitezove: { reg: string | null; name: string; n: number; eur: number }[];
  roky: { rok: number; n: number; objem_eur: number; median_eur: number | null; median_pomer: number | null; prum_nabidek: number | null }[];
}

export interface KonkurenceData {
  segment: Segment;
  pocet: number;
  vzorekNabidek: number;
  soutezi_s_nabidkami: number;
  /** Nenulové = vzorek nabídek narazil na strop, čísla jsou uříznutá. */
  strop: number | null;
  vitezove: { winner_reg: string | null; winner_name: string | null; vyher: Num; objem_eur: Num; prum_pomer: Num }[];
  ucastnici: {
    reg: string | null; name: string; ucasti: number; vyhry: number;
    podil_vyher: number | null; prum_cena_vs_odhad: number | null;
    roky: { rok: number; n: number }[];
  }[];
  dvojice: { a: string; b: string; n: number }[];
}

export type CenoveHladiny = CenoveHladinyData | SegmentPrazdny | SegmentPrilisVelky;
export type Konkurence = KonkurenceData | SegmentPrazdny | SegmentPrilisVelky;

export const jePrazdno = (r: unknown): r is SegmentPrazdny =>
  !!r && typeof r === "object" && (r as SegmentPrazdny).prazdno === true;
export const jePrilisVelky = (r: unknown): r is SegmentPrilisVelky =>
  !!r && typeof r === "object" && (r as SegmentPrilisVelky).vice === true;

// ── Klient ──────────────────────────────────────────────────────────────────

type Params = Record<string, string | number | undefined>;

async function nacti<T>(params: Params, signal?: AbortSignal): Promise<T> {
  const r = await api.get<Env<T>>(BASE, { params, signal });
  return r.data;
}

export const reportyApi = {
  modelKvalita: (signal?: AbortSignal) => nacti<ModelKvalita>({ kind: "model-kvalita" }, signal),
  modelHledani: (country: string, q: string, signal?: AbortSignal) =>
    nacti<ModelHledani>({ kind: "model-hledani", country, q }, signal),
  modelDetail: (id: string | number, signal?: AbortSignal) =>
    nacti<ModelDetail>({ kind: "model-detail", q: String(id) }, signal),

  subjektHledani: (country: string, q: string, signal?: AbortSignal) =>
    nacti<SubjektHledani>({ kind: "subjekt-hledani", country, q }, signal),
  dodavatel: (country: string, q: string, signal?: AbortSignal) =>
    nacti<ProfilDodavatele>({ kind: "dodavatel", country, q }, signal),
  zadavatel: (country: string, q: string, signal?: AbortSignal) =>
    nacti<ProfilZadavatele>({ kind: "zadavatel", country, q }, signal),

  cenoveHladiny: (s: Segment, signal?: AbortSignal) =>
    nacti<CenoveHladiny>({ kind: "cenove-hladiny", country: s.country, cpv: s.cpv, od: s.rokOd, do: s.rokDo, nuts: s.nuts || undefined }, signal),
  konkurence: (s: Segment, signal?: AbortSignal) =>
    nacti<Konkurence>({ kind: "konkurence", country: s.country, cpv: s.cpv, od: s.rokOd, do: s.rokDo, nuts: s.nuts || undefined, buyer: s.buyer || undefined }, signal),
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
