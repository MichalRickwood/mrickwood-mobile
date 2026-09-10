import type { Dict } from "./i18n/translations";
import type { VymStavDopisu, VymStavPripadu, VymVytezeno } from "./admin-api";

/** Sdílené formátování a mapy klíčů pro obrazovky Datové schránky. */

type AdminKlic = keyof Dict["admin"];

/** Stupeň dopisu → popisek. 1 připomínka, 2 žádost InfZ, 3 stížnost § 16a. */
export const STUPEN_KLIC: Record<number, AdminKlic> = {
  1: "dsStupen1",
  2: "dsStupen2",
  3: "dsStupen3",
};

export const STAV_PRIPADU_KLIC: Record<VymStavPripadu, AdminKlic> = {
  OTEVRENY: "dsStavOTEVRENY",
  ODPOVEZENO: "dsStavODPOVEZENO",
  VYRESENO: "dsStavVYRESENO",
  ZAMITNUTO: "dsStavZAMITNUTO",
  NEDORUCITELNY: "dsStavNEDORUCITELNY",
};

export const STAV_DOPISU_KLIC: Record<VymStavDopisu, AdminKlic> = {
  NAVRH: "dsDopisNAVRH",
  SCHVALENO: "dsDopisSCHVALENO",
  ODESLANO: "dsDopisODESLANO",
  DORUCENO: "dsDopisDORUCENO",
  CHYBA: "dsDopisCHYBA",
  VYRAZENO: "dsDopisVYRAZENO",
};

export const TYP_VYTEZENI_KLIC: Record<VymVytezeno["typ"], AdminKlic> = {
  pisemna_zprava: "dsTypPisemnaZprava",
  oznameni_o_vyberu: "dsTypOznameniOVyberu",
  rozhodnuti_o_odmitnuti: "dsTypRozhodnutiOOdmitnuti",
  zruseni_rizeni: "dsTypZruseniRizeni",
  jine: "dsTypJine",
};

/**
 * Do schránky, která není OVM, jde Poštovní datová zpráva placená z kreditu
 * (dnes 10 Kč) — návrh to musí ukázat, než Michal dávku schválí.
 *
 * Server posílá `prijemce.typ` tak, jak ho má veřejný seznam schránek: „OVM",
 * „OVM - Právnická osoba", „Právnická osoba"… Bereme proto prefix, ne rovnost.
 * Neznámý typ (null) štítek nezobrazuje — skutečnou kontrolu dělá FindDataBox
 * těsně před odesláním.
 */
export function jePlacenyPrijemce(typ: string | null | undefined): boolean {
  if (!typ) return false;
  return !typ.trim().toUpperCase().startsWith("OVM");
}

/** Datum bez času; nečitelný vstup vrátíme beze změny. */
export function formatDatum(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { dateStyle: "medium" });
}

export function formatDatumCas(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

/** Předpokládaná hodnota zakázky v Kč, bez haléřů. */
export function formatCastka(hodnota: number | null | undefined, locale: string): string {
  if (hodnota == null) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(
    hodnota,
  );
}
