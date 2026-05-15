import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { saveToken, saveUser, type StoredUser } from "./auth-storage";
import { API_BASE_URL } from "./config";

/**
 * OAuth helper pro Google/GitHub/Apple. Po úspěchu vrací { user, token } —
 * caller (AuthContext) si pak nastaví state. SaveToken + saveUser děláme
 * tady, ať to neleak nahoru.
 */

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
const GITHUB_CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID || "";

export function isGoogleConfigured(): boolean {
  return Boolean(GOOGLE_IOS_CLIENT_ID);
}
export function isGithubConfigured(): boolean {
  return Boolean(GITHUB_CLIENT_ID);
}
export function isAppleAvailable(): boolean {
  return Platform.OS === "ios";
}

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
  return { request, response, promptAsync };
}

const githubDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
};

export function useGithubAuth() {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "tendero", path: "oauth/github" });
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GITHUB_CLIENT_ID,
      scopes: ["read:user", "user:email"],
      redirectUri,
    },
    githubDiscovery,
  );
  return { request, response, promptAsync, redirectUri };
}

async function postOauth(
  provider: "google" | "apple" | "github",
  payload: { idToken?: string; code?: string; redirectUri?: string },
): Promise<StoredUser> {
  const res = await fetch(`${API_BASE_URL}/api/auth/mobile/oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ provider, ...payload }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `OAuth ${provider} selhalo (${res.status}).`);
  }
  const data = (await res.json()) as {
    token: string;
    user: { id: string; email: string; name: string | null; role: "USER" | "ADMIN" };
  };
  await saveToken(data.token);
  await saveUser(data.user);
  return data.user;
}

export async function completeGoogleSignIn(idToken: string): Promise<StoredUser> {
  return postOauth("google", { idToken });
}

export async function completeGithubSignIn(
  code: string,
  redirectUri: string,
): Promise<StoredUser> {
  return postOauth("github", { code, redirectUri });
}

export async function signInWithApple(): Promise<StoredUser> {
  if (!isAppleAvailable()) throw new Error("Apple Sign In jen na iOS.");
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!cred.identityToken) throw new Error("Apple neposlal identityToken.");
  return postOauth("apple", { idToken: cred.identityToken });
}

export type { StoredUser };
