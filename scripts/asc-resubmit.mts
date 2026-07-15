/**
 * Re-submit App Store Review pro version 1.0 (s build 1.0(6) attached).
 *
 * Apple ASC API (reviewSubmissions):
 *  1. List existing reviewSubmissions
 *  2. PATCH canceled=true pro každou pending (READY_FOR_REVIEW / WAITING_FOR_REVIEW /
 *     UNRESOLVED_ISSUES) — DELETE Apple nepovoluje, ale UPDATE canceled ano
 *  3. Počkat až state → CANCELED (poll do 30s)
 *  4. POST /v1/reviewSubmissions, POST item, PATCH submitted=true
 *
 * Spuštění:
 *   npx tsx scripts/asc-resubmit.mts            # dry-run (list jen)
 *   npx tsx scripts/asc-resubmit.mts --submit   # full flow
 */
import { readFileSync } from "fs";
import { createPrivateKey, sign } from "crypto";

const KEY_ID = "3GN49VPDGG";
const ISSUER_ID = "786f2d55-60c2-4d71-a6c5-ebceb59b6699";
const APP_ID = "6772703784";
const KEY_PATH = "./private/AuthKey_3GN49VPDGG.p8";
const PERFORM_SUBMIT = process.argv.includes("--submit");

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log("=== App Store Version 1.0 ===");
const versions = await asc<{ data: any[] }>(
  "GET",
  `/v1/apps/${APP_ID}/appStoreVersions?limit=3&include=build`,
);
const v = versions.data[0];
console.log(`  state: ${v.attributes.appStoreState}, build: ${v.relationships?.build?.data?.id}`);

console.log("\n=== Existing reviewSubmissions ===");
const subs = await asc<{ data: any[] }>(
  "GET",
  `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS`,
);
for (const s of subs.data) {
  console.log(`  ${s.id} — ${s.attributes.state}`);
}

if (!PERFORM_SUBMIT) {
  console.log("\nDry-run. Pass --submit to clean & resubmit.");
  process.exit(0);
}

// Cancel pending submissions (everything not COMPLETE / CANCELED)
const pendingStates = new Set([
  "READY_FOR_REVIEW",
  "WAITING_FOR_REVIEW",
  "IN_REVIEW",
  "UNRESOLVED_ISSUES",
]);
const toCancel = subs.data.filter((s) => pendingStates.has(s.attributes.state));

console.log(`\n=== Canceling ${toCancel.length} pending submissions ===`);
for (const s of toCancel) {
  try {
    await asc("PATCH", `/v1/reviewSubmissions/${s.id}`, {
      data: { type: "reviewSubmissions", id: s.id, attributes: { canceled: true } },
    });
    console.log(`  canceled ${s.id}`);
  } catch (e) {
    console.log(`  FAIL ${s.id}: ${(e as Error).message.split("\n")[0]}`);
  }
}

// Poll until all canceled (max 60s)
console.log("\n=== Waiting for cancellation to settle ===");
for (let attempt = 0; attempt < 30; attempt++) {
  await sleep(2000);
  const check = await asc<{ data: any[] }>(
    "GET",
    `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS`,
  );
  const stillPending = check.data.filter((s) => pendingStates.has(s.attributes.state));
  if (stillPending.length === 0) {
    console.log(`  all clear after ${(attempt + 1) * 2}s`);
    break;
  }
  process.stdout.write(`.`);
}

console.log("\n\n=== Creating new reviewSubmission ===");
const submission = await asc<{ data: { id: string } }>("POST", "/v1/reviewSubmissions", {
  data: {
    type: "reviewSubmissions",
    attributes: { platform: "IOS" },
    relationships: { app: { data: { type: "apps", id: APP_ID } } },
  },
});
console.log(`  id: ${submission.data.id}`);

console.log("\n=== Adding item (appStoreVersion 1.0) ===");
const item = await asc<{ data: { id: string } }>("POST", "/v1/reviewSubmissionItems", {
  data: {
    type: "reviewSubmissionItems",
    relationships: {
      reviewSubmission: { data: { type: "reviewSubmissions", id: submission.data.id } },
      appStoreVersion: { data: { type: "appStoreVersions", id: v.id } },
    },
  },
});
console.log(`  item id: ${item.data.id}`);

console.log("\n=== Submitting (PATCH submitted=true) ===");
await asc("PATCH", `/v1/reviewSubmissions/${submission.data.id}`, {
  data: {
    type: "reviewSubmissions",
    id: submission.data.id,
    attributes: { submitted: true },
  },
});
console.log(`\nSubmitted to Apple Review. ID: ${submission.data.id}`);
