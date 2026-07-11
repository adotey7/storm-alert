/**
 * Smoke test: sends all new SMS message templates to a given phone number.
 *
 * Usage:
 *   bun run scripts/smoke-test-sms.ts <phone>
 *
 * Example:
 *   bun run scripts/smoke-test-sms.ts 0533420555
 */

import { config } from "dotenv";

config({ path: ".env" });

const API_KEY = process.env.ARKESEL_API_KEY;
const BASE_URL = process.env.ARKESEL_API_BASE_URL ?? "https://sms.arkesel.com";
const SENDER_ID = process.env.ARKESEL_SENDER_ID ?? "StormGH";

function toArkeselRecipient(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return "233" + digits.slice(1);
  }
  return digits.replace(/^\+/, "");
}

async function sendSms(recipient: string, message: string): Promise<void> {
  console.log(`\n--- Sending ---`);
  console.log(`To: ${recipient}`);
  console.log(`Message: ${message}`);
  console.log(`Length: ${message.length} chars`);

  const response = await fetch(`${BASE_URL}/api/v2/sms/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": API_KEY!,
    },
    body: JSON.stringify({
      sender: SENDER_ID,
      message,
      recipients: [toArkeselRecipient(recipient)],
    }),
  });

  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    console.error(`FAILED (${response.status})`);
    console.error(JSON.stringify(body, null, 2));
    return;
  }

  console.log(`OK (${response.status})`);
  console.log(`Response: ${JSON.stringify(body)}`);
}

async function main() {
  const phone = process.argv[2];

  if (!phone) {
    console.error("Usage: bun run scripts/smoke-test-sms.ts <phone>");
    process.exit(1);
  }

  if (!API_KEY) {
    console.error("ARKESEL_API_KEY not set in .env");
    process.exit(1);
  }

  console.log("=== StormAlert GH SMS Smoke Test ===");
  console.log(`Recipient: ${phone}`);
  console.log(`Sender ID: ${SENDER_ID}`);
  console.log(`Base URL: ${BASE_URL}`);

  // 1. OTP verification message
  await sendSms(
    phone,
    "StormAlert GH: Your verification code is 123456. It expires in 10 minutes. Do not share this code with anyone.",
  );

  // 2. Alert area update message
  await sendSms(
    phone,
    "StormAlert GH: Use code 123456 to update your flood alert location. This code expires in 10 minutes. If you did not request this, ignore this message.",
  );

  // 3. Weather alert — rainfall
  await sendSms(
    phone,
    "StormAlert GH: Weather alert for Greater Accra. Heavy rain expected (24mm in 1 hour). Avoid flood-prone areas and stay indoors if possible. Stop alerts: https://storm-alert.gh/unsubscribe",
  );

  // 4. Weather alert — thunderstorm
  await sendSms(
    phone,
    "StormAlert GH: Weather alert for Greater Accra. Thunderstorm expected. Stay indoors and avoid open areas. Stop alerts: https://storm-alert.gh/unsubscribe",
  );

  // 5. Weather alert — wind
  await sendSms(
    phone,
    "StormAlert GH: Weather alert for Greater Accra. Strong winds expected (up to 61 km/h). Secure loose objects and stay indoors if possible. Stop alerts: https://storm-alert.gh/unsubscribe",
  );

  // 6. Weather alert — rain probability
  await sendSms(
    phone,
    "StormAlert GH: Weather alert for Greater Accra. Rain likely (85% chance). Prepare for possible flooding in low-lying areas. Stop alerts: https://storm-alert.gh/unsubscribe",
  );

  // 7. Catchment flood alert — upstream rain
  await sendSms(
    phone,
    "StormAlert GH: Flood alert for Odaw/Dome Bridge area. Heavy rain upstream (Aburi Ridge) may cause flooding. Move to higher ground and avoid crossing flooded roads. Stop alerts: https://storm-alert.gh/unsubscribe",
  );

  // 8. Catchment flood alert — local rain
  await sendSms(
    phone,
    "StormAlert GH: Flood alert for Odaw/Dome Bridge area. Very heavy rain locally (52mm over 3 hours) may cause flooding. Move to higher ground and avoid crossing flooded roads. Stop alerts: https://storm-alert.gh/unsubscribe",
  );

  console.log("\n=== Done! Check your phone for 8 SMS messages. ===\n");
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
