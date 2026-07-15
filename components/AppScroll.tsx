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
import { forwardRef, type ReactElement, type Ref } from "react";
import { FlatList, ScrollView, type FlatListProps, type ScrollViewProps } from "react-native";

export const AppScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function AppScrollView(props, ref) {
    return (
      <ScrollView
        ref={ref}
        contentInsetAdjustmentBehavior="automatic"
        {...props}
      />
    );
  },
);

function AppFlatListInner<T>(props: FlatListProps<T>, ref: Ref<FlatList<T>>) {
  return (
    <FlatList
      ref={ref}
      contentInsetAdjustmentBehavior="automatic"
      {...props}
    />
  );
}

export const AppFlatList = forwardRef(AppFlatListInner) as <T>(
  props: FlatListProps<T> & { ref?: Ref<FlatList<T>> },
) => ReactElement;
