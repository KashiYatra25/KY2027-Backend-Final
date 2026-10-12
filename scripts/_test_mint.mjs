import { readFileSync } from "fs";

// Resolve deps from the project's node_modules
const njwt = await import(
  "../node_modules/.pnpm/next-auth@4.24.15_next@16.3.6_@types+node@25.9.8_react-dom@19.3.0_react@19.3.0__react@1_44986fe23de842b4863a1caff390ed3f/node_modules/next-auth/jwt/index.js"
);
const jwtMod = await import(
  "../node_modules/.pnpm/jsonwebtoken@9.0.3/node_modules/jsonwebtoken/index.js"
);
const jwt = jwtMod.default ?? jwtMod;

const envText = readFileSync(new URL("../secrets/.env.development", import.meta.url), "utf8");
const getEnv = (k) => {
  const m = envText.match(new RegExp("^" + k + "=(.+)$", "m"));
  return m ? m[1].trim() : "";
};

const JWT_SECRET = getEnv("JWT_SECRET");
const ADMIN_ACCESS_SECRET = getEnv("ADMIN_JWT_ACCESS_SECRET");

// ── User session token (NextAuth) for the paid IIT-BHU USER ──
const USER = { id: "115173442953905602909", email: "srajan.student.mec23@itbhu.ac.in" };
const sessionToken = await njwt.encode({
  token: { id: USER.id, email: USER.email, name: "Srajan", sub: USER.id },
  secret: JWT_SECRET,
});
console.log("USER_SESSION_TOKEN " + sessionToken);

// ── Admin access token (signed exactly like generateAdminTokens) ──
const ADMIN = {
  userId: "101799029423140078413",
  adminId: "95521018-e0f2-43f1-9a46-d72e03f8afd0",
  email: "invinciblecoder071723@gmail.com",
  role: "MASTER_ADMIN",
};
const adminAccess = jwt.sign(ADMIN, ADMIN_ACCESS_SECRET, {
  expiresIn: "1h",
  jwtid: "access_test_" + Date.now(),
  issuer: "kashiyatra-admin",
  subject: ADMIN.adminId,
});
console.log("ADMIN_ACCESS_TOKEN " + adminAccess);
