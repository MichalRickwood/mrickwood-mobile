import Constants from "expo-constants";

/**
 * Runtime config. API base URL přijímáme z `extra.apiBaseUrl` v app.json
 * (nebo env při `eas build`), s rozumným fallbackem na prod.
 *
 * Pro lokální vývoj proti dev serveru použij EXPO_PUBLIC_API_BASE_URL.
 */

const PROD = "https://veritra.io";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  ((Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.apiBaseUrl as string | undefined) ||
  PROD;

/**
 * Web pro přihlášení/registraci (ASWebAuthenticationSession redirect).
 *
 * MUSÍ být stejný host jako odkud appka otevírá /mobile (veritra.io). Backend
 * má trustHost → OAuth callback se odvodí z hostu requestu, takže session
 * cookie se nastaví na tomtéž hostu jako /mobile a přihlášení se dotáhne.
 * (Staré buildy mířící na mrickwood.cz fungují dál — obě domény servíruje
 * jeden deployment.)
 * Override přes EXPO_PUBLIC_AUTH_BASE_URL pro lokální/test web.
 */
export const AUTH_BASE_URL =
  process.env.EXPO_PUBLIC_AUTH_BASE_URL || PROD;

export const APP_NAME = "Veritra";
