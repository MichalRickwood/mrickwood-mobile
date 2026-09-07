import { api } from "./api";

/**
 * Typovaný klient pro /api/v2/admin/* endpointy (owner-only, ADMIN role).
 * Všechny JSON endpointy vrací v2 envelope { data: <payload> }; tady ho
 * rozbalujeme a vracíme rovnou payload, který obrazovky potřebují.
 * PDF / referral / attachment jsou raw soubory → řeší se přes openAuthedFile,
 * ne přes tenhle klient.
 */

const BASE = "/api/v2/admin";

// ---- Row / entity typy (jen pole, která obrazovky potřebují) ----

export type HealthBand = "critical" | "at_risk" | "ok" | "healthy" | "champion";

export interface AdminSubscription {
  id: string;
  service: string;
  scope: string | null;
  state: string;
  tier: string;
  trialEndsAt: string | null;
  paidUntil: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  company: string;
  phone: string;
  role: "USER" | "ADMIN";
  emailVerified: boolean | null;
  lastSeenAt: string | null;
  createdAt: string;
  deactivatedAt: string | null;
  deletedAt: string | null;
  referralUnlockedAt: string | null;
  referralAgreementAt: string | null;
  referralCode: string;
  signupSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  apiKeys: { id: string; requestsMonth: number; requestsLimit: number }[];
  subscriptions: AdminSubscription[];
  /** Počet lead filtrů (segmenty Bez filtru / Bez aktivace). */
  filterCount?: number;
  billing: {
    billingMode: string;
    paymentMethod: string;
    invoiceStatus: string | null;
    stripeCustomerId: string;
    stripeSubId: string;
  } | null;
  health: { score: number; band: HealthBand } | null;
}

export interface AdminComment {
  id: string;
  body: string;
  authorName: string;
  authorId: string;
  createdAt: string;
}

export interface AdminActivityItem {
  id: string;
  source: string;
  category: string;
  type: string;
  label: string;
  path?: string | null;
  meta?: unknown;
  createdAt: string;
}

export interface HealthSignal {
  key: string;
  label: string;
  value: string | number;
  points: number;
  maxPoints: number;
}

export interface HealthBreakdown {
  category: string;
  label: string;
  earned: number;
  max: number;
  signals: HealthSignal[];
}

export interface HealthReport {
  userId: string;
  score: number;
  band: HealthBand;
  /** "activation" = nový účet (aktivační skóre), "established" = běžný model. */
  stage?: "activation" | "established";
  breakdown: HealthBreakdown[];
  raw?: unknown;
}

export interface AdminInvoice {
  id: string;
  number: string;
  kind: "PROFORMA" | "TAX_DOCUMENT";
  status: string;
  currency: string;
  totalAmount: number;
  buyerName: string;
  buyerIco: string | null;
  buyerCountry: string;
  userId: string;
  userEmail: string | null;
  paidDate: string | null;
  createdAt: string;
  hasPdf: boolean;
}

export type FeedbackKind = "BUG" | "IMPROVEMENT" | "OTHER" | "MISSING_TENDER" | "WRONG_TENDER";
export type FeedbackStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "WONT_FIX" | "DUPLICATE";

/** Výstup automatické AI triáže (Feedback.aiTriage, schéma v1). */
export interface AiTriage {
  version: number;
  createdAt: string;
  kind: string;
  summary: string;
  recommendation: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  scope?: "ONE_OFF" | "SYSTEMATIC" | "UNKNOWN" | null;
  affectedEstimate?: string | null;
  evidence?: Record<string, unknown>;
  suggestedReply?: { locale: string; subject: string; body: string } | null;
  rootCause?: string | null;
}

export interface FeedbackAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Feedback {
  id: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  message: string;
  page: string | null;
  userAgent: string | null;
  tenderId: string | null;
  adminNote: string | null;
  aiTriage: AiTriage | null;
  email: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; name: string | null } | null;
  attachments: FeedbackAttachment[];
}

export type EmailStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "OPENED"
  | "CLICKED"
  | "BOUNCED"
  | "COMPLAINED"
  | "FAILED";

export interface EmailLogRow {
  id: string;
  resendId: string | null;
  category: string;
  fromAddr: string;
  toAddr: string;
  subject: string;
  status: EmailStatus;
  error: string | null;
  userId: string | null;
  meta: unknown;
  sentAt: string;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  complainedAt: string | null;
}

export interface EmailDetail {
  log: EmailLogRow;
  user: { id: string; email: string; name: string | null } | null;
  body: { html: string | null; text: string | null; from: string | null; to: string[] | null } | null;
}

export type SocialStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED"
  | "REJECTED"
  | "ARCHIVED";

export interface SocialPost {
  id: string;
  kind: "POST" | "AD_CREATIVE";
  locale: string;
  country: string | null;
  scope: "GLOBAL" | "LOCAL";
  pillar: string | null;
  platforms: string[];
  topic: string | null;
  caption: string;
  hashtags: string[] | null;
  headline: string | null;
  subheadline: string | null;
  features: string[] | null;
  imageTemplate: string | null;
  status: SocialStatus;
  rejectionReason: string | null;
  registerLink: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  platformRefs: Record<string, { id?: string; permalink?: string }> | null;
  errorMsg: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export type ReplyStatus = "PENDING_REVIEW" | "APPROVED" | "POSTED" | "FAILED" | "REJECTED";

export interface SocialReply {
  id: string;
  locale: string;
  tweetId: string;
  authorId: string | null;
  authorHandle: string | null;
  tweetText: string;
  tweetUrl: string | null;
  matchedQuery: string | null;
  draftReply: string;
  relevance: number | null;
  rationale: string | null;
  status: ReplyStatus;
  rejectionReason: string | null;
  postedTweetId: string | null;
  postedAt: string | null;
  errorMsg: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

// ---- Helper na rozbalení envelope ----
/** Fronta práce jedné Claude session — viz mrickwood-web/src/lib/work/queue.ts. */
export type WorkQueueId = "EPROTOKOL" | "JETCON" | "VERITRA" | "LEADS" | "OSTATNI";
export type WorkStatusId = "NEW" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "DROPPED";

export interface WorkItem {
  id: string;
  queue: WorkQueueId;
  title: string;
  detail: string | null;
  status: WorkStatusId;
  /** Co udělat, až se k úkolu vrátíme. Jádro celé fronty. */
  nextStep: string | null;
  priority: number;
  source: "MANUAL" | "MAIL" | "FEEDBACK" | "SESSION";
  createdAt: string;
  updatedAt: string;
}

type Env<T> = { data: T };

// --- Triáž příchozí pošty ---------------------------------------------------

export type InboxAgenda =
  | "POPTAVKA_ODPOVED" | "POPTAVKA_PRICHOZI" | "VYSVETLENI_ZD" | "LHUTA_VYZVA"
  | "FAKTURA_PLATBA" | "SMLOUVA_PRAVNI" | "ZAKAZNIK" | "JINE";
export type InboxProposalStatus =
  "NEW" | "NOTIFIED" | "APPROVED" | "REJECTED" | "DONE" | "EXPIRED";
export type InboxDecision = Extract<InboxProposalStatus, "APPROVED" | "REJECTED" | "DONE">;

/** Jedna nabídka ve srovnání. Ceny jsou STRINGY — píší se tak, jak přišly
 *  („128 000 Kč bez DPH"); RWX je neplátce DPH, přepočet by tiše lhal. */
export interface InboxOffer {
  supplier: string;
  email?: string;
  price?: string;
  priceNote?: string;
  deliveryDays?: string;
  validUntil?: string;
  note?: string;
}

export interface InboxProposalContent {
  version: number;
  agenda: InboxAgenda;
  summary: string;
  proposedAction: string;
  urgency: "high" | "normal" | "low";
  confidence: "high" | "medium" | "low";
  reasons: string[];
  deadline?: string;
  offers?: InboxOffer[];
  evidence?: Record<string, unknown>;
  suggestedReply?: { locale: string; subject: string; body: string };
  createdAt?: string;
}

export interface InboxProposal {
  id: string;
  mailId: string;
  content: InboxProposalContent;
  status: InboxProposalStatus;
  notifiedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface InboxMailListItem {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  receivedAt: string;
  agenda: string | null;
  urgency: string | null;
  summary: string | null;
  status: string;
  proposals: { id: string; status: InboxProposalStatus; createdAt: string; decidedAt: string | null }[];
}

export interface InboxMailDetail extends Omit<InboxMailListItem, "proposals"> {
  toEmail: string;
  textBody: string | null;
  attachmentsJson: { filename: string; mimeType: string | null; sizeBytes: number | null }[] | null;
  proposals: InboxProposal[];
}

export const adminApi = {
  // Users
  listUsers: async (status: "active" | "inactive" | "all", signal?: AbortSignal) => {
    const r = await api.get<Env<{ users: AdminUser[] }>>(`${BASE}/users`, { params: { status }, signal });
    return r.data.users;
  },
  getUser: async (id: string, signal?: AbortSignal) => {
    const r = await api.get<Env<{ user: AdminUser }>>(`${BASE}/users/${id}`, { signal });
    return r.data.user;
  },
  getHealth: async (id: string, signal?: AbortSignal) => {
    const r = await api.get<Env<{ report: HealthReport }>>(`${BASE}/users/${id}/health`, { signal });
    return r.data.report;
  },
  getActivity: async (id: string, signal?: AbortSignal) => {
    const r = await api.get<Env<{ items: AdminActivityItem[] }>>(`${BASE}/users/${id}/activity`, { signal });
    return r.data.items;
  },
  getUserInvoices: async (id: string, signal?: AbortSignal) => {
    const r = await api.get<Env<{ invoices: AdminInvoice[] }>>(`${BASE}/users/${id}/invoices`, { signal });
    return r.data.invoices;
  },
  listComments: async (id: string, signal?: AbortSignal) => {
    const r = await api.get<Env<{ comments: AdminComment[] }>>(`${BASE}/users/${id}/comments`, { signal });
    return r.data.comments;
  },
  addComment: async (id: string, body: string) => {
    const r = await api.post<Env<{ comment: AdminComment }>>(`${BASE}/users/${id}/comments`, { body });
    return r.data.comment;
  },
  deleteComment: async (id: string, commentId: string) => {
    await api.delete<Env<{ ok: true }>>(`${BASE}/users/${id}/comments/${commentId}`);
  },
  updateUser: async (id: string, patch: { role?: "USER" | "ADMIN"; keyId?: string; paused?: boolean; grantService?: "REPORTS"; enabled?: boolean }) => {
    const r = await api.patch<Env<{ success: true }>>(`${BASE}/users/${id}`, patch);
    return r.data;
  },
  deleteUser: async (id: string) => {
    await api.delete<Env<{ success: true }>>(`${BASE}/users/${id}`);
  },

  // Invoices
  listInvoices: async (opts: { q?: string; page?: number }, signal?: AbortSignal) => {
    const r = await api.get<Env<{ invoices: AdminInvoice[]; total: number; page: number; pageSize: number }>>(
      `${BASE}/invoices`,
      { params: { q: opts.q, page: opts.page }, signal },
    );
    return r.data;
  },
  markPaid: async (id: string, paymentReference?: string) => {
    const r = await api.post<Env<{ ok: boolean; taxDocId: string | null; reason: string }>>(
      `${BASE}/invoices/${id}/mark-paid`,
      { paymentReference },
    );
    return r.data;
  },

  // Feedback
  listFeedback: async (signal?: AbortSignal) => {
    const r = await api.get<Env<{ items: Feedback[] }>>(`${BASE}/feedback`, { signal });
    return r.data.items;
  },
  updateFeedback: async (id: string, patch: { status?: FeedbackStatus; adminNote?: string | null }) => {
    const r = await api.patch<Env<unknown>>(`${BASE}/feedback/${id}`, patch);
    return r.data;
  },
  deleteFeedback: async (id: string) => {
    await api.delete<Env<{ ok: true }>>(`${BASE}/feedback/${id}`);
  },
  grantMonth: async (id: string) => {
    const r = await api.post<Env<{ ok: boolean; extendedServices: string[]; feedbackId: string }>>(
      `${BASE}/feedback/${id}/grant-month`,
    );
    return r.data;
  },

  // Emails
  listEmails: async (
    opts: { status?: string; category?: string; direction?: string; q?: string; limit?: number },
    signal?: AbortSignal,
  ) => {
    const r = await api.get<Env<{ items: EmailLogRow[]; categories: { category: string; count: number }[] }>>(
      `${BASE}/emails`,
      { params: opts, signal },
    );
    return r.data;
  },
  getEmail: async (id: string, signal?: AbortSignal) => {
    const r = await api.get<Env<EmailDetail>>(`${BASE}/emails/${id}`, { signal });
    return r.data;
  },

  // Social
  listSocial: async (
    opts: { status?: string; kind?: string; country?: string; limit?: number },
    signal?: AbortSignal,
  ) => {
    const r = await api.get<Env<{ posts: SocialPost[] }>>(`${BASE}/social`, { params: opts, signal });
    return r.data.posts;
  },
  generateSocial: async (country?: string) => {
    const r = await api.post<Env<{ ok: boolean; id: string }>>(`${BASE}/social`, { country: country ?? null });
    return r.data;
  },
  socialAction: async (
    id: string,
    input: {
      action: "approve" | "reject" | "update" | "delete" | "rerender";
      reason?: string;
      scheduledFor?: string;
      caption?: string;
      headline?: string;
      subheadline?: string;
      features?: string[];
      imageTemplate?: string;
    },
  ) => {
    const r = await api.post<Env<{ ok: boolean; status?: string; rerender?: boolean }>>(`${BASE}/social/${id}`, input);
    return r.data;
  },
  listReplies: async (signal?: AbortSignal) => {
    const r = await api.get<Env<{ replies: SocialReply[] }>>(`${BASE}/social/replies`, { signal });
    return r.data.replies;
  },
  replyAction: async (input: {
    id: string;
    action: "approve" | "reject" | "delete";
    editedText?: string;
    withLink?: boolean;
    reason?: string;
  }) => {
    const r = await api.post<Env<{ ok: boolean; status?: string; errorMsg?: string | null }>>(
      `${BASE}/social/replies`,
      input,
    );
    return r.data;
  },
  cycleAction: async (action: "approve" | "reject") => {
    const r = await api.post<Env<{ ok: boolean; affected: number }>>(`${BASE}/social/cycle`, { action });
    return r.data;
  },
  listInbox: async (pendingOnly: boolean, signal?: AbortSignal) => {
    const r = await api.get<Env<{ items: InboxMailListItem[] }>>(
      `${BASE}/inbox${pendingOnly ? "?pending=1" : ""}`, { signal },
    );
    return r.data.items;
  },
  getInboxMail: async (id: string, signal?: AbortSignal) => {
    const r = await api.get<Env<InboxMailDetail>>(`${BASE}/inbox/${id}`, { signal });
    return r.data;
  },
  decideInboxProposal: async (
    mailId: string,
    input: { proposalId: string; status: InboxDecision; decisionNote?: string },
  ) => {
    const r = await api.patch<Env<unknown>>(`${BASE}/inbox/${mailId}`, input);
    return r.data;
  },

  // Fronty práce
  listUkoly: async (opts: { queue?: WorkQueueId; vse?: boolean }, signal?: AbortSignal) => {
    const r = await api.get<Env<{ items: WorkItem[]; fronty: { id: string; label: string }[] }>>(
      `${BASE}/ukoly`, { params: { queue: opts.queue, vse: opts.vse ? "1" : undefined }, signal },
    );
    return r.data;
  },
  createUkol: async (input: { queue: WorkQueueId; title: string; detail?: string }) => {
    const r = await api.post<Env<{ item: WorkItem }>>(`${BASE}/ukoly`, input);
    return r.data.item;
  },
  updateUkol: async (
    id: string,
    patch: { status?: WorkStatusId; nextStep?: string | null; queue?: WorkQueueId; title?: string; priority?: number },
  ) => {
    const r = await api.patch<Env<{ item: WorkItem }>>(`${BASE}/ukoly/${id}`, patch);
    return r.data.item;
  },
};
