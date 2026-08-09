import { API_BASE_URL } from "./config";
import { clearSession, getToken } from "./auth-storage";

/**
 * Typed API client pro Veritra mobile.
 *
 * - Bearer JWT token z SecureStore přidá do Authorization headeru.
 * - 401 → vyčistíme session (UI se rerenderuje na login screen).
 * - JSON body se serializuje automaticky, query stringy přes `params`.
 */

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  params?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  /** Pokud true, nepřidá Authorization (např. login endpoint). */
  noAuth?: boolean;
  signal?: AbortSignal;
  /** Strop na celý request včetně čtení těla. Viz DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * RN fetch nemá žádný default timeout. Bez stropu se zaseknutý request
 * (výpadek serveru, ztracené spojení na mobilní síti) projeví jako věčně
 * točící se kolečko bez jediné hlášky — uživatel neví, jestli se akce
 * provedla. Timeout → AbortError → obrazovky ukážou svou hlášku o síti.
 */
const DEFAULT_TIMEOUT_MS = 60_000;
/** Upload příloh po mobilních datech je pomalý — 3× 5 MB potřebuje víc. */
const UPLOAD_TIMEOUT_MS = 120_000;
/** AI endpointy (sestavení profilu, generování dokumentace) běží v minutách.
 *  Strop = hranice Vercel funkce, ať klient nevzdá dřív než server. */
export const LONG_TIMEOUT_MS = 300_000;

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${API_BASE_URL}${path}`);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v === null || v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const isFormData =
    typeof FormData !== "undefined" && opts.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  // U FormData necháme fetch nastavit Content-Type vč. boundary.
  if (opts.body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (!opts.noAuth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  // Vlastní controller, aby timeout a případný signál od callera (odchod z
  // obrazovky, react-query cancel) mohly abortovat tentýž request.
  const controller = new AbortController();
  const timeoutMs =
    opts.timeoutMs ?? (isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", abortFromCaller);
  }

  let parsed: unknown = null;
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers,
      body:
        opts.body === undefined
          ? undefined
          : isFormData
            ? (opts.body as FormData)
            : JSON.stringify(opts.body),
      signal: controller.signal,
    });

    // Čtení těla drží pod stejným stropem — zaseknout se dá i tady.
    const text = await res.text();
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", abortFromCaller);
  }

  if (!res.ok) {
    if (res.status === 401) {
      // Token vypršel nebo nevalid — vyčistíme session.
      await clearSession();
    }
    // v2 envelope: { error: { code, message, details? } }
    // v1 legacy:  { error: "string message" }
    let msg = `HTTP ${res.status}`;
    if (parsed && typeof parsed === "object" && "error" in parsed) {
      const errVal = (parsed as { error: unknown }).error;
      if (typeof errVal === "string") {
        msg = errVal;
      } else if (errVal && typeof errVal === "object" && "message" in errVal) {
        const m = (errVal as { message: unknown }).message;
        if (typeof m === "string") msg = m;
      }
    }
    throw new ApiError(res.status, msg, parsed);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PUT", body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
