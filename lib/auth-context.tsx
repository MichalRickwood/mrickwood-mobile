import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { clearSession, getToken, getUser, saveToken, saveUser, type StoredUser } from "./auth-storage";
import { endpoints } from "./endpoints";
import { ApiError } from "./api";
import { registerForPushNotifications, unregisterPushNotifications } from "./notifications";

interface AuthState {
  status: "loading" | "anonymous" | "authenticated";
  user: StoredUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<StoredUser | null>(null);
  // Aktuální Expo push token — drží se pro unregister při signOut.
  const pushTokenRef = useRef<string | null>(null);

  // On mount: ověříme uložený token přes /api/auth/mobile/me. Pokud server
  // řekne 401 nebo síť selže, padáme na anon — uživatel se přihlásí znovu.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) {
        if (!cancelled) setStatus("anonymous");
        return;
      }
      try {
        const { user: serverUser } = await endpoints.me();
        if (cancelled) return;
        await saveUser(serverUser);
        setUser(serverUser);
        setStatus("authenticated");
        // Push registrace běží asynchronně — UI neblokuje.
        void registerForPushNotifications().then((t) => {
          pushTokenRef.current = t;
        });
      } catch (err) {
        // 401 → api.ts už zavolal clearSession
        const stored = await getUser();
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 401) {
            setUser(null);
            setStatus("anonymous");
          } else if (stored) {
            // offline / transient — necháme uživatele dovnitř, server-side
            // requesty se autorizují postupně
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

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user: serverUser } = await endpoints.login(email, password);
    await saveToken(token);
    await saveUser(serverUser);
    setUser(serverUser);
    setStatus("authenticated");
    void registerForPushNotifications().then((t) => {
      pushTokenRef.current = t;
    });
  }, []);

  const signOut = useCallback(async () => {
    // Odregistrujeme push token před clearSession (potřebuje validní JWT).
    await unregisterPushNotifications(pushTokenRef.current);
    pushTokenRef.current = null;
    await clearSession();
    setUser(null);
    setStatus("anonymous");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
