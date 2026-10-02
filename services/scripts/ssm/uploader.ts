import {
  SSMClient,
  PutParameterCommand,
  ParameterType,
} from "@aws-sdk/client-ssm";
import type { EnvVar, CliArgs } from "./types.js";

/**
 * Display parameters that will be uploaded
 */
export function displayParams(toUpload: EnvVar[], skipped: string[]): void {
  console.log("\n📋 Parameters to upload:");
  console.log("-".repeat(50));

  for (const param of toUpload) {
    const typeLabel = getTypeLabel(param.type);
    const valuePreview = getValuePreview(param);

    console.log(`  ${typeLabel} ${param.ssmName}`);
    console.log(`           └─ ${valuePreview}`);
  }

  if (skipped.length > 0) {
    console.log("\n⏭️  Skipped variables:");
    for (const key of skipped) {
      console.log(`  - ${key}`);
    }
  }
}

/**
 * Get display label for parameter type
 */
function getTypeLabel(type: ParameterType): string {
  switch (type) {
    case ParameterType.SECURE_STRING:
      return "🔐 SecureString";
    case ParameterType.STRING:
      return "📝 String";
    case ParameterType.STRING_LIST:
      return "📋 StringList";
    default:
      return "❓ Unknown";
  }
}

/**
 * Get preview of value (mask sensitive data)
 */
function getValuePreview(param: EnvVar): string {
  switch (param.type) {
    case ParameterType.SECURE_STRING:
      return "********";
    default:
      return param.value.length > 30
        ? param.value.slice(0, 30) + "..."
        : param.value;
  }
}

/**
 * Upload parameters to SSM
 */
export async function uploadToSSM(
  toUpload: EnvVar[],
  args: CliArgs
): Promise<{ successCount: number; errorCount: number }> {
  const ssm = new SSMClient({ region: args.region });

  let successCount = 0;
  let errorCount = 0;

  for (const param of toUpload) {
    try {
      const command = new PutParameterCommand({
        Name: param.ssmName,
        Value: param.value,
        Type: param.type,
        Overwrite: true,
        Description: `${param.key} for Kashi Yatra backend (${args.env})`,
      });

      await ssm.send(command);
      console.log(`  ✅ ${param.ssmName}`);
      successCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`  ❌ ${param.ssmName}: ${message}`);
      errorCount++;
    }
  }

  return { successCount, errorCount };
}

/**
 * Display upload summary
 */
export function displaySummary(
  successCount: number,
  errorCount: number,
  skippedCount: number
): void {
  console.log("\n" + "═".repeat(50));
  console.log("📊 Summary:");
  console.log(`   ✅ Uploaded: ${successCount}`);
  console.log(`   ❌ Failed:   ${errorCount}`);
  console.log(`   ⏭️  Skipped:  ${skippedCount}`);
  console.log("═".repeat(50) + "\n");
}

/**
 * Wait for user confirmation (3 second delay)
 */
export async function waitForConfirmation(count: number): Promise<void> {
  console.log(`\n⚠️  About to upload ${count} parameters to SSM.`);
  console.log("   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n");
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
