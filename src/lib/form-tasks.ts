// Bulk-создание задач FILL_FORM для form-only поставщиков (есть contactFormUrl, нет email-контакта,
// ранняя стадия). Переиспользуют UI-экшен /tasks и /api/import?type=form-tasks. Без revalidate здесь.
import { prisma } from "@/lib/prisma";
import { FORM_TAG, formAlias, formTaskBody } from "@/lib/form-outreach";

export async function createFormTasksCore(): Promise<{ tagged: number; created: number }> {
  const domain = (process.env.SMTP_USER || "hello@mirabloom.eu").split("@")[1] || "mirabloom.eu";
  const suppliers = await prisma.supplier.findMany({
    where: {
      contactFormUrl: { not: null },
      status: { in: ["CANDIDATE", "QUALIFIED"] },
      contacts: { none: { email: { not: null } } },
    },
    include: { brands: { include: { brand: { select: { name: true } } } } },
  });
  const tag = await prisma.tag.upsert({ where: { name: FORM_TAG }, update: {}, create: { name: FORM_TAG } });

  let tagged = 0;
  let created = 0;
  for (const s of suppliers) {
    await prisma.supplierTag.upsert({
      where: { supplierId_tagId: { supplierId: s.id, tagId: tag.id } },
      update: {},
      create: { supplierId: s.id, tagId: tag.id },
    });
    tagged++;
    const open = await prisma.task.findFirst({
      where: { kind: "FILL_FORM", entityType: "SUPPLIER", entityId: s.id, status: { not: "DONE" } },
    });
    if (open) continue;
    const brandNames = s.brands.map((b) => b.brand.name);
    await prisma.task.create({
      data: {
        title: `Форма: ${brandNames[0] ?? s.name}`,
        description: formTaskBody(s.name, brandNames, s.contactFormUrl, formAlias(s.id, domain)),
        kind: "FILL_FORM",
        status: "TODO",
        entityType: "SUPPLIER",
        entityId: s.id,
      },
    });
    created++;
  }
  return { tagged, created };
}
