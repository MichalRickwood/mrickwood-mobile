import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { endpoints } from "./endpoints";
import { translateStandalone } from "./i18n";

const PUSH_TOKEN_STORAGE_KEY = "veritra.pushToken";
/**
 * Uživatel si push vypnul přepínačem. Bez tohohle příznaku se registrace
 * spustila znovu při dalším startu appky (auth-context volá registerFor…
 * po každém obnovení session) a zařízení se tiše zapsalo zpátky — vypnutí
 * tak vydrželo do prvního restartu. Ruší ho jen explicitní zapnutí přepínače.
 */
const PUSH_OPT_OUT_STORAGE_KEY = "veritra.pushOptOut";

/** EAS projectId z app.json extra.eas.projectId nebo env. Bez něj Expo SDK 50+
 *  nedovolí getExpoPushTokenAsync — vrátíme `need-build`. */
function getEasProjectId(): string | null {
  const fromExtra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.eas;
  const id =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    (typeof fromExtra === "object" && fromExtra && "projectId" in fromExtra
      ? String((fromExtra as { projectId?: unknown }).projectId ?? "")
      : "");
  return id && id.length > 0 ? id : null;
}

export type PushStatus =
  | { kind: "active"; token: string }
  | { kind: "off" }
  | { kind: "denied" }
  | { kind: "unsupported" }
  | { kind: "need-build" }
  | { kind: "error"; message: string };

/**
 * Poslední důvod, proč registrace tokenu selhala. Bez něj se selhání projeví
 * jen tím, že přepínač zůstane vypnutý — uživatel (ani support) se nedozví,
 * že se vůbec něco pokazilo, a čeká na notifikace, které nikdy nepřijdou.
 */
let lastRegisterError: string | null = null;

async function isOptedOut(): Promise<boolean> {
  return (await AsyncStorage.getItem(PUSH_OPT_OUT_STORAGE_KEY)) === "1";
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!Device.isDevice) return { kind: "unsupported" };
  if (!getEasProjectId()) return { kind: "need-build" };
  // Vypnuto uživatelem má přednost i před chybou registrace — jinak by
  // přepínač po vypnutí ukazoval starou chybovou hlášku.
  if (await isOptedOut()) return { kind: "off" };
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "denied") return { kind: "denied" };
  const saved = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (status === "granted" && saved) return { kind: "active", token: saved };
  if (lastRegisterError) return { kind: "error", message: lastRegisterError };
  return { kind: "off" };
}

export async function disablePush(): Promise<void> {
  // Opt-out zapsat jako první — i kdyby odregistrace na serveru selhala,
  // appka se už sama registrovat nezkusí a uživatel nedostane push z tohohle
  // zařízení znovu jen proto, že byl offline.
  await AsyncStorage.setItem(PUSH_OPT_OUT_STORAGE_KEY, "1");
  lastRegisterError = null;
  const saved = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (saved) {
    try {
      await endpoints.unregisterPushDevice(saved);
    } catch (e) {
      console.warn("[push] disable failed:", (e as Error).message);
    }
  }
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

/**
 * Expo push notification registrace.
 *
 * Volá se po loginu — pokud se user neudělí permission, prostě tiše skipneme
 * (push není blocker pro fungování). Token se posílá na backend, aby ho cron
 * match-leads mohl použít.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Android od 8.0 doručuje notifikace jen do kanálu. Bez explicitní registrace
 * spadnou do kanálu s výchozí důležitostí, takže se neukážou jako banner —
 * uživatel je najde až ve stažené liště. Kanál je vidět v systémovém nastavení
 * appky, proto lokalizovaný název.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: await translateStandalone("settings", "pushChannelName"),
      description: await translateStandalone("settings", "pushChannelDesc"),
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  } catch (e) {
    // Kanál není blocker pro získání tokenu — jen zhorší viditelnost.
    console.warn("[push] setNotificationChannelAsync failed:", (e as Error).message);
  }
}

export async function registerForPushNotifications(
  /** Zapnutí přepínačem v nastavení — zruší dřívější opt-out. */
  opts: { force?: boolean } = {},
): Promise<string | null> {
  if (!Device.isDevice) {
    // Simulator nedostává tokeny. Skip.
    return null;
  }

  if (opts.force) {
    await AsyncStorage.removeItem(PUSH_OPT_OUT_STORAGE_KEY);
  } else if (await isOptedOut()) {
    // Automatická registrace po loginu/startu appky. Uživatel si push vypnul,
    // takže se ho nebudeme ptát znovu ani ho tiše registrovat zpátky.
    return null;
  }

  const projectId = getEasProjectId();
  if (!projectId) {
    // Bez EAS projektu push token v Expo Go nelze získat. Caller (UI) by měl
    // detekovat tento stav přes getPushStatus() a zobrazit hint.
    return null;
  }

  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  // getExpoPushTokenAsync umí házet (APNs/FCM nedostupné, chybí google-services.json
  // na Androidu, výpadek sítě). Neodchycená výjimka tady propadla až do
  // `void register…()` v auth-contextu jako unhandled rejection — registrace tiše
  // selhala a uživateli nikdy nepřišla notifikace, aniž by to kdokoli viděl.
  let expoToken: string | null = null;
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    expoToken = tokenResponse.data || null;
  } catch (e) {
    lastRegisterError = (e as Error).message;
    console.warn("[push] getExpoPushTokenAsync failed:", lastRegisterError);
    return null;
  }
  if (!expoToken) {
    lastRegisterError = "Expo nevrátilo push token.";
    return null;
  }

  const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";
  try {
    await endpoints.registerPushDevice(expoToken, platform);
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoToken);
    lastRegisterError = null;
  } catch (e) {
    // Síťová chyba — token vrátíme, zkusíme registrovat příště. Bez uložení do
    // storage, ať getPushStatus nehlásí "active" pro token, který server nezná.
    lastRegisterError = (e as Error).message;
    console.warn("[push] register failed:", lastRegisterError);
  }
  return expoToken;
}

/**
 * Odhlášení z účtu — token na serveru zneplatníme, ale opt-out příznak
 * necháme být. Je to volba „na tomhle telefonu nechci notifikace", ne
 * vlastnost session; přihlášením jiného účtu by se neměla resetovat.
 */
export async function unregisterPushNotifications(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await endpoints.unregisterPushDevice(token);
  } catch (e) {
    console.warn("[push] unregister failed:", (e as Error).message);
  }
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}
