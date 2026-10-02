import * as fs from "fs";
import { ParameterType } from "@aws-sdk/client-ssm";
import { SECURE_STRING_VARS, SKIP_VARS, NAME_OVERRIDES } from "./config.js";
import type { EnvVar, ParsedEnvVars } from "./types.js";

/**
 * Parse .env file and return key-value pairs
 */
export function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf-8");
  const vars: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Parse KEY=VALUE or KEY="VALUE" or KEY='VALUE'
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1]!;
      let value = (match[2] ?? "").trim();

      // Remove surrounding quotes if present
      const firstChar = value.charAt(0);
      const lastChar = value.charAt(value.length - 1);

      switch (true) {
        case firstChar === '"' && lastChar === '"':
        case firstChar === "'" && lastChar === "'":
          value = value.slice(1, -1);
          break;
      }

      vars[key] = value;
    }
  }

  return vars;
}

/**
 * Determine if a variable should be stored as SecureString
 */
function getParameterType(key: string): ParameterType {
  const isSecure = (SECURE_STRING_VARS as readonly string[]).includes(key);
  return isSecure ? ParameterType.SECURE_STRING : ParameterType.STRING;
}

/**
 * Get the SSM parameter name for a given env var
 */
function getSsmName(key: string, prefix: string, env: string): string {
  const baseName = NAME_OVERRIDES[key] ?? key;
  return `${prefix}/${env}/${baseName}`;
}

/**
 * Check if a variable should be skipped
 */
function shouldSkip(key: string): boolean {
  return (SKIP_VARS as readonly string[]).includes(key);
}

/**
 * Process env vars and prepare for upload
 */
export function processEnvVars(
  envVars: Record<string, string>,
  prefix: string,
  env: string
): ParsedEnvVars {
  const toUpload: EnvVar[] = [];
  const skipped: string[] = [];

  for (const [key, value] of Object.entries(envVars)) {
    // Check if should skip
    if (shouldSkip(key)) {
      skipped.push(key);
      continue;
    }

    // Check for empty value
    if (!value) {
      console.warn(`⚠️  Skipping ${key}: empty value`);
      skipped.push(key);
      continue;
    }

    toUpload.push({
      key,
      value,
      type: getParameterType(key),
      ssmName: getSsmName(key, prefix, env),
    });
  }

  return { toUpload, skipped };
}
