import * as WebBrowser from "expo-web-browser";
import type { Router } from "expo-router";
import type { TenderDocument } from "./endpoints";

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
): Promise<void> {
  const kind = inferDocKind(doc);
  const ext = inferDocExt(doc);
  if (kind === "image") {
    router.push({
      pathname: "/doc-image",
      params: { url: doc.url, name: doc.name },
    });
    return;
  }
  // DOCX server-side konvertujeme přes mammoth → HTML (cached na Spaces).
  // Starý DOC (binary) zatím neumíme, fallback na Safari.
  if (ext === "docx") {
    router.push({
      pathname: "/doc-html",
      params: { url: doc.url, name: doc.name, kind: "docx" },
    });
    return;
  }
  // PDF i ostatní typy zatím přes SFSafariViewController.
  await WebBrowser.openBrowserAsync(doc.url);
}
