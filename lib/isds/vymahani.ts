import {
  adminApi,
  type VymDavka,
  type VymDopis,
  type VymOdeslani,
  type VymPrijataZprava,
  type VymVysledekOdeslani,
} from "../admin-api";
import { IsdsClient } from "./client";
import { OdemceneSchranky, nacistUcty, type IsdsUcet } from "./credentials";
import { schrankaOdesilatele, stazenoOdSchranky } from "./schranky";
import { jeIsdsError, jeIsdsHttpError, jePovolenyPrijemce } from "./types";

/**
 * Průběh dávky vymáhání — telefon dělá ruce (ISDS), server mozek.
 *
 * Modul stojí mezi obrazovkou a klientem ISDS: zajišťuje pojistky, které
 * nesmí záviset na tom, co která obrazovka zavolá.
 *  - před každým dopisem FindDataBox a kontrola, že příjemce je aktivní
 *    schránka povoleného typu (OVM* nebo PO),
 *  - CreateMessage se po nejasném výsledku NEOPAKUJE, jen se ověří podle
 *    naší značky přes GetListOfSentMessages,
 *  - přihlašovací údaje se čtou per odesílající schránka, jedna biometrie
 *    na schránku, a žijí jen po dobu dávky.
 */

export type VymFaze =
  | "overovani"
  | "odesilani"
  | "hlaseni"
  | "seznam"
  | "stahovani"
  | "dorucenky";

export interface VymPrubeh {
  faze: VymFaze;
  hotovo: number;
  celkem: number;
  /** Doplňující text — jméno příjemce, věc zprávy, název schránky. */
  popis?: string;
}

export type NaProbeh = (p: VymPrubeh) => void;

/** Texty biometrických promptů dodává obrazovka (patří do i18n, ne sem). */
export interface VymTexty {
  /** Prompt pro odemčení hesla ke konkrétní schránce. */
  odemknout: (schranka: string) => string;
  /** Chyba nahlášená serveru, když schránka v telefonu není. */
  schrankaChybi: (dbId: string) => string;
  /** Chyba nahlášená serveru, když uživatel biometrii odmítl. */
  overeniOdmitnuto: (schranka: string) => string;
}

/** Stavy došlé zprávy, ve kterých ji lze stáhnout (kap. 2.6.1 příručky ISDS). */
const STAHOVATELNE = [5, 6, 7, 10];

function textChyby(e: unknown): string {
  if (jeIsdsError(e)) return `ISDS ${e.kod}: ${e.message}`;
  if (jeIsdsHttpError(e)) return `ISDS HTTP ${e.status}`;
  return (e as Error)?.message ?? "Neznámá chyba";
}

/**
 * Ověření příjemce před odesláním — pojistka proti podstrčené schránce.
 *
 * Hledá se podle IČO zadavatele z návrhu (ne podle ID schránky, to by jen
 * potvrdilo, co server poslal) a dopis odejde jen tehdy, když je mezi nálezy
 * schránka s tímtéž ID, je aktivní a má povolený typ (OVM* nebo PO).
 * Vrací null při úspěchu, jinak důvod přeskočení.
 */
async function overitPrijemce(klient: IsdsClient, ico: string, databoxId: string): Promise<string | null> {
  const nalez = await klient.findDataBoxByIco(ico);
  // 0009 = schránka existuje, ale Poštovní datovou zprávu do ní z naší
  // schránky poslat nelze; údaje o ní se ani nevracejí.
  if (nalez.status.code === "0009") {
    return `Do schránky ${databoxId} nelze poslat Poštovní datovou zprávu (ISDS 0009).`;
  }
  const schranka = nalez.schranky.find((s) => s.dbID === databoxId);
  if (!schranka) {
    const nalezene = nalez.schranky.map((s) => `${s.dbID ?? "?"}/${s.dbType ?? "?"}`).join(", ") || "žádná";
    return `IČO ${ico} neodpovídá schránce ${databoxId} (ISDS ${nalez.status.code}, nalezeno: ${nalezene}).`;
  }
  if (!jePovolenyPrijemce(schranka.dbType)) {
    return `Nepovolený typ schránky ${schranka.dbType ?? "?"} (povoleno jen OVM a PO) — dopis přeskočen.`;
  }
  if (schranka.dbState !== null && schranka.dbState !== 1) {
    return `Schránka ${databoxId} není aktivní (stav ${schranka.dbState}).`;
  }
  return null;
}

export interface VysledekOdeslani {
  odeslano: number;
  chyby: number;
  vysledky: VymVysledekOdeslani[];
}

/** Dopisy rozdělené podle naší odesílající schránky. */
function seskupitPodleOdesilatele(kOdeslani: VymOdeslani[]): Map<string, VymOdeslani[]> {
  const skupiny = new Map<string, VymOdeslani[]>();
  for (const d of kOdeslani) {
    const dbId = schrankaOdesilatele(d.odesilatelDb);
    const skupina = skupiny.get(dbId);
    if (skupina) skupina.push(d);
    else skupiny.set(dbId, [d]);
  }
  return skupiny;
}

/**
 * Odešle schválené dopisy a nahlásí výsledky serveru.
 *
 * Dopisy se rozdělí podle odesílající schránky; ke každé se heslo odemyká
 * jednou (jedna biometrie na schránku). Schránka, kterou telefon nemá
 * nastavenou, znamená přeskočení jejích dopisů s nahlášenou chybou — ne pád
 * celé dávky. `navrh` je dnešní dávka z `/davka`, bereme z ní IČO zadavatele,
 * které `OdeslaniDto` nenese.
 */
export async function odeslatDopisy(
  kOdeslani: VymOdeslani[],
  navrh: VymDopis[],
  texty: VymTexty,
  naProbeh: NaProbeh,
  relace: OdemceneSchranky = new OdemceneSchranky(),
): Promise<VysledekOdeslani> {
  const vysledky: VymVysledekOdeslani[] = [];
  const icoPodleDopisu = new Map(navrh.map((d) => [d.id, d.prijemce.ico]));
  const ucty = await nacistUcty();
  const celkem = kOdeslani.length;
  let hotovo = 0;

  for (const [dbId, dopisy] of seskupitPodleOdesilatele(kOdeslani)) {
    const ucet = ucty.find((u) => u.dbId === dbId);
    if (!ucet) {
      for (const d of dopisy) vysledky.push({ dopisId: d.dopisId, chyba: texty.schrankaChybi(dbId) });
      hotovo += dopisy.length;
      continue;
    }
    const pristup = await relace.ziskej(dbId, texty.odemknout(ucet.nazev));
    if (!pristup) {
      for (const d of dopisy) vysledky.push({ dopisId: d.dopisId, chyba: texty.overeniOdmitnuto(ucet.nazev) });
      hotovo += dopisy.length;
      continue;
    }

    const klient = new IsdsClient(pristup);
    for (const dopis of dopisy) {
      naProbeh({ faze: "overovani", hotovo, celkem, popis: dopis.predmet });

      const ico = icoPodleDopisu.get(dopis.dopisId);
      if (!ico) {
        vysledky.push({ dopisId: dopis.dopisId, chyba: "K dopisu chybí IČO zadavatele — příjemce nelze ověřit." });
        hotovo++;
        continue;
      }
      try {
        const duvod = await overitPrijemce(klient, ico, dopis.databoxId);
        if (duvod) {
          vysledky.push({ dopisId: dopis.dopisId, chyba: duvod });
          hotovo++;
          continue;
        }
      } catch (e) {
        vysledky.push({ dopisId: dopis.dopisId, chyba: `Ověření příjemce selhalo — ${textChyby(e)}` });
        hotovo++;
        continue;
      }

      naProbeh({ faze: "odesilani", hotovo, celkem, popis: dopis.predmet });
      const kdy = new Date();
      try {
        const dmId = await klient.createMessage({
          dbIDRecipient: dopis.databoxId,
          dmAnnotation: dopis.predmet,
          dmSenderRefNumber: dopis.naseZnacka,
          files: [
            {
              dmFileDescr: dopis.pdf.name,
              dmMimeType: "application/pdf",
              dmFileMetaType: "main",
              dmEncodedContent: dopis.pdf.base64,
            },
          ],
        });
        vysledky.push({ dopisId: dopis.dopisId, dmId });
      } catch (e) {
        if (jeIsdsError(e)) {
          // ISDS odpovědělo — zpráva nevznikla, opakovat by bylo bezpečné,
          // ale to je na příštím běhu, ne teď.
          vysledky.push({ dopisId: dopis.dopisId, chyba: textChyby(e) });
        } else {
          // Nejasný výsledek (timeout, spadlé spojení): zpráva mohla projít.
          // NIKDY neposílat znovu — zjistíme to podle naší značky.
          try {
            const dmId = await klient.overitOdeslani(dopis.naseZnacka, kdy);
            if (dmId) vysledky.push({ dopisId: dopis.dopisId, dmId });
            else vysledky.push({ dopisId: dopis.dopisId, chyba: `Nejasný výsledek odeslání — ${textChyby(e)}` });
          } catch {
            vysledky.push({
              dopisId: dopis.dopisId,
              chyba: `Nejasný výsledek odeslání a ověření selhalo — ${textChyby(e)}. Zkontroluj schránku ručně.`,
            });
          }
        }
      }
      hotovo++;
    }
  }

  naProbeh({ faze: "hlaseni", hotovo: celkem, celkem });
  await adminApi.nahlasitOdeslane(vysledky);

  const odeslano = vysledky.filter((v) => v.dmId).length;
  return { odeslano, chyby: vysledky.length - odeslano, vysledky };
}

export interface VysledekStazeni {
  stazeno: number;
  preskoceno: number;
  dorucenky: number;
  chyby: string[];
}

/**
 * Stáhne došlé zprávy ze VŠECH nastavených schránek a předá je serveru po
 * jedné. Ke každé schránce jedna biometrie; schránka, kterou uživatel
 * neodemkne, se přeskočí a zapíše se to do chyb.
 *
 * POZOR: GetListOfReceivedMessages doručuje ze zákona dodané zprávy — proto
 * jen na výslovný pokyn uživatele, nikdy na pozadí.
 */
export async function stahnoutOdpovedi(
  stazenoOd: VymDavka["stazenoOd"],
  texty: VymTexty,
  naProbeh: NaProbeh,
  relace: OdemceneSchranky = new OdemceneSchranky(),
): Promise<VysledekStazeni> {
  const chyby: string[] = [];
  let stazeno = 0;
  let preskoceno = 0;
  let dorucenky = 0;

  const ucty = await nacistUcty();
  if (ucty.length === 0) return { stazeno, preskoceno, dorucenky, chyby };

  // Doručenky jdou stáhnout jen z odesílající schránky. Kontrakt `/doruceni`
  // odesílatele (zatím) nenese, proto se seznam projde u každé schránky a
  // vyřízené kusy se z něj odeberou.
  let kDoruceni: { dopisId: number; dmId: string; odesilatelDb?: string }[] = [];
  try {
    kDoruceni = await adminApi.getVymahaniDoruceni();
  } catch {
    kDoruceni = []; // endpoint zatím nemusí existovat — dávku to nemá shodit
  }

  for (const ucet of ucty) {
    const pristup = await relace.ziskej(ucet.dbId, texty.odemknout(ucet.nazev));
    if (!pristup) {
      chyby.push(texty.overeniOdmitnuto(ucet.nazev));
      continue;
    }
    const klient = new IsdsClient(pristup);
    const vysledek = await stahnoutProSchranku(klient, ucet, stazenoOd, chyby, naProbeh);
    stazeno += vysledek.stazeno;
    preskoceno += vysledek.preskoceno;

    const zbyva = kDoruceni.filter((d) => !d.odesilatelDb || d.odesilatelDb === ucet.dbId);
    if (zbyva.length > 0) {
      const hotove = await stahnoutDorucenky(klient, zbyva, chyby, naProbeh);
      dorucenky += hotove.size;
      kDoruceni = kDoruceni.filter((d) => !hotove.has(d.dopisId));
    }
  }

  return { stazeno, preskoceno, dorucenky, chyby };
}

/** Došlé zprávy jedné schránky. */
async function stahnoutProSchranku(
  klient: IsdsClient,
  ucet: IsdsUcet,
  stazenoOd: VymDavka["stazenoOd"],
  chyby: string[],
  naProbeh: NaProbeh,
): Promise<{ stazeno: number; preskoceno: number }> {
  naProbeh({ faze: "seznam", hotovo: 0, celkem: 0, popis: ucet.nazev });

  // Minutový překryv intervalu doporučuje kap. 2.9.1 — jinak může zpráva
  // vypadnout z obou po sobě jdoucích seznamů.
  const minuta = 60_000;
  const od = new Date(stazenoOdSchranky(stazenoOd, ucet.dbId).getTime() - minuta);
  const doo = new Date(Date.now() + minuta);
  const stazenoAt = new Date().toISOString();

  let seznam;
  try {
    seznam = await klient.getListOfReceivedMessages({ od, do: doo, limit: 1000 });
  } catch (e) {
    chyby.push(`${ucet.nazev}: ${textChyby(e)}`);
    return { stazeno: 0, preskoceno: 0 };
  }

  const kestazeni = seznam.filter((z) => {
    // VoDZ se stahuje jinou službou na jiném endpointu — sem nepatří.
    if (z.vodz) return false;
    return z.dmMessageStatus === null || STAHOVATELNE.includes(z.dmMessageStatus);
  });
  let stazeno = 0;

  for (let i = 0; i < kestazeni.length; i++) {
    const zaznam = kestazeni[i];
    naProbeh({ faze: "stahovani", hotovo: i, celkem: kestazeni.length, popis: zaznam.dmAnnotation ?? zaznam.dmID });
    try {
      const zprava = await klient.messageDownload(zaznam.dmID);
      // ZFO (zpráva s pečetí správce) je pro archiv — když selže, obsah
      // zprávy máme i tak a případ se dá vyřídit.
      let zfoBase64: string | null = null;
      try {
        zfoBase64 = await klient.signedMessageDownload(zaznam.dmID);
      } catch (e) {
        chyby.push(`ZFO ${zaznam.dmID}: ${textChyby(e)}`);
      }

      const prijata: VymPrijataZprava = {
        dmId: zprava.envelope.dmID || zaznam.dmID,
        odesilatelDb: zprava.envelope.dbIDSender ?? zaznam.dbIDSender ?? "",
        odesilatel: zprava.envelope.dmSender ?? zaznam.dmSender,
        predmet: zprava.envelope.dmAnnotation ?? zaznam.dmAnnotation,
        dodanoAt: zprava.envelope.dmDeliveryTime ?? zaznam.dmDeliveryTime,
        // Zadavatel odpovídá na naši značku — server podle ní spáruje případ.
        recipientRef: zprava.envelope.dmRecipientRefNumber ?? zaznam.dmRecipientRefNumber,
        prilohy: zprava.files.map((f) => ({
          name: f.dmFileDescr,
          mime: f.dmMimeType,
          base64: f.dmEncodedContent,
        })),
        zfoBase64,
      };
      await adminApi.nahlasitPrijate([prijata], stazenoAt, ucet.dbId);
      stazeno++;
    } catch (e) {
      chyby.push(`Zpráva ${zaznam.dmID}: ${textChyby(e)}`);
    }
  }

  // I když nic nepřišlo, ať server posune posledni_stazeni_prijatych:<dbId>.
  if (kestazeni.length === 0) {
    try {
      await adminApi.nahlasitPrijate([], stazenoAt, ucet.dbId);
    } catch (e) {
      chyby.push(`${ucet.nazev}: ${textChyby(e)}`);
    }
  }

  return { stazeno, preskoceno: seznam.length - kestazeni.length };
}

/**
 * Doručenky k odeslaným dopisům, u kterých server ještě neví, zda dorazily.
 * Doručení fikcí i doručení přihlášením pozná podle `dmAcceptanceTime`.
 * Vrací ID dopisů, které se z téhle schránky podařilo vyřídit.
 */
async function stahnoutDorucenky(
  klient: IsdsClient,
  dopisy: { dopisId: number; dmId: string }[],
  chyby: string[],
  naProbeh: NaProbeh,
): Promise<Set<number>> {
  const vysledky: { dopisId: number; dorucenoAt?: string; stav?: string }[] = [];
  const hotove = new Set<number>();

  for (let i = 0; i < dopisy.length; i++) {
    const d = dopisy[i];
    naProbeh({ faze: "dorucenky", hotovo: i, celkem: dopisy.length, popis: d.dmId });
    try {
      const info = await klient.getDeliveryInfo(d.dmId);
      if (info.dmAcceptanceTime) {
        vysledky.push({ dopisId: d.dopisId, dorucenoAt: info.dmAcceptanceTime, stav: "DORUCENO" });
      } else if (info.dmMessageStatus === 8) {
        // Schránka adresáta byla zpětně znepřístupněna — nedoručitelné.
        vysledky.push({ dopisId: d.dopisId, stav: "CHYBA" });
      }
      // Doručenka se stáhla, i když zpráva zatím jen leží ve stavu „dodáno" —
      // z jiné schránky ji už zkoušet nemusíme.
      hotove.add(d.dopisId);
    } catch (e) {
      // Cizí zpráva (patří jiné naší schránce) skončí chybou ISDS — zkusí se
      // u další schránky, do chyb ji proto nezapisujeme.
      if (!jeIsdsError(e)) chyby.push(`Doručenka ${d.dmId}: ${textChyby(e)}`);
    }
  }

  if (vysledky.length > 0) {
    try {
      await adminApi.nahlasitDoruceni(vysledky);
    } catch (e) {
      chyby.push(`Doručenky: ${textChyby(e)}`);
    }
  }
  return hotove;
}

/**
 * Které schránky z dnešního návrhu telefon nemá nastavené. Seznam `schranky`
 * dodává server; když chybí, odvodí se z odesílatelů jednotlivých dopisů.
 */
export async function chybejiciSchranky(davka: VymDavka): Promise<{ dbId: string; nazev: string }[]> {
  const ucty = await nacistUcty();
  const zname = new Set(ucty.map((u) => u.dbId));
  const zNavrhu =
    davka.schranky?.length > 0
      ? davka.schranky
      : [...new Set(davka.dopisy.map((d) => schrankaOdesilatele(d.odesilatelDb)))].map((dbId) => ({
          dbId,
          nazev: dbId,
        }));
  return zNavrhu.filter((s) => !zname.has(s.dbId));
}
