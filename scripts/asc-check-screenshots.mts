/** Read-only kontrola: screenshoty per lokalizace u poslední App Store verze. */
import { readFileSync } from "fs";
import { createPrivateKey, sign } from "crypto";

const KEY_ID = "3GN49VPDGG";
const ISSUER_ID = "786f2d55-60c2-4d71-a6c5-ebceb59b6699";
const APP_ID = "6772703784";
const KEY_PATH = "./private/AuthKey_3GN49VPDGG.p8";

function makeJwt(): string {
  const pem = readFileSync(KEY_PATH, "utf8");
  const key = createPrivateKey(pem);
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 20 * 60, aud: "appstoreconnect-v1" };
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const si = `${enc(header)}.${enc(payload)}`;
  const sig = sign("sha256", Buffer.from(si), { key, dsaEncoding: "ieee-p1363" });
  return `${si}.${sig.toString("base64url")}`;
}
const jwt = makeJwt();
async function asc<T = any>(path: string): Promise<T> {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!r.ok) throw new Error(`${path} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json() as Promise<T>;
}
async function main() {
  const versions = await asc<any>(`/v1/apps/${APP_ID}/appStoreVersions?limit=3&fields[appStoreVersions]=versionString,appStoreState`);
  for (const v of versions.data) console.log("verze:", v.attributes.versionString, "|", v.attributes.appStoreState);
  const latest = versions.data[0];
  const locs = await asc<any>(`/v1/appStoreVersions/${latest.id}/appStoreVersionLocalizations?limit=20`);
  for (const loc of locs.data) {
    const sets = await asc<any>(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots&limit=10`);
    const parts = sets.data.map((s: any) => {
      const n = (s.relationships?.appScreenshots?.data ?? []).length;
      return `${s.attributes.screenshotDisplayType}:${n}`;
    });
    console.log(`${loc.attributes.locale}: ${parts.join(" ") || "ŽÁDNÉ SETY"}`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
