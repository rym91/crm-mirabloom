import type { SupplierStatus } from "@prisma/client";

/** Человеческие подписи статусов (RU). Совпадают с колонками пайплайна. */
export const STATUS_LABEL: Record<SupplierStatus, string> = {
  CANDIDATE: "Кандидат",
  QUALIFIED: "Квалифицирован",
  CONTACTED: "Запрос отправлен",
  REPLIED: "Ответил",
  QUOTED: "Прислал прайс",
  NEGOTIATING: "Переговоры",
  ACTIVE: "Работаем",
  MANUAL_REVIEW: "Ручная проверка",
  ON_HOLD: "Пауза",
  REJECTED: "Отклонён",
};
