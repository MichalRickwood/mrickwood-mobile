import { attr, intOf, najdi, parseXml, pole, soapFault, text, textOf } from "./soap";
import {
  IsdsError,
  type IsdsDataBox,
  type IsdsDeliveryInfo,
  type IsdsDownloadedMessage,
  type IsdsFile,
  type IsdsFindDataBoxResult,
  type IsdsMessageRecord,
  type IsdsOwnerInfo,
  type IsdsStatus,
  type IsdsUserInfo,
  ISDS_OK,
} from "./types";

/**
 * Parsování odpovědí ISDS. Elementy hledáme podle holého názvu (prefixy
 * p:/q:/v20: se mezi službami liší), takže na pořadí v odpovědi nezáleží.
 */

/**
 * Přečte stav operace. Služby `dm_*` vracejí `dmStatus`, služby `db_*`
 * `dbStatus` — bereme první, který v odpovědi je.
 */
export function precistStav(koren: unknown): IsdsStatus {
  const uzel = najdi(koren, "dmStatus") ?? najdi(koren, "dbStatus");
  return {
    code: textOf(uzel, "dmStatusCode") ?? textOf(uzel, "dbStatusCode") ?? "",
    message: textOf(uzel, "dmStatusMessage") ?? textOf(uzel, "dbStatusMessage") ?? "",
  };
}

/**
 * Zpracuje odpověď: SOAP Fault i nenulový stavový kód skončí `IsdsError`.
 * `povoleneKody` slouží službám, kde je nenulový kód informací (FindDataBox
 * vrací 0002 „nic nenalezeno" a 0003 „výsledek oříznut").
 */
export function overitOdpoved(xml: string, operace: string, povoleneKody: string[] = []): {
  koren: unknown;
  stav: IsdsStatus;
} {
  const koren = parseXml(xml);
  const fault = soapFault(koren);
  if (fault) throw new IsdsError(operace, "SOAP_FAULT", fault);
  const stav = precistStav(koren);
  if (stav.code !== ISDS_OK && !povoleneKody.includes(stav.code)) {
    throw new IsdsError(operace, stav.code || "?", stav.message || `Operace ${operace} selhala.`);
  }
  return { koren, stav };
}

/* ------------------------------ DsManage ------------------------------ */

export function parseUserInfo(xml: string): IsdsUserInfo {
  const { koren } = overitOdpoved(xml, "GetUserInfoFromLogin");
  const u = najdi(koren, "dbUserInfo");
  return {
    pnGivenNames: textOf(u, "pnGivenNames"),
    pnLastName: textOf(u, "pnLastName"),
    isdsID: textOf(u, "isdsID"),
    userType: textOf(u, "userType"),
    userPrivils: textOf(u, "userPrivils"),
    ic: textOf(u, "ic"),
    firmName: textOf(u, "firmName"),
  };
}

export function parseOwnerInfo(xml: string): IsdsOwnerInfo {
  const { koren } = overitOdpoved(xml, "GetOwnerInfoFromLogin");
  const o = najdi(koren, "dbOwnerInfo");
  return {
    dbID: textOf(o, "dbID"),
    dbType: textOf(o, "dbType"),
    ic: textOf(o, "ic"),
    firmName: textOf(o, "firmName"),
    pnGivenNames: textOf(o, "pnGivenNames"),
    pnLastName: textOf(o, "pnLastName"),
  };
}

/** GetPasswordInfo — null znamená, že heslo neexpiruje. */
export function parsePasswordInfo(xml: string): string | null {
  const { koren } = overitOdpoved(xml, "GetPasswordInfo");
  return textOf(koren, "pswExpDate");
}

/* -------------------------------- df -------------------------------- */

function parseDataBox(uzel: unknown): IsdsDataBox {
  return {
    dbID: textOf(uzel, "dbID"),
    dbType: textOf(uzel, "dbType"),
    ic: textOf(uzel, "ic"),
    firmName: textOf(uzel, "firmName"),
    pnGivenNames: textOf(uzel, "pnGivenNames"),
    pnLastName: textOf(uzel, "pnLastName"),
    adCity: textOf(uzel, "adCity"),
    adStreet: textOf(uzel, "adStreet"),
    adZipCode: textOf(uzel, "adZipCode"),
    dbState: intOf(uzel, "dbState"),
  };
}

export function parseFindDataBox(xml: string): IsdsFindDataBoxResult {
  // 0002 = nic nenalezeno, 0003 = oříznuto, 0009 = neOVM schránka bez PDZ.
  const { koren, stav } = overitOdpoved(xml, "FindDataBox", ["0002", "0003", "0009"]);
  const vysledky = najdi(koren, "dbResults");
  const schranky = pole(najdi(vysledky, "dbOwnerInfo")).map(parseDataBox);
  return { status: stav, schranky };
}

/* -------------------------------- dz -------------------------------- */

/** CreateMessage → ID odeslané zprávy. */
export function parseCreateMessage(xml: string): string {
  const { koren } = overitOdpoved(xml, "CreateMessage");
  const dmID = textOf(koren, "dmID");
  if (!dmID) throw new IsdsError("CreateMessage", "?", "ISDS nevrátilo ID odeslané zprávy.");
  return dmID;
}

function parseFiles(uzel: unknown): IsdsFile[] {
  return pole(najdi(uzel, "dmFile")).map((f) => ({
    dmFileDescr: attr(f, "dmFileDescr") ?? "priloha",
    dmMimeType: attr(f, "dmMimeType") ?? "application/octet-stream",
    dmFileMetaType: (attr(f, "dmFileMetaType") ?? "enclosure") as IsdsFile["dmFileMetaType"],
    // Base64 může přijít zalomené na řádky — server ho chce v jednom kuse.
    dmEncodedContent: (textOf(f, "dmEncodedContent") ?? "").replace(/\s+/g, ""),
  }));
}

/** Obálka zprávy — sdílená pro seznamy, MessageDownload i doručenku. */
export function parseObalka(uzel: unknown): IsdsMessageRecord {
  return {
    dmID: textOf(uzel, "dmID") ?? "",
    dbIDSender: textOf(uzel, "dbIDSender"),
    dmSender: textOf(uzel, "dmSender"),
    dmSenderAddress: textOf(uzel, "dmSenderAddress"),
    dbIDRecipient: textOf(uzel, "dbIDRecipient"),
    dmRecipient: textOf(uzel, "dmRecipient"),
    dmAnnotation: textOf(uzel, "dmAnnotation"),
    dmSenderRefNumber: textOf(uzel, "dmSenderRefNumber"),
    dmRecipientRefNumber: textOf(uzel, "dmRecipientRefNumber"),
    dmMessageStatus: intOf(uzel, "dmMessageStatus"),
    dmDeliveryTime: textOf(uzel, "dmDeliveryTime"),
    dmAcceptanceTime: textOf(uzel, "dmAcceptanceTime"),
    vodz: (attr(uzel, "dmVODZ") ?? "").toLowerCase() === "true",
  };
}

export function parseMessageDownload(xml: string): IsdsDownloadedMessage {
  const { koren } = overitOdpoved(xml, "MessageDownload");
  const zprava = najdi(koren, "dmReturnedMessage");
  const dm = najdi(zprava, "dmDm");
  const obalka = parseObalka(dm);
  // Čas dodání/doručení a stav jsou vedle dmDm, ne uvnitř.
  obalka.dmDeliveryTime = textOf(zprava, "dmDeliveryTime") ?? obalka.dmDeliveryTime;
  obalka.dmAcceptanceTime = textOf(zprava, "dmAcceptanceTime") ?? obalka.dmAcceptanceTime;
  obalka.dmMessageStatus = intOf(zprava, "dmMessageStatus") ?? obalka.dmMessageStatus;
  return { envelope: obalka, files: parseFiles(najdi(dm, "dmFiles")) };
}

/** SignedMessageDownload → base64 celé podepsané zprávy (obsah ZFO). */
export function parseSignedMessageDownload(xml: string): string {
  const { koren } = overitOdpoved(xml, "SignedMessageDownload");
  const podpis = textOf(koren, "dmSignature");
  if (!podpis) throw new IsdsError("SignedMessageDownload", "?", "ISDS nevrátilo podepsanou zprávu.");
  return podpis.replace(/\s+/g, "");
}

/* -------------------------------- dx -------------------------------- */

export function parseSeznamZprav(xml: string, operace: string): IsdsMessageRecord[] {
  const { koren } = overitOdpoved(xml, operace);
  const zaznamy = najdi(koren, "dmRecords");
  return pole(najdi(zaznamy, "dmRecord")).map(parseObalka);
}

export function parseDeliveryInfo(xml: string): IsdsDeliveryInfo {
  const { koren } = overitOdpoved(xml, "GetDeliveryInfo");
  const dorucenka = najdi(koren, "dmDelivery");
  const dm = najdi(dorucenka, "dmDm");
  const udalosti: IsdsDeliveryInfo["udalosti"] = [];
  for (const u of pole(najdi(najdi(dorucenka, "dmEvents"), "dmEvent"))) {
    // Obvykle je každá událost vlastní element, ale ukázka v příručce má
    // uvnitř jednoho dmEvent víc dvojic čas+popis — zvládneme obojí.
    const casy = pole((u as Record<string, unknown>)?.dmEventTime);
    const popisy = pole((u as Record<string, unknown>)?.dmEventDescr);
    const pocet = Math.max(casy.length, popisy.length, 1);
    for (let i = 0; i < pocet; i++) {
      udalosti.push({ cas: text(casy[i]), popis: text(popisy[i]) });
    }
  }
  return {
    dmID: textOf(dm, "dmID") ?? "",
    dmMessageStatus: intOf(dorucenka, "dmMessageStatus"),
    dmDeliveryTime: textOf(dorucenka, "dmDeliveryTime"),
    dmAcceptanceTime: textOf(dorucenka, "dmAcceptanceTime"),
    udalosti,
  };
}
