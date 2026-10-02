import { ParameterType } from "@aws-sdk/client-ssm";

export interface EnvVar {
  key: string;
  value: string;
  type: ParameterType;
  ssmName: string;
}

export interface CliArgs {
  env: string;
  region: string;
  dryRun: boolean;
  prefix: string;
}

export interface ParsedEnvVars {
  toUpload: EnvVar[];
  skipped: string[];
}
