// Admin auth
export {
  confirmAdminOnboarding,
  refreshAdminToken,
  adminLogout,
  getAdminSession,
  adminLogin,
} from "./auth/index.js";

// CA management
export { getCaApplications } from "./ca/getCaApplications.controller.js";
export { approveCaApplication } from "./ca/approveCaApplication.controller.js";

// Coupon management
export { createCoupon } from "./coupon/createCoupon.controller.js";

// Admin invite
export { makeUserAdminOrPromoteAdmin } from "./promote/makeUserAdminOrPromoteAdmin.controller.js";

// Account suspension
export { suspendAccount } from "./suspend/suspendAccount.controller.js";

// User management
export { getAdminUsers } from "./users/getAdminUsers.controller.js";
