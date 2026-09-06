import type { Router } from "expo-router";
import type { Num } from "./reporty-api";

/**
 * Prokliky mezi reporty na jednom místě.
 *
 * Cíl je, aby se z každého čísla dalo dostat k tomu, z čeho vzniklo: firma →
 * profil, zakázka → detail, CPV → cenová hladina i konkurence v segmentu.
 * Cesty se tu drží pohromadě, aby se při přejmenování routy nemusely hledat
 * po obrazovkách.
 */

/** Firma → profil dodavatele nebo zadavatele. `ident` je IČO, jinak přesný název. */
export function naProfil(
  router: Router,
  p: {
    country: string; ident: string | null | undefined;
    kind: "dodavatel" | "zadavatel"; nazev?: string | null;
    /** Otevřít rovnou zúžené na zakázky, kde soutěžil i tenhle druhý subjekt. */
    spolu?: string | null; spoluNazev?: string | null;
  },
) {
  const ident = (p.ident ?? "").trim();
  if (!ident) return;
  router.push({
    pathname: "/(tabs)/reporty/subjekty/profil",
    params: {
      country: p.country, ident, kind: p.kind, nazev: p.nazev ?? "",
      ...(p.spolu ? { spolu: p.spolu } : {}),
      ...(p.spoluNazev ? { spoluNazev: p.spoluNazev } : {}),
    },
  });
}

/**
 * Živá/archivní zakázka z portálu → detail zakázky v appce.
 *
 * Detail se otevírá přes `/match/[id]`; zakázka bez přiřazeného matche se adresuje
 * prefixem `live-` (stejný postup používá admin sekce Zpětná vazba).
 */
export function naZakazku(router: Router, tenderId: Num) {
  const id = Number(tenderId);
  if (!Number.isFinite(id)) return;
  router.push({ pathname: "/match/[id]", params: { id: `live-${id}` } });
}

/** Predikce k zakázce (obrazovka Model). */
export function naPredikci(router: Router, tenderId: Num) {
  const id = Number(tenderId);
  if (!Number.isFinite(id)) return;
  router.push({ pathname: "/(tabs)/reporty/model/[id]", params: { id: String(id) } });
}

/**
 * Zadání (výsledek soutěže) → detail. Data se předávají v parametru, protože
 * pro jedno zadání samostatný endpoint není a řádek už všechno potřebné nese.
 */
export function naZadani(router: Router, radek: unknown, country: string) {
  router.push({
    pathname: "/(tabs)/reporty/zadani",
    params: { country, row: JSON.stringify(radek) },
  });
}

/** CPV prefix → cenové hladiny v segmentu. */
export function naCenoveHladiny(router: Router, p: { country: string; cpv: string; rokOd?: number; rokDo?: number }) {
  router.push({
    pathname: "/(tabs)/reporty/cenove-hladiny",
    params: {
      country: p.country, cpv: p.cpv,
      ...(p.rokOd ? { od: String(p.rokOd) } : {}),
      ...(p.rokDo ? { do: String(p.rokDo) } : {}),
    },
  });
}

/** CPV prefix (volitelně se zadavatelem) → konkurence v segmentu. */
export function naKonkurenci(
  router: Router,
  p: { country: string; cpv: string; buyer?: string | null; buyerNazev?: string | null },
) {
  router.push({
    pathname: "/(tabs)/reporty/konkurence",
    params: {
      country: p.country, cpv: p.cpv,
      ...(p.buyer ? { buyer: p.buyer } : {}),
      ...(p.buyerNazev ? { buyerNazev: p.buyerNazev } : {}),
    },
  });
}
