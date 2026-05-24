# Chords: прокси на ПК вместо Vercel по умолчанию

**Дата:** 2026-05-24  
**Зачем:** лимит Vercel; табы должны парситься с AmDm через локальный `tools/chord-fetch`, без обязательного деплоя.

## Файлы

| Путь | Изменение |
|------|-----------|
| `src/providers/chordFetchUrl.ts` | Metro > Vercel в `getEffective`; `resolveChordFetchUrlForAutoFill`; подсказки без Vercel |
| `src/providers/autoChordProxy.ts` | авто только env/Metro; апгрейд старого Vercel URL |
| `src/providers/chordFetchProxy.ts` | ошибки → `npm run dev-proxy` |
| `src/providers/providerSettings.ts` | `chordFetchProxyUserSet` |
| `src/screens/ChordsScreen.tsx` | блок «Прокси на ПК», Vercel в «Свой URL» |
| `docs/chord-fetch-local-proxy.md` | основная инструкция |
| `docs/deploy-chord-api-vercel.md` | опциональное приложение |

## Было → стало

| Было | Стало |
|------|--------|
| Vercel в подсказках и placeholder | Прокси на ПК, Vercel свёрнут в «Свой URL» |
| Авто подставляло app.json Vercel | Авто: только EXPO_PUBLIC и Metro :8787 |
| «Табы онлайн» | «Табы с AmDm» + «через прокси на компьютере» |

## Пользователь

1. `npm run dev-proxy` на ПК  
2. Expo Go, одна Wi‑Fi  
3. ⚙ → **Подставить авто** → **Проверить**
