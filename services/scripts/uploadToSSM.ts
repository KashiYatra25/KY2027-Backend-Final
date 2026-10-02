#!/usr/bin/env npx tsx

/**
 * Upload environment variables to AWS SSM Parameter Store
 *
 * Usage:
 *   npx tsx scripts/uploadToSSM.ts --env production --region ap-south-1
 *   npx tsx scripts/uploadToSSM.ts --env staging --region ap-south-1 --dry-run
 *
 * Options:
 *   --env       Environment name (production, staging, development)
 *   --region    AWS region (default: ap-south-1)
 *   --dry-run   Preview changes without uploading
 *   --prefix    SSM path prefix (default: /kashiyatra/backend)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import {
  parseArgs,
  parseEnvFile,
  processEnvVars,
  displayParams,
  uploadToSSM,
  displaySummary,
  waitForConfirmation,
} from "./ssm/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const args = parseArgs();

  // Display configuration
  console.log("\n🔧 AWS SSM Parameter Upload (Backend)");
  console.log("═".repeat(50));
  console.log(`Environment: ${args.env}`);
  console.log(`Region:      ${args.region}`);
  console.log(`Prefix:      ${args.prefix}`);
  console.log(`Dry Run:     ${args.dryRun ? "Yes" : "No"}`);
  console.log("═".repeat(50));

  // Find .env file
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) {
    console.error("❌ .env file not found at:", envPath);
    process.exit(1);
  }

  // Parse and process env vars
  const envVars = parseEnvFile(envPath);
  const { toUpload, skipped } = processEnvVars(envVars, args.prefix, args.env);

  // Display what will be uploaded
  displayParams(toUpload, skipped);

  // Dry run - stop here
  if (args.dryRun) {
    console.log("\n✅ Dry run complete. No changes made.");
    return;
  }

  // Wait for confirmation
  await waitForConfirmation(toUpload.length);

  // Upload parameters
  console.log("📤 Uploading parameters...\n");
  const { successCount, errorCount } = await uploadToSSM(toUpload, args);

  // Display summary
  displaySummary(successCount, errorCount, skipped.length);

  // Exit with error if any uploads failed
  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
