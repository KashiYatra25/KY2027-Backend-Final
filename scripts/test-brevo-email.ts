/**
 * Test script for Brevo HTTP API email sending
 * 
 * Usage:
 *   BREVO_API_KEY=xkeysib-xxx npx tsx scripts/test-brevo-email.ts
 * 
 * Or set BREVO_API_KEY in your .env file and run:
 *   npx tsx scripts/test-brevo-email.ts
 */

import path from "path";
import { fileURLToPath } from "url";
import { create } from "express-handlebars";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const TEST_EMAIL = process.env.TEST_EMAIL || "invinciblecoder071723@gmail.com";
const EMAIL_FROM = process.env.EMAIL_FROM || "no-reply@kashiyatra.org";

// ═══════════════════════════════════════════════════════════════════
// HANDLEBARS ENGINE
// ═══════════════════════════════════════════════════════════════════

const hbsEngine = create({
  extname: ".handlebars",
  defaultLayout: false,
  partialsDir: path.join(__dirname, "../services/email/views/partials"),
});

// ═══════════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

async function testSimpleEmail(): Promise<void> {
  console.log("\n📧 Test 1: Simple HTML Email");
  console.log("─".repeat(50));

  const payload = {
    sender: { name: "Kashiyatra 2027", email: EMAIL_FROM },
    to: [{ email: TEST_EMAIL, name: "Srajan" }],
    subject: "🧪 Test Email - Brevo API Working!",
    htmlContent: `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #8B1538;">🎉 Brevo HTTP API Test Successful!</h1>
          <p>This email was sent using the <strong>Brevo HTTP API</strong> instead of SMTP.</p>
          <p>If you received this, the migration will work perfectly on Render free tier!</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">- Kashiyatra 2027 Backend</p>
        </body>
      </html>
    `,
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log("✅ Success! Message ID:", (data as { messageId: string }).messageId);
  } else {
    console.log("❌ Failed:", data);
  }
}

async function testTemplateEmail(): Promise<void> {
  console.log("\n📧 Test 2: Handlebars Template Email (adminInvite)");
  console.log("─".repeat(50));

  const templatePath = path.join(__dirname, "../services/email/views/adminInvite.handlebars");
  
  // Render the template
  const htmlContent = await hbsEngine.render(templatePath, {
    userName: "Srajan",
    email: TEST_EMAIL,
    tempPassword: "TestPass123!",
    loginUrl: "https://admin.kashiyatra.org/login",
  });

  const payload = {
    sender: { name: "Kashiyatra 2027", email: EMAIL_FROM },
    to: [{ email: TEST_EMAIL, name: "Srajan" }],
    subject: "🧪 Test - Admin Invite Template",
    htmlContent,
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log("✅ Success! Message ID:", (data as { messageId: string }).messageId);
  } else {
    console.log("❌ Failed:", data);
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         BREVO HTTP API EMAIL TEST                          ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  console.log("\n📋 Configuration:");
  console.log(`   API Key: ${BREVO_API_KEY ? BREVO_API_KEY.substring(0, 15) + "..." : "❌ NOT SET"}`);
  console.log(`   From: ${EMAIL_FROM}`);
  console.log(`   To: ${TEST_EMAIL}`);

  if (!BREVO_API_KEY) {
    console.log("\n❌ ERROR: BREVO_API_KEY is not set!");
    console.log("   Set it via environment variable:");
    console.log("   BREVO_API_KEY=xkeysib-xxx npx tsx scripts/test-brevo-email.ts");
    process.exit(1);
  }

  if (!BREVO_API_KEY.startsWith("xkeysib-")) {
    console.log("\n⚠️  WARNING: API key doesn't start with 'xkeysib-'");
    console.log("   SMTP keys (xsmtpsib-) won't work with the HTTP API!");
    console.log("   Generate an API key from: https://app.brevo.com/settings/keys/api");
  }

  try {
    await testSimpleEmail();
    await testTemplateEmail();
    
    console.log("\n" + "═".repeat(60));
    console.log("✅ All tests completed! Check your inbox at:", TEST_EMAIL);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main();
