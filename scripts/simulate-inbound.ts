process.loadEnvFile(".env");

// Usage: npx tsx scripts/simulate-inbound.ts [from] [subject] [messageId]
// Simulates what n8n will POST after IMAP receives a supplier reply.
async function main() {
  const [from = "info@pilot-es.com", subject = "Re: Wholesale account — PILOT for Spain & EU", messageId = `<sim-${Date.now()}@supplier.example>`] =
    process.argv.slice(2);
  const res = await fetch("http://localhost:3000/api/inbound-email", {
    method: "POST",
    headers: { "content-type": "application/json", "x-crm-secret": process.env.CRM_INBOUND_SECRET ?? "" },
    body: JSON.stringify({
      messageId,
      inReplyTo: null,
      from,
      subject,
      bodyText:
        "Hello, thanks for your interest. Please find attached our wholesale price list. MOQ 200 EUR. Best regards, Sales",
      attachmentNames: ["pricelist_2026.xlsx"],
    }),
  });
  console.log(res.status, JSON.stringify(await res.json(), null, 2));
}
main();
