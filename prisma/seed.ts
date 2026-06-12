import { PrismaClient, TemplateKind } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const users = [
  { email: "admin@mirabloom.eu", name: "Администратор", role: "ADMIN" as const, pwEnv: "SEED_PW_ADMIN" },
  { email: "manager1@mirabloom.eu", name: "Менеджер 1", role: "MEMBER" as const, pwEnv: "SEED_PW_MANAGER1" },
  { email: "manager2@mirabloom.eu", name: "Менеджер 2", role: "MEMBER" as const, pwEnv: "SEED_PW_MANAGER2" },
];

const TEMPLATES: { kind: TemplateKind; name: string; subject: string; body: string; followUpDays: number | null }[] = [
  {
    kind: "INTRO",
    name: "v2 Intro — wholesale account",
    subject: "Wholesale account — {{brand}} for Spain & EU",
    followUpDays: 3,
    body: `Hi {{contact_name_or_team}},

{{opening_hook}}

I'm Tetiana from Mirabloom (mirabloom.eu) — a VAT-registered retailer in Spain selling through our own store and the main EU marketplaces. We'd like to add {{brand}} to our range and become a regular, reordering account.

Could you tell me who looks after wholesale/trade accounts, and send your line sheet or catalogue? We're happy to work within your pricing and channel policies.

Thanks very much,
Tetiana Rymarova
Mirabloom · mirabloom.eu · VAT ESY9616676E`,
  },
  {
    kind: "FOLLOWUP_1",
    name: "v2 Follow-up #1 (+3d)",
    subject: "Re: Wholesale account — {{brand}} for Spain & EU",
    followUpDays: 7,
    body: `Hi {{contact_name_or_team}},

Just following up — we're ready to place a first {{brand}} order and reorder regularly. If you can point me to your line sheet, or the right person for trade accounts, I'll take it from there. Happy to share our company registration and trade references.

Thanks!
Tetiana — Mirabloom`,
  },
  {
    kind: "FOLLOWUP_2",
    name: "v2 Follow-up #2 (+7d, breakup)",
    subject: "Re: Wholesale account — {{brand}} for Spain & EU",
    followUpDays: null,
    body: `Hi {{contact_name_or_team}},

Last note from me on this — if {{brand}} wholesale isn't something you handle, could you forward this to the right contact or distributor? Otherwise I'll close it off for now and circle back another time. Thanks for your time either way.

Best regards,
Tetiana Rymarova
Mirabloom · mirabloom.eu`,
  },
  {
    kind: "QUALIFICATION",
    name: "v2 Qualification (after reply)",
    subject: "Re: Wholesale account — {{brand}} for Spain & EU",
    followUpDays: null,
    body: `Hi {{contact_name_or_team}},

Thanks for getting back to me. To set up the account and prepare a first order, could you share:

1. Current net (ex-VAT) wholesale price list / catalogue
2. MOQ (per SKU and per order) and any volume tiers
3. Payment terms and accepted methods
4. Returns policy and shipping terms (Incoterms)
5. Confirmation that units carry a scannable EAN/barcode

We're VAT-registered in Spain (ESY9616676E) and can provide company registration and trade references. If {{brand}} requires a signed reseller/authorization form, send it over and I'll complete it.

Looking forward to placing the first order.

Best regards,
Tetiana Rymarova
Mirabloom · mirabloom.eu · VAT ESY9616676E`,
  },
];

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

  await prisma.emailTemplate.deleteMany({ where: { kind: { notIn: TEMPLATES.map((t) => t.kind) } } });
  for (const t of TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { kind: t.kind },
      update: { name: t.name, subject: t.subject, bodyHtml: t.body, followUpDays: t.followUpDays },
      create: { kind: t.kind, name: t.name, subject: t.subject, bodyHtml: t.body, followUpDays: t.followUpDays },
    });
  }
  console.log(`Seeded ${TEMPLATES.length} v2 email templates.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });