import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const users = [
  { email: "admin@mirabloom.eu", name: "Администратор", role: "ADMIN" as const, pwEnv: "SEED_PW_ADMIN" },
  { email: "manager1@mirabloom.eu", name: "Менеджер 1", role: "MEMBER" as const, pwEnv: "SEED_PW_MANAGER1" },
  { email: "manager2@mirabloom.eu", name: "Менеджер 2", role: "MEMBER" as const, pwEnv: "SEED_PW_MANAGER2" },
];

// Шаблон запроса прайса (из FBA Spain 02_supplier_research.md §4.2). Плейсхолдеры {{...}}.
const RFQ_NAME = "RFQ — Wholesale price request";
const RFQ_SUBJECT = "Wholesale account enquiry — {{company}}, Amazon.es reseller ({{category}})";
const RFQ_BODY = `<p>Dear {{contact_or_team}},</p>
<p>My name is {{name}} from {{company}}, a VAT-registered retailer based in {{country}}
(VAT/EORI: {{vat}}). We sell {{category}} online in Spain and the wider EU, including on
Amazon.es, and we are looking to add reliable, long-term supply partners.</p>
<p>We are interested in your {{brand}} range and would like to open a wholesale account.
Could you please send:</p>
<ol>
  <li>Your current net (ex-VAT) wholesale price list / catalogue</li>
  <li>Minimum order quantity (per SKU and per order) and any volume price tiers</li>
  <li>Payment terms and accepted payment methods</li>
  <li>Current stock availability and typical lead time</li>
  <li>Confirmation that all units carry a scannable EAN/barcode</li>
  <li>Your return/defective policy and shipping terms (Incoterms)</li>
  <li>Standard commercial invoices with full company details, and (if applicable) a Letter of Authorization for the brand(s)</li>
</ol>
<p>We are ready to place a first order promptly and intend to reorder regularly.
Happy to share trade references or our company registration on request.</p>
<p>Best regards,<br/>{{name}} | {{title}}<br/>{{company}} — {{website}}<br/>{{phone}} | {{email}} | VAT: {{vat}}</p>`;

async function main() {
  for (const u of users) {
    const plain = process.env[u.pwEnv] ?? "change-me-now";
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, role: u.role, passwordHash: await bcrypt.hash(plain, 12) },
    });
  }
  console.log(`Seeded ${users.length} users.`);

  const existing = await prisma.emailTemplate.findFirst({ where: { name: RFQ_NAME } });
  if (!existing) {
    await prisma.emailTemplate.create({
      data: { name: RFQ_NAME, subject: RFQ_SUBJECT, bodyHtml: RFQ_BODY, followUpDays: 3 },
    });
    console.log("Seeded RFQ email template.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });