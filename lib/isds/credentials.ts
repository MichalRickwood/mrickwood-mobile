import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import type { IsdsCredentials, IsdsEnv } from "./types";

/**
 * Přihlašovací údaje k datovým schránkám žijí VÝHRADNĚ v telefonu.
 *
 * Michal má přístup k několika schránkám (RWX, Bricky, Cloud IS, Ordinea…),
 * proto se údaje vedou per schránka:
 *  - `isds.ucty` — seznam účtů (dbId, název, login, prostředí). Nechráněný,
 *    ať jde Nastavení a kontrola „mám ke všem odesílatelům údaje?" udělat
 *    bez biometrického promptu. Heslo v něm NENÍ.
 *  - `isds.heslo.<dbId>` — heslo, `requireAuthentication: true` (Keychain /
 *    Keystore za biometrií; každé čtení vyvolá prompt). Navíc
 *    `expo-local-authentication` před čtením, aby prompt přišel i tam, kde
 *    SecureStore biometrii sám nevynutí.
 *
 * Heslo se nikdy neloguje, neposílá na server ani nedrží v React stavu —
 * načte se těsně před akcí a po jejím dokončení se zahodí.
 */

const KLIC_UCTY = "isds.ucty";
const PREFIX_HESLO = "isds.heslo.";

/** Klíče z jednoschránkové verze — po migraci se jen zahodí (viz `uklidStareKlice`). */
const STARE_KLICE = ["isds.login", "isds.password", "isds.env", "isds.meta"];

export interface IsdsUcet {
  /** ID datové schránky (7 znaků) — primární klíč účtu, z GetOwnerInfoFromLogin. */
  dbId: string;
  /** Název držitele schránky (firma), z GetOwnerInfoFromLogin. */
  nazev: string;
  login: string;
  env: IsdsEnv;
  /** Kdy naposledy prošlo „Ověřit přihlášení". */
  overenoAt: string | null;
  /** Jméno přihlášené osoby z GetUserInfoFromLogin (jen pro zobrazení). */
  uzivatel: string | null;
}

/**
 * Volby chráněné položky. `requireAuthentication` a `keychainService` musí být
 * u zápisu, čtení i mazání stejné, jinak se položka nenajde. Text promptu si
 * přináší volající — hlášky patří do i18n, ne sem.
 */
function chranene(prompt: string): SecureStore.SecureStoreOptions {
  return {
    requireAuthentication: true,
    keychainService: "cz.mrickwood.veritra.isds",
    authenticationPrompt: prompt,
  };
}

/** SecureStore pouští v klíči jen alfanumerické znaky a `.`, `-`, `_`. */
function klicHesla(dbId: string): string {
  return `${PREFIX_HESLO}${dbId.replace(/[^A-Za-z0-9._-]/g, "")}`;
}

/** Umí zařízení biometrii a je nějaká zaregistrovaná? */
export async function biometrieDostupna(): Promise<boolean> {
  try {
    const [hw, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hw && enrolled;
  } catch {
    return false;
  }
}

/**
 * Biometrické potvrzení akce. `disableDeviceFallback: false` = když biometrie
 * selže, pustí uživatele přes PIN/heslo zařízení.
 */
export async function overitBiometrii(duvod: string): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: duvod,
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}

function normalizovatUcet(x: Partial<IsdsUcet>): IsdsUcet | null {
  if (!x || typeof x.dbId !== "string" || !x.dbId.trim()) return null;
  if (typeof x.login !== "string" || !x.login.trim()) return null;
  return {
    dbId: x.dbId.trim(),
    nazev: typeof x.nazev === "string" && x.nazev.trim() ? x.nazev.trim() : x.dbId.trim(),
    login: x.login.trim(),
    env: x.env === "prod" ? "prod" : "test",
    overenoAt: typeof x.overenoAt === "string" ? x.overenoAt : null,
    uzivatel: typeof x.uzivatel === "string" ? x.uzivatel : null,
  };
}

/** Seznam nastavených schránek. Bez biometrie — hesla v něm nejsou. */
export async function nacistUcty(): Promise<IsdsUcet[]> {
  try {
    const raw = await SecureStore.getItemAsync(KLIC_UCTY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => normalizovatUcet(x as Partial<IsdsUcet>))
      .filter((x): x is IsdsUcet => x !== null);
  } catch {
    return [];
  }
}

async function zapsatUcty(ucty: IsdsUcet[]): Promise<void> {
  await SecureStore.setItemAsync(KLIC_UCTY, JSON.stringify(ucty));
}

/** Jeden účet podle ID schránky. */
export async function najitUcet(dbId: string): Promise<IsdsUcet | null> {
  const ucty = await nacistUcty();
  return ucty.find((u) => u.dbId === dbId) ?? null;
}

/**
 * Uloží (nebo přepíše) účet i s heslem. Účty se rozlišují podle `dbId`, které
 * přišlo z GetOwnerInfoFromLogin — dvakrát zadaná táž schránka se přepíše,
 * nezaloží se duplicita.
 */
export async function ulozitUcet(ucet: IsdsUcet, heslo: string, prompt: string): Promise<void> {
  await SecureStore.setItemAsync(klicHesla(ucet.dbId), heslo, chranene(prompt));
  const ucty = await nacistUcty();
  const bezStareho = ucty.filter((u) => u.dbId !== ucet.dbId);
  await zapsatUcty([...bezStareho, ucet]);
}

/**
 * Načte údaje jedné schránky po biometrickém potvrzení. Vrací null, když
 * schránka není nastavená nebo uživatel ověření odmítl. Volající je smí držet
 * jen po dobu akce.
 */
export async function nacistUdajeSchranky(dbId: string, duvod: string): Promise<IsdsCredentials | null> {
  const ucet = await najitUcet(dbId);
  if (!ucet) return null;
  if (!(await overitBiometrii(duvod))) return null;
  try {
    const heslo = await SecureStore.getItemAsync(klicHesla(dbId), chranene(duvod));
    if (!heslo) return null;
    return { login: ucet.login, password: heslo, env: ucet.env };
  } catch {
    return null;
  }
}

/** Zapíše výsledek posledního ověření přihlášení (jen pro zobrazení). */
export async function zapsatOvereniUctu(dbId: string, uzivatel: string | null): Promise<void> {
  const ucty = await nacistUcty();
  const novy = ucty.map((u) =>
    u.dbId === dbId ? { ...u, overenoAt: new Date().toISOString(), uzivatel } : u,
  );
  await zapsatUcty(novy);
}

/** Smaže jednu schránku — účet i heslo. */
export async function smazatUcet(dbId: string, prompt: string): Promise<void> {
  await SecureStore.deleteItemAsync(klicHesla(dbId), chranene(prompt));
  const ucty = await nacistUcty();
  await zapsatUcty(ucty.filter((u) => u.dbId !== dbId));
}

/**
 * Migrace z jednoschránkové verze. Build s klíči `isds.login` / `isds.password`
 * / `isds.env` se nikam nedostal, takže je nemáme kam převádět (bez `dbID` by
 * účet stejně nešel založit) — jen je zahodíme, ať v Keychainu neleží heslo,
 * ke kterému už nic nesahá. Volá se při otevření sekce.
 */
export async function uklidStareKlice(): Promise<void> {
  for (const klic of STARE_KLICE) {
    try {
      await SecureStore.deleteItemAsync(klic);
      // Heslo bylo uložené s `requireAuthentication` a keychainService —
      // smazání musí proběhnout se stejnými volbami, jinak položku nenajde.
      await SecureStore.deleteItemAsync(klic, {
        requireAuthentication: true,
        keychainService: "cz.mrickwood.veritra.isds",
      });
    } catch {
      // Nic k zahození nebo zamítnutá biometrie — migrace nesmí blokovat sekci.
    }
  }
}
