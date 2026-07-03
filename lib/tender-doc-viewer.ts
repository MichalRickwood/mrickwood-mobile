import * as WebBrowser from "expo-web-browser";
import type { Router } from "expo-router";
import type { TenderDocument } from "./endpoints";
import { API_BASE_URL } from "./config";
import { getToken } from "./auth-storage";

/**
 * Klasifikace tender attachmentu pro výběr in-app vieweru. Postupně rozšiřujeme:
 * v1 = image preview + pdf přes Safari, ostatní fallback na WebBrowser.
 */
export type DocKind = "pdf" | "image" | "office" | "text" | "archive" | "cert" | "other";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff"];
const OFFICE_EXTS = ["doc", "docx", "xls", "xlsx", "xlsm", "odt", "ods", "rtf", "ppt", "pptx"];
const TEXT_EXTS = ["txt", "xml", "csv", "md", "json", "log"];
const ARCHIVE_EXTS = ["zip", "rar", "7z", "tar", "gz", "001", "002", "003", "004", "005", "006", "z01"];
const CERT_EXTS = ["cer", "crt", "p7s", "pem"];

export function inferDocExt(doc: TenderDocument): string | null {
  if (doc.fileType && doc.fileType.length <= 5) return doc.fileType.toLowerCase();
  return extractExt(doc.url) ?? extractExt(doc.name);
}

export function inferDocKind(doc: TenderDocument): DocKind {
  const ext = inferDocExt(doc) ?? "";
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (OFFICE_EXTS.includes(ext)) return "office";
  if (TEXT_EXTS.includes(ext)) return "text";
  if (ARCHIVE_EXTS.includes(ext)) return "archive";
  if (CERT_EXTS.includes(ext)) return "cert";
  return "other";
}

/** Vytáhne příponu z URL nebo display jména. RWX portály občas používají
 *  dash místo dot (např. `…-priloha-docx`), proto akceptujeme oba. */
function extractExt(s: string | null | undefined): string | null {
  if (!s) return null;
  const clean = s.split("?")[0].split("/").pop() ?? "";
  const dot = clean.match(/\.([a-z0-9]{1,5})$/i);
  if (dot) return dot[1].toLowerCase();
  const dash = clean.match(/-([a-z0-9]{2,5})$/i);
  if (dash) return dash[1].toLowerCase();
  return null;
}

/** Ikona pro DocumentRow podle inferovaného typu. */
export function iconForKind(kind: DocKind): string {
  switch (kind) {
    case "pdf":
      return "📄";
    case "image":
      return "🖼️";
    case "office":
      return "📝";
    case "text":
      return "📃";
    case "archive":
      return "🗜️";
    case "cert":
      return "🔐";
    default:
      return "📎";
  }
}

/** Otevře přílohu v nejvhodnějším in-app vieweru. Pro zatím nepodporované typy
 *  fallback na WebBrowser (Safari pro PDF/image, pro zbytek fallback download). */
export async function openTenderDocument(
  doc: TenderDocument,
  router: Router,
  locale?: string,
): Promise<void> {
  const kind = inferDocKind(doc);
  const ext = inferDocExt(doc);
  // TED oznámení existují ve všech jazycích EU → přepiš URL na locale uživatele
  // (fallback en). Non-TED URL vrací beze změny.
  const url = localizeTedUrl(doc.url, locale ?? "en");
  if (kind === "image") {
    router.push({
      pathname: "/doc-image",
      params: { url, name: doc.name },
    });
    return;
  }
  // DOCX přes docx-preview, XLSX/XLS/XLSM přes SheetJS — vše server-side
  // render do HTML stránky, cached na Spaces.
  if (ext === "docx" || ext === "xlsx" || ext === "xls" || ext === "xlsm") {
    router.push({
      pathname: "/doc-html",
      params: { url, name: doc.name, kind: ext },
    });
    return;
  }
  // Starší binární formáty (.doc/.rtf/.ppt/.pptx/.odt/.ods/.odp), které neumíme
  // renderovat in-house (docx-preview/SheetJS je nezvládnou, LibreOffice běží jen
  // na externím workeru). Zakázkové dokumenty jsou veřejné → otevřeme je přes
  // Microsoft Office web viewer (plná věrnost, bez vlastní infra). Vyžaduje
  // veřejně dostupnou URL (resolver i portály jsou public).
  if (ext && OFFICE_VIEWER_EXTS.includes(ext)) {
    await WebBrowser.openBrowserAsync(officeViewerUrl(url));
    return;
  }
  // PDF přes RWX resolver (vasedio.cz) chodí s `Content-Disposition: attachment`,
  // takže in-app prohlížeč soubor stáhne místo zobrazení. Protáhneme ho naším
  // inline-proxy endpointem (uloží do Spaces jako application/pdf bez attachment)
  // a otevřeme výslednou signed URL — SFSafari/Chrome Custom Tab ji vykreslí inline.
  if (kind === "pdf" && isResolverHost(url)) {
    const inlineUrl = await resolveInlinePdfUrl(url);
    if (inlineUrl) {
      await WebBrowser.openBrowserAsync(inlineUrl);
      return;
    }
    // fallthrough: kdyby proxy selhala, otevři aspoň původní URL
  }
  // PDF i ostatní typy přes SFSafariViewController.
  await WebBrowser.openBrowserAsync(url);
}

const TED_LANGS = new Set([
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
]);

/** TED oznámení jsou ve všech 24 jazycích EU (ted.europa.eu/{lang}/notice/{id}/…).
 *  Přepíše jazykový segment na locale uživatele (fallback en). Non-TED beze změny. */
export function localizeTedUrl(rawUrl: string, locale: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.hostname !== "ted.europa.eu" && !u.hostname.endsWith(".ted.europa.eu")) return rawUrl;
    const m = u.pathname.match(/^\/[a-z]{2}(\/notice\/.+)$/i);
    if (!m) return rawUrl;
    const lang = TED_LANGS.has(locale) ? locale : "en";
    u.pathname = `/${lang}${m[1]}`;
    return u.toString();
  } catch {
    return rawUrl;
  }
}

/** "TED 321887-2026 — MLT (PDF)" → "TED 321887-2026 (PDF)" (zbav zavádějícího kódu jazyka). */
export function cleanTedDocName(name: string, url: string): string {
  if (!url.includes("ted.europa.eu")) return name;
  return name.replace(/\s+—\s+[A-Z]{3}\s+\(/, " (");
}

/** Legacy Office formáty, které renderujeme přes Microsoft Office web viewer. */
const OFFICE_VIEWER_EXTS = ["doc", "rtf", "ppt", "pptx", "odt", "ods", "odp"];

/** Microsoft Office online viewer pro veřejné dokumenty (plná věrnost). */
function officeViewerUrl(url: string): string {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
}

/** True pro dokumenty servírované přes RWX resolver (potřebují inline-proxy). */
function isResolverHost(url: string): boolean {
  try {
    return new URL(url).host.toLowerCase().endsWith("vasedio.cz");
  } catch {
    return false;
  }
}

/** Získá signed inline URL z preview endpointu (Bearer auth), nebo null při chybě. */
async function resolveInlinePdfUrl(url: string): Promise<string | null> {
  try {
    const token = await getToken();
    const endpoint = `${API_BASE_URL}/api/v2/leads/documents/preview?url=${encodeURIComponent(
      url,
    )}&kind=pdf&redirect=json`;
    const res = await fetch(endpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data?.url ?? null;
  } catch {
    return null;
  }
}
