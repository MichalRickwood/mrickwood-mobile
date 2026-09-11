/**
 * Scrollable obaly pro obrazovky uvnitř (tabs) — systémové řešení obsahu
 * schovaného pod glass tab barem (iOS 18+ NativeTabs / Liquid Glass).
 *
 * `contentInsetAdjustmentBehavior="automatic"` nechá UIKit spočítat spodní
 * inset pod plovoucím tab barem (a scroll indikátory) samo — funguje při
 * rotaci, změně výšky baru i budoucích verzích iOS. Na Androidu / klasickém
 * tab baru (iPad, iOS <18) je prop no-op a react-navigation obsah nad bar
 * posadí sám, takže se nikde nepřičítá dvakrát.
 *
 * PRAVIDLO: každá nová obrazovka v (tabs) používá AppScrollView/AppFlatList
 * místo holých ScrollView/FlatList (vertikální; horizontální chip-scrollery
 * se nechávají jako ScrollView). Ruční `paddingBottom: 100` hacky nedělat.
 */
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { forwardRef, useContext, type ReactElement, type Ref } from "react";
import {
  FlatList, Platform, ScrollView, StyleSheet,
  type FlatListProps, type ScrollViewProps, type StyleProp, type ViewStyle,
} from "react-native";

/**
 * Spodní odsazení pod plovoucím tab barem. Na iOSu ho spočítá UIKit sám
 * (`contentInsetAdjustmentBehavior`), na Androidu ne — od 11. 9. 2026 tam bar
 * plave nad obsahem kvůli sklu, takže by poslední řádek seznamu zůstal schovaný.
 * Mimo záložky vrací kontext `undefined` a nepřičítá se nic.
 */
function useOdsazeniPodBarem(): number {
  const vyska = useContext(BottomTabBarHeightContext);
  return Platform.OS === "android" ? (vyska ?? 0) : 0;
}

function sOdsazenim(style: StyleProp<ViewStyle>, paddingBottom: number): StyleProp<ViewStyle> {
  return paddingBottom > 0 ? StyleSheet.compose(style, { paddingBottom }) : style;
}

export const AppScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function AppScrollView(props, ref) {
    const odsazeni = useOdsazeniPodBarem();
    return (
      <ScrollView
        ref={ref}
        contentInsetAdjustmentBehavior="automatic"
        {...props}
        contentContainerStyle={sOdsazenim(props.contentContainerStyle, odsazeni)}
      />
    );
  },
);

function AppFlatListInner<T>(props: FlatListProps<T>, ref: Ref<FlatList<T>>) {
  const odsazeni = useOdsazeniPodBarem();
  return (
    <FlatList
      ref={ref}
      contentInsetAdjustmentBehavior="automatic"
      {...props}
      contentContainerStyle={sOdsazenim(props.contentContainerStyle, odsazeni)}
    />
  );
}

export const AppFlatList = forwardRef(AppFlatListInner) as <T>(
  props: FlatListProps<T> & { ref?: Ref<FlatList<T>> },
) => ReactElement;
