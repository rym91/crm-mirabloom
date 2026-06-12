process.loadEnvFile(".env");
import { sendEmail, generateMessageId } from "../src/lib/email/send";

async function main() {
  const res = await sendEmail({
    to: "fake-distributor@example.com", // will be redirected by TEST MODE
    subject: "CRM smoke test",
    text: "Это тестовое письмо из CRM (Layer 2 smoke). Реальный получатель: fake-distributor@example.com.",
    messageId: generateMessageId("smoketoken"),
  });
  console.log(JSON.stringify(res, null, 2));
  if (!res.ok) process.exit(1);
  if (!res.testMode) {
    console.error("FATAL: testMode is OFF — check EMAIL_TEST_MODE");
    process.exit(2);
  }
}
main();
