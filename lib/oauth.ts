import * as AppleAuthentication from "expo-apple-authentication";
import { saveToken, saveUser, type StoredUser } from "./auth-storage";
import { endpoints } from "./endpoints";

/**
 * Nativní OAuth pro appku. Apple = native sheet (expo-apple-authentication),
 * Google = expo-auth-session (idToken se získá v komponentě přes hook a předá
 * sem do googleExchange). Server (/api/auth/mobile/oauth) ověří idToken, založí/
 * najde usera (emailVerified hned, souhlasy clickwrap pod tlačítky) a vrátí JWT.
 */

export class OAuthCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "OAuthCancelled";
  }
}

/** Sign in with Apple — nativní sheet. */
export async function appleSignIn(): Promise<StoredUser> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "ERR_REQUEST_CANCELED") {
      throw new OAuthCancelled();
    }
    throw e;
  }
  if (!credential.identityToken) throw new Error("Apple: chybí identity token.");
  // Apple posílá fullName jen při první autorizaci a jen nativně (není v tokenu).
  const fullName =
    [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ") || undefined;
  const { token, user } = await endpoints.mobileOauth({
    provider: "apple",
    idToken: credential.identityToken,
    name: fullName,
  });
  await saveToken(token);
  await saveUser(user);
  return user;
}

export function isAppleAuthAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

/** Google — idToken už získaný přes expo-auth-session hook v komponentě. */
export async function googleExchange(idToken: string): Promise<StoredUser> {
  const { token, user } = await endpoints.mobileOauth({ provider: "google", idToken });
  await saveToken(token);
  await saveUser(user);
  return user;
}
