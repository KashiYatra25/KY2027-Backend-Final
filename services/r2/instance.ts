import { R2Manager } from "./manager.js";
import { env } from "@root/lib/env/environment.js";

// ═══════════════════════════════════════════════════════════════════
// R2 MANAGER SINGLETON
// 
// Single instance of R2Manager for the entire application.
// Import this wherever you need R2 storage access.
// ═══════════════════════════════════════════════════════════════════

export const r2 = new R2Manager(
  env.R2_ACCOUNT_ID,
  env.R2_ACCESS_KEY_ID,
  env.R2_SECRET_ACCESS_KEY,
  env.R2_BUCKET_NAME,
  env.R2_PUBLIC_URL,
);
