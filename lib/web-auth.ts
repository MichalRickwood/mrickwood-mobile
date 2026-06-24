import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { saveToken, saveUser, type StoredUser } from "./auth-storage";
import { AUTH_BASE_URL } from "./config";
import { endpoints } from "./endpoints";

/**
 * Web-redirect auth. POUZE PŘIHLÁŠENÍ existujícího účtu na veritra.io — appka
 * jen otevře web v ASWebAuthenticationSession (Apple-preferred secure browser,
 * ne raw WebView) a po úspěchu dostane jednorázový `code`, který vymění za
 * mobilní JWT. Stejný pattern jako dřívější GitHub OAuth.
 *
 * Apple compliance (3.1.1): appka VĚDOMĚ neumí registraci (mode=register).
 * Nový business účet vede k placenému tarifu mimo IAP → in-app registrace je
 * "external mechanism for purchases", což Apple zamítl. `mode` je proto fixně
 * "login"; registrace se dělá výhradně na webu. Nepřidávej zpět "register".
 *
 * Guideline 4.8 (Sign in with Apple) se neaktivuje — appka používá výhradně
 * vlastní auth systém. Social login je záležitost webu, mimo scope appky.
 */

WebBrowser.maybeCompleteAuthSession();

/** Uživatel zavřel prohlížeč bez dokončení — caller chybu ignoruje. */
export class WebAuthCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "WebAuthCancelled";
  }
}

export async function startWebAuth(locale: string): Promise<StoredUser> {
  // V EAS buildu → "tendero://auth/callback" (scheme z app.json). createURL ho
  // vyřeší správně i v dev clientu.
  const redirectUrl = Linking.createURL("auth/callback");
  // state = ochrana proti záměně/útoku; web ho vrací beze změny.
  const state = Crypto.randomUUID();

  const authUrl =
    `${AUTH_BASE_URL}/mobile?mode=login` +
    `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
    `&state=${encodeURIComponent(state)}` +
    `&locale=${encodeURIComponent(locale)}`;

  // preferEphemeralSession: privátní auth session bez sdílení cookies mezi
  // spuštěními. Bez toho NextAuth session cookie na veritra.io přežije
  // odhlášení v appce → server přes requireAuth() uvidí starou session a rovnou
  // přihlásí původní účet (formulář se neukáže). Ephemeral = formulář vždy čistý,
  // přepnutí účtu funguje. (iOS; na Androidu se ignoruje — řeší se server-side.)
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl, {
    preferEphemeralSession: true,
  });

  if (result.type !== "success") {
    // cancel / dismiss — user zavřel prohlížeč
    throw new WebAuthCancelled();
  }

  const { queryParams } = Linking.parse(result.url);
  const code = typeof queryParams?.code === "string" ? queryParams.code : null;
  const returnedState = typeof queryParams?.state === "string" ? queryParams.state : null;
  const error = typeof queryParams?.error === "string" ? queryParams.error : null;

  if (error) throw new Error(error);
  if (returnedState !== state) throw new Error("Neplatný state — přihlášení zamítnuto.");
  if (!code) throw new Error("Chybí autorizační kód.");

  const { token, user } = await endpoints.exchangeWebAuthCode(code);
  await saveToken(token);
  await saveUser(user);
  return user;
}

export type { StoredUser };
