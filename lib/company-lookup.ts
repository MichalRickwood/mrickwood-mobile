import { API_BASE_URL } from "./config";

/**
 * Tenký client wrapper nad /api/public/company-lookup. Sjednocený interface
 * pro různé country resolvery (CZ ARES, SK ORSR, DE Handelsregister přes VIES,
 * FR SIRENE, GB Companies House…) — viz src/lib/company-lookup/index.ts ve
 * webu pro plný seznam podporovaných zemí.
 */

export interface CompanyEntity {
  taxId: string;
  country: string;
  name: string;
  address: string;
  vatNumber?: string | null;
  source: string;
}

/** Země s rejstříky kde umíme byId lookup. */
export const SUPPORTED_COUNTRIES: { code: string; label: string }[] = [
  { code: "CZ", label: "Česká republika" },
  { code: "SK", label: "Slovensko" },
  { code: "DE", label: "Německo" },
  { code: "AT", label: "Rakousko" },
  { code: "PL", label: "Polsko" },
  { code: "FR", label: "Francie" },
  { code: "GB", label: "Velká Británie" },
  { code: "HU", label: "Maďarsko" },
  { code: "IT", label: "Itálie" },
  { code: "ES", label: "Španělsko" },
  { code: "NL", label: "Nizozemsko" },
  { code: "BE", label: "Belgie" },
  { code: "DK", label: "Dánsko" },
  { code: "FI", label: "Finsko" },
  { code: "SE", label: "Švédsko" },
  { code: "IE", label: "Irsko" },
  { code: "PT", label: "Portugalsko" },
  { code: "RO", label: "Rumunsko" },
  { code: "BG", label: "Bulharsko" },
  { code: "HR", label: "Chorvatsko" },
  { code: "SI", label: "Slovinsko" },
  { code: "EE", label: "Estonsko" },
  { code: "LV", label: "Lotyšsko" },
  { code: "LT", label: "Litva" },
  { code: "GR", label: "Řecko" },
  { code: "CY", label: "Kypr" },
  { code: "MT", label: "Malta" },
  { code: "LU", label: "Lucembursko" },
];

export async function lookupCompanyById(
  country: string,
  id: string,
  signal?: AbortSignal,
): Promise<{ found: false } | ({ found: true } & CompanyEntity)> {
  const res = await fetch(
    `${API_BASE_URL}/api/public/company-lookup?country=${encodeURIComponent(country)}&id=${encodeURIComponent(id)}`,
    { signal },
  );
  if (res.status === 404) return { found: false };
  if (!res.ok) throw new Error(`lookup failed: ${res.status}`);
  return res.json();
}

export interface CompanySearchResult {
  taxId: string;
  country: string;
  name: string;
  address: string;
}

/** Country s full-coverage search (ARES, RPO, SIRENE). EU VIES země podporují
 * jen byId, ne fulltext. */
export const FULL_COVERAGE_COUNTRIES = ["CZ", "SK", "FR"] as const;

export async function searchCompaniesByName(
  country: string,
  query: string,
  signal?: AbortSignal,
): Promise<CompanySearchResult[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/public/company-lookup?country=${encodeURIComponent(country)}&q=${encodeURIComponent(query)}`,
    { signal },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
}
