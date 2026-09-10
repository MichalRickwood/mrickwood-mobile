/**
 * Jednotkové testy klienta ISDS — sestavení požadavků a parsování odpovědí
 * na ukázkách z příruček v `~/firmy/rwx/isds-docs/pril_2/`.
 *
 * Repo nemá test runner, soubor je proto samostatně spustitelný:
 *   npx tsx lib/isds/__tests__/isds.test.ts
 * Neimportuje nic z React Native, běží v čistém Node.
 */

import { base64Utf8 } from "../base64";
import {
  isdsCas,
  reqCreateMessage,
  reqFindDataBoxById,
  reqGetDeliveryInfo,
  reqGetListOfReceivedMessages,
  reqGetListOfSentMessages,
  reqGetUserInfoFromLogin,
  reqMessageDownload,
  reqSignedMessageDownload,
} from "../requests";
import {
  parseCreateMessage,
  parseDeliveryInfo,
  parseFindDataBox,
  parseMessageDownload,
  parsePasswordInfo,
  parseSeznamZprav,
  parseSignedMessageDownload,
  parseUserInfo,
} from "../responses";
import { jeIsdsError, jeOvm } from "../types";

let bezi = 0;
let padlo = 0;

function test(nazev: string, fn: () => void): void {
  bezi++;
  try {
    fn();
    console.log(`  ok   ${nazev}`);
  } catch (e) {
    padlo++;
    console.log(`  CHYBA ${nazev}\n        ${(e as Error).message}`);
  }
}

function equal(skutecnost: unknown, ocekavani: unknown, co = ""): void {
  const a = JSON.stringify(skutecnost);
  const b = JSON.stringify(ocekavani);
  if (a !== b) throw new Error(`${co}: čekáno ${b}, dostal ${a}`);
}

function obsahuje(text: string, podretezec: string): void {
  if (!text.includes(podretezec)) throw new Error(`chybí «${podretezec}»`);
}

/** Pořadí elementů — ISDS je na sekvenci ze schématu citlivé. */
function poradi(xml: string, nazvy: string[]): void {
  let pozice = -1;
  for (const n of nazvy) {
    const i = xml.indexOf(`<v:${n}`);
    if (i < 0) throw new Error(`element ${n} chybí`);
    if (i < pozice) throw new Error(`element ${n} je mimo pořadí`);
    pozice = i;
  }
}

/* =========================== sestavení požadavků =========================== */

console.log("\nSestavení požadavků");

test("SOAP obálka nese jmenný prostor v20 a xsi", () => {
  const xml = reqGetUserInfoFromLogin();
  obsahuje(xml, 'xmlns:v="http://isds.czechpoint.cz/v20"');
  obsahuje(xml, 'xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"');
  obsahuje(xml, 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
  // tDummyInput = prázdný řetězec v dbDummy, ne xsi:nil
  obsahuje(xml, "<v:GetUserInfoFromLogin><v:dbDummy></v:dbDummy></v:GetUserInfoFromLogin>");
});

test("FindDataBox drží pořadí elementů tDbOwnerInfo", () => {
  const xml = reqFindDataBoxById("c8nc4q5");
  obsahuje(xml, "<v:dbID>c8nc4q5</v:dbID>");
  poradi(xml, [
    "dbID",
    "dbType",
    "ic",
    "pnFirstName",
    "pnMiddleName",
    "pnLastName",
    "pnLastNameAtBirth",
    "firmName",
    "biDate",
    "biCity",
    "biCounty",
    "biState",
    "adCity",
    "adStreet",
    "adNumberInStreet",
    "adNumberInMunicipality",
    "adZipCode",
    "adState",
    "nationality",
    "identifier",
    "registryCode",
    "dbState",
    "dbEffectiveOVM",
    "dbOpenAddressing",
  ]);
  // nepovinné elementy schématu neposíláme vůbec
  if (xml.includes("<v:email")) throw new Error("email se posílat nemá");
});

test("CreateMessage drží pořadí obálky podle ukázky v příručce", () => {
  const xml = reqCreateMessage({
    dbIDRecipient: "kv62bqf",
    dmAnnotation: "Žádost o uveřejnění písemné zprávy",
    dmSenderRefNumber: "VER-12-1",
    files: [
      {
        dmFileDescr: "dopis.pdf",
        dmMimeType: "application/pdf",
        dmFileMetaType: "main",
        dmEncodedContent: "JVBERi0=",
      },
    ],
  });
  poradi(xml, [
    "dmEnvelope",
    "dmSenderOrgUnit",
    "dmSenderOrgUnitNum",
    "dbIDRecipient",
    "dmRecipientOrgUnit",
    "dmRecipientOrgUnitNum",
    "dmToHands",
    "dmAnnotation",
    "dmRecipientRefNumber",
    "dmSenderRefNumber",
    "dmRecipientIdent",
    "dmSenderIdent",
    "dmLegalTitleLaw",
    "dmLegalTitleYear",
    "dmLegalTitleSect",
    "dmLegalTitlePar",
    "dmLegalTitlePoint",
    "dmPersonalDelivery",
    "dmAllowSubstDelivery",
    "dmFiles",
    "dmFile",
    "dmEncodedContent",
  ]);
  obsahuje(xml, "<v:dbIDRecipient>kv62bqf</v:dbIDRecipient>");
  obsahuje(xml, "<v:dmSenderRefNumber>VER-12-1</v:dmSenderRefNumber>");
  obsahuje(xml, '<v:dmFile dmMimeType="application/pdf" dmFileMetaType="main" dmFileDescr="dopis.pdf">');
  obsahuje(xml, "<v:dmEncodedContent>JVBERi0=</v:dmEncodedContent>");
  obsahuje(xml, "<v:dmPersonalDelivery>false</v:dmPersonalDelivery>");
});

test("CreateMessage escapuje text a ořezává délky", () => {
  const xml = reqCreateMessage({
    dbIDRecipient: "abc1234",
    dmAnnotation: "A & B <c> ".repeat(60),
    dmSenderRefNumber: "Z".repeat(80),
    files: [{ dmFileDescr: 'a"b.pdf', dmMimeType: "application/pdf", dmFileMetaType: "main", dmEncodedContent: "AA==" }],
  });
  obsahuje(xml, "&amp;");
  obsahuje(xml, "&lt;c&gt;");
  obsahuje(xml, 'dmFileDescr="a&quot;b.pdf"');
  const anotace = /<v:dmAnnotation>([\s\S]*?)<\/v:dmAnnotation>/.exec(xml)![1];
  // 255 znaků zdrojového textu, po escapování je řetězec delší
  equal(anotace.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").length, 255, "délka anotace");
  const znacka = /<v:dmSenderRefNumber>(.*?)<\/v:dmSenderRefNumber>/.exec(xml)![1];
  equal(znacka.length, 50, "délka naší značky");
});

test("Seznamy zpráv mají správné pořadí a formát času", () => {
  const od = new Date(Date.UTC(2013, 2, 25, 10, 0, 0));
  const doo = new Date(Date.UTC(2013, 2, 25, 12, 0, 0));
  const prijate = reqGetListOfReceivedMessages({ od, do: doo, limit: 1000 });
  poradi(prijate, ["dmFromTime", "dmToTime", "dmRecipientOrgUnitNum", "dmStatusFilter", "dmOffset", "dmLimit"]);
  obsahuje(prijate, "<v:dmFromTime>2013-03-25T10:00:00Z</v:dmFromTime>");
  obsahuje(prijate, "<v:dmStatusFilter>-1</v:dmStatusFilter>");
  obsahuje(prijate, '<v:dmOffset xsi:nil="true"/>');
  const odeslane = reqGetListOfSentMessages({ od, do: doo });
  poradi(odeslane, ["dmFromTime", "dmToTime", "dmSenderOrgUnitNum", "dmStatusFilter", "dmOffset", "dmLimit"]);
  equal(isdsCas(od), "2013-03-25T10:00:00Z", "isdsCas");
});

test("Stahování a doručenka posílají jen dmID", () => {
  obsahuje(reqMessageDownload("1446014"), "<v:MessageDownload><v:dmID>1446014</v:dmID></v:MessageDownload>");
  obsahuje(
    reqSignedMessageDownload("1446014"),
    "<v:SignedMessageDownload><v:dmID>1446014</v:dmID></v:SignedMessageDownload>",
  );
  obsahuje(reqGetDeliveryInfo("1721"), "<v:GetDeliveryInfo><v:dmID>1721</v:dmID></v:GetDeliveryInfo>");
});

/* ============================ parsování odpovědí ============================ */

console.log("\nParsování odpovědí");

// Ukázka z WS_souvisejici_s_pristupem_do_ISDS.txt, kap. 1.7
const UKAZKA_USER_INFO = `<p:GetUserInfoFromLoginResponse xmlns:p="http://isds.czechpoint.cz/v20"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <p:dbUserInfo>
    <p:pnGivenNames>Jan Petr</p:pnGivenNames>
    <p:pnLastName>Šmída</p:pnLastName>
    <p:adCity>Náchod</p:adCity>
    <p:adNumberInStreet xsi:nil="true"/>
    <p:biDate>1967-01-07</p:biDate>
    <p:isdsID>DS_wexphsydx</p:isdsID>
    <p:userType>PRIMARY_USER</p:userType>
    <p:userPrivils>255</p:userPrivils>
    <p:ic xsi:nil="true"/>
    <p:firmName xsi:nil="true"/>
  </p:dbUserInfo>
  <p:dbStatus>
    <p:dbStatusCode>0000</p:dbStatusCode>
    <p:dbStatusMessage>Provedeno úspěšně.</p:dbStatusMessage>
  </p:dbStatus>
</p:GetUserInfoFromLoginResponse>`;

test("GetUserInfoFromLogin — jméno, role, nil elementy", () => {
  const u = parseUserInfo(UKAZKA_USER_INFO);
  equal(u.pnGivenNames, "Jan Petr", "jména");
  equal(u.pnLastName, "Šmída", "příjmení");
  equal(u.isdsID, "DS_wexphsydx", "isdsID");
  equal(u.userType, "PRIMARY_USER", "typ uživatele");
  equal(u.userPrivils, "255", "oprávnění");
  equal(u.ic, null, "IČ je xsi:nil → null");
  equal(u.firmName, null, "firmName je xsi:nil → null");
});

// Ukázka z téže příručky, kap. 1.8
test("GetPasswordInfo — datum expirace i NIL", () => {
  const s = `<p:GetPasswordInfoResponse xmlns:p="http://isds.czechpoint.cz/v20"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <p:pswExpDate>2011-07-06T13:33:39.000+02:00</p:pswExpDate>
  <p:dbStatus><p:dbStatusCode>0000</p:dbStatusCode><p:dbStatusMessage>Provedeno úspěšně.</p:dbStatusMessage></p:dbStatus>
</p:GetPasswordInfoResponse>`;
  equal(parsePasswordInfo(s), "2011-07-06T13:33:39.000+02:00", "expirace");
  const bezExpirace = s.replace(
    "<p:pswExpDate>2011-07-06T13:33:39.000+02:00</p:pswExpDate>",
    '<p:pswExpDate xsi:nil="true"/>',
  );
  equal(parsePasswordInfo(bezExpirace), null, "heslo neexpiruje");
});

test("FindDataBox — nalezená OVM schránka", () => {
  const s = `<q:FindDataBoxResponse xmlns:q="http://isds.czechpoint.cz/v20"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <q:dbResults>
    <q:dbOwnerInfo>
      <q:dbID>e7wafrq</q:dbID>
      <q:dbType>OVM</q:dbType>
      <q:ic>00075370</q:ic>
      <q:firmName>Město Česká Třebová</q:firmName>
      <q:adCity>Česká Třebová</q:adCity>
      <q:adStreet>Staré náměstí</q:adStreet>
      <q:adZipCode>56002</q:adZipCode>
      <q:dbState>1</q:dbState>
    </q:dbOwnerInfo>
  </q:dbResults>
  <q:dbStatus><q:dbStatusCode>0000</q:dbStatusCode><q:dbStatusMessage>Provedeno úspěšně.</q:dbStatusMessage></q:dbStatus>
</q:FindDataBoxResponse>`;
  const r = parseFindDataBox(s);
  equal(r.status.code, "0000", "stav");
  equal(r.schranky.length, 1, "počet schránek");
  equal(r.schranky[0].dbID, "e7wafrq", "ID schránky");
  equal(r.schranky[0].dbType, "OVM", "typ");
  equal(r.schranky[0].ic, "00075370", "IČO s vedoucími nulami zůstává řetězcem");
  equal(r.schranky[0].dbState, 1, "stav schránky");
});

test("FindDataBox — 0002 není chyba, jen prázdný výsledek", () => {
  const s = `<q:FindDataBoxResponse xmlns:q="http://isds.czechpoint.cz/v20">
  <q:dbResults/>
  <q:dbStatus><q:dbStatusCode>0002</q:dbStatusCode>
  <q:dbStatusMessage>Podmínkám neodpovídá žádná datová schránka</q:dbStatusMessage></q:dbStatus>
</q:FindDataBoxResponse>`;
  const r = parseFindDataBox(s);
  equal(r.status.code, "0002", "stav");
  equal(r.schranky.length, 0, "žádná schránka");
});

test("Nenulový stavový kód skončí IsdsError", () => {
  const s = `<p:CreateMessageResponse xmlns:p="http://isds.czechpoint.cz/v20">
  <p:dmStatus><p:dmStatusCode>1233</p:dmStatusCode>
  <p:dmStatusMessage>Odesilatel ani příjemce datové zprávy není OVM.</p:dmStatusMessage></p:dmStatus>
</p:CreateMessageResponse>`;
  let chyba: unknown = null;
  try {
    parseCreateMessage(s);
  } catch (e) {
    chyba = e;
  }
  if (!jeIsdsError(chyba)) throw new Error("čekal jsem IsdsError");
  equal(chyba.kod, "1233", "kód chyby");
  equal(chyba.operace, "CreateMessage", "operace");
});

test("SOAP Fault skončí IsdsError", () => {
  const s = `<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body><SOAP-ENV:Fault>
    <faultcode>SOAP-ENV:Client</faultcode>
    <faultstring>Chybná struktura požadavku</faultstring>
  </SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
  let chyba: unknown = null;
  try {
    parseCreateMessage(s);
  } catch (e) {
    chyba = e;
  }
  if (!jeIsdsError(chyba)) throw new Error("čekal jsem IsdsError");
  equal(chyba.kod, "SOAP_FAULT", "kód");
  equal(chyba.message, "Chybná struktura požadavku", "text");
});

test("CreateMessage — ID odeslané zprávy v SOAP obálce", () => {
  const s = `<?xml version="1.0"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body>
<p:CreateMessageResponse xmlns:p="http://isds.czechpoint.cz/v20">
  <p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode><p:dmStatusMessage>Provedeno úspěšně.</p:dmStatusMessage></p:dmStatus>
  <p:dmID>1835603</p:dmID>
</p:CreateMessageResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
  equal(parseCreateMessage(s), "1835603", "dmID");
});

// Ukázka z WS_manipulace_s_datovymi_zpravami.txt, kap. 2.6.1 (base64 zkrácené)
const UKAZKA_MESSAGE_DOWNLOAD = `<q:MessageDownloadResponse xmlns:q="http://isds.czechpoint.cz/v20"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <q:dmReturnedMessage>
     <p:dmDm xmlns:p="http://isds.czechpoint.cz/v20">
        <p:dmID>1446014</p:dmID>
        <p:dbIDSender>9ky2eiu</p:dbIDSender>
        <p:dmSender>Jan Bohuslav Šimek</p:dmSender>
        <p:dmSenderAddress>Malá 1, 162 00, Praha 6, CZ</p:dmSenderAddress>
        <p:dmSenderType>40</p:dmSenderType>
        <p:dmRecipient>Jan Testovací - Test exekutor</p:dmRecipient>
        <p:dbIDRecipient>csy2btu</p:dbIDRecipient>
        <p:dmAnnotation>MTOM zpráva</p:dmAnnotation>
        <p:dmRecipientRefNumber xsi:nil="true"/>
        <p:dmSenderRefNumber xsi:nil="true"/>
        <p:dmPersonalDelivery>false</p:dmPersonalDelivery>
        <p:dmAllowSubstDelivery>true</p:dmAllowSubstDelivery>
        <p:dmFiles>
           <p:dmFile dmFormat="" dmMimeType="text/plain" dmFileDescr="pruvodni_dopis.txt"
             dmUpFileGuid="" dmFileMetaType="main" dmFileGuid="">
              <p:dmEncodedContent>RG9icj1GRCBkZW4uDQoNClBvcz1FRGw9RTFt
              IHBvPTlFYWRvdmFub3UgZGF0b3ZvdSB6cHI9RTF2dS4=</p:dmEncodedContent>
           </p:dmFile>
           <p:dmFile dmFormat="" dmMimeType="image/jpeg" dmFileDescr="snimek.jpg"
             dmUpFileGuid="" dmFileMetaType="enclosure" dmFileGuid="">
             <p:dmEncodedContent>/9j/4AAQSkZJRgABAAEAYABgAAD=</p:dmEncodedContent>
           </p:dmFile>
        </p:dmFiles>
     </p:dmDm>
     <q:dmHash algorithm="SHA-256">u+VxSlr1l5eWfa+5dbU96wW8Rchai9+5xzktPOLriT0=</q:dmHash>
     <q:dmQTimestamp>MIAGCSqGSIb3DQEHAqCA</q:dmQTimestamp>
     <q:dmDeliveryTime>2018-10-03T07:48:36.718+02:00</q:dmDeliveryTime>
     <q:dmAcceptanceTime>2018-10-03T11:02:11.001+02:00</q:dmAcceptanceTime>
     <q:dmMessageStatus>6</q:dmMessageStatus>
     <q:dmAttachmentSize>107</q:dmAttachmentSize>
  </q:dmReturnedMessage>
  <q:dmStatus>
     <q:dmStatusCode>0000</q:dmStatusCode>
     <q:dmStatusMessage>Provedeno úspěšně.</q:dmStatusMessage>
  </q:dmStatus>
</q:MessageDownloadResponse>`;

test("MessageDownload — obálka i obě přílohy", () => {
  const z = parseMessageDownload(UKAZKA_MESSAGE_DOWNLOAD);
  equal(z.envelope.dmID, "1446014", "dmID");
  equal(z.envelope.dbIDSender, "9ky2eiu", "odesílatel");
  equal(z.envelope.dmSender, "Jan Bohuslav Šimek", "jméno odesílatele");
  equal(z.envelope.dmAnnotation, "MTOM zpráva", "věc");
  equal(z.envelope.dmSenderRefNumber, null, "nil číslo jednací");
  equal(z.envelope.dmMessageStatus, 6, "stav ze sourozence dmDm");
  equal(z.envelope.dmDeliveryTime, "2018-10-03T07:48:36.718+02:00", "čas dodání");
  equal(z.files.length, 2, "počet příloh");
  equal(z.files[0].dmFileDescr, "pruvodni_dopis.txt", "název 1. přílohy");
  equal(z.files[0].dmMimeType, "text/plain", "mime 1. přílohy");
  equal(z.files[0].dmFileMetaType, "main", "druh 1. přílohy");
  // zalomený base64 se slepí do jednoho řádku
  equal(
    z.files[0].dmEncodedContent,
    "RG9icj1GRCBkZW4uDQoNClBvcz1FRGw9RTFtIHBvPTlFYWRvdmFub3UgZGF0b3ZvdSB6cHI9RTF2dS4=",
    "obsah 1. přílohy",
  );
  equal(z.files[1].dmFileDescr, "snimek.jpg", "název 2. přílohy");
  equal(z.files[1].dmFileMetaType, "enclosure", "druh 2. přílohy");
});

test("SignedMessageDownload — base64 ZFO bez zalomení", () => {
  const s = `<q:SignedMessageDownloadResponse xmlns:q="http://isds.czechpoint.cz/v20">
  <q:dmSignature>MIAGCSqGSIb3DQEHAqCAMIACAQEx
  CzAJBgUrDgMCGgUAMIAG</q:dmSignature>
  <q:dmStatus><q:dmStatusCode>0000</q:dmStatusCode><q:dmStatusMessage>Provedeno úspěšně.</q:dmStatusMessage></q:dmStatus>
</q:SignedMessageDownloadResponse>`;
  equal(parseSignedMessageDownload(s), "MIAGCSqGSIb3DQEHAqCAMIACAQExCzAJBgUrDgMCGgUAMIAG", "ZFO");
});

// Ukázka z kap. 2.9 (zkrácená na dva záznamy)
const UKAZKA_SEZNAM = `<q:GetListOfReceivedMessagesResponse xmlns:q="http://isds.czechpoint.cz/v20"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <q:dmRecords>
      <q:dmRecord dmVODZ="true">
         <q:dmOrdinal>1</q:dmOrdinal>
         <q:dmID>178021</q:dmID>
         <q:dbIDSender>xfdgr5q</q:dbIDSender>
         <q:dmSender>testovací PO</q:dmSender>
         <q:dbIDRecipient>4gheef</q:dbIDRecipient>
         <q:dmAnnotation>zkušební zpráva</q:dmAnnotation>
         <q:dmSenderRefNumber xsi:nil="true"/>
         <q:dmRecipientRefNumber xsi:nil="true"/>
         <q:dmMessageStatus>6</q:dmMessageStatus>
         <q:dmDeliveryTime>2010-03-31T11:41:10.760+02:00</q:dmDeliveryTime>
         <q:dmAcceptanceTime>2010-04-05T10:40:11.000+02:00</q:dmAcceptanceTime>
      </q:dmRecord>
      <q:dmRecord dmType="I">
         <q:dmOrdinal>2</q:dmOrdinal>
         <q:dmID>178025</q:dmID>
         <q:dbIDSender>t4d5ggh</q:dbIDSender>
         <q:dmSender>testovací schránka 008</q:dmSender>
         <q:dmAnnotation>testovací zpráva</q:dmAnnotation>
         <q:dmSenderRefNumber>VER-42-1</q:dmSenderRefNumber>
         <q:dmRecipientRefNumber>VER-42-1</q:dmRecipientRefNumber>
         <q:dmMessageStatus>5</q:dmMessageStatus>
         <q:dmDeliveryTime>2010-03-24T16:07:26.117+01:00</q:dmDeliveryTime>
      </q:dmRecord>
   </q:dmRecords>
   <q:dmStatus><q:dmStatusCode>0000</q:dmStatusCode><q:dmStatusMessage>Provedeno úspěšně.</q:dmStatusMessage></q:dmStatus>
</q:GetListOfReceivedMessagesResponse>`;

test("GetListOfReceivedMessages — oba záznamy, příznak VoDZ, značka příjemce", () => {
  const z = parseSeznamZprav(UKAZKA_SEZNAM, "GetListOfReceivedMessages");
  equal(z.length, 2, "počet záznamů");
  equal(z[0].dmID, "178021", "dmID 1");
  equal(z[0].vodz, true, "VoDZ příznak");
  equal(z[0].dmMessageStatus, 6, "stav 1");
  equal(z[1].vodz, false, "běžná zpráva");
  equal(z[1].dmRecipientRefNumber, "VER-42-1", "naše značka v odpovědi zadavatele");
  equal(z[1].dmAcceptanceTime, null, "chybějící čas doručení");
});

test("Seznam s jediným záznamem se vrací jako pole", () => {
  const jeden = UKAZKA_SEZNAM.replace(/<q:dmRecord dmType="I">[\s\S]*?<\/q:dmRecord>/, "");
  equal(parseSeznamZprav(jeden, "GetListOfReceivedMessages").length, 1, "jeden záznam");
});

// Ukázka z kap. 2.8.1 — příručka má všechny dvojice čas+popis v jednom dmEvent
const UKAZKA_DORUCENKA = `<q:GetDeliveryInfoResponse xmlns:q="http://isds.czechpoint.cz/v20"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <q:dmDelivery>
      <p:dmDm xmlns:p="http://isds.czechpoint.cz/v20">
         <p:dmID>1721</p:dmID>
         <p:dbIDSender>ximacm6</p:dbIDSender>
         <p:dbIDRecipient>fcx6dqk</p:dbIDRecipient>
         <p:dmAnnotation>test 2 nedoručenky</p:dmAnnotation>
      </p:dmDm>
      <q:dmHash algorithm="SHA-256">ovssggE+BBpZkF92n8hPSLu5Oi0=</q:dmHash>
      <q:dmDeliveryTime>2009-06-23T19:51:23.256+02:00</q:dmDeliveryTime>
      <q:dmAcceptanceTime xsi:nil="true"/>
      <q:dmMessageStatus>8</q:dmMessageStatus>
      <q:dmEvents>
         <q:dmEvent>
            <q:dmEventTime>2009-06-23T19:51:20.100+02:00</q:dmEventTime>
            <q:dmEventDescr>EV0: Datová zpráva byla podána.</q:dmEventDescr>
            <q:dmEventTime>2009-06-23T19:51:21.130+02:00</q:dmEventTime>
            <q:dmEventDescr>EV5: Datová zpráva byla dodána.</q:dmEventDescr>
            <q:dmEventTime>2009-06-23T19:52:49.029+02:00</q:dmEventTime>
            <q:dmEventDescr>EV3: Datová schránka adresáta byla znepřístupněna.</q:dmEventDescr>
         </q:dmEvent>
      </q:dmEvents>
   </q:dmDelivery>
   <q:dmStatus><q:dmStatusCode>0000</q:dmStatusCode><q:dmStatusMessage>Provedeno úspěšně.</q:dmStatusMessage></q:dmStatus>
</q:GetDeliveryInfoResponse>`;

test("GetDeliveryInfo — stav, časy a všechny události", () => {
  const d = parseDeliveryInfo(UKAZKA_DORUCENKA);
  equal(d.dmID, "1721", "dmID");
  equal(d.dmMessageStatus, 8, "stav = nedoručitelná");
  equal(d.dmDeliveryTime, "2009-06-23T19:51:23.256+02:00", "čas dodání");
  equal(d.dmAcceptanceTime, null, "nedoručeno");
  equal(d.udalosti.length, 3, "počet událostí");
  equal(d.udalosti[0].popis, "EV0: Datová zpráva byla podána.", "první událost");
  equal(d.udalosti[2].cas, "2009-06-23T19:52:49.029+02:00", "čas poslední události");
});

test("GetDeliveryInfo — každá událost ve vlastním dmEvent", () => {
  const s = UKAZKA_DORUCENKA.replace(
    /<q:dmEvents>[\s\S]*?<\/q:dmEvents>/,
    `<q:dmEvents>
      <q:dmEvent><q:dmEventTime>2026-09-01T08:00:00+02:00</q:dmEventTime>
        <q:dmEventDescr>EV0: podána</q:dmEventDescr></q:dmEvent>
      <q:dmEvent><q:dmEventTime>2026-09-01T08:00:05+02:00</q:dmEventTime>
        <q:dmEventDescr>EV5: dodána</q:dmEventDescr></q:dmEvent>
    </q:dmEvents>`,
  );
  const d = parseDeliveryInfo(s);
  equal(d.udalosti.length, 2, "počet událostí");
  equal(d.udalosti[1].popis, "EV5: dodána", "druhá událost");
});

/* ================================ pomocné ================================ */

console.log("\nPomocné funkce");

test("jeOvm pustí jen schránky orgánu veřejné moci", () => {
  for (const t of ["OVM", "OVM_PO", "OVM_REQ", "OVM_FO", "OVM_PFO", "ovm"]) {
    if (!jeOvm(t)) throw new Error(`${t} má projít`);
  }
  for (const t of ["PO", "PO_REQ", "PFO", "PFO_ADVOK", "FO", "", null, undefined]) {
    if (jeOvm(t)) throw new Error(`${String(t)} nemá projít`);
  }
});

test("base64Utf8 zvládne diakritiku i doplňkové znaky", () => {
  equal(base64Utf8("login:heslo"), Buffer.from("login:heslo", "utf8").toString("base64"), "ascii");
  equal(base64Utf8("Šmída:Tajné1"), Buffer.from("Šmída:Tajné1", "utf8").toString("base64"), "diakritika");
  equal(base64Utf8("a"), Buffer.from("a", "utf8").toString("base64"), "padding 2");
  equal(base64Utf8("ab"), Buffer.from("ab", "utf8").toString("base64"), "padding 1");
  equal(base64Utf8("😀"), Buffer.from("😀", "utf8").toString("base64"), "surrogate pár");
});

console.log(`\n${bezi - padlo}/${bezi} testů prošlo`);
if (padlo > 0) process.exit(1);
