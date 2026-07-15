import { Text, View } from "react-native";
import { useI18n } from "@/lib/i18n";
import { APP_NAME } from "@/lib/config";

/**
 * Vstupní „/" route — záměrně NE tenders. RouterGuard (app/_layout.tsx) odsud
 * přesměruje podle stavu session (anon → login, auth → tabs/onboarding). Bez
 * tohoto by „/" renderovalo (tabs)/index a nepřihlášený by na okamžik viděl
 * zakázky.
 *
 * Vzhled = boot/loading obrazovka: Veritra wordmark + lokalizovaný tagline
 * (brand.tagline, dle jazyka zařízení) na krémovém pozadí #F4F0E4 — stejná
 * barva jako nativní splash, takže přechod splyne. (Dřív tu byla lupa s „T"
 * ze splash-icon.png — starý brand.)
 */
export default function Index() {
  const { t } = useI18n();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F4F0E4",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 46,
          fontWeight: "800",
          letterSpacing: -1,
          color: "#1C1917",
        }}
      >
        {APP_NAME}
      </Text>
      <Text
        style={{
          marginTop: 10,
          fontSize: 15,
          color: "#78716C",
          textAlign: "center",
          paddingHorizontal: 32,
        }}
      >
        {t("brand", "tagline")}
      </Text>
    </View>
  );
}
