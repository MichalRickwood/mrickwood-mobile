/**
 * RevenueCat (Apple IAP) — per-country předplatné na iOS.
 * Konfigurace + login (appUserID = náš user.id) + fetch produktů + nákup + restore.
 * Aktivní jen na iOS s nastaveným EXPO_PUBLIC_REVENUECAT_IOS_KEY; jinak no-op.
 */
import { Platform } from "react-native";
import Purchases, { type PurchasesStoreProduct } from "react-native-purchases";

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
let configured = false;

export function isIapAvailable(): boolean {
  return Platform.OS === "ios" && !!IOS_KEY;
}

function ensureConfigured(): boolean {
  if (!isIapAvailable()) return false;
  if (!configured) {
    Purchases.configure({ apiKey: IOS_KEY! });
    configured = true;
  }
  return true;
}

/** Přihlásí RevenueCat na náš user.id (appUserID) — webhook tím zná uživatele. */
export async function iapLogIn(userId: string): Promise<void> {
  if (!ensureConfigured()) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn("[iap] logIn:", e instanceof Error ? e.message : e);
  }
}

export async function iapLogOut(): Promise<void> {
  if (!isIapAvailable() || !configured) return;
  try {
    await Purchases.logOut();
  } catch {
    /* ignore */
  }
}

export interface CountryProducts {
  monthly: PurchasesStoreProduct | null;
  yearly: PurchasesStoreProduct | null;
}

/** Načte StoreKit produkty (cena z Apple) pro zemi. */
export async function getCountryProducts(monthlyId: string, yearlyId: string): Promise<CountryProducts> {
  if (!ensureConfigured()) return { monthly: null, yearly: null };
  try {
    const products = await Purchases.getProducts([monthlyId, yearlyId]);
    return {
      monthly: products.find((p) => p.identifier === monthlyId) ?? null,
      yearly: products.find((p) => p.identifier === yearlyId) ?? null,
    };
  } catch (e) {
    console.warn("[iap] getProducts:", e instanceof Error ? e.message : e);
    return { monthly: null, yearly: null };
  }
}

/** Nákup produktu. Vrací true při úspěchu, false při zrušení uživatelem; jinak hází. */
export async function purchaseProduct(product: PurchasesStoreProduct): Promise<boolean> {
  if (!ensureConfigured()) return false;
  try {
    await Purchases.purchaseStoreProduct(product);
    return true;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "userCancelled" in e && (e as { userCancelled?: boolean }).userCancelled) {
      return false;
    }
    throw e;
  }
}

export async function restorePurchases(): Promise<void> {
  if (!ensureConfigured()) return;
  await Purchases.restorePurchases();
}
