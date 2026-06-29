import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "./config";
import { getToken } from "./auth-storage";

/**
 * Stáhne soubor přes mobile JWT Bearer (následuje i 302 na signed Spaces URL),
 * uloží do cache → vrátí file:// URI. Zobecnění invoice-pdf.ts pro AI report PDF
 * a doc-prep soubory (PDF/DOCX).
 */
export async function downloadAuthedFile(path: string, filename: string): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in.");
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  // sanitizace názvu pro cache cestu
  const safe = filename.replace(/[^\w.\-]+/g, "_") || "file";
  const target = `${FileSystem.cacheDirectory}${safe}`;
  const dl = await FileSystem.downloadAsync(url, target, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (dl.status !== 200) {
    try {
      await FileSystem.deleteAsync(dl.uri, { idempotent: true });
    } catch {
      /* noop */
    }
    throw new Error(`Download failed: HTTP ${dl.status}`);
  }
  return dl.uri;
}

/**
 * Stáhne a otevře soubor přes systémový náhled / share sheet (iOS Quick Look
 * zvládne PDF i DOCX). mimeType je volitelný (lepší preview).
 */
export async function openAuthedFile(path: string, filename: string, mimeType?: string): Promise<void> {
  const uri = await downloadAuthedFile(path, filename);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, mimeType ? { mimeType } : undefined);
  }
}
