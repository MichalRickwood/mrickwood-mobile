import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors, type Colors } from "@/constants/theme";

/**
 * Theme context — mode (system/light/dark) → resolved colors.
 *
 * Persistence: AsyncStorage `tendero.theme` (default "system").
 * Při mode = "system" sleduje iOS system preference přes `useColorScheme()`.
 */

export type ThemeMode = "system" | "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
  colors: Colors;
}

const STORAGE_KEY = "tendero.theme";
const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const systemScheme = useColorScheme();

  // Načti uložený mode z AsyncStorage po startu (default "system" zůstává až do načtení).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && saved && (saved === "system" || saved === "light" || saved === "dark")) {
          setModeState(saved);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const isDark = mode === "dark" || (mode === "system" && systemScheme === "dark");
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(
    () => ({ mode, setMode, isDark, colors }),
    [mode, setMode, isDark, colors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
