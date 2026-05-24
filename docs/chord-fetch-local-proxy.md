# Табы с AmDm — прокси на компьютере (основной способ)

Приложение **не** качает HTML с AmDm напрямую. ПК парсит страницу и отдаёт ChordPro по HTTP.

## Быстрый старт

1. **Один раз** в `tools/chord-fetch`:
   ```bash
   npm install
   ```

2. **На ПК** (корень RecoTune, окно не закрывать):
   ```bash
   npm run dev-proxy
   ```
   Слушает `http://0.0.0.0:8787/fetch`.

3. **Телефон:** Expo Go, та же Wi‑Fi, что и ПК. Запустите приложение (`npx expo start`).

4. **В приложении:** Практика → long-press **⚙** → блок **«Прокси на ПК»** → **Подставить авто** → **Проверить** (Creep).

5. Выберите песню без полного таба — подгрузка пойдёт через прокси.

## Проверка на ПК

В другом терминале (прокси должен быть запущен):

```bash
node tools/chord-fetch/test-endpoint.mjs http://127.0.0.1:8787/fetch
```

## Если не работает

| Симптом | Что сделать |
|--------|-------------|
| «Прокси не найден» | Expo Go не видит Metro — перезапустите `npx expo start`, телефон в той же сети |
| Timeout / network failed | Прокси не запущен → `npm run dev-proxy` |
| Android cleartext | В `app.json` включён `usesCleartextTraffic`; для release-сборки нужен тот же флаг |
| Таб не найден | Проверьте исполнителя/название; AmDm может не иметь страницы |

## Опционально: свой сервер (Vercel)

Если нужен таб **без ПК в сети**, можно развернуть `api/fetch-chords.mjs` — см. [deploy-chord-api-vercel.md](./deploy-chord-api-vercel.md). Это **не** обязательно для разработки.

## См. также

- `tools/chord-fetch/README.md` — формат POST, парсер
- [features/2026-05-23-chord-search-fetch-reliability.md](./features/2026-05-23-chord-search-fetch-reliability.md)
