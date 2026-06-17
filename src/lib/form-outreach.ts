// Form-only suppliers: брендов, у которых нет публичного email-дистрибьютора и контакт идёт
// только через веб-форму бренда. Менеджер заполняет форму, в поле email вписывает alias
// lead-<supplierId>@<домен> — ответ через catch-all привяжется автоматически (см. inbound-email).

export const FORM_TAG = "outreach:form";

/** Поставщик достижим только формой: есть contactFormUrl и нет ни одного email-контакта. */
export function isFormOnly(hasContactFormUrl: boolean, hasEmailContact: boolean): boolean {
  return hasContactFormUrl && !hasEmailContact;
}

/** Alias для поля email в форме бренда. */
export function formAlias(supplierId: string, domain: string): string {
  return `lead-${supplierId}@${domain}`;
}

/** Текст задачи менеджеру на заполнение формы. */
export function formTaskBody(
  supplierName: string,
  brandNames: string[],
  formUrl: string | null,
  alias: string
): string {
  const brands = brandNames.length ? brandNames.join(", ") : supplierName;
  return [
    `Заполнить B2B-форму бренда: ${brands}`,
    formUrl ? `Форма: ${formUrl}` : "Форма: см. карточку поставщика (contactFormUrl)",
    "",
    `В поле «ваш email» укажи: ${alias}`,
    "(так ответ автоматически привяжется к этому поставщику)",
    "",
    "Запросить: net-прайс ex-VAT · MOQ · условия оплаты · сроки/наличие · EAN на каждой единице · корректный VAT-инвойс · (если есть) LoA для бренда.",
  ].join("\n");
}
