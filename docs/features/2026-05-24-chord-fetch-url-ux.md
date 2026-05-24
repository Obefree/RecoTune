# Chords: URL подгрузки табов и диагностика

**Дата:** 2026-05-24  
**Зачем:** табы «не грузятся» — у пользователя не было URL API в настройках (UI убрали), ошибки прятались за «только прогрессия», Android блокировал `http://` dev-proxy.

## Файлы

| Путь | Изменение |
|------|-----------|
| `src/providers/chordFetchUrl.ts` | `normalizeChordFetchUrl`, `getEffectiveChordFetchUrl`, `resolveChordFetchUrlDetailed`, `expoGoConfig`, `chordFetchSetupHint` |
| `src/providers/chordFetchProxy.ts` | effective URL, `probeChordFetchEndpoint`, подсказка cleartext |
| `src/screens/ChordsScreen.tsx` | URL в ⚙, «Подставить авто» / «Проверить», ошибка в пустом экране, dev-строка API |
| `app.json` | `android.usesCleartextTraffic` для dev-proxy |
| `tools/chord-fetch/test-endpoint.mjs` | smoke-test endpoint |

## Было → стало

| Было | Стало |
|------|--------|
| Нельзя ввести Vercel URL в приложении | Поле URL + авто + проверка Creep |
| Пустой экран: только «прогрессия» | Оранжевая строка с причиной (нет API / HTTP / timeout) |
| `http://LAN:8787` на Android | `usesCleartextTraffic` + подсказка про https Vercel |
| URL без пути `/api/fetch-chords` | Нормализация дописывает путь |

## Проверка endpoint (ПК)

```bash
# dev-proxy (в другом терминале: npm run dev-proxy)
npm run test-chord-fetch

# Vercel
node tools/chord-fetch/test-endpoint.mjs https://ВАШ-ПРОЕКТ.vercel.app/api/fetch-chords

# handler без сети
node --input-type=module -e "import h from './api/fetch-chords.mjs'; ..."
```

## Пользователь

1. Deploy RecoTune на Vercel → скопировать `https://<project>.vercel.app/api/fetch-chords`
2. В приложении: Практика → long-press ⚙ → вставить URL → **Проверить** → **Сохранить настройки**
3. Или Expo Go + `npm run dev-proxy` на ПК → **Подставить авто**
