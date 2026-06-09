# FBA Spain CRM — приложение (Фаза 1)

Supplier-outreach CRM. Стек: **Next.js 15 (App Router, TS) + Prisma 6 + PostgreSQL + Tailwind + Auth.js v5**.
Решения и архитектура — в `../docs/` (ADR-0001..0004, 04-data-model, 09-auth, 10-fba-spain-integration).

## Что есть в Фазе 1
- Auth.js (Credentials + JWT), вход для 3 засеянных пользователей, без публичной регистрации.
- Сущности: User, Supplier (+статусы/скоринг), Contact, Brand, SupplierBrand, Tag, Note, Document (+ Email*/ApiSecret в схеме на будущее).
- Страницы: **Задачи** (Kanban, главный экран) · **Поставщики** (список с фильтром + карточка с таймлайном и сменой статуса) · **Бренды** · **Импорт**.
- **Импорт `distributor_candidates.csv`** из проекта Claude fba Spain → Brand/Supplier/Contact/SupplierBrand (дедуп по домену).
- Сид шаблона письма-запроса прайса (`EmailTemplate`).

> Почта, follow-up-cron и vault секретов — Фаза 2 (схема уже готова).

## Запуск (локально)

Требуется Node 20+ и Docker.

```bash
# 1) переменные окружения
cp .env.example .env
#    задать AUTH_SECRET. На Windows без openssl:
#    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
#    вставить результат в AUTH_SECRET; задать SEED_PW_* по вкусу.

# 2) поднять Postgres
docker compose up -d

# 3) зависимости
npm install

# 4) миграция + сид
npx prisma migrate dev --name init
npm run db:seed

# 5) запуск
npm run dev
# http://localhost:3000  →  вход: admin@mirabloom.eu / значение SEED_PW_ADMIN
```

## Импорт поставщиков
Открыть **/import** → загрузить `…_distributor_candidates.csv` из `C:\Users\Administrator\Claude fba Spain\sourcing\`.
Поставщики появятся в **/suppliers** в статусе `CANDIDATE`, бренды — в **/brands**.

## Полезные команды
- `npm run db:studio` — Prisma Studio (просмотр БД)
- `npm run db:migrate` — новая миграция
- `npm run build && npm start` — прод-сборка локально

## Деплой на Contabo
См. `../docs/08-deployment-contabo.md` (Docker рядом с n8n, Caddy, бэкапы). В этой папке есть `Dockerfile` и
`docker-entrypoint.sh` для прод-образа (`output: standalone`).

## Заметки
- БД-схема — `prisma/schema.prisma` (единый источник истины, соответствует `docs/04-data-model.md`).
- Пин версий: Next 15, Prisma 6, `next-auth@5.0.0-beta.x`. На Next 16 — переименовать `src/middleware.ts` → `proxy.ts` (см. docs/09).
