/**
 * Sdílený typ pro jednorázový (nepersistovaný) filtr v listu zakázek.
 * Picker komponenty modifikují tenhle state, /api/mobile/matches ho čte
 * jako query params (regions=…, minValue, maxValue).
 */
export interface AdHocFilter {
  regions: string[];
  minValue: number | null;
  maxValue: number | null;
  /** ISO YYYY-MM-DD nebo null. Server filtruje deadlineAt >= deadlineFrom. */
  deadlineFrom: string | null;
  /** ISO YYYY-MM-DD nebo null. Server filtruje deadlineAt <= deadlineTo. */
  deadlineTo: string | null;
}

export const EMPTY_AD_HOC: AdHocFilter = {
  regions: [],
  minValue: null,
  maxValue: null,
  deadlineFrom: null,
  deadlineTo: null,
};

export function isAdHocActive(f: AdHocFilter): boolean {
  return (
    f.regions.length > 0 ||
    f.minValue != null ||
    f.maxValue != null ||
    f.deadlineFrom != null ||
    f.deadlineTo != null
  );
}
