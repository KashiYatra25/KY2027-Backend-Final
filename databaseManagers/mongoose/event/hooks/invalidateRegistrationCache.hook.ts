/**
 * Post-save hook: when an event registration is created or its status
 * changes (e.g. cancelled via `.save()`), invalidate the cached
 * registrations list for the affected user(s).
 *
 * - Individual registration → the single `userId`.
 * - Team registration → every member of the team (resolved lazily to
 *   avoid a circular import with team.model).
 */

import type { EventRegistrationDoc } from "@lib/mongo/event/eventRegistration.model.js";
import { invalidateRegistrationsCache } from "@root/services/redis/entityCache.service.js";

export async function invalidateRegistrationCacheHook(
  doc: EventRegistrationDoc,
): Promise<void> {
  try {
    if (doc.userId) {
      await invalidateRegistrationsCache(doc.userId);
      return;
    }

    if (doc.teamId) {
      // Lazy import breaks the eventRegistration <-> team model import cycle.
      const { TeamModel } = await import("@lib/mongo/team/team.model.js");
      const team = await TeamModel.findOne({ teamId: doc.teamId })
        .select("members.userId")
        .lean();
      const memberIds = team?.members.map((m) => m.userId) ?? [];
      if (memberIds.length > 0) {
        await invalidateRegistrationsCache(memberIds);
      }
    }
  } catch {
    /* ignore — caching must never break writes */
  }
}
