import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { endpoints } from "./endpoints";

const PUSH_TOKEN_STORAGE_KEY = "tendero.pushToken";

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
  | { kind: "need-build" };

export async function getPushStatus(): Promise<PushStatus> {
  if (!Device.isDevice) return { kind: "unsupported" };
  if (!getEasProjectId()) return { kind: "need-build" };
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "denied") return { kind: "denied" };
  const saved = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (status === "granted" && saved) return { kind: "active", token: saved };
  return { kind: "off" };
}

export async function disablePush(): Promise<void> {
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

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    // Simulator nedostává tokeny. Skip.
    return null;
  }

  const projectId = getEasProjectId();
  if (!projectId) {
    // Bez EAS projektu push token v Expo Go nelze získat. Caller (UI) by měl
    // detekovat tento stav přes getPushStatus() a zobrazit hint.
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoToken = tokenResponse.data;
  if (!expoToken) return null;

  const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";
  try {
    await endpoints.registerPushDevice(expoToken, platform);
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoToken);
  } catch (e) {
    // Síťová chyba — token vrátíme, zkusíme registrovat příště.
    console.warn("[push] register failed:", (e as Error).message);
  }
  return expoToken;
}

export async function unregisterPushNotifications(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await endpoints.unregisterPushDevice(token);
  } catch (e) {
    console.warn("[push] unregister failed:", (e as Error).message);
  }
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}
