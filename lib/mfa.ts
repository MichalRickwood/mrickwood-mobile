/**
 * 2FA přes mobilní aplikaci (web docs/2fa/NAVRH.md).
 *
 * a) Tahle aplikace potvrzuje přihlášení na webu: push `type: "login-challenge"` → obrazovka
 *    /potvrzeni-prihlaseni (čekající výzvy z /api/v2/account/mfa/vyzvy).
 * b) Přihlášení do aplikace na NOVÉM zařízení při zapnuté 2FA: server místo tokenu vrátí `mfa`
 *    výzvu. `prijmiPrihlaseni` ji uloží a vyhodí `MfaVyzadovana`; obrazovka /(auth)/mfa pak čeká,
 *    až přihlášení potvrdí jiné zařízení, nebo přijme záložní kód.
 */
import { saveToken, saveUser, type StoredUser } from "./auth-storage";

export interface MfaVyzva { vyzva: string; cislo: number; expiresAt: string; kodPovinny: boolean }
export type PrihlaseniOdpoved = { token: string; user: StoredUser } | { mfa: MfaVyzva };

export class MfaVyzadovana extends Error {
  constructor(public vyzva: MfaVyzva) { super("MFA_REQUIRED"); }
}

let cekajici: MfaVyzva | null = null;
export const cekajiciMfa = () => cekajici;
export const zrusMfa = () => { cekajici = null; };

/** Uloží session z odpovědi přihlášení, nebo vyhodí MfaVyzadovana. */
export async function prijmiPrihlaseni(r: PrihlaseniOdpoved): Promise<StoredUser> {
  if ("mfa" in r) { cekajici = r.mfa; throw new MfaVyzadovana(r.mfa); }
  await saveToken(r.token);
  await saveUser(r.user);
  cekajici = null;
  return r.user;
}
