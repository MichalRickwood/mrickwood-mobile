import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearSession, getToken, getUser, saveUser, type StoredUser } from "./auth-storage";
import { endpoints } from "./endpoints";
import { ApiError } from "./api";
import { registerForPushNotifications, unregisterPushNotifications } from "./notifications";
import { iapLogIn, iapLogOut } from "./iap";

interface AuthState {
  status: "loading" | "anonymous" | "authenticated";
  user: StoredUser | null;
  /** Voláno po úspěšném web-auth handoffu — token už je v SecureStore. */
  applySession: (user: StoredUser) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<StoredUser | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null>(null);

  // On mount: ověříme uložený token přes /api/auth/mobile/me. 401 → anon.
  // Cached user nastavíme optimisticky z storage *před* network call, ať UI
  // (settings karta, headery atd.) nečeká na endpoints.me() a nepoblikává.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) {
        if (!cancelled) setStatus("anonymous");
        return;
      }
      const stored = await getUser();
      if (stored && !cancelled) {
        prevUserIdRef.current = stored.id;
        setUser(stored);
        setStatus("authenticated");
      }
      try {
        const { user: serverUser } = await endpoints.me();
        if (cancelled) return;
        await saveUser(serverUser);
        prevUserIdRef.current = serverUser.id;
        setUser(serverUser);
        setStatus("authenticated");
        void registerForPushNotifications().then((t) => {
          pushTokenRef.current = t;
        });
      } catch (err) {
        const stored = await getUser();
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 401) {
            setUser(null);
            setStatus("anonymous");
          } else if (stored) {
            // offline / transient — necháme uživatele dovnitř, requesty se autorizují postupně
            setUser(stored);
            setStatus("authenticated");
          } else {
            setStatus("anonymous");
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // RevenueCat login na náš user.id (appUserID) — kdykoli máme usera (iOS IAP).
  useEffect(() => {
    if (user?.id) void iapLogIn(user.id);
  }, [user?.id]);

  const applySession = useCallback((sessionUser: StoredUser) => {
    // Přihlášení (i přepnutí účtu) → zahoď cache předchozího uživatele, jinak
    // by nový účet viděl cizí data (sledované zakázky, matches, filtry…).
    if (prevUserIdRef.current && prevUserIdRef.current !== sessionUser.id) {
      queryClient.clear();
    }
    prevUserIdRef.current = sessionUser.id;
    setUser(sessionUser);
    setStatus("authenticated");
    void registerForPushNotifications().then((t) => {
      pushTokenRef.current = t;
    });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await unregisterPushNotifications(pushTokenRef.current);
    pushTokenRef.current = null;
    await iapLogOut();
    await clearSession();
    // Vyčisti veškerou cache serverových dat, ať další účet nezdědí sledované
    // zakázky / matches / filtry po odhlášeném uživateli.
    queryClient.clear();
    prevUserIdRef.current = null;
    setUser(null);
    setStatus("anonymous");
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ status, user, applySession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
