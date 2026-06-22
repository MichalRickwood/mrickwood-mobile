import Constants from "expo-constants";

/**
 * Runtime config. API base URL přijímáme z `extra.apiBaseUrl` v app.json
 * (nebo env při `eas build`), s rozumným fallbackem na prod.
 *
 * Pro lokální vývoj proti dev serveru použij EXPO_PUBLIC_API_BASE_URL.
 */

const PROD = "https://mrickwood.cz";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  ((Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.apiBaseUrl as string | undefined) ||
  PROD;

/**
 * Web pro přihlášení/registraci (ASWebAuthenticationSession redirect).
 *
 * MUSÍ být stejný host jako NEXTAUTH_URL na backendu (mrickwood.cz). OAuth
 * (Google/GitHub) callback míří na NEXTAUTH_URL a session cookie se nastaví
 * tam — kdyby auth běžel na jiné doméně (auth.mrickwood.cz), /mobile by tu
 * cookie po OAuth neviděl a přihlášení by se nedotáhlo (cross-domain).
 * Override přes EXPO_PUBLIC_AUTH_BASE_URL pro lokální/test web.
 */
export const AUTH_BASE_URL =
  process.env.EXPO_PUBLIC_AUTH_BASE_URL || PROD;

export const APP_NAME = "Veritra";
