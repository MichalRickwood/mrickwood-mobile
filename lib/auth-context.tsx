import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { clearSession, getToken, getUser, saveUser, type StoredUser } from "./auth-storage";
import { endpoints } from "./endpoints";
import { ApiError } from "./api";
import { registerForPushNotifications, unregisterPushNotifications } from "./notifications";

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
        setUser(stored);
        setStatus("authenticated");
      }
      try {
        const { user: serverUser } = await endpoints.me();
        if (cancelled) return;
        await saveUser(serverUser);
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

  const applySession = useCallback((sessionUser: StoredUser) => {
    setUser(sessionUser);
    setStatus("authenticated");
    void registerForPushNotifications().then((t) => {
      pushTokenRef.current = t;
    });
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPushNotifications(pushTokenRef.current);
    pushTokenRef.current = null;
    await clearSession();
    setUser(null);
    setStatus("anonymous");
  }, []);

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
