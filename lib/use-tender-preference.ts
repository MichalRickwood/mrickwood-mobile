import { useSyncExternalStore } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { endpoints, type LeadMatchRow } from "./endpoints";

/**
 * Zakázky vyloučené palcem dolů v této relaci. Seznam je skrývá i tehdy, když
 * odpověď dotazu odeslaného před uložením vyloučení dorazí až po něm a cache
 * přepíše (feedback V-2026-2635: karta se po 2 s vrátila).
 */
let vyloucene = new Set<number>();
const posluchaci = new Set<() => void>();
function nastavVyloucene(next: Set<number>) {
  vyloucene = next;
  posluchaci.forEach((f) => f());
}
export function useLokalneVyloucene(): Set<number> {
  return useSyncExternalStore(
    (f) => { posluchaci.add(f); return () => { posluchaci.delete(f); }; },
    () => vyloucene,
  );
}

type Status = "STARRED" | "EXCLUDED" | "NONE";

interface MatchesPage {
  matches: LeadMatchRow[];
  nextCursor: string | null;
}

interface InfiniteData {
  pages: MatchesPage[];
  pageParams: unknown[];
}

/**
 * Optimistický toggle hvězdičky / vyloučení zakázky. UI se okamžitě upraví
 * (žádný viditelný refresh), API se volá v pozadí. Při chybě se vrátí jen ta zakázka.
 *
 * Logika filtrace v cache podle view (= queryKey[1]):
 *   - ["matches","starred"] → unstar (NONE) odstraní řádek z listu
 *   - jakákoli matches query → EXCLUDED odstraní řádek
 *   - jinak jen update flagů, řádek zůstává
 */
export function useToggleTenderPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenderId, status }: { tenderId: number; status: Status }) =>
      endpoints.setTenderPreference(tenderId, status),
    onMutate: async ({ tenderId, status }) => {
      const pred = vyloucene.has(tenderId);
      if (status === "EXCLUDED" && !pred) nastavVyloucene(new Set(vyloucene).add(tenderId));
      if (status !== "EXCLUDED" && pred) { const n = new Set(vyloucene); n.delete(tenderId); nastavVyloucene(n); }
      await qc.cancelQueries({ queryKey: ["matches"] });
      const snapshots = qc.getQueriesData<InfiniteData>({ queryKey: ["matches"] });

      for (const [key, data] of snapshots) {
        if (!data) continue;
        const isStarredView = Array.isArray(key) && key[1] === "starred";
        const next: InfiniteData = {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            matches: page.matches
              .map((m) => {
                if (m.tender.id !== tenderId) return m;
                return {
                  ...m,
                  tender: {
                    ...m.tender,
                    starred: status === "STARRED",
                    excluded: status === "EXCLUDED",
                  },
                };
              })
              .filter((m) => {
                if (m.tender.id !== tenderId) return true;
                if (status === "EXCLUDED") return false;
                if (isStarredView && status !== "STARRED") return false;
                return true;
              }),
          })),
        };
        qc.setQueryData<InfiniteData>(key as QueryKey, next);
      }
      return { pred };
    },
    // Při chybě vrátit jen tuhle zakázku, ne celý snímek: ten by vrátil i karty
    // vyloučené mezitím. Seznam se pak načte znovu se stavem ze serveru.
    onError: (_err, { tenderId }, ctx) => {
      const n = new Set(vyloucene);
      if (ctx?.pred) n.add(tenderId); else n.delete(tenderId);
      nastavVyloucene(n);
      void qc.invalidateQueries({ queryKey: ["matches"] });
    },
    // Žádný invalidate v onSettled — UI už ukazuje správný stav z optimistic
    // update. Background refetch by jen způsobil viditelný flicker.
  });
}
