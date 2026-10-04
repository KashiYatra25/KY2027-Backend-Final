import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper";

export type AdminSuspendRequestWithTargetUser =
  AuthenticatedUserRequestWithVerifiedEmail & {
    targetAdmin: {
      targetUserId: string;
      targetAdminId: string;
      targetRole: "MANAGER" | "OPERATOR";
    };
  };
