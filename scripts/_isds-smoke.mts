/**
 * Smoke test klienta ISDS proti VEŘEJNÉMU TESTOVACÍMU prostředí
 * (https://ws1.datovka-test.gov.cz). Zavolá jen čtecí operace —
 * GetUserInfoFromLogin, GetPasswordInfo a FindDataBox. Nic neodesílá.
 *
 *   ISDS_TEST_LOGIN=... ISDS_TEST_PASSWORD=... npx tsx scripts/_isds-smoke.mts [--ico 00075370] [--dbid xxxxxxx]
 *
 * Bez přístupových údajů skript vypíše, co chybí, a skončí kódem 0 —
 * není to chyba, testovací účet zatím nemáme. Heslo se nikde nevypisuje.
 */

import { IsdsClient } from "../lib/isds/client";
import { jeIsdsError, jeIsdsHttpError, jeOvm } from "../lib/isds/types";

function arg(nazev: string): string | undefined {
  const i = process.argv.indexOf(`--${nazev}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const login = process.env.ISDS_TEST_LOGIN?.trim();
  const password = process.env.ISDS_TEST_PASSWORD?.trim();

  if (!login || !password) {
    console.log(
      [
        "ISDS smoke: přeskočeno — chybí přístupové údaje k testovacímu prostředí.",
        "Nastav ISDS_TEST_LOGIN a ISDS_TEST_PASSWORD (účet na https://www.datovka-test.gov.cz)",
        "a spusť znovu. Ostré údaje sem NEPATŘÍ — v telefonu žijí jen v SecureStore.",
      ].join("\n"),
    );
    return;
  }

  const klient = new IsdsClient({ login, password, env: "test" });
  console.log(`ISDS smoke proti testovacímu prostředí, login ${login.slice(0, 3)}***`);

  // 1) Kdo jsme
  const uzivatel = await klient.getUserInfoFromLogin();
  console.log(
    `  GetUserInfoFromLogin: ${[uzivatel.pnGivenNames, uzivatel.pnLastName].filter(Boolean).join(" ") || "(bez jména)"}` +
      ` · role ${uzivatel.userType ?? "?"} · oprávnění ${uzivatel.userPrivils ?? "?"}` +
      (uzivatel.firmName ? ` · ${uzivatel.firmName}` : ""),
  );

  // 2) Expirace hesla — ať nás nepřekvapí uprostřed dávky
  const expirace = await klient.getPasswordInfo();
  console.log(`  GetPasswordInfo: ${expirace ?? "heslo neexpiruje"}`);

  // 3) Vyhledání schránky (ověření příjemce před odesláním dopisu)
  const dbid = arg("dbid");
  const ico = arg("ico") ?? (dbid ? undefined : "00075370");
  const vysledek = dbid ? await klient.findDataBoxById(dbid) : await klient.findDataBoxByIco(ico!);
  console.log(
    `  FindDataBox (${dbid ? `dbID ${dbid}` : `IČO ${ico}`}): stav ${vysledek.status.code} ` +
      `${vysledek.status.message} · nalezeno ${vysledek.schranky.length}`,
  );
  for (const s of vysledek.schranky) {
    console.log(
      `    ${s.dbID} · ${s.dbType} · ${s.firmName ?? [s.pnGivenNames, s.pnLastName].filter(Boolean).join(" ")}` +
        ` · stav ${s.dbState ?? "?"} · OVM: ${jeOvm(s.dbType) ? "ano" : "NE"}`,
    );
  }
}

main().catch((e: unknown) => {
  if (jeIsdsError(e)) {
    console.error(`ISDS chyba ${e.kod} v ${e.operace}: ${e.message}`);
  } else if (jeIsdsHttpError(e)) {
    console.error(
      `ISDS HTTP ${e.status}` +
        (e.status === 401 ? " — špatné údaje nebo dočasná blokace přihlašování (opakovat až po chvíli!)" : ""),
    );
  } else {
    console.error(`Selhalo: ${(e as Error).message}`);
  }
  process.exit(1);
});
