import { prisma } from "@/lib/prisma";

/** AI class → supplier tag (name shown next to the supplier, color used by the Badge map). */
export const AI_CLASS_TAG: Record<string, { name: string; color: string }> = {
  PRICE_LIST: { name: "Прайс получен", color: "green" },
  QUESTION: { name: "Вопрос", color: "blue" },
  REJECTION: { name: "Отказ", color: "red" },
};

/** Idempotently tag a supplier based on an inbound message's AI class. OTHER is left untagged
 *  (the "new reply" indicator already covers generic replies). Safe to call repeatedly. */
export async function assignClassTag(supplierId: string, aiClass: string): Promise<void> {
  const def = AI_CLASS_TAG[aiClass];
  if (!def) return;
  const tag = await prisma.tag.upsert({
    where: { name: def.name },
    update: {},
    create: { name: def.name, color: def.color },
  });
  await prisma.supplierTag.upsert({
    where: { supplierId_tagId: { supplierId, tagId: tag.id } },
    update: {},
    create: { supplierId, tagId: tag.id },
  });
}
