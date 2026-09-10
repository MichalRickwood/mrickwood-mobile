import { el, elPrazdny, escapeXml, soapEnvelope } from "./soap";
import type { IsdsCreateMessageInput } from "./types";

/**
 * Sestavení těl SOAP požadavků ISDS.
 *
 * Pořadí elementů odpovídá `xs:sequence` ve schématech (dbTypes.xsd) a
 * ukázkám v příručkách — ISDS je na pořadí citlivé. Povinné elementy, které
 * neplníme, se posílají jako `xsi:nil`.
 */

/** Čas pro dmFromTime / dmToTime. UTC se suffixem Z (kap. 1.3.2). */
export function isdsCas(datum: Date): string {
  return `${datum.toISOString().slice(0, 19)}Z`;
}

/* --------------------------- /DS/DsManage --------------------------- */

/** GetUserInfoFromLogin — vstup je prázdný `dbDummy` (typ tDummyInput). */
export function reqGetUserInfoFromLogin(): string {
  return soapEnvelope(`<v:GetUserInfoFromLogin>${elPrazdny("dbDummy")}</v:GetUserInfoFromLogin>`);
}

/** GetPasswordInfo — datum budoucí expirace hesla. */
export function reqGetPasswordInfo(): string {
  return soapEnvelope(`<v:GetPasswordInfo>${elPrazdny("dbDummy")}</v:GetPasswordInfo>`);
}

/* ------------------------------ /DS/df ------------------------------ */

/**
 * Vnitřek elementu `dbOwnerInfo` (typ tDbOwnerInfo) — všechny povinné
 * elementy v pořadí ze schématu; nepovinné `email` a `telNumber` vynecháváme.
 */
function dbOwnerInfo(zadani: { dbID?: string | null; ic?: string | null; dbType?: string | null }): string {
  return (
    el("dbID", zadani.dbID) +
    el("dbType", zadani.dbType) +
    el("ic", zadani.ic) +
    el("pnFirstName", null) +
    el("pnMiddleName", null) +
    el("pnLastName", null) +
    el("pnLastNameAtBirth", null) +
    el("firmName", null) +
    el("biDate", null) +
    el("biCity", null) +
    el("biCounty", null) +
    el("biState", null) +
    el("adCity", null) +
    el("adStreet", null) +
    el("adNumberInStreet", null) +
    el("adNumberInMunicipality", null) +
    el("adZipCode", null) +
    el("adState", null) +
    el("nationality", null) +
    el("identifier", null) +
    el("registryCode", null) +
    el("dbState", null) +
    el("dbEffectiveOVM", null) +
    el("dbOpenAddressing", null)
  );
}

/**
 * FindDataBox podle ID schránky. Je-li zadáno `dbID`, ostatní údaje ISDS
 * ignoruje a vrátí nejvýše jednu schránku (nebo stav 0002).
 */
export function reqFindDataBoxById(dbID: string): string {
  return soapEnvelope(
    `<v:FindDataBox><v:dbOwnerInfo>${dbOwnerInfo({ dbID })}</v:dbOwnerInfo></v:FindDataBox>`,
  );
}

/**
 * FindDataBox podle IČO. Z neOVM schránky (RWX je PO) se takto dají najít
 * jen schránky OVM — což je přesně náš případ.
 */
export function reqFindDataBoxByIco(ic: string, dbType: string | null = "OVM"): string {
  return soapEnvelope(
    `<v:FindDataBox><v:dbOwnerInfo>${dbOwnerInfo({ ic, dbType })}</v:dbOwnerInfo></v:FindDataBox>`,
  );
}

/* ------------------------------ /DS/dz ------------------------------ */

/** CreateMessage — obálka (dmEnvelope) + písemnosti (dmFiles). */
export function reqCreateMessage(vstup: IsdsCreateMessageInput): string {
  const obalka =
    el("dmSenderOrgUnit", null) +
    el("dmSenderOrgUnitNum", null) +
    el("dbIDRecipient", vstup.dbIDRecipient) +
    el("dmRecipientOrgUnit", null) +
    el("dmRecipientOrgUnitNum", null) +
    el("dmToHands", null) +
    el("dmAnnotation", vstup.dmAnnotation.slice(0, 255)) +
    el("dmRecipientRefNumber", null) +
    el("dmSenderRefNumber", vstup.dmSenderRefNumber ? vstup.dmSenderRefNumber.slice(0, 50) : null) +
    el("dmRecipientIdent", null) +
    el("dmSenderIdent", null) +
    el("dmLegalTitleLaw", vstup.dmLegalTitleLaw ?? null) +
    el("dmLegalTitleYear", vstup.dmLegalTitleYear ?? null) +
    el("dmLegalTitleSect", vstup.dmLegalTitleSect ?? null) +
    el("dmLegalTitlePar", null) +
    el("dmLegalTitlePoint", null) +
    // Ne do vlastních rukou; fikci doručení stejně smí zakázat jen OVM
    // odesílatel, u ostatních se příznak ignoruje (kap. 2.1).
    el("dmPersonalDelivery", "false") +
    el("dmAllowSubstDelivery", "false");

  const pisemnosti = vstup.files
    .map(
      (f) =>
        `<v:dmFile dmMimeType="${escapeXml(f.dmMimeType)}" dmFileMetaType="${escapeXml(
          f.dmFileMetaType,
        )}" dmFileDescr="${escapeXml(f.dmFileDescr)}">` +
        `<v:dmEncodedContent>${f.dmEncodedContent}</v:dmEncodedContent>` +
        `</v:dmFile>`,
    )
    .join("");

  return soapEnvelope(
    `<v:CreateMessage>` +
      `<v:dmEnvelope>${obalka}</v:dmEnvelope>` +
      `<v:dmFiles>${pisemnosti}</v:dmFiles>` +
      `</v:CreateMessage>`,
  );
}

/** MessageDownload — celá došlá zpráva včetně příloh (bez pečeti). */
export function reqMessageDownload(dmID: string): string {
  return soapEnvelope(`<v:MessageDownload>${el("dmID", dmID)}</v:MessageDownload>`);
}

/** SignedMessageDownload — došlá zpráva s pečetí správce ISDS (ZFO). */
export function reqSignedMessageDownload(dmID: string): string {
  return soapEnvelope(`<v:SignedMessageDownload>${el("dmID", dmID)}</v:SignedMessageDownload>`);
}

/* ------------------------------ /DS/dx ------------------------------ */

/** GetDeliveryInfo — doručenka k odeslané zprávě. */
export function reqGetDeliveryInfo(dmID: string): string {
  return soapEnvelope(`<v:GetDeliveryInfo>${el("dmID", dmID)}</v:GetDeliveryInfo>`);
}

export interface SeznamZpravVstup {
  od: Date;
  do: Date;
  /** Součet bitů stavů, -1 = bez filtru. */
  stavFiltr?: number;
  offset?: number | null;
  limit?: number | null;
}

/**
 * GetListOfReceivedMessages. POZOR: volání této služby způsobuje doručení
 * dodaných zpráv ze zákona (kap. 2.9.1) — nevoláme ho proto na pozadí,
 * ale jen na výslovný pokyn uživatele.
 */
export function reqGetListOfReceivedMessages(vstup: SeznamZpravVstup): string {
  return soapEnvelope(
    `<v:GetListOfReceivedMessages>` +
      el("dmFromTime", isdsCas(vstup.od)) +
      el("dmToTime", isdsCas(vstup.do)) +
      el("dmRecipientOrgUnitNum", null) +
      el("dmStatusFilter", vstup.stavFiltr ?? -1) +
      el("dmOffset", vstup.offset ?? null) +
      el("dmLimit", vstup.limit ?? null) +
      `</v:GetListOfReceivedMessages>`,
  );
}

/** GetListOfSentMessages — používá se k ověření, zda odeslání proběhlo. */
export function reqGetListOfSentMessages(vstup: SeznamZpravVstup): string {
  return soapEnvelope(
    `<v:GetListOfSentMessages>` +
      el("dmFromTime", isdsCas(vstup.od)) +
      el("dmToTime", isdsCas(vstup.do)) +
      el("dmSenderOrgUnitNum", null) +
      el("dmStatusFilter", vstup.stavFiltr ?? -1) +
      el("dmOffset", vstup.offset ?? null) +
      el("dmLimit", vstup.limit ?? null) +
      `</v:GetListOfSentMessages>`,
  );
}
