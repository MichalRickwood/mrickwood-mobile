import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { endpoints, type LeadMatchRow } from "./endpoints";

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
 * (žádný viditelný refresh), API se volá v pozadí. Při chybě vrátíme snapshot.
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
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, data] of ctx.snapshots) {
        qc.setQueryData(key as QueryKey, data);
      }
    },
    // Žádný invalidate v onSettled — UI už ukazuje správný stav z optimistic
    // update. Background refetch by jen způsobil viditelný flicker.
  });
}
