import { useMemo } from "react";
import * as Localization from "expo-localization";
import { useI18n } from "./i18n";
import { vychoziZeme as odvodZemi } from "./countries";

/**
 * Výchozí země reportů podle nastavení uživatele.
 *
 * Bere se region zařízení (Michal má CZ), a když ho systém nedá nebo pro něj
 * nemáme data, odvodí se z jazyka appky; poslední záchrana je CZ. Počítá se
 * jednou za locale — `getLocales()` sahá na nativní modul.
 */
export function useVychoziZeme(): { vychoziZeme: string } {
  const { locale } = useI18n();
  const vychoziZeme = useMemo(() => {
    let region: string | null = null;
    try {
      region = Localization.getLocales()[0]?.regionCode ?? null;
    } catch {
      region = null;
    }
    return odvodZemi(region, locale);
  }, [locale]);
  return { vychoziZeme };
}
