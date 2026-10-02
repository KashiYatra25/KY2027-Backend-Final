import { DEFAULT_CONFIG } from "./config.js";
import type { CliArgs } from "./types.js";

/**
 * Parse command line arguments
 */
export function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    env: DEFAULT_CONFIG.env,
    region: DEFAULT_CONFIG.region,
    dryRun: false,
    prefix: DEFAULT_CONFIG.prefix,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--env":
        result.env = getRequiredValue(arg, nextArg);
        i += 2;
        break;

      case "--region":
        result.region = getRequiredValue(arg, nextArg);
        i += 2;
        break;

      case "--prefix":
        result.prefix = getRequiredValue(arg, nextArg);
        i += 2;
        break;

      case "--dry-run":
        result.dryRun = true;
        i += 1;
        break;

      case "--help":
      case "-h":
        printHelp();
        process.exit(0);

      default:
        console.warn(`Unknown argument: ${arg}`);
        i += 1;
        break;
    }
  }

  return result;
}

/**
 * Get required value for a flag, throw if missing
 */
function getRequiredValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    console.error(`Error: ${flag} requires a value`);
    process.exit(1);
  }
  return value;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Upload environment variables to AWS SSM Parameter Store

Usage:
  npx tsx scripts/uploadToSSM.ts --env production --region ap-south-1

Options:
  --env       Environment name (production, staging, development)
  --region    AWS region (default: ${DEFAULT_CONFIG.region})
  --prefix    SSM path prefix (default: ${DEFAULT_CONFIG.prefix})
  --dry-run   Preview changes without uploading
  --help      Show this help message

Examples:
  npx tsx scripts/uploadToSSM.ts --env production --region ap-south-1 --dry-run
  npx tsx scripts/uploadToSSM.ts --env staging --prefix /ky/backend
  `);
}
