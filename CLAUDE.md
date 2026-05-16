# Tendero mobile — engineering rules

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
