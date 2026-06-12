/**
 * Apple In-App Purchase service (iOS only).
 *
 * Model: jedna auto-renewable subscription pokrývá celý set LEADS zemí.
 * Backend (/api/v2/account/billing/iap) říká, KTERÝ productId koupit pro daný
 * set zemí (quote), a po nákupu verifikuje podepsanou StoreKit 2 transakci
 * (JWS = purchase.purchaseToken) a zapne Subscription rows.
 *
 * Upgrade (přidání země) = nákup vyššího produktu ve stejné subscription
 * group — Apple proration řeší sám, platí hned. Downgrade (odebrání země)
 * Apple aplikuje až při renewalu → backend dostane pending scopes.
 *
 * POZOR: expo-iap se načítá VÝHRADNĚ lazy (dynamic import). Statický import
 * by při evaluaci modulu volal requireNativeModule a shodil celý settings
 * stack v buildech bez nativního modulu (Expo Go, starší dev/TestFlight
 * buildy) — expo-router require-uje všechny sibling routes při mountu Stacku.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Purchase } from "expo-iap";
import { endpoints } from "./endpoints";

type ExpoIapModule = typeof import("expo-iap");

export const IAP_PRODUCT_PREFIX = "veritra.leads.";

/** Scopes zvolené při posledním purchase — fallback pro restore/replay, když
 *  backend o nákupu ještě neví (crash mezi purchase a verify). */
const PENDING_SCOPES_KEY = "iap.lastPurchaseScopes";

let mod: ExpoIapModule | null = null;
let connected = false;

/** Lazy load expo-iap — null když nativní modul v buildu chybí. */
async function loadIap(): Promise<ExpoIapModule | null> {
  if (Platform.OS !== "ios") return null;
  if (mod) return mod;
  try {
    mod = await import("expo-iap");
    return mod;
  } catch {
    return null;
  }
}

export async function ensureIapConnection(): Promise<ExpoIapModule | null> {
  const iap = await loadIap();
  if (!iap) return null;
  if (connected) return iap;
  try {
    await iap.initConnection();
    connected = true;
    return iap;
  } catch {
    return null;
  }
}

export async function closeIapConnection(): Promise<void> {
  if (!connected || !mod) return;
  try {
    await mod.endConnection();
  } finally {
    connected = false;
  }
}

export interface LeadsProductInfo {
  productId: string;
  displayPrice: string;
}

/** Lokalizovaná cena produktu ze StoreKit (žádné vlastní ceníky v appce). */
export async function fetchLeadsProduct(productId: string): Promise<LeadsProductInfo | null> {
  const iap = await ensureIapConnection();
  if (!iap) return null;
  const products = await iap.fetchProducts({ skus: [productId], type: "subs" });
  const p = (products as Array<{ id: string; displayPrice: string }>).find(
    (x) => x.id === productId,
  );
  return p ? { productId: p.id, displayPrice: p.displayPrice } : null;
}

export class IapCancelledError extends Error {
  constructor() {
    super("cancelled");
  }
}

export class IapUnavailableError extends Error {
  constructor() {
    super("IAP not available");
  }
}

/**
 * Koupí daný produkt a verifikuje ho na backendu pro daný set zemí.
 * Resolvuje až po úspěšné backend verifikaci + finishTransaction.
 *
 * `mode: "purchase"` → verify nastaví scopes hned (nový nákup / upgrade).
 * `mode: "downgrade"` → Apple změnu aplikuje při renewalu; backend dostane
 *   pending scopes a verify jen potvrdí stávající stav.
 */
export async function purchaseLeads(opts: {
  productId: string;
  appAccountToken: string;
  scopes: string[];
  currentScopes?: string[];
  mode?: "purchase" | "downgrade";
}): Promise<void> {
  const iap = await ensureIapConnection();
  if (!iap) throw new IapUnavailableError();
  const mode = opts.mode ?? "purchase";

  await AsyncStorage.setItem(PENDING_SCOPES_KEY, JSON.stringify(opts.scopes)).catch(() => {});

  const purchase = await new Promise<Purchase>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      updateSub.remove();
      errorSub.remove();
      fn();
    };
    const updateSub = iap.purchaseUpdatedListener((p) => {
      if (p.productId !== opts.productId) return;
      settle(() => resolve(p));
    });
    const errorSub = iap.purchaseErrorListener((e) => {
      settle(() =>
        reject(e.code === "user-cancelled" ? new IapCancelledError() : new Error(e.message)),
      );
    });
    iap
      .requestPurchase({
        request: { apple: { sku: opts.productId, appAccountToken: opts.appAccountToken } },
        type: "subs",
      })
      .catch((e) => settle(() => reject(e instanceof Error ? e : new Error(String(e)))));
  });

  const jws = purchase.purchaseToken;
  if (!jws) throw new Error("Missing transaction token");

  if (mode === "downgrade") {
    // Downgrade: entitlement se mění až renewalem — ulož pending set,
    // verify jen re-potvrdí současný produkt (no-op pro scopes).
    await endpoints.setIapPendingScopes(opts.scopes);
    if (opts.currentScopes && opts.currentScopes.length > 0) {
      await endpoints.verifyIapPurchase(jws, opts.currentScopes).catch(() => {});
    }
  } else {
    await endpoints.verifyIapPurchase(jws, opts.scopes);
  }

  await iap.finishTransaction({ purchase, isConsumable: false });
  await AsyncStorage.removeItem(PENDING_SCOPES_KEY).catch(() => {});
}

/**
 * Restore / dokončení nezpracovaných transakcí. Projde dostupné nákupy,
 * LEADS subscription verifikuje na backendu a dokončí.
 *
 * Scopes pro verify: backend current → lokální stash z přerušeného nákupu.
 * Vrací počet úspěšně obnovených transakcí; -1 = nákup existuje, ale nejde
 * přiřadit set zemí (UI zobrazí instrukci).
 */
export async function restoreLeadsPurchases(): Promise<number> {
  const iap = await ensureIapConnection();
  if (!iap) return 0;
  const purchases = await iap.getAvailablePurchases();
  const leads = purchases.filter((p) => p.productId.startsWith(IAP_PRODUCT_PREFIX));
  if (leads.length === 0) return 0;

  const current = await endpoints.getIapState();
  let scopes: string[] = current.current.scopes;
  if (scopes.length === 0) {
    try {
      const stash = await AsyncStorage.getItem(PENDING_SCOPES_KEY);
      if (stash) scopes = JSON.parse(stash) as string[];
    } catch {
      // ignore
    }
  }
  if (scopes.length === 0) return -1;

  let restored = 0;
  for (const p of leads) {
    const jws = p.purchaseToken;
    if (!jws) continue;
    try {
      await endpoints.verifyIapPurchase(jws, scopes);
      await iap.finishTransaction({ purchase: p, isConsumable: false });
      restored++;
    } catch {
      // Kompozice nesedí na aktuální scopes (starý produkt apod.) — nech být,
      // další pokus při příští návštěvě billing screenu.
    }
  }
  return restored;
}

/** Otevře nativní správu předplatných (cancel/změna řeší Apple UI). */
export async function openManageSubscriptions(): Promise<void> {
  const iap = await ensureIapConnection();
  if (!iap) return;
  await iap.deepLinkToSubscriptions();
}
