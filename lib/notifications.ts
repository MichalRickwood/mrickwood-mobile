import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { endpoints } from "./endpoints";

const PUSH_TOKEN_STORAGE_KEY = "tendero.pushToken";

export type PushStatus =
  | { kind: "active"; token: string }
  | { kind: "off" }
  | { kind: "denied" }
  | { kind: "unsupported" };

export async function getPushStatus(): Promise<PushStatus> {
  if (!Device.isDevice) return { kind: "unsupported" };
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

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((((Notifications as any)?.getExpoPushTokenAsync?.length ?? 0) > 0 ? null : null));
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
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
