import { XMLParser } from "fast-xml-parser";

/**
 * Sestavení a čtení SOAP 1.1 obálek pro ISDS.
 *
 * Jmenný prostor je pro všechny čtyři endpointy stejný —
 * `http://isds.czechpoint.cz/v20` (targetNamespace v `dm_operations.wsdl`,
 * `dm_info.wsdl`, `db_search.wsdl` i `db_access.wsdl`). Schémata mají
 * `elementFormDefault="qualified"`, takže i vnořené elementy nesou prefix.
 *
 * Modul je záměrně bez závislosti na React Native — dá se spustit v Node
 * (jednotkové testy, smoke skript).
 */

export const NS_ISDS = "http://isds.czechpoint.cz/v20";
const NS_SOAP = "http://schemas.xmlsoap.org/soap/envelope/";
const NS_XSI = "http://www.w3.org/2001/XMLSchema-instance";

export function escapeXml(hodnota: string): string {
  return hodnota
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Element s hodnotou, nebo `xsi:nil="true"` když hodnota chybí.
 * ISDS akceptuje tři zápisy prázdné hodnoty (kap. 1.3.1), volíme nil —
 * je jednoznačný i pro číselné a datumové elementy.
 */
export function el(nazev: string, hodnota: string | number | null | undefined): string {
  if (hodnota === null || hodnota === undefined || hodnota === "") {
    return `<v:${nazev} xsi:nil="true"/>`;
  }
  return `<v:${nazev}>${escapeXml(String(hodnota))}</v:${nazev}>`;
}

/** Element s prázdným (ne nil) obsahem — vstup typu tDummyInput. */
export function elPrazdny(nazev: string): string {
  return `<v:${nazev}></v:${nazev}>`;
}

/** Obalí tělo požadavku SOAP 1.1 obálkou s deklaracemi obou prefixů. */
export function soapEnvelope(telo: string): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="${NS_SOAP}" xmlns:v="${NS_ISDS}" xmlns:xsi="${NS_XSI}">` +
    `<s:Header/>` +
    `<s:Body>${telo}</s:Body>` +
    `</s:Envelope>`
  );
}

/* ------------------------------ parsování ------------------------------ */

export type Uzel = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Prefixy (p:, q:, v20:…) se v odpovědích ISDS liší podle služby, hledáme
  // proto podle holého názvu elementu.
  removeNSPrefix: true,
  // Bez konverzí: dmID i IČO jsou identifikátory, ne čísla (vedoucí nuly).
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  textNodeName: "#text",
});

export function parseXml(xml: string): Uzel {
  return parser.parse(xml) as Uzel;
}

/** Rekurzivně najde první element daného jména (bez ohledu na prefix). */
export function najdi(koren: unknown, nazev: string): unknown {
  if (koren === null || typeof koren !== "object") return undefined;
  const uzel = koren as Uzel;
  if (nazev in uzel) return uzel[nazev];
  for (const hodnota of Object.values(uzel)) {
    if (Array.isArray(hodnota)) {
      for (const polozka of hodnota) {
        const nalez = najdi(polozka, nazev);
        if (nalez !== undefined) return nalez;
      }
    } else if (hodnota && typeof hodnota === "object") {
      const nalez = najdi(hodnota, nazev);
      if (nalez !== undefined) return nalez;
    }
  }
  return undefined;
}

/** Textová hodnota elementu; `xsi:nil` i prázdný element vrací null. */
export function text(uzel: unknown): string | null {
  if (uzel === null || uzel === undefined) return null;
  if (typeof uzel === "string") return uzel === "" ? null : uzel;
  if (typeof uzel === "number" || typeof uzel === "boolean") return String(uzel);
  if (typeof uzel === "object") {
    const o = uzel as Uzel;
    if (o["@_nil"] === "true" || o["@_nil"] === true) return null;
    const t = o["#text"];
    if (t === undefined || t === null || t === "") return null;
    return String(t);
  }
  return null;
}

/** Textová hodnota vnořeného elementu. */
export function textOf(uzel: unknown, nazev: string): string | null {
  return text(najdi(uzel, nazev));
}

/** Celé číslo vnořeného elementu, nebo null. */
export function intOf(uzel: unknown, nazev: string): number | null {
  const t = textOf(uzel, nazev);
  if (t === null) return null;
  const n = Number.parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

/** Hodnota atributu elementu. */
export function attr(uzel: unknown, nazev: string): string | null {
  if (!uzel || typeof uzel !== "object") return null;
  const hodnota = (uzel as Uzel)[`@_${nazev}`];
  return hodnota === undefined || hodnota === null ? null : String(hodnota);
}

/** Opakovací element → vždy pole (parser vrací jeden výskyt jako objekt). */
export function pole(uzel: unknown): unknown[] {
  if (uzel === null || uzel === undefined) return [];
  return Array.isArray(uzel) ? uzel : [uzel];
}

/**
 * Text SOAP Fault, pokud odpověď žádnou nenese, vrací null.
 * ISDS vrací Fault mimo jiné při špatně sestaveném požadavku.
 */
export function soapFault(korenXml: Uzel): string | null {
  const fault = najdi(korenXml, "Fault");
  if (fault === undefined) return null;
  const duvod =
    textOf(fault, "faultstring") ??
    textOf(fault, "Text") ??
    textOf(fault, "Reason") ??
    "SOAP Fault";
  return duvod;
}
