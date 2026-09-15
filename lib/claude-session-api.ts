import { api } from "./api";

/**
 * Předvyplněné zadání pro novou Claude session nad danou oblastí.
 *
 * Záměrně vlastní soubor, ne další metoda v admin-api.ts: „otevřít v Claude"
 * není admin agenda, ale obecný mechanismus, který poroste do dalších obrazovek
 * (zakázky, faktury). Kontext skládá server — appka o pravidlech značky ani
 * o strategii nic neví a vědět nemá.
 */
export interface ClaudeSession {
  titul: string;
  prompt: string;
  /** `claude://…` — appka zadání jen předvyplní, neodešle ho. */
  url: string;
}

export async function nactiClaudeSession(
  kind: string,
  id?: string,
  signal?: AbortSignal,
): Promise<ClaudeSession> {
  const r = await api.get<{ data: ClaudeSession }>("/api/v2/admin/claude-session", {
    params: { kind, ...(id ? { id } : {}) },
    signal,
  });
  return r.data;
}
