/**
 * Onboarding výběr zemí — sdílená logika v components/CountriesManager.tsx
 * (stejná obrazovka slouží i v Nastavení → „Sledované země").
 */
import CountriesManager from "@/components/CountriesManager";

export default function OnboardingCountries() {
  return <CountriesManager mode="onboarding" />;
}
