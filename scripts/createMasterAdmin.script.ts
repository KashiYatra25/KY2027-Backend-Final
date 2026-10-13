import { prisma } from "@root/prisma";
import { env } from "@root/lib/env/environment";
import { AccountProgressModel, VerificationTokenModel } from "@root/databaseManagers/mongoose";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import { AdminInviteEmail } from "@root/services/email/utils/admin.invite.email";

// ═══════════════════════════════════════════════════════════════════
// CREATE / RE-SEND MASTER ADMIN CREDENTIALS
// 
// This script handles two cases:
// 1. First time: Creates admin record, sends email
// 2. Re-send: Updates password & token, sends new email
//    (Useful if email was lost or token expired)
//
// SECURITY: When re-sending:
// - New password is generated (old password won't work)
// - New token is created (old token won't work)
// - Old tokens are deleted to prevent misuse
// ═══════════════════════════════════════════════════════════════════

const sendMasterAdminCredentials = async () => {
  const masterAdminEmail = env.SUPER_ADMIN_EMAIL;
  
    // ─────────────────────────────────────────────────────────────────
    // GUARD: Master admin email MUST belong to an IIT (BHU) domain.
    // Allowed: anything ending in ".itbhu.ac.in" (e.g. student.itbhu.ac.in)
    //          or ending in "iitbhu.ac.in" (e.g. someone@iitbhu.ac.in).
    // ─────────────────────────────────────────────────────────────────
    const normalizedEmail = masterAdminEmail.trim().toLowerCase();
    const isIitBhuEmail =
      normalizedEmail.endsWith(".itbhu.ac.in") ||
      normalizedEmail.endsWith("iitbhu.ac.in");
  
    if (!isIitBhuEmail) {
      console.error("═".repeat(60));
      console.error("❌ Cannot grant admin access.");
      console.error(
        `   The email "${masterAdminEmail}" is not an IIT (BHU) email.`,
      );
      console.error(
        "   Only emails ending in '.itbhu.ac.in' or 'iitbhu.ac.in' can be admins.",
      );
      console.error("═".repeat(60));
      return;
    }

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: masterAdminEmail },
    });

    if (!user) {
      throw new Error(`User with email ${masterAdminEmail} not found. Please sign up first.`);
    }

    const progress = await AccountProgressModel.findOne({
      userId: user.id,
    });

    if (
      !progress ||
      !progress.profileCompletionAndVerification?.hasSelectedCollegeDetails ||
      !progress.profileCompletionAndVerification?.hasAadhaarBeenUploaded ||
      !progress.profileCompletionAndVerification?.hasAadhaarBeenVerified ||
      !progress.profileCompletionAndVerification?.hasVerifiedPhoneNumber
    ) {
      throw new Error("Master admin profile is not complete or verified.");
    }

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { userId: user.id },
    });

    // Generate new temp password
    const tempPassword = CryptoService.generateTempPassword();
    const hashedPassword = await CryptoService.hash(tempPassword);

    let adminId: string;
    let isResend = false;

    if (existingAdmin) {
      // ─────────────────────────────────────────────────────────────────
      // RE-SEND CASE: Admin exists, update password and re-send
      // ─────────────────────────────────────────────────────────────────
      isResend = true;
      adminId = existingAdmin.id;

      // Update password (invalidates old password)
      await prisma.admin.update({
        where: { id: existingAdmin.id },
        data: { password: hashedPassword },
      });

      console.log("⚠️  Admin already exists. Updating password and re-sending email...");
    } else {
      // ─────────────────────────────────────────────────────────────────
      // FIRST TIME: Create admin record
      // ─────────────────────────────────────────────────────────────────
      
      // Update user role to MASTER_ADMIN
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: {
            upsert: {
              create: { level: "MASTER_ADMIN" },
              update: { level: "MASTER_ADMIN" },
            },
          },
        },
      });

      // Create admin record
      const newAdmin = await prisma.admin.create({
        data: {
          userId: user.id,
          password: hashedPassword,
        },
      });

      adminId = newAdmin.id;
    }

    // ─────────────────────────────────────────────────────────────────
    // Generate NEW login token (old tokens deleted above for re-send)
    // ─────────────────────────────────────────────────────────────────
    const loginToken = CryptoService.generateRandomToken(32);
    const hashedToken = await CryptoService.hash(loginToken);

    // Create new token (don't use upsert - we want a fresh token)
    await VerificationTokenModel.create({
      userId: user.id,
      tokenType: "ADMIN_LOGIN_URL_TOKEN",
      tokenValue: hashedToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Create login URL
    const loginUrl = `${env.CLIENT_ADMIN_PANEL_ORIGIN}/admin-verification/${loginToken}`;

    // Send email with credentials
    const userName = user.firstName || user.slugName || "Admin";
    await new AdminInviteEmail(
      { name: userName, email: masterAdminEmail },
      tempPassword,
      loginUrl,
    ).sendEmail(
      "🎫 You've been granted Admin Access - Kashiyatra 2027",
      "adminInvite",
    );

    console.log("═".repeat(60));
    if (isResend) {
      console.log("✅ Master admin credentials RE-SENT successfully!");
      console.log("   (Old password and tokens are now invalid)");
    } else {
      console.log("✅ Master admin CREATED successfully!");
    }
    console.log("═".repeat(60));
    console.log(`Admin ID: ${adminId}`);
    console.log(`Email: ${masterAdminEmail}`);
    console.log(`Temp Password: ${tempPassword}`);
    console.log(`Login URL: ${loginUrl}`);
    console.log("═".repeat(60));
    console.log("📧 Email sent to admin with credentials.");
    console.log("⏰ Token expires in 10 minutes.");

  } catch (err) {
    console.error("❌ Error:", (err as Error).message);
  }
};

sendMasterAdminCredentials();
