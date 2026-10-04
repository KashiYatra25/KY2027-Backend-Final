import type { AuthenticatedUserRequestWithVerifiedEmail } from "@root/utils/helper/auth.types.helper";

export type AdminAuthRequestWithAdminData =
  AuthenticatedUserRequestWithVerifiedEmail & {
    adminData: {
      adminId: string;
      hashedPassword: string;
    };
  };
