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
  // Bez téhle kontroly se rozbitá odpověď (404 stránka, jiný obal) projeví
  // až o dva kroky dál jako nesrozumitelné „Cannot read property … of
  // undefined". Radši jasná hláška hned.
  if (!r?.data?.url || !r.data.prompt) {
    throw new Error("Server nevrátil zadání pro Claude — zkus to znovu, nebo to nahlas.");
  }
  return r.data;
}

/** Stav požadavku na session běžící na serveru. */
export interface StavSession {
  status: "NEW" | "RUNNING" | "FAILED";
  sessionName: string | null;
  errorMsg: string | null;
}

/**
 * Požádá server, ať spustí Claude session NA SERVERU (ne chat v appce).
 * Vrací id požadavku; runner na stroji ho vyzvedne do ~10 vteřin.
 */
export async function spustSessionNaServeru(kind: string, id?: string): Promise<{ id: string; status: string }> {
  const r = await api.post<{ data: { id: string; kind: string; status: string } }>(
    "/api/v2/admin/claude-session/spawn",
    { kind, ...(id ? { id } : {}) },
  );
  if (!r?.data?.id) throw new Error("Server nepotvrdil založení session.");
  return r.data;
}

export async function stavSessionNaServeru(requestId: string): Promise<StavSession> {
  const r = await api.get<{ data: StavSession }>("/api/v2/admin/claude-session/spawn", {
    params: { requestId },
  });
  return r.data;
}
