/**
 * Typy pro klienta ISDS (Informační systém datových schránek).
 *
 * Názvy polí kopírují elementy z WSDL/XSD (příloha 2 Provozního řádu ISDS,
 * `~/firmy/rwx/isds-docs/pril_2/`), ať se dá kód porovnat s dokumentací
 * bez překladového slovníku.
 */

/** Prostředí ISDS. Ostrá schránka i testovací mají oddělené přihlašovací údaje. */
export type IsdsEnv = "test" | "prod";

export interface IsdsCredentials {
  login: string;
  password: string;
  env: IsdsEnv;
}

/** Stav operace — element `dmStatus` (dm_*) nebo `dbStatus` (db_*). */
export interface IsdsStatus {
  code: string;
  message: string;
}

/** Kód úspěchu je u všech služeb `0000`. */
export const ISDS_OK = "0000";
/** FindDataBox: podmínkám neodpovídá žádná datová schránka (není chyba, jen informace). */
export const ISDS_NENALEZENO = "0002";
/** FindDataBox: výsledek byl oříznut na interní limit. */
export const ISDS_ORIZNUTO = "0003";

/**
 * Chyba vrácená ISDS (nenulový stavový kód) nebo SOAP Fault.
 * Síťové chyby zůstávají obyčejné `TypeError`/`AbortError` z fetch.
 */
export class IsdsError extends Error {
  readonly operace: string;
  readonly kod: string;
  constructor(operace: string, kod: string, message: string) {
    super(message);
    this.name = "IsdsError";
    this.operace = operace;
    this.kod = kod;
  }
}

/** Chyba HTTP vrstvy (401 při špatných údajích, 503 při odstávce…). */
export class IsdsHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "IsdsHttpError";
    this.status = status;
  }
}

/**
 * Rozpoznání chyb podle `name`, ne přes `instanceof`.
 * Modul se v Node (tsx) načte zvlášť pro CJS a ESM větev, takže `instanceof`
 * mezi `.mts` skriptem a `.ts` knihovnou selhává — v aplikaci by to prošlo,
 * ve smoke skriptu ne.
 */
export function jeIsdsError(e: unknown): e is IsdsError {
  return e instanceof Error && e.name === "IsdsError";
}

export function jeIsdsHttpError(e: unknown): e is IsdsHttpError {
  return e instanceof Error && e.name === "IsdsHttpError";
}

/** GetUserInfoFromLogin — údaje o přihlášeném uživateli. */
export interface IsdsUserInfo {
  pnGivenNames: string | null;
  pnLastName: string | null;
  isdsID: string | null;
  /** PRIMARY_USER, ENTRUSTED_USER, ADMINISTRATOR, LIQUIDATOR, GUARDIAN, RECEIVER. */
  userType: string | null;
  /** Přidělená práva 0–255. */
  userPrivils: string | null;
  ic: string | null;
  firmName: string | null;
}

/** FindDataBox — jeden nalezený záznam (struktura tDbOwnerInfoExt). */
export interface IsdsDataBox {
  dbID: string | null;
  /** OVM, OVM_PO, OVM_REQ, OVM_FO, OVM_PFO, PO, PO_REQ, PFO…, FO. */
  dbType: string | null;
  ic: string | null;
  firmName: string | null;
  pnGivenNames: string | null;
  pnLastName: string | null;
  adCity: string | null;
  adStreet: string | null;
  adZipCode: string | null;
  /** Pouze stav 1 = aktivní schránka, do které lze doručovat. */
  dbState: number | null;
}

export interface IsdsFindDataBoxResult {
  status: IsdsStatus;
  schranky: IsdsDataBox[];
}

/** Písemnost (příloha) datové zprávy. */
export interface IsdsFile {
  /** Název souboru — element atribut `dmFileDescr`, povinný. */
  dmFileDescr: string;
  /** MIME typ — atribut `dmMimeType`, povinný. */
  dmMimeType: string;
  /** `main` u první písemnosti, `enclosure` u dalších. */
  dmFileMetaType: "main" | "enclosure" | "signature" | "meta";
  /** Obsah v base64 (`dmEncodedContent`). */
  dmEncodedContent: string;
}

/** Vstup pro CreateMessage. */
export interface IsdsCreateMessageInput {
  /** ID datové schránky příjemce (7 znaků). */
  dbIDRecipient: string;
  /** Věc zprávy — `dmAnnotation`, max. 255 znaků. */
  dmAnnotation: string;
  /** Naše značka — `dmSenderRefNumber`, max. 50 znaků. */
  dmSenderRefNumber?: string | null;
  /** Zmocnění (zákon/rok/paragraf) — u žádosti podle InfZ. */
  dmLegalTitleLaw?: string | null;
  dmLegalTitleYear?: string | null;
  dmLegalTitleSect?: string | null;
  files: IsdsFile[];
}

/** Záznam v seznamu přijatých/odeslaných zpráv (element dmRecord). */
export interface IsdsMessageRecord {
  dmID: string;
  dbIDSender: string | null;
  dmSender: string | null;
  dmSenderAddress: string | null;
  dbIDRecipient: string | null;
  dmRecipient: string | null;
  dmAnnotation: string | null;
  dmSenderRefNumber: string | null;
  dmRecipientRefNumber: string | null;
  /** Stav podle kap. 1.5 Provozního řádu (4 dodáno, 5 fikce, 6 doručeno, 7 přečteno, 10 trezor). */
  dmMessageStatus: number | null;
  dmDeliveryTime: string | null;
  dmAcceptanceTime: string | null;
  /** Velkoobjemová zpráva (atribut dmVODZ) — tu tento klient nestahuje. */
  vodz: boolean;
}

/** MessageDownload — obálka i písemnosti. */
export interface IsdsDownloadedMessage {
  envelope: IsdsMessageRecord;
  files: IsdsFile[];
}

/** GetDeliveryInfo — doručenka. */
export interface IsdsDeliveryInfo {
  dmID: string;
  dmMessageStatus: number | null;
  dmDeliveryTime: string | null;
  dmAcceptanceTime: string | null;
  /** Události doručování; popis je prefixovaný pevným kódem (EV0, EV5, EV2…). */
  udalosti: { cas: string | null; popis: string | null }[];
}

/** Filtr stavů pro seznamy (součet bitů, -1 = bez filtru). */
export const STAV_FILTR_VSE = -1;

/**
 * Typy datových schránek, které jsou orgánem veřejné moci.
 * Dopis smí odejít jen do takové schránky — pojistka proti podstrčenému
 * příjemci ze serveru. Seznam je nadmnožinou: `OVM`, `OVM_REQ`, `OVM_PO`,
 * `OVM_FO`, `OVM_PFO` jsou typy podle WS_vyhledavani_datovych_schranek,
 * `OVM_NOTAR` a `OVM_EXEKUT` jsou historická označení, která se v datech
 * starších schránek ještě mohou objevit.
 */
export const OVM_TYPY = [
  "OVM",
  "OVM_MAIN",
  "OVM_REQ",
  "OVM_PO",
  "OVM_FO",
  "OVM_PFO",
  "OVM_NOTAR",
  "OVM_EXEKUT",
] as const;

export function jeOvm(dbType: string | null | undefined): boolean {
  if (!dbType) return false;
  return (OVM_TYPY as readonly string[]).includes(dbType.trim().toUpperCase());
}

/**
 * Typy schránek, do kterých smí dopis odejít. Kromě OVM i `PO` — zadavatelé
 * jako Správa železnic nebo krajské nemocnice mají schránku právnické osoby,
 * ale povinným subjektem podle InfZ jsou (dry-run 10. 9. 2026: 2 z 5).
 * `FO` a `PFO` nikdy.
 */
export function jePovolenyPrijemce(dbType: string | null | undefined): boolean {
  if (!dbType) return false;
  return jeOvm(dbType) || dbType.trim().toUpperCase() === "PO";
}

/**
 * Do schránky, která není OVM, jde Poštovní datová zpráva — placená z kreditu
 * odesílatele (dnes 10 Kč). Michal to musí vidět, než dávku schválí.
 */
export function jePlacenaZprava(dbType: string | null | undefined): boolean {
  return !jeOvm(dbType);
}
