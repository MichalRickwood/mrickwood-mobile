/**
 * App Store Connect — provisioning IAP katalogu pro LEADS předplatné.
 *
 * Vytvoří subscription group "LEADS" + 54 auto-renewable produktů podle
 * sdíleného katalogu (mrickwood-web/src/lib/iap-catalog.ts):
 *   - lokalizace cs / en-US / de-DE
 *   - ceny: CZE explicitně z CZK price pointů, EUR baseline z DEU,
 *     ostatní (PLN/SEK/DKK/…) přes equalizations DEU price pointu
 *   - dostupnost: jen LEADS territories (EU + CH/NO/IS/MK)
 *
 * Idempotentní — existující group/produkty/lokalizace/ceny přeskakuje,
 * takže se dá po chybě pustit znovu a doplní jen chybějící kusy.
 *
 * Spuštění:
 *   npx tsx scripts/asc-create-iap.mts            # dry-run (jen vypíše plán)
 *   npx tsx scripts/asc-create-iap.mts --apply    # skutečně vytváří
 *
 * Pozn.: vyžaduje podepsanou Paid Applications Agreement v ASC (Business →
 * Agreements). Bez ní POSTy selžou — skript to detekuje a poradí.
 */
import { readFileSync } from "fs";
import { createPrivateKey, sign } from "crypto";
import {
  buildIapCatalog,
  IAP_SUBSCRIPTION_GROUP,
  type IapProduct,
} from "../../mrickwood-web/src/lib/iap-catalog";

const KEY_ID = "X5ZFJXJ53Z";
const ISSUER_ID = "786f2d55-60c2-4d71-a6c5-ebceb59b6699";
const APP_ID = "6772703784";
const KEY_PATH = new URL("../private/AuthKey_X5ZFJXJ53Z.p8", import.meta.url).pathname;

const APPLY = process.argv.includes("--apply");
/** Volitelný filtr: --only veritra.leads.s1l0.m (pro testovací první produkt). */
const ONLY = (() => {
  const i = process.argv.indexOf("--only");
  return i >= 0 ? process.argv[i + 1] : null;
})();

/** LEADS země → App Store territory (ISO alpha-3). Subscription bude koupitelná jen tady. */
const TERRITORIES = [
  "CZE", "SVK", "POL", "DEU", "AUT", "FRA", "ESP", "ITA", "NLD", "BEL",
  "PRT", "SWE", "FIN", "DNK", "NOR", "IRL", "GRC", "ROU", "BGR", "HUN",
  "HRV", "SVN", "LTU", "LVA", "EST", "LUX", "CYP", "MLT", "CHE", "ISL",
  "MKD",
] as const;

/** Eurozone territories — dostanou stejný EUR price point jako DEU baseline. */
const EUR_TERRITORIES = new Set([
  "DEU", "AUT", "FRA", "ESP", "ITA", "NLD", "BEL", "PRT", "FIN", "IRL",
  "GRC", "SVK", "SVN", "LTU", "LVA", "EST", "LUX", "CYP", "MLT", "HRV",
]);

// ---------------------------------------------------------------------------
// ASC API klient
// ---------------------------------------------------------------------------

let cachedJwt: { token: string; exp: number } | null = null;
function makeJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp - now > 60) return cachedJwt.token;
  const pem = readFileSync(KEY_PATH, "utf8");
  const key = createPrivateKey(pem);
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const exp = now + 19 * 60;
  const payload = { iss: ISSUER_ID, iat: now, exp, aud: "appstoreconnect-v1" };
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const si = `${enc(header)}.${enc(payload)}`;
  const sig = sign("sha256", Buffer.from(si), { key, dsaEncoding: "ieee-p1363" });
  cachedJwt = { token: `${si}.${sig.toString("base64url")}`, exp };
  return cachedJwt.token;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Mezera mezi voláními — ASC limit ~3500/h, držíme se výrazně pod ním. */
const CALL_GAP_MS = 700;

async function asc<T = any>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: object,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    await sleep(method === "GET" ? 250 : CALL_GAP_MS);
    const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      method,
      headers: { Authorization: `Bearer ${makeJwt()}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429 && attempt <= 5) {
      console.log(`  …429 rate limit, čekám 60 s (pokus ${attempt})`);
      await sleep(60_000);
      continue;
    }
    const text = await r.text();
    if (!r.ok) {
      if (/agreement|contract/i.test(text)) {
        console.error(
          "\n!! ASC hlásí problém se smlouvou. Podepiš Paid Applications Agreement:\n" +
            "   App Store Connect → Business → Agreements, Tax, and Banking\n",
        );
      }
      throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 600)}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }
}

/** GET s následováním links.next (paginace). */
async function ascAll(path: string): Promise<any[]> {
  const out: any[] = [];
  let url: string | null = path;
  while (url) {
    const r = await asc<{ data: any[]; links?: { next?: string } }>("GET", url);
    out.push(...r.data);
    url = r.links?.next ? r.links.next.replace("https://api.appstoreconnect.apple.com", "") : null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lokalizace názvů (max 30 znaků!)
// ---------------------------------------------------------------------------

function pluralCs(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

function nameCs(p: IapProduct): string {
  const { small: s, large: l } = p;
  if (l === 0) return `Zakázky: ${s} ${pluralCs(s, "malá země", "malé země", "malých zemí")}`;
  if (s === 0) return `Zakázky: ${l} ${pluralCs(l, "velká země", "velké země", "velkých zemí")}`;
  return `Zakázky: ${s} ${pluralCs(s, "malá", "malé", "malých")} + ${l} ${pluralCs(l, "velká", "velké", "velkých")}`;
}

function nameEn(p: IapProduct): string {
  const { small: s, large: l } = p;
  const cc = (n: number) => (n === 1 ? "country" : "countries");
  if (l === 0) return `Leads: ${s} small ${cc(s)}`;
  if (s === 0) return `Leads: ${l} large ${cc(l)}`;
  return `Leads: ${s} small + ${l} large`;
}

function nameDe(p: IapProduct): string {
  const { small: s, large: l } = p;
  if (l === 0) return `Aufträge: ${s} ${s === 1 ? "kleines Land" : "kleine Länder"}`;
  if (s === 0) return `Aufträge: ${l} ${l === 1 ? "großes Land" : "große Länder"}`;
  return `Aufträge: ${s} kleine + ${l} große`;
}

const GROUP_LOCALIZATIONS = [
  { locale: "cs", name: "Sledování zakázek" },
  { locale: "en-US", name: "Tender alerts" },
  { locale: "de-DE", name: "Auftrags-Monitoring" },
];

// ---------------------------------------------------------------------------
// Price points
// ---------------------------------------------------------------------------

interface PricePoint {
  id: string;
  customerPrice: number;
  territoryId: string;
}

/** Price pointy subscription pro daný territory, seřazené vzestupně. */
async function pricePointsFor(subscriptionId: string, territory: string): Promise<PricePoint[]> {
  const data = await ascAll(
    `/v1/subscriptions/${subscriptionId}/pricePoints?filter[territory]=${territory}` +
      `&fields[subscriptionPricePoints]=customerPrice&limit=200`,
  );
  return data
    .map((d) => ({
      id: d.id,
      customerPrice: Number(d.attributes.customerPrice),
      territoryId: territory,
    }))
    .sort((a, b) => a.customerPrice - b.customerPrice);
}

/** Nejlevnější price point ≥ target ("ať mám stejné peníze" → zaokrouhlujeme nahoru). */
function pickPoint(points: PricePoint[], target: number): PricePoint {
  const p = points.find((x) => x.customerPrice >= target);
  if (!p) throw new Error(`Žádný price point ≥ ${target} (max ${points.at(-1)?.customerPrice})`);
  return p;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const catalog = buildIapCatalog().filter((p) => !ONLY || p.productId === ONLY);
console.log(`Katalog: ${catalog.length} produktů${ONLY ? ` (filtr ${ONLY})` : ""}. Režim: ${APPLY ? "APPLY" : "dry-run"}\n`);

if (!APPLY) {
  for (const p of catalog) {
    console.log(
      `${p.productId}  L${String(p.level).padStart(2)}  ${p.cycle === "YEARLY" ? "1 rok " : "1 měs."}` +
        `  cíl ${p.targetCzk.toFixed(0)} Kč / ${p.targetEur.toFixed(2)} €  „${nameCs(p)}“`,
    );
    for (const n of [nameCs(p), nameEn(p), nameDe(p)]) {
      if (n.length > 30) throw new Error(`Název přes 30 znaků (${n.length}): ${n}`);
    }
  }
  console.log("\nDry-run OK. Spusť s --apply pro vytvoření v App Store Connect.");
  process.exit(0);
}

// 1. Subscription group
let groups = await ascAll(`/v1/apps/${APP_ID}/subscriptionGroups?filter[referenceName]=${IAP_SUBSCRIPTION_GROUP}`);
let groupId: string;
if (groups.length > 0) {
  groupId = groups[0].id;
  console.log(`Group "${IAP_SUBSCRIPTION_GROUP}" existuje (${groupId})`);
} else {
  const r = await asc<{ data: { id: string } }>("POST", "/v1/subscriptionGroups", {
    data: {
      type: "subscriptionGroups",
      attributes: { referenceName: IAP_SUBSCRIPTION_GROUP },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  groupId = r.data.id;
  console.log(`Group "${IAP_SUBSCRIPTION_GROUP}" vytvořena (${groupId})`);
}

// 1b. Group lokalizace
const existingGroupLocs = await ascAll(`/v1/subscriptionGroups/${groupId}/subscriptionGroupLocalizations`);
for (const loc of GROUP_LOCALIZATIONS) {
  if (existingGroupLocs.some((l) => l.attributes.locale === loc.locale)) continue;
  await asc("POST", "/v1/subscriptionGroupLocalizations", {
    data: {
      type: "subscriptionGroupLocalizations",
      attributes: { locale: loc.locale, name: loc.name },
      relationships: { subscriptionGroup: { data: { type: "subscriptionGroups", id: groupId } } },
    },
  });
  console.log(`  group lokalizace ${loc.locale} ✓`);
}

// 2. Existující subscriptions v group
const existingSubs = await ascAll(
  `/v1/subscriptionGroups/${groupId}/subscriptions?fields[subscriptions]=productId,name,state&limit=200`,
);
const byProductId = new Map<string, any>(existingSubs.map((s) => [s.attributes.productId, s]));

let created = 0;
for (const p of catalog) {
  const label = `${p.productId} (L${p.level}, ${p.targetCzk.toFixed(0)} Kč / ${p.targetEur.toFixed(2)} €)`;
  let subId: string;
  const existing = byProductId.get(p.productId);
  if (existing) {
    subId = existing.id;
    console.log(`= ${label} — existuje (${existing.attributes.state})`);
  } else {
    const r = await asc<{ data: { id: string } }>("POST", "/v1/subscriptions", {
      data: {
        type: "subscriptions",
        attributes: {
          name: p.productId.replace("veritra.leads.", "LEADS ").replace(".", " "),
          productId: p.productId,
          subscriptionPeriod: p.cycle === "YEARLY" ? "ONE_YEAR" : "ONE_MONTH",
          groupLevel: p.level,
          familySharable: false,
        },
        relationships: { group: { data: { type: "subscriptionGroups", id: groupId } } },
      },
    });
    subId = r.data.id;
    created++;
    console.log(`+ ${label} — vytvořeno (${subId})`);
  }

  // 2b. Lokalizace
  const locs = await ascAll(`/v1/subscriptions/${subId}/subscriptionLocalizations`);
  const wantedLocs = [
    { locale: "cs", name: nameCs(p) },
    { locale: "en-US", name: nameEn(p) },
    { locale: "de-DE", name: nameDe(p) },
  ];
  for (const loc of wantedLocs) {
    if (locs.some((l) => l.attributes.locale === loc.locale)) continue;
    await asc("POST", "/v1/subscriptionLocalizations", {
      data: {
        type: "subscriptionLocalizations",
        attributes: { locale: loc.locale, name: loc.name },
        relationships: { subscription: { data: { type: "subscriptions", id: subId } } },
      },
    });
    console.log(`    lokalizace ${loc.locale}: „${loc.name}“ ✓`);
  }

  // 2c. Ceny — přeskočit pokud už nějaké jsou (idempotence)
  const prices = await ascAll(`/v1/subscriptions/${subId}/prices?limit=200`);
  if (prices.length === 0) {
    // CZE explicitně z CZK price pointů
    const czePoints = await pricePointsFor(subId, "CZE");
    const czePoint = pickPoint(czePoints, p.targetCzk);
    // DEU baseline pro EUR
    const deuPoints = await pricePointsFor(subId, "DEU");
    const deuPoint = pickPoint(deuPoints, p.targetEur);

    // Equalizations DEU pointu pro non-EUR territories (PLN, SEK, …)
    const nonEur = TERRITORIES.filter((t) => t !== "CZE" && t !== "DEU" && !EUR_TERRITORIES.has(t));
    const eqs = await ascAll(
      `/v1/subscriptionPricePoints/${deuPoint.id}/equalizations?include=territory` +
        `&filter[territory]=${nonEur.join(",")}&fields[subscriptionPricePoints]=customerPrice&limit=200`,
    );
    const eqByTerritory = new Map<string, string>();
    // relationships.territory v include — id territory je v relationships
    for (const eq of eqs) {
      const tid = eq.relationships?.territory?.data?.id;
      if (tid) eqByTerritory.set(tid, eq.id);
    }

    // EUR territories — stejný customerPrice jako DEU, point z jejich listu
    const pricePlan: Array<{ territory: string; pointId: string; price: number }> = [
      { territory: "CZE", pointId: czePoint.id, price: czePoint.customerPrice },
      { territory: "DEU", pointId: deuPoint.id, price: deuPoint.customerPrice },
    ];
    for (const t of TERRITORIES) {
      if (t === "CZE" || t === "DEU") continue;
      if (EUR_TERRITORIES.has(t)) {
        const pts = await pricePointsFor(subId, t);
        const match = pts.find((x) => x.customerPrice === deuPoint.customerPrice) ?? pickPoint(pts, p.targetEur);
        pricePlan.push({ territory: t, pointId: match.id, price: match.customerPrice });
      } else {
        const eqId = eqByTerritory.get(t);
        if (!eqId) {
          console.log(`    !! chybí equalization pro ${t} — přeskakuji territory`);
          continue;
        }
        pricePlan.push({ territory: t, pointId: eqId, price: NaN });
      }
    }

    for (const pp of pricePlan) {
      await asc("POST", "/v1/subscriptionPrices", {
        data: {
          type: "subscriptionPrices",
          relationships: {
            subscription: { data: { type: "subscriptions", id: subId } },
            subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: pp.pointId } },
          },
        },
      });
    }
    console.log(
      `    ceny ✓ CZE ${czePoint.customerPrice} Kč, EUR ${deuPoint.customerPrice} €, ${pricePlan.length} territories`,
    );
  } else {
    console.log(`    ceny už nastavené (${prices.length}) — skip`);
  }

  // 2d. Availability — jen LEADS territories
  try {
    await asc("GET", `/v1/subscriptions/${subId}/subscriptionAvailability`);
    console.log(`    availability už nastavená — skip`);
  } catch {
    await asc("POST", "/v1/subscriptionAvailabilities", {
      data: {
        type: "subscriptionAvailabilities",
        attributes: { availableInNewTerritories: false },
        relationships: {
          subscription: { data: { type: "subscriptions", id: subId } },
          availableTerritories: {
            data: TERRITORIES.map((t) => ({ type: "territories", id: t })),
          },
        },
      },
    });
    console.log(`    availability ✓ (${TERRITORIES.length} territories)`);
  }
}

console.log(`\nHotovo. Nově vytvořeno ${created} produktů, celkem v group ${byProductId.size + created}.`);
console.log("Zbývá ručně/později: review screenshot per produkt (řeší resubmit krok).");
