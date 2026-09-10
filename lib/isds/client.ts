import { base64Utf8 } from "./base64";
import {
  isdsCas,
  reqCreateMessage,
  reqFindDataBoxById,
  reqFindDataBoxByIco,
  reqGetDeliveryInfo,
  reqGetListOfReceivedMessages,
  reqGetListOfSentMessages,
  reqGetOwnerInfoFromLogin,
  reqGetPasswordInfo,
  reqGetUserInfoFromLogin,
  reqMessageDownload,
  reqSignedMessageDownload,
  type SeznamZpravVstup,
} from "./requests";
import {
  parseCreateMessage,
  parseDeliveryInfo,
  parseFindDataBox,
  parseMessageDownload,
  parseOwnerInfo,
  parsePasswordInfo,
  parseSeznamZprav,
  parseSignedMessageDownload,
  parseUserInfo,
} from "./responses";
import {
  IsdsHttpError,
  jeIsdsHttpError,
  type IsdsCreateMessageInput,
  type IsdsCredentials,
  type IsdsDeliveryInfo,
  type IsdsDownloadedMessage,
  type IsdsEnv,
  type IsdsFindDataBoxResult,
  type IsdsMessageRecord,
  type IsdsOwnerInfo,
  type IsdsUserInfo,
} from "./types";

/**
 * Klient webových služeb ISDS. Jen `fetch` a čisté JS parsování — žádný
 * nativní modul, aby šel bundlovat i posílat přes OTA update.
 *
 * Heslo drží instance jen po dobu jedné akce; obrazovky ji vytvářejí těsně
 * před akcí a po dokončení zahazují. Nikdy se nesmí logovat ani posílat na
 * server (server o přístupových údajích do DS nemá vědět).
 */

const BASE_URL: Record<IsdsEnv, string> = {
  prod: "https://ws1.datovka.gov.cz",
  test: "https://ws1.datovka-test.gov.cz",
};

/** Cesty podle WSDL: dz = manipulace, dx = informace, df = vyhledávání. */
const CESTA = {
  zpravy: "/DS/dz",
  info: "/DS/dx",
  hledani: "/DS/df",
  pristup: "/DS/DsManage",
} as const;

const TIMEOUT_MS = 30_000;

export class IsdsClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(udaje: IsdsCredentials) {
    this.baseUrl = BASE_URL[udaje.env];
    this.authHeader = `Basic ${base64Utf8(`${udaje.login}:${udaje.password}`)}`;
  }

  /**
   * Jedno SOAP volání. `opakovat` = zopakovat jednou při síťové chybě;
   * u CreateMessage je vždy false, dvojí odeslání by znamenalo dva dopisy.
   */
  private async volat(cesta: string, telo: string, opakovat: boolean): Promise<string> {
    let posledni: unknown = null;
    for (let pokus = 0; pokus < (opakovat ? 2 : 1); pokus++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${this.baseUrl}${cesta}`, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: '""',
            Authorization: this.authHeader,
            Accept: "text/xml",
          },
          body: telo,
          signal: controller.signal,
        });
        const text = await res.text();
        if (!res.ok) {
          // 401 = špatné údaje nebo dočasná blokace IP (kap. 1.3 příručky
          // o přístupu), 503 = plánovaná odstávka. Tělo je HTML, ne SOAP.
          throw new IsdsHttpError(res.status, `ISDS HTTP ${res.status}`);
        }
        return text;
      } catch (e) {
        // Chyby HTTP vrstvy neopakujeme — 401 se opakováním nespraví a
        // násobné pokusy vedou k blokaci IP adresy.
        if (jeIsdsHttpError(e)) throw e;
        posledni = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw posledni instanceof Error ? posledni : new Error("Spojení s ISDS selhalo.");
  }

  /* ------------------------------ přístup ------------------------------ */

  /** Ověření přihlašovacích údajů — vrátí jméno a typ oprávnění uživatele. */
  async getUserInfoFromLogin(): Promise<IsdsUserInfo> {
    return parseUserInfo(await this.volat(CESTA.pristup, reqGetUserInfoFromLogin(), true));
  }

  /**
   * Údaje o schránce, do které jsme přihlášení — `dbID` a název držitele.
   * Používá se při přidávání účtu, aby uživatel ID schránky neopisoval.
   */
  async getOwnerInfoFromLogin(): Promise<IsdsOwnerInfo> {
    return parseOwnerInfo(await this.volat(CESTA.pristup, reqGetOwnerInfoFromLogin(), true));
  }

  /** Datum expirace hesla; null = heslo neexpiruje. */
  async getPasswordInfo(): Promise<string | null> {
    return parsePasswordInfo(await this.volat(CESTA.pristup, reqGetPasswordInfo(), true));
  }

  /* ----------------------------- vyhledávání ----------------------------- */

  /** FindDataBox podle ID schránky (ověření příjemce před odesláním). */
  async findDataBoxById(dbID: string): Promise<IsdsFindDataBoxResult> {
    return parseFindDataBox(await this.volat(CESTA.hledani, reqFindDataBoxById(dbID), true));
  }

  /** FindDataBox podle IČO (záloha, když server ID schránky nezná). */
  async findDataBoxByIco(ic: string): Promise<IsdsFindDataBoxResult> {
    return parseFindDataBox(await this.volat(CESTA.hledani, reqFindDataBoxByIco(ic), true));
  }

  /* ------------------------------- zprávy ------------------------------- */

  /**
   * Odeslání zprávy. NIKDY neopakovat — při nejasném výsledku se ptáme
   * `overitOdeslani()` podle naší značky, ne novým CreateMessage.
   */
  async createMessage(vstup: IsdsCreateMessageInput): Promise<string> {
    return parseCreateMessage(await this.volat(CESTA.zpravy, reqCreateMessage(vstup), false));
  }

  /** Stažení došlé zprávy včetně příloh (base64). */
  async messageDownload(dmID: string): Promise<IsdsDownloadedMessage> {
    return parseMessageDownload(await this.volat(CESTA.zpravy, reqMessageDownload(dmID), true));
  }

  /** Stažení došlé zprávy s pečetí správce ISDS (obsah ZFO, base64). */
  async signedMessageDownload(dmID: string): Promise<string> {
    return parseSignedMessageDownload(
      await this.volat(CESTA.zpravy, reqSignedMessageDownload(dmID), true),
    );
  }

  /**
   * Seznam došlých zpráv. Volání doručuje ze zákona dodané zprávy (kap.
   * 2.9.1), takže se spouští jen na výslovný pokyn uživatele.
   */
  async getListOfReceivedMessages(vstup: SeznamZpravVstup): Promise<IsdsMessageRecord[]> {
    return parseSeznamZprav(
      await this.volat(CESTA.info, reqGetListOfReceivedMessages(vstup), true),
      "GetListOfReceivedMessages",
    );
  }

  /** Seznam odeslaných zpráv. */
  async getListOfSentMessages(vstup: SeznamZpravVstup): Promise<IsdsMessageRecord[]> {
    return parseSeznamZprav(
      await this.volat(CESTA.info, reqGetListOfSentMessages(vstup), true),
      "GetListOfSentMessages",
    );
  }

  /** Doručenka k odeslané zprávě. */
  async getDeliveryInfo(dmID: string): Promise<IsdsDeliveryInfo> {
    return parseDeliveryInfo(await this.volat(CESTA.info, reqGetDeliveryInfo(dmID), true));
  }

  /**
   * Ověří, zda zpráva s danou naší značkou (`dmSenderRefNumber`) už ze
   * schránky odešla. Používá se po nejasném výsledku CreateMessage — místo
   * opakovaného odeslání, které by vytvořilo druhý dopis.
   *
   * Prohledává se okno kolem času pokusu; ISDS filtruje podle času dodání,
   * proto sahá o hodinu zpět i vpřed.
   */
  async overitOdeslani(naseZnacka: string, kdy: Date = new Date()): Promise<string | null> {
    const hodina = 60 * 60 * 1000;
    const zpravy = await this.getListOfSentMessages({
      od: new Date(kdy.getTime() - hodina),
      do: new Date(kdy.getTime() + hodina),
      limit: 1000,
    });
    const nalez = zpravy.find((z) => z.dmSenderRefNumber === naseZnacka);
    return nalez?.dmID ?? null;
  }
}

export { isdsCas };
export type { SeznamZpravVstup };
