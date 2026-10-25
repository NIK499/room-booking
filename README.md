# Бронирование кабинетов

Веб-приложение для бронирования кабинетов. Выбираете дату, видите занятые кабинеты и бронируете свободное время.

## Структура проекта

- `backend/` — сервер на Node.js и TypeScript
- `frontend/` — веб-страница на HTML и JavaScript
- `docs/` — документация (API, инструкции)

## Быстрый старт

### Бэкенд

```bash
cd backend
npm install
npx tsx watch server.ts
```

Сервер запустится на http://localhost:3000

### Фронтенд

Откройте `frontend/index.html` в браузере.

## API

См. [docs/API.md](docs/API.md)

## Правила работы с Git

1. В `main` напрямую не пишем. Любая работа идёт в своей ветке.
2. Название ветки показывает, что в ней: `docs/api-contract`, `backend/bookings-read`, `frontend/ui`.
3. Коммиты маленькие, сообщение понятное.
4. Код попадает в `main` только через Pull Request.
5. Перед началом работы: `git switch main && git pull`.
