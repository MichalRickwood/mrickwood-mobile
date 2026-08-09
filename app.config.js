const fs = require("fs");
const path = require("path");

/**
 * Statická konfigurace je v app.json — tenhle soubor jen dopočítá to, co
 * závisí na přítomnosti souborů v pracovní kopii.
 *
 * `android.googleServicesFile` = FCM (Firebase Cloud Messaging). Bez něj
 * Android push notifikace nemohou fungovat vůbec — Expo Push Service nemá
 * kudy doručit. Soubor se stahuje z Firebase konzole (viz docs/android-push.md)
 * a commituje se do repa; obsahuje jen veřejné identifikátory, které stejně
 * putují v každém APK.
 *
 * Podmínka je tu proto, že cesta na neexistující soubor shodí `expo export`
 * pro Android — tedy i `eas update`, který exportuje obě platformy. Dokud
 * google-services.json chybí, pole prostě vynecháme a všechno ostatní jede.
 */
module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, "google-services.json");
  if (fs.existsSync(googleServices)) {
    config.android = { ...config.android, googleServicesFile: "./google-services.json" };
  }
  return config;
};
