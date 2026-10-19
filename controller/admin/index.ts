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
export { updateCaApplicationStatus } from "./ca/updateCaApplicationStatus.controller.js";

// Admin invite
export { makeUserAdminOrPromoteAdmin } from "./promote/makeUserAdminOrPromoteAdmin.controller.js";

// Account status change (suspend/reactivate)
export { changeAccountStatus } from "./suspend/changeAccountStatus.controller.js";

// User management
export { getAdminUsers } from "./users/getAdminUsers.controller.js";

// Team management
export { getAllTeams } from "./teams/index.js";

// Registration management
export { getAllRegistrations } from "./registrations/index.js";
