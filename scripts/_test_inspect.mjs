import { readFileSync } from "fs";
import pg from "../node_modules/.pnpm/pg@8.23.0/node_modules/pg/lib/index.js";
const { Client } = pg;

// Read DATABASE_URL directly from the dev env file (avoids shell-sourcing quirks)
const envText = readFileSync(new URL("../secrets/.env.development", import.meta.url), "utf8");
const m = envText.match(/^DATABASE_URL=(.+)$/m);
const conn = m ? m[1].trim() : "";

const client = new Client({
  connectionString: conn,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const users = await client.query(`
    SELECT u.id, u.email, u."firstName", u."isPaidUser", u."isFromIITBhu",
           u."isSuspended", u."kyId", r.level AS role,
           a.id AS admin_id,
           cp."referralId", cp."numberOfReferrals",
           ca.id AS ca_app_id, ca.status AS ca_status
    FROM "User" u
    LEFT JOIN "Role" r ON r."userId" = u.id
    LEFT JOIN "Admin" a ON a."userId" = u.id
    LEFT JOIN "CaProfile" cp ON cp."userId" = u.id
    LEFT JOIN "CaApplication" ca ON ca."userId" = u.id
    ORDER BY u."createdAt" ASC
    LIMIT 40;
  `);
  console.log("USER_COUNT", users.rows.length);
  for (const u of users.rows) console.log("USER " + JSON.stringify(u));

  const admins = await client.query(`SELECT a.id, u.email, r.level FROM "Admin" a JOIN "User" u ON u.id=a."userId" LEFT JOIN "Role" r ON r."userId"=u.id;`);
  console.log("ADMIN_COUNT", admins.rows.length);
  for (const a of admins.rows) console.log("ADMIN " + JSON.stringify(a));

  const events = await client.query(`SELECT slug, "participationType", "registrationOpen", category FROM "Event" LIMIT 8;`);
  console.log("EVENT_COUNT", events.rows.length);
  for (const e of events.rows) console.log("EVENT " + JSON.stringify(e));

  const coupons = await client.query(`SELECT id, code, status FROM "Coupon" LIMIT 10;`);
  console.log("COUPON_COUNT", coupons.rows.length);
  for (const c of coupons.rows) console.log("COUPON " + JSON.stringify(c));
} catch (e) {
  console.error("ERR_FULL", e);
} finally {
  await client.end();
}
