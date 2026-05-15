/**
 * Design tokens — light + dark palettes pro Tendero.
 *
 * Light = sjednoceno s webovým mrickwood.cz (stone/zinc gray scale).
 * Dark = inverse s mírnými warm tones (ne čistá čerň — vypadá teplej a méně OLED-aggressive).
 */

export interface Colors {
  bg: string;
  card: string;
  cardElevated: string;
  border: string;
  borderHover: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textFaint: string;
  accent: string;
  accentHover: string;
  accentForeground: string;
  danger: string;
  dangerBg: string;
  warning: string;
  warningBg: string;
  success: string;
  successBg: string;
  link: string;
}

export const lightColors: Colors = {
  bg: "#FAFAF9",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  border: "#E7E5E4",
  borderHover: "#A8A29E",
  text: "#1C1917",
  textMuted: "#57534E",
  textSubtle: "#78716C",
  textFaint: "#A8A29E",
  accent: "#1C1917",
  accentHover: "#0C0A09",
  accentForeground: "#FFFFFF",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  success: "#16A34A",
  successBg: "#F0FDF4",
  link: "#2563EB",
};

export const darkColors: Colors = {
  bg: "#0C0A09",
  card: "#1C1917",
  cardElevated: "#292524",
  border: "#292524",
  borderHover: "#57534E",
  text: "#FAFAF9",
  textMuted: "#D6D3D1",
  textSubtle: "#A8A29E",
  textFaint: "#78716C",
  accent: "#FAFAF9",
  accentHover: "#E7E5E4",
  accentForeground: "#1C1917",
  danger: "#F87171",
  dangerBg: "#3A1212",
  warning: "#FBBF24",
  warningBg: "#3A2A08",
  success: "#4ADE80",
  successBg: "#0F2A18",
  link: "#60A5FA",
};

/**
 * @deprecated Use `useTheme()` hook from `@/lib/theme-context` instead.
 * Tato static export zůstává pro backwards compat — některé legacy komponenty
 * ji ještě používají. Při refaktoru je migrujeme na hook.
 */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
};
