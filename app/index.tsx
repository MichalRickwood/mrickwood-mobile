import { Image, View } from "react-native";

/**
 * Vstupní „/" route — záměrně NE tenders. RouterGuard (app/_layout.tsx) odsud
 * přesměruje podle stavu session (anon → login, auth → tabs/onboarding). Bez
 * tohoto by „/" renderovalo (tabs)/index a nepřihlášený by na okamžik viděl
 * zakázky.
 *
 * Vizuál = shodný s native splashem (stejný splash-icon + barva #FAFAF9,
 * resizeMode contain), takže native splash → tento gate → cíl je plynulé, žádná
 * prázdná bílá ani skákání loga (i během načítání subscriptions u přihlášeného).
 */
export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FAFAF9",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={require("@/assets/splash-icon.png")}
        resizeMode="contain"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}
