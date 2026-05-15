import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { dicts, type Dict, type Locale, LOCALES } from "./translations";

/**
 * Lightweight i18n bez externí knihovny. Pro ~50 stringů stačí lookup table.
 * Locale se persistuje do AsyncStorage, default se bere ze systému (iOS lang).
 * Interpolace přes `{name}` placeholders (např. `{email}`).
 */

const STORAGE_KEY = "tendero.locale";

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: <K1 extends keyof Dict, K2 extends keyof Dict[K1]>(
    section: K1,
    key: K2,
    params?: Record<string, string | number>,
  ) => string;
  dict: Dict;
}

const I18nContext = createContext<I18nState | null>(null);

function detectDefaultLocale(): Locale {
  const tag = Localization.getLocales()[0]?.languageCode ?? "cs";
  if (tag === "en") return "en";
  if (tag === "de") return "de";
  return "cs";
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectDefaultLocale());

  // Načti uloženou volbu při startu — pokud neexistuje, zůstaneme na default
  // detekovaný ze systému.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && saved && (LOCALES as readonly string[]).includes(saved)) {
          setLocaleState(saved as Locale);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const dict = dicts[locale];

  const t = useCallback<I18nState["t"]>(
    (section, key, params) => {
      const sec = dict[section] as Record<string, string>;
      const tpl = sec?.[key as string] ?? `${String(section)}.${String(key)}`;
      return interpolate(tpl, params);
    },
    [dict],
  );

  const value = useMemo(() => ({ locale, setLocale, t, dict }), [locale, setLocale, t, dict]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export type { Locale };
