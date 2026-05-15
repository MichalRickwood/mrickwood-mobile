import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { clearSession, getToken, getUser, saveToken, saveUser, type StoredUser } from "./auth-storage";
import { endpoints } from "./endpoints";
import { ApiError } from "./api";
import { registerForPushNotifications, unregisterPushNotifications } from "./notifications";

interface AuthState {
  status: "loading" | "anonymous" | "authenticated";
  user: StoredUser | null;
  /** null = ještě nevíme (load běží), true/false = známé. */
  profileComplete: boolean | null;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Voláno OAuth helpers po úspěšném sign-in — token už je v SecureStore. */
  applyOauthSession: (user: StoredUser) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<StoredUser | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  // Aktuální Expo push token — drží se pro unregister při signOut.
  const pushTokenRef = useRef<string | null>(null);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await endpoints.profile();
      setProfileComplete(p.isComplete);
    } catch {
      // Transient — necháme null, RouterGuard počká.
      setProfileComplete(null);
    }
  }, []);

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
        // Push registrace + profile completion check běží paralelně — UI neblokuje.
        void registerForPushNotifications().then((t) => {
          pushTokenRef.current = t;
        });
        void refreshProfile();
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

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token, user: serverUser } = await endpoints.login(email, password);
      await saveToken(token);
      await saveUser(serverUser);
      setUser(serverUser);
      setStatus("authenticated");
      void registerForPushNotifications().then((t) => {
        pushTokenRef.current = t;
      });
      void refreshProfile();
    },
    [refreshProfile],
  );

  const applyOauthSession = useCallback(
    (oauthUser: StoredUser) => {
      setUser(oauthUser);
      setStatus("authenticated");
      void registerForPushNotifications().then((t) => {
        pushTokenRef.current = t;
      });
      void refreshProfile();
    },
    [refreshProfile],
  );

  const signOut = useCallback(async () => {
    await unregisterPushNotifications(pushTokenRef.current);
    pushTokenRef.current = null;
    await clearSession();
    setUser(null);
    setProfileComplete(null);
    setStatus("anonymous");
  }, []);

  return (
    <AuthContext.Provider
      value={{ status, user, profileComplete, refreshProfile, signIn, applyOauthSession, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
