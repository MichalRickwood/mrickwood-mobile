// SDK 54+ má nový File-based API, ale pro authenticated download s headers
// je legacy API přímější. Migrace na new API počká až bude stable.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "./config";
import { getToken } from "./auth-storage";

/**
 * Stáhne PDF faktury přes mobile JWT Bearer auth, uloží do cache, otevře
 * v nativním iOS share/preview (Soubory, iBooks, Mail…). Žádné signed URL
 * v query stringu — Bearer header se nedá nasdílet jako odkaz.
 */
export async function downloadAndShareInvoicePdf(
  invoiceId: string,
  invoiceNumber: string,
): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in.");

  const url = `${API_BASE_URL}/api/mobile/billing/invoices/${encodeURIComponent(invoiceId)}/pdf`;
  const filename = `${invoiceNumber || invoiceId}.pdf`;
  const target = `${FileSystem.cacheDirectory}${filename}`;

  const download = await FileSystem.downloadAsync(url, target, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (download.status !== 200) {
    // Smaž neúspěšný download (může to být JSON error body)
    try {
      await FileSystem.deleteAsync(download.uri, { idempotent: true });
    } catch {
      /* noop */
    }
    throw new Error(`Download failed: HTTP ${download.status}`);
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing not available on this device.");
  }
  await Sharing.shareAsync(download.uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: filename,
  });
}
