import { Image, View } from "react-native";

/**
 * Vstupní „/" route — záměrně NE tenders. RouterGuard (app/_layout.tsx) odsud
 * přesměruje podle stavu session (anon → login, auth → tabs/onboarding). Bez
 * tohoto by „/" renderovalo (tabs)/index a nepřihlášený by na okamžik viděl
 * zakázky.
 *
 * Pozadí #F4F0E4 = barva pozadí splash-icon.png (krémová), takže contain pásy
 * nahoře/dole splynou s obrázkem → jednolitá plocha s logem, žádné „bílé sekce"
 * (předtím View #FAFAF9 ≠ krémové pozadí obrázku → viditelné pásy nahoře/dole).
 */
export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F4F0E4",
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
