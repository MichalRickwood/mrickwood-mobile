import { adminApi, type VymOdeslani, type VymPrijataZprava, type VymVysledekOdeslani } from "../admin-api";
import { IsdsClient } from "./client";
import { jeIsdsError, jeIsdsHttpError, jeOvm, type IsdsCredentials } from "./types";

/**
 * Průběh dávky vymáhání — telefon dělá ruce (ISDS), server mozek.
 *
 * Modul stojí mezi obrazovkou a klientem ISDS: zajišťuje pojistky, které
 * nesmí záviset na tom, co která obrazovka zavolá.
 *  - před každým dopisem FindDataBox a kontrola, že příjemce je OVM,
 *  - CreateMessage se po nejasném výsledku NEOPAKUJE, jen se ověří podle
 *    naší značky přes GetListOfSentMessages,
 *  - přihlašovací údaje sem přijdou jen na dobu jedné dávky.
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
  /** Doplňující text — jméno příjemce, věc zprávy. */
  popis?: string;
}

export type NaProbeh = (p: VymPrubeh) => void;

/** Stavy došlé zprávy, ve kterých ji lze stáhnout (kap. 2.6.1 příručky ISDS). */
const STAHOVATELNE = [5, 6, 7, 10];

function textChyby(e: unknown): string {
  if (jeIsdsError(e)) return `ISDS ${e.kod}: ${e.message}`;
  if (jeIsdsHttpError(e)) return `ISDS HTTP ${e.status}`;
  return (e as Error)?.message ?? "Neznámá chyba";
}

export interface VysledekOdeslani {
  odeslano: number;
  chyby: number;
  vysledky: VymVysledekOdeslani[];
}

/**
 * Odešle schválené dopisy do datových schránek a nahlásí výsledky serveru.
 * Chyba jednoho dopisu nezastaví dávku — zapíše se a pokračuje se dál.
 */
export async function odeslatDopisy(
  udaje: IsdsCredentials,
  kOdeslani: VymOdeslani[],
  naProbeh: NaProbeh,
): Promise<VysledekOdeslani> {
  const klient = new IsdsClient(udaje);
  const vysledky: VymVysledekOdeslani[] = [];

  for (let i = 0; i < kOdeslani.length; i++) {
    const dopis = kOdeslani[i];
    naProbeh({ faze: "overovani", hotovo: i, celkem: kOdeslani.length, popis: dopis.predmet });

    // 1) Ověření příjemce. Pojistka proti podstrčené schránce: server může
    //    poslat jakékoli ID, ale dopis odejde jen do aktivní schránky OVM.
    try {
      const nalez = await klient.findDataBoxById(dopis.databoxId);
      const schranka = nalez.schranky[0];
      if (!schranka) {
        vysledky.push({ dopisId: dopis.dopisId, chyba: `Schránka ${dopis.databoxId} nenalezena (${nalez.status.code}).` });
        continue;
      }
      if (!jeOvm(schranka.dbType)) {
        vysledky.push({
          dopisId: dopis.dopisId,
          chyba: `Příjemce není OVM (typ schránky ${schranka.dbType ?? "?"}) — dopis přeskočen.`,
        });
        continue;
      }
      if (schranka.dbState !== null && schranka.dbState !== 1) {
        vysledky.push({
          dopisId: dopis.dopisId,
          chyba: `Schránka ${dopis.databoxId} není aktivní (stav ${schranka.dbState}).`,
        });
        continue;
      }
    } catch (e) {
      vysledky.push({ dopisId: dopis.dopisId, chyba: `Ověření příjemce selhalo — ${textChyby(e)}` });
      continue;
    }

    // 2) Odeslání
    naProbeh({ faze: "odesilani", hotovo: i, celkem: kOdeslani.length, popis: dopis.predmet });
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
        continue;
      }
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

  naProbeh({ faze: "hlaseni", hotovo: kOdeslani.length, celkem: kOdeslani.length });
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
 * Stáhne došlé zprávy od `stazenoOd` a předá je serveru po jedné.
 *
 * POZOR: GetListOfReceivedMessages doručuje ze zákona dodané zprávy — proto
 * jen na výslovný pokyn uživatele, nikdy na pozadí.
 */
export async function stahnoutOdpovedi(
  udaje: IsdsCredentials,
  stazenoOd: Date,
  naProbeh: NaProbeh,
): Promise<VysledekStazeni> {
  const klient = new IsdsClient(udaje);
  const chyby: string[] = [];
  let stazeno = 0;
  let preskoceno = 0;

  naProbeh({ faze: "seznam", hotovo: 0, celkem: 0 });
  // Minutový překryv intervalu doporučuje kap. 2.9.1 — jinak může zpráva
  // vypadnout z obou po sobě jdoucích seznamů.
  const minuta = 60_000;
  const od = new Date(stazenoOd.getTime() - minuta);
  const doo = new Date(Date.now() + minuta);
  const stazenoAt = new Date().toISOString();
  const seznam = await klient.getListOfReceivedMessages({ od, do: doo, limit: 1000 });

  const kestazeni = seznam.filter((z) => {
    // VoDZ se stahuje jinou službou na jiném endpointu — sem nepatří.
    if (z.vodz) return false;
    return z.dmMessageStatus === null || STAHOVATELNE.includes(z.dmMessageStatus);
  });
  preskoceno = seznam.length - kestazeni.length;

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
      await adminApi.nahlasitPrijate([prijata], stazenoAt);
      stazeno++;
    } catch (e) {
      chyby.push(`Zpráva ${zaznam.dmID}: ${textChyby(e)}`);
    }
  }

  // I když nic nepřišlo, ať server posune posledni_stazeni_prijatych.
  if (kestazeni.length === 0) await adminApi.nahlasitPrijate([], stazenoAt);

  const dorucenky = await stahnoutDorucenky(klient, naProbeh, chyby);
  return { stazeno, preskoceno, dorucenky, chyby };
}

/**
 * Doručenky k odeslaným dopisům, u kterých server ještě neví, zda dorazily.
 * Doručení fikcí i doručení přihlášením pozná podle `dmAcceptanceTime`.
 */
async function stahnoutDorucenky(klient: IsdsClient, naProbeh: NaProbeh, chyby: string[]): Promise<number> {
  let dopisy: { dopisId: number; dmId: string }[] = [];
  try {
    dopisy = await adminApi.getVymahaniDoruceni();
  } catch {
    return 0; // endpoint zatím nemusí existovat — dávku to nemá shodit
  }
  if (dopisy.length === 0) return 0;

  const vysledky: { dopisId: number; dorucenoAt?: string; stav?: string }[] = [];
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
    } catch (e) {
      chyby.push(`Doručenka ${d.dmId}: ${textChyby(e)}`);
    }
  }
  if (vysledky.length > 0) await adminApi.nahlasitDoruceni(vysledky);
  return vysledky.length;
}

/** Výchozí okno, když server `stazenoOd` neposílá (ISDS drží zprávy 90 dnů). */
export function vychoziStazenoOd(stazenoOd?: string | null): Date {
  if (stazenoOd) {
    const d = new Date(stazenoOd);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}
