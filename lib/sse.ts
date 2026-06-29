import { API_BASE_URL } from "./config";
import { getToken } from "./auth-storage";

/**
 * SSE-over-POST přes XMLHttpRequest. RN nemá spolehlivý fetch body streaming,
 * ale XHR umí přírůstkové čtení `responseText`. Parsuje bloky oddělené prázdným
 * řádkem, z každého bere řádky `data: {json}` → `onEvent`. Bearer token se přidá
 * automaticky. Promise se resolvne po dokončení streamu (poslední event typu
 * `done` dostaneš taky přes onEvent).
 *
 * Použití: analýza chatu, doc-prep analýza, firemní profil chat/research.
 */
export async function ssePost<T = unknown>(
  path: string,
  body: unknown,
  onEvent: (evt: T) => void,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const token = await getToken();
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "text/event-stream");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    let offset = 0;
    let buffer = "";

    const parseBlock = (raw: string) => {
      for (const line of raw.split("\n")) {
        const m = line.match(/^data:\s?(.*)$/);
        if (!m) continue;
        const data = m[1];
        if (!data || data === "[DONE]") continue;
        try {
          onEvent(JSON.parse(data) as T);
        } catch {
          /* neúplný/nevalidní řádek — ignoruj */
        }
      }
    };

    const drain = (final: boolean) => {
      buffer += xhr.responseText.slice(offset);
      offset = xhr.responseText.length;
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        parseBlock(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
      if (final && buffer.trim()) {
        parseBlock(buffer);
        buffer = "";
      }
    };

    xhr.onprogress = () => drain(false);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        drain(true);
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`SSE HTTP ${xhr.status}: ${xhr.responseText.slice(0, 300)}`));
      }
    };
    xhr.onerror = () => reject(new Error("SSE network error"));
    opts?.signal?.addEventListener("abort", () => xhr.abort());

    xhr.send(JSON.stringify(body ?? {}));
  });
}
