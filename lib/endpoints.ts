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

export interface TenderDocument {
  name: string;
  url: string;
  fileType: string | null;
  fileSizeBytes: number | null;
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
  documents: TenderDocument[];
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

export interface MobileRegisterInput {
  email: string;
  password: string;
  name: string;
  locale: string;
  consentVop: boolean;
  consentGdpr: boolean;
}

export interface ProfileView {
  name: string | null;
  phone: string | null;
  email: string;
  company: string | null;
  ico: string | null;
  dic: string | null;
  address: string | null;
  isComplete: boolean;
}

export interface ProfileUpdate {
  name?: string | null;
  phone?: string | null;
  company?: string | null;
  ico?: string | null;
  dic?: string | null;
  address?: string | null;
  country?: string | null;
}

export interface NotificationSettings {
  email: string;
  digestEnabled: boolean;
  marketingEnabled: boolean;
  educationalEnabled: boolean;
}

export const endpoints = {
  // Auth
  login: (email: string, password: string) =>
    api.post<MobileLoginResponse>("/api/auth/mobile/login", { email, password }, { noAuth: true }),

  // Mobile-specific register — minimální (name, email, password, consents).
  // Firemní údaje + telefon se doplňují v Settings → Profil / Předplatné.
  register: (input: MobileRegisterInput) =>
    api.post<{ success: boolean; userId: string }>("/api/auth/mobile/register", input, { noAuth: true }),

  // Profile read — používáme po loginu pro detekci jestli je profil kompletní
  profile: () => api.get<ProfileView>("/api/account/profile"),

  // Profile update — phone + company/ico/dic/address/country
  updateProfile: (input: ProfileUpdate) =>
    api.patch<{ ok: true }>("/api/account/profile", input),

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

  // Email notifikační preference (digest, marketing, educational)
  getNotificationSettings: () =>
    api.get<{ settings: NotificationSettings }>("/api/mobile/notification-settings"),
  updateNotificationSettings: (input: Partial<Omit<NotificationSettings, "email">>) =>
    api.patch<{ settings: NotificationSettings }>("/api/mobile/notification-settings", input),

  // Heslo — GET zda user má heslo (OAuth-only účty mají hasPassword=false)
  getPasswordStatus: () => api.get<{ hasPassword: boolean }>("/api/mobile/password"),
  // POST vrací nový JWT (token-version se inkrementuje při změně hesla, takže
  // starý token by skončil 401). Klient nahradí token v SecureStore.
  changePassword: (input: { currentPassword?: string; newPassword: string }) =>
    api.post<{ ok: true; token: string }>("/api/mobile/password", input),

  // Odhlásit ze všech zařízení (inkrement mobileTokenVersion).
  revokeAllSessions: () => api.post<{ ok: true }>("/api/mobile/sessions/revoke"),

  // Billing — full self-service state (profile, mode, cycle, services, card, invoice)
  getBilling: () => api.get<BillingFullState>("/api/mobile/billing"),
  updateBilling: (input: BillingUpdateInput) =>
    api.patch<{ ok: true }>("/api/mobile/billing", input),

  // Stripe Checkout (mobile deep links). Mobile otevře `url` ve WebBrowser.
  createBillingCheckout: () =>
    api.post<{ url: string }>("/api/mobile/billing/checkout"),
  disconnectCard: () => api.delete<{ ok: true }>("/api/mobile/billing/checkout"),

  // Proforma faktura (pro INVOICE režim)
  createProforma: (cycle: BillingCycle) =>
    api.post<{
      ok: true;
      invoiceId: string;
      invoiceNumber: string;
      totalAmount: number;
      dueDate: string;
      cycle: BillingCycle;
    }>("/api/mobile/billing/proforma", { cycle }),
  deleteProforma: () => api.delete<{ ok: true }>("/api/mobile/billing/proforma"),

  // Cancel / reactivate service auto-renewal
  cancelService: (service: ApiServiceId) =>
    api.post<{ ok: true; alreadyScheduled?: boolean }>(
      "/api/mobile/billing/cancel-service",
      { service },
    ),
  reactivateService: (service: ApiServiceId) =>
    api.delete<{ ok: true; alreadyActive?: boolean }>(
      `/api/mobile/billing/cancel-service?service=${service}`,
    ),

  // Faktury — list. PDF download je v lib/invoice-pdf.ts (přes Bearer auth +
  // expo-file-system + expo-sharing pro iOS native preview).
  getInvoices: () =>
    api.get<{ invoices: InvoiceRow[] }>("/api/mobile/billing/invoices"),

  // Account export — pošle JSON přílohou na email uživatele (mobile-only flow).
  exportAccount: () =>
    api.post<{ sent: true; email: string }>("/api/mobile/account/export"),

  // Cancel / Delete flow (request → email s 8-char kódem → confirm)
  requestAccountCancel: (action: "DEACTIVATE" | "DELETE") =>
    api.post<{ sent: true; action: "DEACTIVATE" | "DELETE"; email: string; expiresAt: string }>(
      "/api/mobile/account/cancel/request",
      { action },
    ),
  confirmAccountCancel: (input: { code: string; reason?: string }) =>
    api.post<{ action: "DEACTIVATE" | "DELETE" }>("/api/mobile/account/cancel/confirm", input),
};

export type BillingTier = "FREE" | "PAID";
export type BillingState = "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";
export type BillingCycle = "MONTHLY" | "YEARLY";
export type BillingMode = "CARD" | "INVOICE";
export type ApiServiceId = "PRICING" | "LEADS" | "PROCUREMENT" | "MANAGEMENT";

export interface BillingProfileShape {
  name: string;
  ico: string;
  dic: string;
  address: string;
  email: string;
  country: string;
}

export interface BillingCardInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface BillingInvoiceLite {
  id: string;
  number: string;
  status: string;
  totalAmount: number;
  pdfPath: string | null;
  paidDate: string | null;
}

export interface BillingServiceRow {
  service: ApiServiceId;
  tier: BillingTier;
  state: BillingState;
  trialEndsAt: string | null;
  paidUntil: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface BillingFullState {
  billingMode: BillingMode | null;
  billingCycle: BillingCycle | null;
  billingProfile: BillingProfileShape;
  card: BillingCardInfo | null;
  invoice: BillingInvoiceLite | null;
  services: BillingServiceRow[];
}

export interface BillingUpdateInput {
  billingMode?: BillingMode;
  billingCycle?: BillingCycle;
  billingProfile?: Partial<BillingProfileShape>;
}

export type InvoiceKind = "PROFORMA" | "TAX_DOCUMENT";

export interface InvoiceRow {
  id: string;
  number: string;
  kind: InvoiceKind;
  status: string;
  totalAmount: number;
  hasPdf: boolean;
  paidDate: string | null;
  createdAt: string;
  cycle: BillingCycle | null;
}
