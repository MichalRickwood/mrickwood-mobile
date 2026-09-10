/**
 * Base64 bez závislosti na `btoa` (Hermes ho negarantuje) a bez nativního
 * modulu. Používá se jen na hlavičku Basic autentizace — přílohy zpráv
 * putují jako base64 řetězce skrz (server → ISDS → server) a nikdy se
 * v telefonu nedekódují.
 */

const ABECEDA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** UTF-8 bajty řetězce (login i heslo mohou obsahovat diakritiku). */
function utf8Bajty(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let kod = text.charCodeAt(i);
    // Složit surrogate pár do jednoho kódového bodu.
    if (kod >= 0xd800 && kod <= 0xdbff && i + 1 < text.length) {
      const dalsi = text.charCodeAt(i + 1);
      if (dalsi >= 0xdc00 && dalsi <= 0xdfff) {
        kod = 0x10000 + ((kod - 0xd800) << 10) + (dalsi - 0xdc00);
        i++;
      }
    }
    if (kod < 0x80) out.push(kod);
    else if (kod < 0x800) out.push(0xc0 | (kod >> 6), 0x80 | (kod & 0x3f));
    else if (kod < 0x10000) out.push(0xe0 | (kod >> 12), 0x80 | ((kod >> 6) & 0x3f), 0x80 | (kod & 0x3f));
    else
      out.push(
        0xf0 | (kod >> 18),
        0x80 | ((kod >> 12) & 0x3f),
        0x80 | ((kod >> 6) & 0x3f),
        0x80 | (kod & 0x3f),
      );
  }
  return out;
}

/** Zakóduje text do base64 (UTF-8). */
export function base64Utf8(text: string): string {
  const b = utf8Bajty(text);
  let out = "";
  for (let i = 0; i < b.length; i += 3) {
    const b0 = b[i];
    const b1 = i + 1 < b.length ? b[i + 1] : undefined;
    const b2 = i + 2 < b.length ? b[i + 2] : undefined;
    out += ABECEDA[b0 >> 2];
    out += ABECEDA[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : ABECEDA[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : ABECEDA[b2 & 0x3f];
  }
  return out;
}
