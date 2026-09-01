/**
 * Majitel schránky — jediný, kdo smí vidět triáž příchozí pošty.
 *
 * POZOR: tohle je JEN kosmetika UI. Skutečná hranice je na serveru
 * (`assertOwner()` v src/lib/inbound/owner.ts), který cizímu adminovi vrací
 * NOT_FOUND. Tady se položka schovává proto, aby jiný admin ani nevěděl, že
 * nějaká schránka existuje — menu je taky informace.
 *
 * Hodnota zrcadlí serverový default `INBOX_OWNER_EMAIL`. Kdyby se na serveru
 * změnil, změň ji i tady; rozejití znamená jen schovanou/zbytečně zobrazenou
 * položku, přístup k datům tím neprosákne.
 */
const OWNER_EMAIL = "michal@rickwood.cz";

export function isInboxOwner(user: { email?: string | null } | null | undefined): boolean {
  return (user?.email ?? "").trim().toLowerCase() === OWNER_EMAIL;
}
