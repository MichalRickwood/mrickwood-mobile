import * as SecureStore from "expo-secure-store";

/**
 * Tenký wrapper nad expo-secure-store pro JWT.
 * Hodnota je uložená do iOS Keychain / Android Keystore — chráněná OS.
 */

const TOKEN_KEY = "tendero.session.token";
const USER_KEY = "tendero.session.user";

export interface StoredUser {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveUser(user: StoredUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<StoredUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export async function clearUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function clearSession(): Promise<void> {
  await Promise.all([clearToken(), clearUser()]);
}
