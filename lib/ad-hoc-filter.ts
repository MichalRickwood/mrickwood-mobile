/**
 * Sdílený typ pro jednorázový (nepersistovaný) filtr v listu zakázek.
 * Picker komponenty modifikují tenhle state, /api/mobile/matches ho čte
 * jako query params (regions=…, minValue, maxValue).
 */
export interface AdHocFilter {
  regions: string[];
  minValue: number | null;
  maxValue: number | null;
}

export const EMPTY_AD_HOC: AdHocFilter = {
  regions: [],
  minValue: null,
  maxValue: null,
};

export function isAdHocActive(f: AdHocFilter): boolean {
  return f.regions.length > 0 || f.minValue != null || f.maxValue != null;
}
