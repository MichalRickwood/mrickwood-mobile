import { useSyncExternalStore } from "react";

/**
 * Které dopisy Michal z dnešní dávky vyřadil. Volba musí být vidět na seznamu
 * i v detailu dopisu, ale nemá přežít restart aplikace (dávka je jednodenní),
 * proto malý modulový store místo contextu i persistované cache.
 */

let vyrazene: ReadonlySet<number> = new Set();
const posluchaci = new Set<() => void>();

function oznam(): void {
  for (const p of posluchaci) p();
}

function subscribe(fn: () => void): () => void {
  posluchaci.add(fn);
  return () => posluchaci.delete(fn);
}

export function useVyrazene(): ReadonlySet<number> {
  return useSyncExternalStore(subscribe, () => vyrazene);
}

export function prepnoutVyrazeni(id: number): void {
  const novy = new Set(vyrazene);
  if (novy.has(id)) novy.delete(id);
  else novy.add(id);
  vyrazene = novy;
  oznam();
}

export function vycistitVyrazeni(): void {
  vyrazene = new Set();
  oznam();
}
