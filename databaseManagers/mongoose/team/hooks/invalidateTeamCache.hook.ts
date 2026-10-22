/**
 * Post-save hook: when a team is created/updated, invalidate the cached
 * teams list AND registrations list for EVERY member (team membership
 * affects "my teams" and team-based "my registrations" for all members).
 */

import type { TeamDoc } from "@lib/mongo/team/team.model.js";
import {
  invalidateTeamsCache,
  invalidateRegistrationsCache,
} from "@root/services/redis/entityCache.service.js";

export async function invalidateTeamCacheHook(doc: TeamDoc): Promise<void> {
  try {
    const memberIds = doc.members.map((m) => m.userId);
    if (memberIds.length === 0) return;
    await invalidateTeamsCache(memberIds);
    await invalidateRegistrationsCache(memberIds);
  } catch {
    /* ignore — caching must never break writes */
  }
}
