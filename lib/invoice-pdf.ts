import * as FileSystem from "expo-file-system/legacy";
import { API_BASE_URL } from "./config";
import { getToken } from "./auth-storage";

/**
 * Stáhne PDF faktury přes mobile JWT Bearer auth, uloží do cache, vrátí
 * file:// URI. UI pak otevře v in-app WebView (PDF preview screen) — žádný
 * iOS share-sheet jako default. Sharing zůstává jako akce v headeru toho
 * screenu.
 */
export async function downloadInvoicePdf(
  invoiceId: string,
  invoiceNumber: string,
): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in.");

  const url = `${API_BASE_URL}/api/mobile/billing/invoices/${encodeURIComponent(invoiceId)}/pdf`;
  const filename = `${invoiceNumber || invoiceId}.pdf`;
  const target = `${FileSystem.cacheDirectory}${filename}`;

  const download = await FileSystem.downloadAsync(url, target, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (download.status !== 200) {
    try {
      await FileSystem.deleteAsync(download.uri, { idempotent: true });
    } catch {
      /* noop */
    }
    throw new Error(`Download failed: HTTP ${download.status}`);
  }
  return download.uri;
}
