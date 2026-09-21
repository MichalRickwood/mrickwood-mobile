import type { VymDavka } from "../admin-api";

/**
 * Čistá logika kolem našich odesílajících schránek — bez React Native,
 * aby šla spustit i v jednotkových testech.
 */

/** Výchozí odesílatel, dokud server `odesilatelDb` neposílá — schránka RWX. */
export const VYCHOZI_SCHRANKA = "c8nc4q5";

/** ISDS drží došlé zprávy 90 dnů po doručení — měsíc zpět je bezpečná pojistka. */
export const VYCHOZI_OKNO_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Ze které naší schránky dopis odchází. Dokud server pole neposílá, platí
 * RWX — jediný odesílatel, se kterým se automat rozjížděl.
 */
export function schrankaOdesilatele(dbId: string | null | undefined): string {
  return dbId && dbId.trim() ? dbId.trim() : VYCHOZI_SCHRANKA;
}

/**
 * Od kdy stahovat došlé zprávy pro danou schránku. `stazenoOd` je mapa
 * `dbId → čas`; holý řetězec je starší tvar kontraktu a patří schránce RWX.
 * Neznámá hodnota = okno 30 dnů zpět.
 */
export function stazenoOdSchranky(stazenoOd: VymDavka["stazenoOd"], dbId: string, ted: number = Date.now()): Date {
  const hodnota =
    typeof stazenoOd === "string"
      ? dbId === VYCHOZI_SCHRANKA
        ? stazenoOd
        : null
      : (stazenoOd?.[dbId] ?? null);
  if (hodnota) {
    const d = new Date(hodnota);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(ted - VYCHOZI_OKNO_MS);
}
