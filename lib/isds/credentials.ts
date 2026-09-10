import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import type { IsdsCredentials, IsdsEnv } from "./types";

/**
 * Přihlašovací údaje do datové schránky žijí VÝHRADNĚ v telefonu.
 *
 * - `expo-secure-store` s `requireAuthentication: true` → položka v Keychain /
 *   Keystore je svázaná s biometrií, samotné čtení vyvolá prompt.
 * - Navíc `expo-local-authentication` před čtením, aby prompt přišel i tam,
 *   kde SecureStore biometrii sám nevynutí.
 * - Heslo se nikdy neloguje, neposílá na server ani nedrží v React stavu —
 *   načte se těsně před akcí a po jejím dokončení se zahodí.
 */

const KLIC_LOGIN = "isds.login";
const KLIC_HESLO = "isds.password";
const KLIC_PROSTREDI = "isds.env";
/** Nechráněný příznak, ať jde v Nastavení ukázat stav bez biometrie. */
const KLIC_META = "isds.meta";

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

export interface IsdsMeta {
  ulozeno: boolean;
  env: IsdsEnv;
  /** Kdy naposledy prošlo „Ověřit přihlášení". */
  overenoAt: string | null;
  /** Jméno uživatele z GetUserInfoFromLogin (jen pro zobrazení). */
  jmeno: string | null;
}

const PRAZDNA_META: IsdsMeta = { ulozeno: false, env: "test", overenoAt: null, jmeno: null };

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
      cancelLabel: undefined,
    });
    return res.success;
  } catch {
    return false;
  }
}

export async function nacistMeta(): Promise<IsdsMeta> {
  try {
    const raw = await SecureStore.getItemAsync(KLIC_META);
    if (!raw) return PRAZDNA_META;
    const parsed = JSON.parse(raw) as Partial<IsdsMeta>;
    return {
      ulozeno: parsed.ulozeno === true,
      env: parsed.env === "prod" ? "prod" : "test",
      overenoAt: parsed.overenoAt ?? null,
      jmeno: parsed.jmeno ?? null,
    };
  } catch {
    return PRAZDNA_META;
  }
}

async function zapsatMeta(meta: IsdsMeta): Promise<void> {
  await SecureStore.setItemAsync(KLIC_META, JSON.stringify(meta));
}

/** Uloží údaje. Bez zaregistrované biometrie se ukládat nesmí. */
export async function ulozitUdaje(udaje: IsdsCredentials, prompt: string): Promise<void> {
  const opts = chranene(prompt);
  await SecureStore.setItemAsync(KLIC_LOGIN, udaje.login, opts);
  await SecureStore.setItemAsync(KLIC_HESLO, udaje.password, opts);
  await SecureStore.setItemAsync(KLIC_PROSTREDI, udaje.env, opts);
  const meta = await nacistMeta();
  await zapsatMeta({ ...meta, ulozeno: true, env: udaje.env });
}

/**
 * Načte údaje po biometrickém potvrzení. Vrací null, když uživatel biometrii
 * odmítl nebo údaje nejsou uložené. Volající je smí držet jen po dobu akce.
 */
export async function nacistUdaje(duvod: string): Promise<IsdsCredentials | null> {
  const meta = await nacistMeta();
  if (!meta.ulozeno) return null;
  if (!(await overitBiometrii(duvod))) return null;
  const opts = chranene(duvod);
  try {
    const [login, password, env] = await Promise.all([
      SecureStore.getItemAsync(KLIC_LOGIN, opts),
      SecureStore.getItemAsync(KLIC_HESLO, opts),
      SecureStore.getItemAsync(KLIC_PROSTREDI, opts),
    ]);
    if (!login || !password) return null;
    return { login, password, env: env === "prod" ? "prod" : "test" };
  } catch {
    return null;
  }
}

/** Zapíše výsledek posledního ověření přihlášení (jen pro zobrazení). */
export async function zapsatOvereni(jmeno: string | null): Promise<void> {
  const meta = await nacistMeta();
  await zapsatMeta({ ...meta, overenoAt: new Date().toISOString(), jmeno });
}

/** Smaže všechno, co k datové schránce v telefonu je. */
export async function smazatUdaje(prompt: string): Promise<void> {
  const opts = chranene(prompt);
  await Promise.all([
    SecureStore.deleteItemAsync(KLIC_LOGIN, opts),
    SecureStore.deleteItemAsync(KLIC_HESLO, opts),
    SecureStore.deleteItemAsync(KLIC_PROSTREDI, opts),
    SecureStore.deleteItemAsync(KLIC_META),
  ]);
}
