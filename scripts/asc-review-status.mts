/**
 * App Store Connect API — přečte stav posledních App Store submission(s),
 * případně rejection feedback. Plus výpis builds a appStoreVersions.
 *
 * Spuštění: npx tsx scripts/asc-review-status.mts
 */
import { readFileSync } from "fs";
import { createPrivateKey, sign } from "crypto";

const KEY_ID = "X5ZFJXJ53Z";
const ISSUER_ID = "786f2d55-60c2-4d71-a6c5-ebceb59b6699";
const APP_ID = "6772703784";
const KEY_PATH = "./private/AuthKey_X5ZFJXJ53Z.p8";

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

async function asc<T = any>(path: string, jwt: string): Promise<T> {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`ASC ${path} → ${r.status}: ${txt}`);
  }
  return (await r.json()) as T;
}

const jwt = makeJwt();

console.log("=== Recent builds ===");
const builds = await asc<{ data: any[] }>(
  `/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=5&fields[builds]=version,uploadedDate,processingState,expired,minOsVersion`,
  jwt,
);
for (const b of builds.data) {
  const a = b.attributes;
  console.log(`  build ${a.version} (id ${b.id}) — ${a.processingState}, uploaded ${a.uploadedDate}`);
}

console.log("\n=== App Store Versions ===");
const versions = await asc<{ data: any[] }>(
  `/v1/apps/${APP_ID}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,createdDate,platform`,
  jwt,
);
for (const v of versions.data) {
  const a = v.attributes;
  console.log(`  version ${a.versionString} (id ${v.id}) — state=${a.appStoreState}, platform=${a.platform}, created ${a.createdDate}`);
}

const latestVersion = versions.data[0];
if (latestVersion) {
  console.log(`\n=== Details for ${latestVersion.attributes.versionString} ===`);
  // Build relationship
  try {
    const buildRel = await asc<{ data: { id: string } | null }>(
      `/v1/appStoreVersions/${latestVersion.id}/relationships/build`,
      jwt,
    );
    console.log("  attached build:", buildRel.data?.id ?? "(none)");
  } catch (e) {
    console.log("  build relationship lookup failed:", (e as Error).message);
  }

  // Submission status
  try {
    const sub = await asc<{ data: any[] }>(
      `/v1/appStoreVersionSubmissions?filter[appStoreVersion]=${latestVersion.id}`,
      jwt,
    );
    console.log("  submissions:", JSON.stringify(sub.data, null, 2));
  } catch (e) {
    console.log("  submission lookup failed:", (e as Error).message);
  }

  // Review feedback — appStoreReviewDetails
  try {
    const review = await asc<{ data: any }>(
      `/v1/appStoreVersions/${latestVersion.id}/appStoreReviewDetail`,
      jwt,
    );
    console.log("  reviewDetail:", JSON.stringify(review.data?.attributes, null, 2));
  } catch (e) {
    console.log("  reviewDetail lookup failed:", (e as Error).message);
  }
}
