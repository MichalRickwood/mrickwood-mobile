# Tendero — mobile

iOS aplikace pro vyhledávání veřejných zakázek. Frontend Expo (React Native + TypeScript) napojený na backend mrickwood.cz přes `/api/auth/mobile/*` a `/api/mobile/*`.

## Stack

- Expo SDK 54 (React Native 0.81)
- Expo Router (file-based navigation)
- React Query (data fetching + cache)
- Expo SecureStore (JWT v iOS Keychain)
- Expo Notifications (push přes Expo Push Service)

## Development

```bash
# Lokální dev proti dev serveru (DATABASE_URL=dev_mrickwoodapp)
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001 npx expo start --ios
```

Defaultně appka tlačí na `https://mrickwood.cz`. Pro lokální vývoj nastav `EXPO_PUBLIC_API_BASE_URL` na URL kde běží `npm run dev` ve web projektu.

## Auth flow

1. User zadá email+heslo → POST `/api/auth/mobile/login`
2. Server vrátí HS256 JWT (30d TTL) + user info
3. Token uložen v SecureStore (`tendero.session.token`)
4. Každý request přidává `Authorization: Bearer <token>`
5. Při startu appka volá `/api/auth/mobile/me` pro verifikaci; 401 → odhlášení

## Struktura

```
app/                  expo-router routes
  _layout.tsx         root layout + auth guard
  (auth)/login.tsx    login screen
  (tabs)/             bottom tab navigator
    index.tsx         seznam matchů
    settings.tsx      profil + odhlášení
  match/[id].tsx      detail zakázky (deep link target)
lib/
  api.ts              typed fetch wrapper
  auth-context.tsx    auth state + signIn/signOut
  auth-storage.ts     SecureStore helpers
  config.ts           runtime config
  endpoints.ts        typed API endpoints
  notifications.ts    Expo push registrace
constants/theme.ts    design tokens (sjednoceno s webem)
```

## Backend endpointy

Mobile-specific:
- `POST /api/auth/mobile/login` — email+password → JWT
- `GET /api/auth/mobile/me` — verify JWT, return user
- `GET /api/mobile/filters` — user's lead filters
- `GET /api/mobile/matches?filterId=` — last 30d matches
- `POST /api/mobile/matches/:id/view` — mark as viewed
- `POST /api/mobile/devices/register` — Expo push token
- `POST /api/mobile/devices/unregister` — sign-out cleanup

## Build & deploy

EAS build flow přijde až bude EAS Project ID nastavený v `app.json`.

```bash
# Po `eas login` a `eas init`:
eas build --platform ios --profile development
```
