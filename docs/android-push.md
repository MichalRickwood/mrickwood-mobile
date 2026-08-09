# Android push notifikace (FCM)

## Proč to nefunguje bez nastavení

Expo Push Service je jen přeposílač. Na iOS předá zprávu Applu (APNs), na
Androidu **Googlu (FCM)** — a k tomu potřebuje dvě věci, které dnes chybí:

1. **`google-services.json` v aplikaci** — identifikuje appku vůči FCM. Bez něj
   `getExpoPushTokenAsync()` na Androidu vyhodí chybu, zařízení se nikdy
   nezaregistruje a v DB (`MobileDevice`) po něm nezůstane stopa. Přesně to
   odpovídá stavu k 9. 8. 2026: **nula Android zařízení**, jen iOS.
2. **FCM V1 service account klíč nahraný v EAS** — tím se Expo servery
   autentizují u Googlu při odesílání. Bez něj ticket z Expo Push API vrátí
   `InvalidCredentials` a naše `pushToUser()` zařízení rovnou zablokuje
   (`disabledReason`).

`eas update` (OTA) tohle **nevyřeší** — jde o nativní konfiguraci, takže je
nutný nový Android build.

Repo je připravené: `app.config.js` nastaví `android.googleServicesFile`
automaticky, jakmile soubor v kořeni existuje. Do té doby ho vynechá, aby
`expo export` (a tím i `eas update`) nespadl.

## Postup

Kroky 1–4 vyžadují přihlášení Googlem, proto je spusť sám (`! <příkaz>`).

### 1. Přihlášení k Firebase

```bash
npx firebase-tools login
npx firebase-tools projects:list
```

### 2. Firebase projekt

Ideálně **použít stávající GCP projekt**, ve kterém už je OAuth klient pro
přihlášení Googlem (client ID `513591543173-…` v `app.json`) — ať nemáme dva
projekty pro jednu appku:

```bash
npx firebase-tools projects:addfirebase <PROJECT_ID>
```

Pokud v seznamu není nebo je to slepá ulička, založ nový:

```bash
npx firebase-tools projects:create veritra-app --display-name "Veritra"
```

### 3. Android app + google-services.json

Package name musí sedět na `app.json` → `android.package`:

```bash
npx firebase-tools apps:create ANDROID "Veritra Android" \
  --package-name cz.mrickwood.veritra --project <PROJECT_ID>

# APP_ID vypíše předchozí příkaz (tvar 1:513591543173:android:…)
npx firebase-tools apps:sdkconfig ANDROID <APP_ID> --project <PROJECT_ID> \
  --out google-services.json
```

Soubor patří do kořene repa a **commituje se** — neobsahuje tajemství, stejné
identifikátory putují v každém APK.

### 4. FCM V1 klíč do EAS

Firebase konzole → Project settings → Service accounts → *Generate new private
key* → stáhne se JSON. Ten se nahraje do EAS (interaktivní menu):

```bash
npx eas-cli credentials --platform android
# → production → Push Notifications: Manage your FCM V1 service account key
#   → Set up a FCM V1 service account key → cesta ke staženému JSONu
```

Stažený JSON **nedávej do repa** — je to plnohodnotný přístup k projektu.
`.gitignore` už ignoruje `*.key` / `*.p8`, ale ne obecné `.json`, tak ho drž
mimo pracovní kopii (třeba `~/`).

### 5. Build a ověření

```bash
npx eas-cli build --platform android --profile production
```

Po instalaci buildu na Androidu:

1. V appce Nastavení → Notifikace zapnout přepínač (musí zůstat zapnutý —
   při chybě se pod ním zobrazí důvod, viz `settings.pushFailed`).
2. Ověřit, že v DB přibyl `MobileDevice` s `platform='android'` a
   `disabledAt IS NULL`.
3. Testovací push: ranní cron `match-leads` (5:00 UTC), nebo ručně přes
   `pushToUser(userId, …)`.

## Kontrolní seznam po nasazení

- [ ] `google-services.json` v repu, `package_name` = `cz.mrickwood.veritra`
- [ ] `npx expo config --json` ukazuje `android.googleServicesFile`
- [ ] EAS má FCM V1 klíč (`eas credentials --platform android` → Push Notifications)
- [ ] Android build z `production` profilu nainstalovaný
- [ ] `MobileDevice` s `platform='android'` v DB
- [ ] Push dorazí a tapnutí otevře filtr (`data.type = 'leads.new'`)
