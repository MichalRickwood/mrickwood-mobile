/**
 * Lehký activity tracker — batchuje client eventy (screen views, případně
 * akce) do POST /api/v2/track → UserActivity timeline (admin detail uživatele).
 *
 * - fire-and-forget: chyba/offline eventy zahodí, tracking nesmí rušit UX
 * - flush: každých 15 s, při 10+ eventech a při přechodu appky do pozadí
 * - bez tokenu (anonymous) se eventy zahazují — server anon z mobilu nebere
 */
import { AppState } from "react-native";
import { API_BASE_URL } from "./config";
import { getToken } from "./auth-storage";

export type TrackCategory = "navigation" | "leads" | "feedback";

export interface TrackEvent {
  category: TrackCategory;
  /** kebab/snake, např. "screen_view" — server validuje ^[a-z][a-z0-9_.]{0,47}$ */
  type: string;
  path?: string;
  target?: string;
  meta?: Record<string, unknown>;
}

const FLUSH_MS = 15_000;
const FLUSH_AT = 10;
const MAX_QUEUE = 40;
const MAX_BATCH = 20;

let queue: TrackEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const token = await getToken().catch(() => null);
  if (!token) {
    queue = [];
    return;
  }
  const events = queue.splice(0, MAX_BATCH);
  try {
    await fetch(`${API_BASE_URL}/api/v2/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events }),
    });
  } catch {
    // offline / server chyba — eventy padly, ztráta je přijatelná
  }
  if (queue.length > 0) schedule();
}

function schedule(): void {
  if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
}

function ensureStarted(): void {
  if (started) return;
  started = true;
  AppState.addEventListener("change", (state) => {
    if (state === "background" || state === "inactive") void flush();
  });
}

export function track(event: TrackEvent): void {
  ensureStarted();
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(event);
  if (queue.length >= FLUSH_AT) void flush();
  else schedule();
}

let lastScreen: string | null = null;

/** Screen view s dedupe po sobě jdoucích stejných cest; ID segment → target. */
export function trackScreen(pathname: string): void {
  if (pathname === lastScreen) return;
  lastScreen = pathname;
  const segments = pathname.split("/").filter(Boolean);
  const idSeg = segments.find((s) => /^\d+$/.test(s) || /^[a-z0-9]{20,}$/i.test(s));
  track({ category: "navigation", type: "screen_view", path: pathname, target: idSeg });
}
