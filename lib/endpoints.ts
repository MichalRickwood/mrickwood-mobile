import { api } from "./api";

/**
 * Typed endpoints — sjednoceno na jednom místě, ať klient nemusí znát URL.
 * Schéma shape kopíruje mrickwood-web (zdroj pravdy).
 */

export interface MobileLoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: "USER" | "ADMIN";
  };
}

export interface ContractingAuthority {
  ico: string;
  name: string;
  region: string | null;
  district: string | null;
}

export interface PublicTender {
  id: number;
  title: string;
  portalType: string;
  url: string;
  status: string;
  estimatedValue: number | null;
  currency: string | null;
  publishedAt: string | null;
  deadlineAt: string | null;
  firstSeenAt: string;
  cpvCode: string | null;
  tenderType: string | null;
  contractingAuthority: ContractingAuthority;
}

export interface LeadMatchRow {
  matchId: string;
  filterId: string;
  filterName: string;
  matchedAt: string;
  delivered: boolean;
  viewedAt: string | null;
  tender: PublicTender;
}

export interface LeadFilterRow {
  id: string;
  name: string;
  isActive: boolean;
  emailDigest: boolean;
  regions: string[];
  keywords: string[];
  categories: string[];
  industryTags: string[];
  minValue: number | null;
  maxValue: number | null;
}

export const endpoints = {
  // Auth
  login: (email: string, password: string) =>
    api.post<MobileLoginResponse>("/api/auth/mobile/login", { email, password }, { noAuth: true }),

  // Aktuální user (verifikace JWT na startu)
  me: () => api.get<{ user: MobileLoginResponse["user"] }>("/api/auth/mobile/me"),

  // Lead matches — last 30 days, optional filterId
  myMatches: (params?: { filterId?: string }) =>
    api.get<{ matches: LeadMatchRow[] }>("/api/mobile/matches", { params }),

  // Filtry usera (pro filter chips v UI)
  myFilters: () => api.get<{ filters: LeadFilterRow[] }>("/api/mobile/filters"),

  // Mark match jako viewed
  markViewed: (matchId: string) =>
    api.post<{ ok: true }>(`/api/mobile/matches/${matchId}/view`),

  // Registrace push tokenu z Expo (po user povolí notifikace)
  registerPushDevice: (token: string, platform: "ios" | "android") =>
    api.post<{ ok: true }>("/api/mobile/devices/register", { token, platform }),

  // Odregistrace push tokenu při odhlášení
  unregisterPushDevice: (token: string) =>
    api.post<{ ok: true }>("/api/mobile/devices/unregister", { token }),
};
