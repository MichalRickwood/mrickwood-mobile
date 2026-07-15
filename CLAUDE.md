# Veritra mobile — engineering rules

## i18n is non-negotiable

**Every user-facing string must go through `useI18n()` — no hardcoded language anywhere in the UI.**

This includes:
- Modal titles, button labels, placeholders
- `Alert.alert(...)` titles + bodies + button labels
- Error toasts, validation messages, fallback messages in catch blocks
- Descriptive body text, fineprints, empty states
- Anything users can read

Mechanism:
- Slovník v `lib/i18n/translations.ts` — `Dict` typ interface + cs/en/de bloky
- Konzumace přes `const { t } = useI18n(); t("section", "key", { interpol })`
- Při psaní nové komponenty nejdřív přidej klíče do `Dict` + cs/en/de hodnoty, pak použij `t()`

Hardcoded čeština (nebo angličtina) v UI je defekt — i v rychlém prototypu. User explicitně potvrdil: "vždy jdeme i18n, nikdy ne natvrdo jazyk".

## Scrollování v (tabs) — glass tab bar

**Každá obrazovka uvnitř `app/(tabs)` používá `AppScrollView` / `AppFlatList` z `components/AppScroll.tsx` místo holých `ScrollView` / `FlatList`.**

Důvod: iOS 18+ má nativní glass tab bar (NativeTabs / Liquid Glass), pod který obsah podtéká — `contentInsetAdjustmentBehavior="automatic"` v obalech nechá UIKit spočítat spodní inset sám (rotace, změny výšky baru, budoucí iOS). Na Androidu / klasickém tab baru je to no-op.

- Horizontální chip-scrollery zůstávají obyčejný `ScrollView` (`horizontal`).
- Žádné ruční `paddingBottom: 100` hacky v `contentContainerStyle` — breathing room max `spacing.xl`.
- Platí i pro nové taby/obrazovky; mimo (tabs) (fullscreen stack modaly) není potřeba.
