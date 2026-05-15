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

export const APP_NAME = "Tendero";
