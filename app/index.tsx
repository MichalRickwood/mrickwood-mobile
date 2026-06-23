import { View } from "react-native";

/**
 * Vstupní „/" route — záměrně NE tenders. RouterGuard (app/_layout.tsx) odsud
 * přesměruje podle stavu session (anon → login, auth → tabs/onboarding). Bez
 * tohoto by „/" renderovalo (tabs)/index a nepřihlášený by na okamžik viděl
 * zakázky, než redirect doběhne. Neutrální plocha v barvě native splashe →
 * plynulý přechod, žádné logo ani probliknutí zakázek.
 */
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: "#FAFAF9" }} />;
}
