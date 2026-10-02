import path, { join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

import dotenv from "dotenv";
import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import { EnvironmentConfig } from "./config.js";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Find project root - works for both source (lib/env/) and compiled (JS/lib/env/)
function findProjectRoot(): string {
  let currentDir = dirname;
  
  // Walk up until we find package.json or secrets folder
  for (let i = 0; i < 5; i++) {
    const secretsPath = join(currentDir, "secrets");
    if (existsSync(secretsPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  // Fallback - assume 2 levels up from lib/env
  return join(dirname, "../..");
}

const projectRoot = findProjectRoot();
const envFilePath = join(projectRoot, "secrets", ".env.development");

// Load .env file for development
dotenv.config({ path: envFilePath });

type Environments = "development" | "test" | "production";

class RuntimeManager {
  private prefix: string;
  private availabilityZone: string;
  private environment: Environments;

  public constructor() {
    this.prefix = EnvironmentConfig.parametersPrefix;
    this.availabilityZone = EnvironmentConfig.availabilityZone;
    this.environment = (process.env.NODE_ENV as Environments) || "development";
  }

  private async loadFromSSM(): Promise<Record<string, string>> {
    const client = new SSMClient({
      region: this.availabilityZone,
    });

    const prefix = `${this.prefix}/${this.environment}/`;
    const params: Record<string, string> = {};

    let nextToken: string | undefined;

    do {
      const command = new GetParametersByPathCommand({
        Path: prefix,
        WithDecryption: true,
        Recursive: false,
        NextToken: nextToken,
      });

      const response = await client.send(command);

      if (response.Parameters) {
        for (const param of response.Parameters) {
          if (param.Name && param.Value) {
            // Extract the key name from the full path
            // e.g., /kashiyatra/backend/production/DATABASE_URL -> DATABASE_URL
            const key = param.Name.replace(prefix, "");
            params[key] = param.Value;
          }
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return params;
  }

  async getRuntimeConfig() {
    console.log("NODE_ENV:", this.environment);
    let runTimeEnv: Record<string, any>;

    switch (this.environment) {
      case "production":
      case "test":
        try {
          console.log(
            `Loading environment from AWS SSM (${this.environment})...`
          );
          runTimeEnv = await this.loadFromSSM();
          console.log(
            `Loaded ${Object.keys(runTimeEnv).length} parameters from SSM`
          );
        } catch (error) {
          console.error(
            "Failed to load from SSM, falling back to process.env:",
            error
          );
          runTimeEnv = process.env;
        }
        break;

      case "development":
      default:
        runTimeEnv = process.env;
        break;
    }

    return { runTimeEnv };
  }
}

export { RuntimeManager, type Environments };
