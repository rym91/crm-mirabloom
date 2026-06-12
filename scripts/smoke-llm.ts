process.loadEnvFile(".env");
import { classifyInbound } from "../src/lib/email/classify";
import { generateOpeningHook } from "../src/lib/email/hook";

async function main() {
  const cls = await classifyInbound({
    subject: "Re: Wholesale account — PILOT for Spain & EU",
    bodyText: "Hello, thanks for reaching out. Please find attached our current wholesale price list. MOQ is 200€ per order.",
    attachmentNames: ["PILOT_wholesale_2026.xlsx"],
  });
  console.log("classify:", JSON.stringify(cls));
  const hook = await generateOpeningHook({
    supplierName: "Comercial Arge, S.A.",
    brands: ["PILOT"],
    country: "ES",
    notes: "EXCLUSIVE/official PILOT distributor for all of Spain since 1980",
  });
  console.log("hook:", JSON.stringify(hook));
}
main();