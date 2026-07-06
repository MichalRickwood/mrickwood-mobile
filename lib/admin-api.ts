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

export type FeedbackKind = "BUG" | "IMPROVEMENT" | "OTHER" | "MISSING_TENDER";
export type FeedbackStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "WONT_FIX" | "DUPLICATE";

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
  adminNote: string | null;
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
  status: SocialStatus;
  rejectionReason: string | null;
  registerLink: string;
  scheduledFor: string | null;
  publishedAt: string | null;
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
type Env<T> = { data: T };

export const adminApi = {
  // Users
  listUsers: async (status: "active" | "inactive" | "all", signal?: AbortSignal) => {
    const r = await api.get<Env<{ users: AdminUser[] }>>(`${BASE}/users`, { params: { status }, signal });
    return r.data.users;
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
  updateUser: async (id: string, patch: { role?: "USER" | "ADMIN"; keyId?: string; paused?: boolean }) => {
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
    input: { action: "approve" | "reject" | "update" | "delete"; reason?: string; scheduledFor?: string; caption?: string },
  ) => {
    const r = await api.post<Env<{ ok: boolean; status?: string }>>(`${BASE}/social/${id}`, input);
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
};
