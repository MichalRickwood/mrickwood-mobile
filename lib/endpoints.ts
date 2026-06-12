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
  description?: string | null;
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
  documents?: TenderDocument[];
  starred?: boolean;
  excluded?: boolean;
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

export interface LeadFilterInput {
  name: string;
  regions?: string[];
  keywords?: string[];
  categories?: string[];
  industryTags?: string[];
  minValue?: number | null;
  maxValue?: number | null;
  emailDigest?: boolean;
  active?: boolean;
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

/**
 * v2 vrací Filter s `active`. Mobile UI dnes čte `isActive` — adaptujeme.
 */
type V2Filter = Omit<LeadFilterRow, "isActive"> & { active: boolean };

function legacyFilterShape(f: V2Filter): LeadFilterRow {
  const { active, ...rest } = f;
  return { ...rest, isActive: active };
}

export const endpoints = {
  // Auth
  login: (email: string, password: string) =>
    api.post<MobileLoginResponse>("/api/auth/mobile/login", { email, password }, { noAuth: true }),

  // Mobile-specific register — minimální (name, email, password, consents).
  // Firemní údaje + telefon se doplňují v Settings → Profil / Předplatné.
  register: (input: MobileRegisterInput) =>
    api.post<{ success: boolean; userId: string }>("/api/auth/mobile/register", input, { noAuth: true }),

  // Zapomenuté heslo — pošle email s reset linkem (vede na web /reset-password).
  // Backend vždy vrací 200 (i pro neexistující email) kvůli email-enumeration prevenci.
  requestPasswordReset: (email: string) =>
    api.post<{ ok: true }>("/api/auth/forgot-password", { email }, { noAuth: true }),

  // Profile read — používáme po loginu pro detekci jestli je profil kompletní
  profile: () => api.get<ProfileView>("/api/account/profile"),

  // Profile update — phone + company/ico/dic/address/country
  updateProfile: (input: ProfileUpdate) =>
    api.patch<{ ok: true }>("/api/account/profile", input),

  // v2 profile — používá unified API. Onboarding/OAuth completion flow.
  getProfileV2: async () => {
    const r = await api.get<{
      data: {
        email: string;
        name: string | null;
        phone: string | null;
        company: string | null;
        ico: string | null;
        dic: string | null;
        address: string | null;
        country: string | null;
        locale: string;
        isComplete: boolean;
        consentRequired: boolean;
      };
    }>("/api/v2/account/profile");
    return r.data;
  },
  updateProfileV2: async (input: { name?: string; country?: string; phone?: string; company?: string; ico?: string; dic?: string; address?: string; consentVop?: boolean; consentGdpr?: boolean }) => {
    await api.patch("/api/v2/account/profile", input);
  },

  // Aktuální user (verifikace JWT na startu)
  me: () => api.get<{ user: MobileLoginResponse["user"] }>("/api/auth/mobile/me"),

  // Lead matches — v2 envelope { data, pagination }. Wrapper sjednocuje na původní
  // tvar (matches, nextCursor, totalCount) ať se UI nemusí měnit.
  myMatches: async (params?: {
    filterId?: string;
    cursor?: string;
    limit?: number;
    view?: "all" | "starred" | "excluded";
    sort?: "newest" | "deadline" | "value";
    q?: string;
    regions?: string;
    minValue?: number;
    maxValue?: number;
    /** YYYY-MM-DD */
    deadlineFrom?: string;
    /** YYYY-MM-DD */
    deadlineTo?: string;
    /** Comma-separated CPV prefixes (např. "44,452"). */
    cpvPrefixes?: string;
    /** Comma-separated industry tag IDs (např. "con_buildings,it_development"). */
    industryTags?: string;
  }) => {
    // v2 paramy: ?qText (ne ?q), ?view jen "starred"|"excluded" (ne "all")
    const v2Params: Record<string, string | number | boolean | null | undefined> = {};
    if (params?.filterId) v2Params.filterId = params.filterId;
    if (params?.cursor) v2Params.cursor = params.cursor;
    if (params?.limit) v2Params.limit = params.limit;
    if (params?.sort) v2Params.sort = params.sort;
    if (params?.q) v2Params.qText = params.q;
    if (params?.regions) v2Params.regions = params.regions;
    if (params?.minValue != null) v2Params.minValue = params.minValue;
    if (params?.maxValue != null) v2Params.maxValue = params.maxValue;
    if (params?.deadlineFrom) v2Params.deadlineFrom = params.deadlineFrom;
    if (params?.deadlineTo) v2Params.deadlineTo = params.deadlineTo;
    if (params?.cpvPrefixes) v2Params.cpvPrefixes = params.cpvPrefixes;
    if (params?.industryTags) v2Params.industryTags = params.industryTags;
    if (params?.view === "starred" || params?.view === "excluded") v2Params.view = params.view;

    const r = await api.get<{
      data: LeadMatchRow[];
      pagination: { nextCursor: string | null; totalCount: number };
    }>("/api/v2/leads/matches", { params: v2Params });
    return { matches: r.data, nextCursor: r.pagination.nextCursor, totalCount: r.pagination.totalCount };
  },

  // Tender preferences (hvězdička / vyloučit) — v2 split na /star + /exclude per match.
  setTenderPreference: async (tenderId: number, status: "STARRED" | "EXCLUDED" | "NONE") => {
    const matchId = `live-${tenderId}`;
    if (status === "STARRED") {
      await api.post(`/api/v2/leads/matches/${matchId}/star`, { starred: true });
    } else if (status === "EXCLUDED") {
      await api.post(`/api/v2/leads/matches/${matchId}/exclude`, { excluded: true });
    } else {
      // NONE — vyčistí jakýkoliv status (lib funkce DELETE-uje row)
      await api.post(`/api/v2/leads/matches/${matchId}/star`, { starred: false });
    }
    return { ok: true as const };
  },

  // Filtry usera — v2 envelope { data } → adaptér na { filters }.
  myFilters: async () => {
    const r = await api.get<{ data: V2Filter[] }>("/api/v2/leads/filters");
    return { filters: r.data.map(legacyFilterShape) };
  },

  // LEADS service stav — v2: GET /account/subscriptions vrátí list, mobile filtruje na LEADS.
  getLeadsService: async () => {
    const r = await api.get<{
      data: Array<{
        service: string;
        scope: string | null;
        state: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";
        tier: "FREE" | "PAID";
        trialEndsAt: string | null;
        paidUntil: string | null;
        cancelAtPeriodEnd: boolean;
        priceMonthly: number | null;
        priceYearly: number | null;
      }>;
    }>("/api/v2/account/subscriptions");
    const leads = r.data.find((s) => s.service === "LEADS");
    return {
      service: "LEADS" as const,
      hasKey: !!leads,
      state: leads?.state ?? null,
      tier: leads?.tier ?? null,
      trialEndsAt: leads?.trialEndsAt ?? null,
      paidUntil: leads?.paidUntil ?? null,
      cancelAtPeriodEnd: leads?.cancelAtPeriodEnd ?? false,
      canActivateTrial: !leads,
      trialDays: 14, // backend default; není teď exposed v listu — UI ho zná z translations
    };
  },
  activateLeadsTrial: async () => {
    // Default scope=CZ pro back-compat (starší mobile builds). Pro multi-country
    // onboarding používej activateLeadsScope(scope) přímo.
    const r = await api.post<{
      data: { state: string; trialEndsAt: string | null };
    }>("/api/v2/account/subscriptions", { service: "LEADS", scope: "CZ", mode: "trial" });
    return { ok: true as const, state: r.data.state, trialEndsAt: r.data.trialEndsAt };
  },
  // Activate LEADS pro konkrétní zemi (ISO code). Volá se per země v onboarding.
  // 409 pokud pro tu zemi už subscription existuje — caller to ignoruje (idempotent).
  activateLeadsScope: async (scope: string) => {
    try {
      const r = await api.post<{
        data: { state: string; scope: string | null; trialEndsAt: string | null };
      }>("/api/v2/account/subscriptions", { service: "LEADS", scope, mode: "trial" });
      return { ok: true as const, state: r.data.state, scope: r.data.scope, trialEndsAt: r.data.trialEndsAt };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("CONFLICT") || msg.includes("409")) {
        return { ok: true as const, state: "ALREADY", scope, trialEndsAt: null };
      }
      throw e;
    }
  },
  // Atomická batch aktivace LEADS pro N zemí. Použito v multi-country onboarding —
  // bez tohoto by částečný fail nechal user s neúplným setem trialů. Backend
  // skipuje země, na které už user má subscription (silent idempotent).
  activateLeadsBatch: async (scopes: string[]) => {
    const r = await api.post<{
      data: Array<{ state: string; scope: string | null; trialEndsAt: string | null }>;
    }>("/api/v2/account/subscriptions/batch", { service: "LEADS", scopes, mode: "trial" });
    return { ok: true as const, created: r.data };
  },
  // Plný katalog LEADS zemí (labels per locale + pricing CZK+EUR + coverage).
  // Mobile používá pro onboarding picker. Cache 1h server-side.
  getLeadsCountries: async () => {
    const r = await api.get<{
      data: Array<{
        code: string;
        flag: string;
        labels: { cs: string; en: string; de: string };
        sources: string[];
        price: {
          czk: { monthly: number; yearly: number };
          eur: { monthly: number; yearly: number };
        };
        trialEnabled: boolean;
        coverage: number;
        available: boolean;
      }>;
      generatedAt: string;
    }>("/api/v2/leads/countries");
    return r.data;
  },
  // Regions per country pro region picker. Vrací NUTS regions + raw region names
  // z RWX (CZ má z.region = kraj name text, non-CZ zatím prázdné dokud RWX nebude
  // plnit z TED NUTS metadat).
  getLeadsRegions: async (country?: string) => {
    const r = await api.get<{
      data: Record<string, Array<{ region: string; count: number }>>;
    }>("/api/v2/leads/regions", { params: country ? { region: country } : {} });
    return r.data;
  },
  // Primary NUTS regions catalog per LEADS země + labels v daném locale.
  // Cache 24h server-side. Single payload pro region picker.
  getLeadsRegionsCatalog: async (locale: string) => {
    const r = await api.get<{
      data: Record<string, Array<{ code: string; label: string }>>;
      generatedAt: string;
    }>("/api/v2/leads/regions/catalog", { params: { locale } });
    return r.data;
  },
  // List všech subscriptions usera (per scope). Mobile detekuje aktivní LEADS scopes
  // pro onboarding pre-fill + post-auth routing decision.
  listSubscriptions: async () => {
    const r = await api.get<{
      data: Array<{
        id: string;
        service: string;
        scope: string | null;
        state: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";
        tier: "FREE" | "PAID";
        trialEndsAt: string | null;
        paidUntil: string | null;
        cancelAtPeriodEnd: boolean;
      }>;
    }>("/api/v2/account/subscriptions");
    return r.data;
  },
  reactivateLeadsService: async (scope?: string) => {
    await api.patch("/api/v2/account/subscriptions/LEADS", {
      cancelAtPeriodEnd: false,
      ...(scope ? { scope } : {}),
    });
    return { ok: true as const };
  },
  deactivateLeadsService: async (scope?: string) => {
    await api.patch("/api/v2/account/subscriptions/LEADS", {
      cancelAtPeriodEnd: true,
      ...(scope ? { scope } : {}),
    });
    return { ok: true as const };
  },

  // Industry taxonomy — labels v daném locale (cs/en/de).
  industryTaxonomy: async (locale: string) => {
    const r = await api.get<{
      data: {
        locale: string;
        areas: Array<{ id: string; icon: string; label: string }>;
        tags: Array<{ id: string; area: string; label: string; cpvPrefixes: string[] }>;
      };
    }>("/api/v2/leads/taxonomy/industry", { params: { locale } });
    return r.data;
  },

  // CPV katalog (~800KB raw, ~100KB gzip). Cache infinity client-side, klíč per locale.
  cpvCatalog: async (locale: string) => {
    const r = await api.get<{
      data: {
        locale: string;
        entries: Array<{
          prefix: string;
          label: string;
          level: "oddil" | "skupina" | "trida" | "kategorie" | "podkategorie";
        }>;
      };
    }>("/api/v2/leads/taxonomy/cpv", { params: { locale } });
    return r.data;
  },
  createFilter: async (input: LeadFilterInput) => {
    const r = await api.post<{ data: V2Filter }>("/api/v2/leads/filters", input);
    return { filter: legacyFilterShape(r.data) };
  },
  updateFilter: async (id: string, input: Partial<LeadFilterInput>) => {
    const r = await api.patch<{ data: V2Filter }>(`/api/v2/leads/filters/${id}`, input);
    return { filter: legacyFilterShape(r.data) };
  },
  deleteFilter: async (id: string) => {
    await api.delete(`/api/v2/leads/filters/${id}`);
    return { deleted: true as const };
  },

  // Mark match jako viewed — v2 vrátí 204, mobile chce { ok: true }
  markViewed: async (matchId: string) => {
    await api.post(`/api/v2/leads/matches/${matchId}/view`);
    return { ok: true as const };
  },

  // Pošle shrnutí zakázky na email uživatele
  emailTenderSummary: async (tenderId: number) => {
    const r = await api.post<{
      data: { sent: true; email: string };
    }>(`/api/v2/leads/tenders/${tenderId}/email`);
    return r.data;
  },

  // Registrace push tokenu z Expo (po user povolí notifikace)
  registerPushDevice: async (token: string, platform: "ios" | "android") => {
    await api.post("/api/v2/account/devices", { token, platform });
    return { ok: true as const };
  },

  // Odregistrace push tokenu při odhlášení (token v query, ne v body — api.delete nemá body support)
  unregisterPushDevice: async (token: string) => {
    await api.delete(`/api/v2/account/devices?token=${encodeURIComponent(token)}`);
    return { ok: true as const };
  },

  // Email notifikační preference (digest, marketing, educational)
  getNotificationSettings: async () => {
    const r = await api.get<{ data: NotificationSettings }>("/api/v2/account/notifications");
    return { settings: r.data };
  },
  updateNotificationSettings: async (input: Partial<Omit<NotificationSettings, "email">>) => {
    const r = await api.patch<{ data: NotificationSettings }>("/api/v2/account/notifications", input);
    return { settings: r.data };
  },

  // Heslo — GET zda user má heslo (OAuth-only účty mají hasPassword=false)
  getPasswordStatus: async () => {
    const r = await api.get<{ data: { hasPassword: boolean } }>("/api/v2/account/password");
    return r.data;
  },
  // POST vrací nový JWT (token-version se inkrementuje při změně hesla)
  changePassword: async (input: { currentPassword?: string; newPassword: string }) => {
    const r = await api.post<{ data: { token: string | null } }>("/api/v2/account/password", input);
    return { ok: true as const, token: r.data.token ?? "" };
  },

  // Odhlásit ze všech zařízení (inkrement mobileTokenVersion).
  revokeAllSessions: async () => {
    const r = await api.post<{ data: { token: string | null } }>("/api/v2/account/sessions/revoke");
    return { ok: true as const, token: r.data.token };
  },

  // Billing — full self-service state. v2 vrací `subscriptions`, UI čte `services`.
  getBilling: async () => {
    const r = await api.get<{
      data: {
        billingMode: BillingMode | null;
        billingCycle: BillingCycle | null;
        invoiceCurrency?: "CZK" | "EUR" | null;
        billingProfile: BillingProfileShape | null;
        card: BillingCardInfo | null;
        invoice: BillingInvoiceLite | null;
        subscriptions: BillingServiceRow[];
      };
    }>("/api/v2/account/billing");
    return {
      billingMode: r.data.billingMode,
      billingCycle: r.data.billingCycle,
      invoiceCurrency: r.data.invoiceCurrency ?? null,
      billingProfile: r.data.billingProfile ?? ({} as BillingProfileShape),
      card: r.data.card,
      invoice: r.data.invoice,
      services: r.data.subscriptions ?? [],
    } satisfies BillingFullState;
  },
  updateBilling: async (input: BillingUpdateInput) => {
    await api.patch("/api/v2/account/billing", input);
    return { ok: true as const };
  },

  // Stripe Checkout (mobile deep links). v2 endpoint detekuje audience="mobile" + používá veritra:// scheme.
  createBillingCheckout: async () => {
    const r = await api.post<{ data: { url: string } }>("/api/v2/account/billing/checkout");
    return r.data;
  },
  disconnectCard: async () => {
    await api.delete("/api/v2/account/billing/checkout");
    return { ok: true as const };
  },

  // Proforma faktura (pro INVOICE režim) — v2
  createProforma: async (cycle: BillingCycle) => {
    const r = await api.post<{
      data: {
        invoiceId: string;
        invoiceNumber: string;
        totalAmount: number;
        dueDate: string;
        cycle: BillingCycle;
      };
    }>("/api/v2/account/billing/proforma", { cycle });
    return { ok: true as const, ...r.data };
  },
  deleteProforma: async () => {
    await api.delete("/api/v2/account/billing/proforma");
    return { ok: true as const };
  },
  // Smaže konkrétní (neuhrazenou) proformu z historie. Pokud byla aktivní
  // v BillingProfile, backend vyčistí pointer.
  deleteProformaById: async (invoiceId: string) => {
    await api.delete(`/api/v2/account/billing/invoices/${encodeURIComponent(invoiceId)}`);
    return { ok: true as const };
  },

  // --- Apple In-App Purchase (iOS) ---
  // Quote: který IAP produkt koupit pro daný set zemí + appAccountToken pro
  // párování StoreKit transakce s účtem.
  getIapQuote: async (scopes: string[], cycle: BillingCycle) => {
    const r = await api.get<{
      data: {
        appAccountToken: string;
        productId: string;
        small: number;
        large: number;
        cycle: BillingCycle;
        current: IapCurrentState;
      };
    }>("/api/v2/account/billing/iap", {
      params: { scopes: scopes.join(","), cycle },
    });
    return r.data;
  },
  // Aktuální Apple stav účtu (bez quote).
  getIapState: async () => {
    const r = await api.get<{
      data: { appAccountToken: string; current: IapCurrentState };
    }>("/api/v2/account/billing/iap");
    return r.data;
  },
  // Verifikace podepsané StoreKit 2 transakce — backend zapne subscriptions.
  verifyIapPurchase: async (jws: string, scopes: string[]) => {
    const r = await api.post<{
      data: { productId: string; scopes: string[]; paidUntil: string };
    }>("/api/v2/account/billing/iap", { jws, scopes });
    return r.data;
  },
  // Downgrade: cílový set zemí aplikovaný při příštím renewalu.
  setIapPendingScopes: async (scopes: string[]) => {
    await api.post("/api/v2/account/billing/iap/pending", { scopes });
    return { ok: true as const };
  },

  // Cancel / reactivate service auto-renewal — v2 cesta přes /subscriptions/[id] PATCH
  cancelService: async (service: ApiServiceId) => {
    await api.patch(`/api/v2/account/subscriptions/${service}`, { cancelAtPeriodEnd: true });
    return { ok: true as const };
  },
  reactivateService: async (service: ApiServiceId) => {
    await api.patch(`/api/v2/account/subscriptions/${service}`, { cancelAtPeriodEnd: false });
    return { ok: true as const };
  },

  // Faktury — list. v2 envelope { data }.
  getInvoices: async () => {
    const r = await api.get<{ data: InvoiceRow[] }>("/api/v2/account/billing/invoices");
    return { invoices: r.data };
  },

  // Account export — pošle JSON přílohou na email uživatele (POST = email flow).
  exportAccount: async () => {
    const r = await api.post<{ data: { sent: true; email: string } }>("/api/v2/account/export");
    return r.data;
  },

  // Cancel / Delete flow (request → email s 8-char kódem → confirm)
  requestAccountCancel: async (action: "DEACTIVATE" | "DELETE") => {
    const r = await api.post<{
      data: { sent: true; action: "DEACTIVATE" | "DELETE"; email: string; expiresAt: string };
    }>("/api/v2/account/cancel/request", { action });
    return r.data;
  },
  confirmAccountCancel: async (input: { code: string; reason?: string }) => {
    const r = await api.post<{ data: { action: "DEACTIVATE" | "DELETE" } }>(
      "/api/v2/account/cancel/confirm",
      input,
    );
    return r.data;
  },

  // Feedback — submit (BUG / IMPROVEMENT / OTHER / MISSING_TENDER).
  // MISSING_TENDER má monthly cap 1/měsíc — server vrací 429 s code=MONTHLY_CAP_REACHED.
  // Když jsou attachments, posíláme multipart; jinak JSON (jednodušší pro server).
  submitFeedback: async (input: {
    kind: FeedbackKind;
    message: string;
    attachments?: { uri: string; name: string; mimeType: string }[];
  }) => {
    if (input.attachments && input.attachments.length > 0) {
      const fd = new FormData();
      fd.append("kind", input.kind);
      fd.append("message", input.message);
      for (const a of input.attachments) {
        // RN FormData přijímá { uri, name, type } objekt jako file part.
        fd.append("attachments", {
          uri: a.uri,
          name: a.name,
          type: a.mimeType,
        } as unknown as Blob);
      }
      const r = await api.post<{ data: { id: string; createdAt: string } }>(
        "/api/v2/feedback",
        fd,
      );
      return r.data;
    }
    const r = await api.post<{ data: { id: string; createdAt: string } }>(
      "/api/v2/feedback",
      { kind: input.kind, message: input.message },
    );
    return r.data;
  },
};

export type FeedbackKind = "BUG" | "IMPROVEMENT" | "OTHER" | "MISSING_TENDER";

export type BillingTier = "FREE" | "PAID";
export type BillingState = "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";
export type BillingCycle = "MONTHLY" | "YEARLY";
export type BillingMode = "CARD" | "INVOICE";
export type ApiServiceId = "PRICING" | "LEADS" | "PROCUREMENT" | "MANAGEMENT";

export interface IapCurrentState {
  active: boolean;
  productId: string | null;
  scopes: string[];
  pendingScopes: string[];
}

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
  /** Scope rozlišuje multi-country LEADS (CZ/SK/DE…). Null pro PRICING/PROCUREMENT. */
  scope?: string | null;
  tier: BillingTier;
  state: BillingState;
  trialEndsAt: string | null;
  paidUntil: string | null;
  cancelAtPeriodEnd: boolean;
  /** Cena per cycle PO aplikaci volume discount. */
  priceMonthly: number | null;
  priceYearly: number | null;
  /** Cena před discountem (null pokud žádný discount). Pro strikethrough. */
  priceMonthlyOriginal?: number | null;
  priceYearlyOriginal?: number | null;
  /** 0..1 — kolik volume slevy. 0 pro single-country a non-LEADS. */
  discountPct?: number;
  /** Měna ve které jsou priceMonthly/Yearly ('CZK' | 'EUR'). */
  priceCurrency?: "CZK" | "EUR";
}

export interface BillingFullState {
  billingMode: BillingMode | null;
  billingCycle: BillingCycle | null;
  invoiceCurrency: "CZK" | "EUR" | null;
  billingProfile: BillingProfileShape;
  card: BillingCardInfo | null;
  invoice: BillingInvoiceLite | null;
  services: BillingServiceRow[];
}

export interface BillingUpdateInput {
  billingMode?: BillingMode;
  billingCycle?: BillingCycle;
  invoiceCurrency?: "CZK" | "EUR";
  billingProfile?: Partial<BillingProfileShape>;
}

export type InvoiceKind = "PROFORMA" | "TAX_DOCUMENT";

export interface InvoiceRow {
  id: string;
  number: string;
  kind: InvoiceKind;
  status: string;
  totalAmount: number;
  /** Měna faktury ('CZK' | 'EUR'). Default 'CZK' pro back-compat. */
  currency?: "CZK" | "EUR";
  hasPdf: boolean;
  paidDate: string | null;
  createdAt: string;
  cycle: BillingCycle | null;
}
