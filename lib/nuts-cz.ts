/**
 * 14 NUTS-3 krajů ČR. Static copy of web nuts-catalog NUTS3 entries —
 * mobile picker není online (extra API call by byl overkill pro 14 řádků,
 * které se nemění).
 */

export interface CzRegion {
  code: string;
  labels: { cs: string; en: string; de: string };
}

export const CZ_REGIONS: CzRegion[] = [
  { code: "CZ010", labels: { cs: "Hlavní město Praha", en: "Prague", de: "Hauptstadt Prag" } },
  { code: "CZ020", labels: { cs: "Středočeský kraj", en: "Central Bohemian Region", de: "Mittelböhmische Region" } },
  { code: "CZ031", labels: { cs: "Jihočeský kraj", en: "South Bohemian Region", de: "Südböhmische Region" } },
  { code: "CZ032", labels: { cs: "Plzeňský kraj", en: "Plzeň Region", de: "Pilsner Region" } },
  { code: "CZ041", labels: { cs: "Karlovarský kraj", en: "Karlovy Vary Region", de: "Karlsbader Region" } },
  { code: "CZ042", labels: { cs: "Ústecký kraj", en: "Ústí nad Labem Region", de: "Aussiger Region" } },
  { code: "CZ051", labels: { cs: "Liberecký kraj", en: "Liberec Region", de: "Reichenberger Region" } },
  { code: "CZ052", labels: { cs: "Královéhradecký kraj", en: "Hradec Králové Region", de: "Königgrätzer Region" } },
  { code: "CZ053", labels: { cs: "Pardubický kraj", en: "Pardubice Region", de: "Pardubitzer Region" } },
  { code: "CZ063", labels: { cs: "Kraj Vysočina", en: "Vysočina Region", de: "Region Vysočina" } },
  { code: "CZ064", labels: { cs: "Jihomoravský kraj", en: "South Moravian Region", de: "Südmährische Region" } },
  { code: "CZ071", labels: { cs: "Olomoucký kraj", en: "Olomouc Region", de: "Olmützer Region" } },
  { code: "CZ072", labels: { cs: "Zlínský kraj", en: "Zlín Region", de: "Zliner Region" } },
  { code: "CZ080", labels: { cs: "Moravskoslezský kraj", en: "Moravian-Silesian Region", de: "Mährisch-Schlesische Region" } },
];

export function regionLabel(code: string, locale: string): string {
  const r = CZ_REGIONS.find((x) => x.code === code);
  if (!r) return code;
  return (r.labels[locale as keyof CzRegion["labels"]] ?? r.labels.cs) as string;
}
