/**
 * Průvodce aplikací — kroky, persistovaný stav a (budoucí) video návody.
 *
 * Auto-open: CountriesManager při onboarding aktivaci trialu nastaví „pending"
 * flag; obrazovka Zakázky ho při mountu spotřebuje a průvodce otevře. Stávající
 * uživatelé pending nikdy nedostanou → žádné hromadné překvapení po updatu.
 * Ruční otevření je vždy v Nastavení → Průvodce aplikací.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type GuideStepId =
  | "welcome"
  | "orientation"
  | "emailDigest"
  | "aiAnalysis"
  | "subscription";

export const GUIDE_STEPS: GuideStepId[] = [
  "welcome",
  "orientation",
  "emailDigest",
  "aiAnalysis",
  "subscription",
];

const PENDING_KEY = "veritra.guidePending";
const SEEN_KEY = "veritra.guideSeen";

export async function markGuidePending(): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, "1");
  } catch {
    /* průvodce nesmí nikdy blokovat aplikaci */
  }
}

/** Vrátí true právě jednou — po dokončení onboardingu (pending && !seen). */
export async function consumeGuidePending(): Promise<boolean> {
  try {
    const [pending, seen] = await Promise.all([
      AsyncStorage.getItem(PENDING_KEY),
      AsyncStorage.getItem(SEEN_KEY),
    ]);
    if (pending !== "1") return false;
    await Promise.all([
      AsyncStorage.removeItem(PENDING_KEY),
      AsyncStorage.setItem(SEEN_KEY, "1"),
    ]);
    return seen !== "1";
  } catch {
    return false;
  }
}

/**
 * Mobilní guide videa natočíme později — až budou na Spaces
 * (Veritra/guides/mobile/<locale>/<topic>.mp4), stačí přidat klíč
 * "<locale>/<topic>" do AVAILABLE a poslat OTA update.
 */
const GUIDE_VIDEO_BASE =
  "https://rwx-storage.fra1.digitaloceanspaces.com/Veritra/guides/mobile";
/** Bump při přenahrání videí (CDN i lokální cache busting). v2 = portrét 810×1800. */
const GUIDE_VIDEO_VERSION = "2";
const AVAILABLE = new Set<string>([
  "cs/orientation", "cs/emailDigest", "cs/subscription",
  "en/orientation", "en/emailDigest", "en/subscription",
  "de/orientation", "de/emailDigest", "de/subscription",
]);

export function guideVideoUrl(topic: GuideStepId, locale: string): string | null {
  const key = `${locale}/${topic}`;
  const resolved = AVAILABLE.has(key) ? key : AVAILABLE.has(`cs/${topic}`) ? `cs/${topic}` : null;
  return resolved ? `${GUIDE_VIDEO_BASE}/${resolved}.mp4?v=${GUIDE_VIDEO_VERSION}` : null;
}

/**
 * Video předstažené do cache — WebView pak hraje lokální soubor (okamžitý
 * start místo streamování ze Spaces). Při selhání stažení vrací remote URL
 * (fallback na streamování); videa mají ~0,3–1,5 MB, OS cache si je spravuje.
 */
export async function cachedGuideVideoUri(
  topic: GuideStepId,
  locale: string,
): Promise<string | null> {
  const remote = guideVideoUrl(topic, locale);
  if (!remote) return null;
  try {
    const FileSystem = await import("expo-file-system/legacy");
    // název souboru zahrnuje i ?v= → bump verze zneplatní lokální cache
    const name = remote.split("/guides/mobile/")[1]!.replace(/[^a-zA-Z0-9.]+/g, "-");
    const target = `${FileSystem.cacheDirectory}guide-${name}`;
    const info = await FileSystem.getInfoAsync(target);
    if (info.exists && (info.size ?? 0) > 0) return target;
    const dl = await FileSystem.downloadAsync(remote, target);
    return dl.status === 200 ? dl.uri : remote;
  } catch {
    return remote;
  }
}
