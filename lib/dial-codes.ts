/**
 * Telefonní předvolby pro register form.
 *
 * Label = "🇨🇿 CZ +420" — flag + ISO 3166-1 alpha-2 + dial code. Bez názvu
 * země (úspora místa v select dropdownu, ISO je univerzální).
 */
export interface DialCode {
  code: string;
  iso: string;
  flag: string;
  label: string;
}

function mk(iso: string, flag: string, code: string): DialCode {
  // Label = "CZ +420" — flag emoji se v některých fontech rozkládá na
  // regional indicators (CZ + CZ = 2× zkratka), proto jen ISO bez flag.
  return { code, iso, flag, label: `${iso} ${code}` };
}

/**
 * Délka subscriber number (bez dial code) pro známé země.
 * `min === max` znamená přesný počet číslic.
 * Default fallback pokud země zde není: 7-15.
 *
 * Zdroj: ITU-T E.164 + národní telekomunikační regulátoři.
 */
interface LocalLen { min: number; max: number }

const LOCAL_DIGITS: Record<string, LocalLen> = {
  // Přesné délky (mobile + landline shodné)
  CZ: { min: 9, max: 9 },
  SK: { min: 9, max: 9 },
  PL: { min: 9, max: 9 },
  DK: { min: 8, max: 8 },
  ES: { min: 9, max: 9 },
  FR: { min: 9, max: 9 },
  GB: { min: 10, max: 10 },
  GR: { min: 10, max: 10 },
  HR: { min: 9, max: 9 },
  NL: { min: 9, max: 9 },
  NO: { min: 8, max: 8 },
  PT: { min: 9, max: 9 },
  CH: { min: 9, max: 9 },
  US: { min: 10, max: 10 },
  TR: { min: 10, max: 10 },
  IL: { min: 9, max: 9 },
  RO: { min: 9, max: 9 },
  RS: { min: 8, max: 9 },
  AE: { min: 9, max: 9 },
  AU: { min: 9, max: 9 },
  KR: { min: 9, max: 10 },
  IN: { min: 10, max: 10 },
  JP: { min: 10, max: 10 },
  ZA: { min: 9, max: 9 },
  EG: { min: 10, max: 10 },
  BR: { min: 10, max: 11 },
  MX: { min: 10, max: 10 },
  CN: { min: 11, max: 11 },

  // Range (různé délky mobile vs landline / historicky proměnlivé)
  DE: { min: 7, max: 13 },
  AT: { min: 7, max: 13 },
  HU: { min: 8, max: 9 },
  BE: { min: 8, max: 9 },
  BG: { min: 8, max: 9 },
  IT: { min: 9, max: 10 },
  FI: { min: 5, max: 12 },
  SE: { min: 7, max: 9 },
  IS: { min: 7, max: 9 },
  IE: { min: 7, max: 11 },
  LU: { min: 4, max: 11 },
  EE: { min: 7, max: 8 },
  LV: { min: 8, max: 8 },
  LT: { min: 8, max: 8 },
  MT: { min: 8, max: 8 },
  SI: { min: 8, max: 8 },
  CY: { min: 8, max: 8 },
  LI: { min: 7, max: 9 },
  UA: { min: 9, max: 9 },
  ME: { min: 8, max: 8 },
  BA: { min: 8, max: 8 },
  MK: { min: 8, max: 8 },
  AL: { min: 8, max: 9 },
  MD: { min: 8, max: 8 },
  BY: { min: 9, max: 9 },
  SG: { min: 8, max: 8 },
  HK: { min: 8, max: 8 },
  NZ: { min: 8, max: 10 },
};

export function localDigitsRange(iso: string): LocalLen {
  return LOCAL_DIGITS[iso] ?? { min: 7, max: 15 };
}

/** Backwards-compat helper. */
export function minLocalDigits(iso: string): number {
  return localDigitsRange(iso).min;
}

export const DIAL_CODES: DialCode[] = [
  // Nejčastější CZ B2B trh
  mk("CZ", "🇨🇿", "+420"),
  mk("SK", "🇸🇰", "+421"),
  mk("DE", "🇩🇪", "+49"),
  mk("AT", "🇦🇹", "+43"),
  mk("PL", "🇵🇱", "+48"),
  mk("HU", "🇭🇺", "+36"),

  // Ostatní EU / EEA (abecedně dle ISO)
  mk("BE", "🇧🇪", "+32"),
  mk("BG", "🇧🇬", "+359"),
  mk("CY", "🇨🇾", "+357"),
  mk("DK", "🇩🇰", "+45"),
  mk("EE", "🇪🇪", "+372"),
  mk("ES", "🇪🇸", "+34"),
  mk("FI", "🇫🇮", "+358"),
  mk("FR", "🇫🇷", "+33"),
  mk("GR", "🇬🇷", "+30"),
  mk("HR", "🇭🇷", "+385"),
  mk("IE", "🇮🇪", "+353"),
  mk("IS", "🇮🇸", "+354"),
  mk("IT", "🇮🇹", "+39"),
  mk("LI", "🇱🇮", "+423"),
  mk("LT", "🇱🇹", "+370"),
  mk("LU", "🇱🇺", "+352"),
  mk("LV", "🇱🇻", "+371"),
  mk("MT", "🇲🇹", "+356"),
  mk("NL", "🇳🇱", "+31"),
  mk("NO", "🇳🇴", "+47"),
  mk("PT", "🇵🇹", "+351"),
  mk("RO", "🇷🇴", "+40"),
  mk("SE", "🇸🇪", "+46"),
  mk("SI", "🇸🇮", "+386"),

  // Mimo EU, v Evropě
  mk("CH", "🇨🇭", "+41"),
  mk("GB", "🇬🇧", "+44"),
  mk("UA", "🇺🇦", "+380"),
  mk("TR", "🇹🇷", "+90"),
  mk("RS", "🇷🇸", "+381"),
  mk("ME", "🇲🇪", "+382"),
  mk("BA", "🇧🇦", "+387"),
  mk("MK", "🇲🇰", "+389"),
  mk("AL", "🇦🇱", "+355"),
  mk("MD", "🇲🇩", "+373"),
  mk("BY", "🇧🇾", "+375"),

  // Severní Amerika
  mk("US", "🇺🇸", "+1"),

  // Asie / Pacifik
  mk("CN", "🇨🇳", "+86"),
  mk("IN", "🇮🇳", "+91"),
  mk("JP", "🇯🇵", "+81"),
  mk("KR", "🇰🇷", "+82"),
  mk("SG", "🇸🇬", "+65"),
  mk("HK", "🇭🇰", "+852"),
  mk("AU", "🇦🇺", "+61"),
  mk("NZ", "🇳🇿", "+64"),
  mk("IL", "🇮🇱", "+972"),
  mk("AE", "🇦🇪", "+971"),

  // Latinská Amerika
  mk("BR", "🇧🇷", "+55"),
  mk("MX", "🇲🇽", "+52"),

  // Afrika
  mk("ZA", "🇿🇦", "+27"),
  mk("EG", "🇪🇬", "+20"),
];

export function defaultDialCodeForLocale(locale: string): string {
  if (locale === "de") return "+49";
  if (locale === "sk") return "+421";
  return "+420";
}
