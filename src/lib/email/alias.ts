/** Домен для form-alias (lead-<supplierId>@<домен>), из MAIL_FROM / SMTP_USER. */
export function aliasDomain(): string {
  return (process.env.MAIL_FROM || process.env.SMTP_USER || "@mirabloom.eu").match(/@([^>\s]+)/)?.[1] || "mirabloom.eu";
}

/** Адрес-алиас поставщика: его вставляют в email-поле контактной формы, чтобы ответ
 *  подтянулся к карточке (см. extractSupplierAlias в resolve.ts + catch-all на домене). */
export function supplierAlias(supplierId: string): string {
  return `lead-${supplierId}@${aliasDomain()}`;
}
