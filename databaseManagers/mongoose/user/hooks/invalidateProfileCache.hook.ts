/**
 * Post-save hook: invalidate the cached `myAccount` (profile) response
 * whenever a user's AccountProgress changes.
 *
 * Covers every progress write that uses `.save()`:
 * college/phone update, identity-method selection, manual/aadhaar
 * verification, suspend/reactivate, and progress creation on auth.
 */

import type { AccountProgressDoc } from "@lib/mongo/user/accountProgress.model.js";
import { invalidateProfileCache } from "@root/services/redis/entityCache.service.js";

export async function invalidateProfileCacheHook(
  doc: AccountProgressDoc,
): Promise<void> {
  // entityCache never throws, but guard anyway so a hook error can't
  // break the main save operation.
  try {
    await invalidateProfileCache(doc.userId);
  } catch {
    /* ignore — caching must never break writes */
  }
}
