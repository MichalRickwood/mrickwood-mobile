/**
 * Submit verze 1.0.1 do App Store Review — binárka (build 17) už je v ASC
 * nahraná z EAS, ale verze 1.0.1 neexistuje (EAS submit padal na duplicitní
 * buildNumber). Flow:
 *  1. Ověř build 17 (VALID) + že 1.0.1 ještě neexistuje (idempotentní — reuse).
 *  2. POST appStoreVersions (1.0.1) + attach build.
 *  3. Zkopíruj appStoreReviewDetail z 1.0 (demo účet pro review).
 *  4. Doplň whatsNew do všech lokalizací verze.
 *  5. reviewSubmission + item + submitted=true.
 *
 * Spuštění: npx tsx scripts/asc-submit-101.mts            # dry-run
 *           npx tsx scripts/asc-submit-101.mts --submit   # celý flow
 */
import { readFileSync } from "fs";
import { createPrivateKey, sign } from "crypto";

const KEY_ID = "3GN49VPDGG";
const ISSUER_ID = "786f2d55-60c2-4d71-a6c5-ebceb59b6699";
const APP_ID = "6772703784";
const KEY_PATH = "./private/AuthKey_3GN49VPDGG.p8";
const VERSION = "1.0.1";
const BUILD_NUMBER = "17";
const PERFORM_SUBMIT = process.argv.includes("--submit");

// Release notes per ASC locale — fallback en-US pro neznámé.
const WHATS_NEW: Record<string, string> = {
  "cs": "Nový vzhled aplikace — logo Veritra na úvodní obrazovce a nová ikona. Drobná vylepšení a opravy.",
  "en-US": "A fresh new look — Veritra logo on the launch screen and a new app icon. Minor improvements and fixes.",
  "en-GB": "A fresh new look — Veritra logo on the launch screen and a new app icon. Minor improvements and fixes.",
  "de-DE": "Neues Erscheinungsbild — Veritra-Logo auf dem Startbildschirm und neues App-Icon. Kleine Verbesserungen und Fehlerbehebungen.",
  "sk": "Nový vzhľad aplikácie — logo Veritra na úvodnej obrazovke a nová ikona. Drobné vylepšenia a opravy.",
  "fr-FR": "Un nouveau look — logo Veritra sur l'écran de démarrage et nouvelle icône. Améliorations mineures et corrections.",
  "it": "Un nuovo look — logo Veritra nella schermata di avvio e nuova icona. Piccoli miglioramenti e correzioni.",
  "ja": "アプリの新しいデザイン — 起動画面に Veritra ロゴ、新しいアイコン。細かな改善と修正。",
};

function makeJwt(): string {
  const pem = readFileSync(KEY_PATH, "utf8");
  const key = createPrivateKey(pem);
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 20 * 60, aud: "appstoreconnect-v1" };
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const signature = sign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${signature.toString("base64url")}`;
}

const jwt = makeJwt();

async function asc<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`ASC ${method} ${path} → ${r.status}: ${txt}`);
  return txt ? (JSON.parse(txt) as T) : ({} as T);
}

// 1. Build 17
const builds = await asc<{ data: any[] }>(
  "GET",
  `/v1/builds?filter[app]=${APP_ID}&filter[version]=${BUILD_NUMBER}&filter[preReleaseVersion.version]=${VERSION}&fields[builds]=version,processingState,expired`,
);
const build = builds.data.find((b) => b.attributes.processingState === "VALID" && !b.attributes.expired);
if (!build) throw new Error(`Build ${VERSION}(${BUILD_NUMBER}) není VALID v ASC: ${JSON.stringify(builds.data.map((b) => b.attributes))}`);
console.log(`build ${BUILD_NUMBER}: ${build.id} (VALID)`);

// 2. Verze 1.0.1 — reuse pokud existuje
const versions = await asc<{ data: any[] }>(
  "GET",
  `/v1/apps/${APP_ID}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,platform`,
);
for (const v of versions.data) console.log(`version ${v.attributes.versionString} — ${v.attributes.appStoreState}`);
let ver = versions.data.find((v) => v.attributes.versionString === VERSION);

if (!PERFORM_SUBMIT) {
  console.log(`\nDry-run. Verze ${VERSION} ${ver ? "existuje" : "NEEXISTUJE — vytvoří se"}. Pass --submit.`);
  process.exit(0);
}

if (!ver) {
  const created = await asc<{ data: any }>("POST", "/v1/appStoreVersions", {
    data: {
      type: "appStoreVersions",
      attributes: { platform: "IOS", versionString: VERSION },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  ver = created.data;
  console.log(`vytvořena verze ${VERSION}: ${ver.id}`);
}

// 3. Attach build
await asc("PATCH", `/v1/appStoreVersions/${ver.id}/relationships/build`, {
  data: { type: "builds", id: build.id },
});
console.log(`build attached`);

// 4. Review detail — zkopíruj z předchozí verze (demo účet), pokud u nové chybí
const prev = versions.data.find((v) => v.attributes.versionString !== VERSION);
try {
  const prevDetail = await asc<{ data: any }>(
    "GET",
    `/v1/appStoreVersions/${prev.id}/appStoreReviewDetail`,
  );
  const a = prevDetail.data.attributes;
  try {
    await asc("POST", "/v1/appStoreReviewDetails", {
      data: {
        type: "appStoreReviewDetails",
        attributes: {
          contactFirstName: a.contactFirstName,
          contactLastName: a.contactLastName,
          contactPhone: a.contactPhone,
          contactEmail: a.contactEmail,
          demoAccountName: a.demoAccountName,
          demoAccountPassword: a.demoAccountPassword,
          demoAccountRequired: a.demoAccountRequired,
          notes: a.notes,
        },
        relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: ver.id } } },
      },
    });
    console.log("review detail zkopírován");
  } catch (e) {
    // 409 = detail už existuje (ASC ho zdědil) — v pořádku
    console.log(`review detail: ${(e as Error).message.slice(0, 120)}`);
  }
} catch (e) {
  console.log(`review detail z ${prev?.attributes?.versionString} nedostupný: ${(e as Error).message.slice(0, 120)}`);
}

// 5. whatsNew do všech lokalizací
const locs = await asc<{ data: any[] }>(
  "GET",
  `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations?limit=20`,
);
for (const loc of locs.data) {
  const code = loc.attributes.locale as string;
  const text = WHATS_NEW[code] ?? WHATS_NEW[code.split("-")[0]] ?? WHATS_NEW["en-US"];
  await asc("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, {
    data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: { whatsNew: text } },
  });
  console.log(`whatsNew ${code} OK`);
}

// 6. reviewSubmission
const submission = await asc<{ data: { id: string } }>("POST", "/v1/reviewSubmissions", {
  data: {
    type: "reviewSubmissions",
    attributes: { platform: "IOS" },
    relationships: { app: { data: { type: "apps", id: APP_ID } } },
  },
});
console.log(`reviewSubmission: ${submission.data.id}`);

await asc("POST", "/v1/reviewSubmissionItems", {
  data: {
    type: "reviewSubmissionItems",
    relationships: {
      reviewSubmission: { data: { type: "reviewSubmissions", id: submission.data.id } },
      appStoreVersion: { data: { type: "appStoreVersions", id: ver.id } },
    },
  },
});
console.log("item přidán");

await asc("PATCH", `/v1/reviewSubmissions/${submission.data.id}`, {
  data: { type: "reviewSubmissions", id: submission.data.id, attributes: { submitted: true } },
});
console.log(`\n✔ Verze ${VERSION} (build ${BUILD_NUMBER}) odeslána do App Review. Submission: ${submission.data.id}`);
