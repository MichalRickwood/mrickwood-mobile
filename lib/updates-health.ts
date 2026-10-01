/**
 * Hlášení chyb expo-updates do timeline uživatele.
 *
 * Proč: 25. 9. 2026 spadla appka testerovi při startu (build 22, iOS 27).
 * Z crash logu od Applu šlo vyčíst jen to, že expo-updates vyčerpal obnovu
 * a aplikaci sám ukončil (ErrorRecovery.crash) — NE to, co načtení JS shodilo.
 * Bez téhle viditelnosti bychom u dalšího pádu zase jen hádali.
 *
 * expo-updates si vlastní log drží nativně; `readLogEntriesAsync` ho vrátí.
 * Posíláme jen úroveň error/fatal, jednou za běh, a pamatujeme si čas poslední
 * odeslané položky, aby se tytéž řádky neposílaly při každém startu dokola.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { reportClientError } from "./tracker";

const KLIC = "updates-health:posledni";
/** Okno, ze kterého log čteme — delší než typická pauza mezi spuštěními. */
const STARI_MS = 7 * 24 * 60 * 60 * 1000;
/** Víc než pár řádek nemá cenu posílat, stejně jde o jednu příčinu. */
const MAX_POLOZEK = 5;

function jeChyba(level: string): boolean {
  return level === "error" || level === "fatal";
}

/**
 * Přečte nativní log expo-updates a odešle nové chybové řádky.
 * Fire-and-forget: tohle nikdy nesmí shodit ani zdržet start appky.
 */
export async function nahlasChybyUpdatu(): Promise<void> {
  try {
    const zaznamy = await Updates.readLogEntriesAsync(STARI_MS);
    if (!zaznamy || zaznamy.length === 0) return;

    const posledniRaw = await AsyncStorage.getItem(KLIC).catch(() => null);
    const posledni = posledniRaw ? Number(posledniRaw) || 0 : 0;

    const nove = zaznamy
      .filter((z) => jeChyba(z.level) && z.timestamp > posledni)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (nove.length === 0) return;

    // Posun značky děláme podle VŠECH přečtených řádků, ne jen odeslaných —
    // jinak by se starší chyba, která se nevešla do MAX_POLOZEK, hlásila pořád.
    const nejnovejsi = Math.max(...zaznamy.map((z) => z.timestamp));
    await AsyncStorage.setItem(KLIC, String(nejnovejsi)).catch(() => {});

    const vzorek = nove.slice(-MAX_POLOZEK).map((z) => ({
      cas: new Date(z.timestamp).toISOString(),
      uroven: z.level,
      kod: z.code,
      zprava: String(z.message ?? "").slice(0, 300),
      updateId: z.updateId,
    }));

    reportClientError("expo-updates", new Error(vzorek[vzorek.length - 1].zprava), {
      pocet: nove.length,
      zaznamy: vzorek,
      updateId: Updates.updateId ?? undefined,
      kanal: Updates.channel ?? undefined,
      runtimeVersion: Updates.runtimeVersion ?? undefined,
      jeEmbedded: Updates.isEmbeddedLaunch,
    });
  } catch {
    // Log se nepodařilo přečíst — nevadí, tohle je jen diagnostika.
  }
}
