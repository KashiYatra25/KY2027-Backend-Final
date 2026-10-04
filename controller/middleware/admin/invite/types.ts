import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper";

export type AdminInviteRequestWithTargetUser =
  AuthenticatedUserRequestWithVerifiedEmail & {
    targetAdminUser: {
      targetUserId: string;
      targetRole: "MANAGER" | "OPERATOR";
    };
  };
