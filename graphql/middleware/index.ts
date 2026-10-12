// Admin guards
export { adminContextGuard } from "./adminContextGuard.middleware.js";
export { adminJwtGuard } from "./adminJwtGuard.middleware.js";

// User guards
export { myProfileGuard } from "./myProfileGuard.middleware.js";
export { isAuthenticatedGuard } from "./isAuthenticatedGuard.middleware.js";
export { isProfileCompleteGuard } from "./isProfileCompleteGuard.middleware.js";

// Role checker (use this for role-based access control)
// Usage: roleCheckerMiddleware("GraphQL", "MASTER_ADMIN", "MANAGER")
export { roleCheckerMiddleware } from "@middleware/user/protect/index.js";
