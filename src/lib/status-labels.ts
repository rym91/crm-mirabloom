import type { SupplierStatus } from "@prisma/client";

/** Человеческие подписи статусов (RU). Совпадают с колонками пайплайна. */
export const STATUS_LABEL: Record<SupplierStatus, string> = {
  CANDIDATE: "Кандидат",
  QUALIFIED: "Квалиф. — email/форма",
  CONTACTED: "Запрос отправлен",
  REPLIED: "Ответил",
  QUOTED: "Прислал прайс",
  NEGOTIATING: "Жду доступ на сайт",
  ACTIVE: "Проверяем прайс",
  MANUAL_REVIEW: "Ручная проверка",
  ON_HOLD: "Пауза",
  REJECTED: "Отклонён",
};
