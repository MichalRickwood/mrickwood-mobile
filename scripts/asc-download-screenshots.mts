/** Stáhne aktuální 6.7" screenshoty cs lokalizace (kontrola aktuálnosti). */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { createPrivateKey, sign } from "crypto";
const KEY_ID = "3GN49VPDGG", ISSUER_ID = "786f2d55-60c2-4d71-a6c5-ebceb59b6699", APP_ID = "6772703784";
function makeJwt(): string {
  const key = createPrivateKey(readFileSync("./private/AuthKey_3GN49VPDGG.p8", "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const si = `${enc({ alg: "ES256", kid: KEY_ID, typ: "JWT" })}.${enc({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" })}`;
  return `${si}.${sign("sha256", Buffer.from(si), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}
const jwt = makeJwt();
const asc = async (p: string) => {
  const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return r.json() as Promise<any>;
};
async function main() {
  const versions = await asc(`/v1/apps/${APP_ID}/appStoreVersions?limit=1`);
  const locs = await asc(`/v1/appStoreVersions/${versions.data[0].id}/appStoreVersionLocalizations?limit=20`);
  const cs = locs.data.find((l: any) => l.attributes.locale === "cs");
  const sets = await asc(`/v1/appStoreVersionLocalizations/${cs.id}/appScreenshotSets`);
  const set67 = sets.data.find((s: any) => s.attributes.screenshotDisplayType === "APP_IPHONE_67");
  const shots = await asc(`/v1/appScreenshotSets/${set67.id}/appScreenshots`);
  mkdirSync("/tmp/asc-shots", { recursive: true });
  let i = 0;
  for (const s of shots.data) {
    const t = s.attributes.imageAsset;
    const url = t.templateUrl.replace("{w}", String(t.width)).replace("{h}", String(t.height)).replace("{f}", "png");
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const f = `/tmp/asc-shots/cs-${++i}.png`;
    writeFileSync(f, buf);
    console.log(f, buf.length, "B", s.attributes.fileName);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
