import { prisma } from "@root/prisma";
import { env } from "@root/lib/env/environment";
import { AccountProgressModel } from "@root/databaseManagers/mongoose";
import { CryptoService } from "@root/utils/helper/crypto.encryption.helper";

const sendMasterAdminCredentials = async () => {
  const masterAdminEmail = env.MASTER_ADMIN_EMAIL;

  try {
    const progress = await AccountProgressModel.findOne({
      userId: masterAdminEmail,
    });
    if (
      !progress ||
      !progress.profileCompletionAndVerification!.hasSelectedCollegeDetails ||
      !progress.profileCompletionAndVerification!.hasAadhaarBeenUploaded ||
      !progress.profileCompletionAndVerification!.hasAadhaarBeenVerified ||
      !progress.profileCompletionAndVerification!.hasVerifiedPhoneNumber
    ) {
      throw new Error("Master admin profile is not complete or verified.");
    }

    // check does it alreaedy exist in prisma
    const existingAdmin = await prisma.admin.findUnique({
      where: { userId: masterAdminEmail },
    });

    if (existingAdmin) {
      throw new Error("Master admin already exists in the database.");
    }

    // genreate temp password
    const tempPassword = CryptoService.generateTempPassword();
    const hashedPassword = await CryptoService.hash(tempPassword);

    // create master admin in prisma
    const masterId = progress.userId;
    const updateUserRole = await prisma.user.update({
      where: { id: masterId },
      data: {
        role: {
          upsert: {
            create: { level: "MASTER_ADMIN" },
            update: { level: "MASTER_ADMIN" },
          },
        },
      },
    });

    if (!updateUserRole) {
      throw new Error("Failed to update user role to MASTER_ADMIN.");
    }
    const newAdmin = await prisma.admin.create({
      data: {
        userId: masterId,
        password: hashedPassword,
      },
    });

    if (!newAdmin) {
      throw new Error("Failed to create master admin in the database.");
    }

    // send email to master admin with temp password
    // await new SendAdminInviteEmail(
    //   { name: "Master Admin", email: masterAdminEmail },
    //   tempPassword,
    // ).SendEmail();

    // console.log("Master admin credentials sent successfully.");
  } catch (err) {
    console.error(
      "Error in creating or sending master admin credentials:",
      err,
    );
  }
  // check for profile completion and verification in mongo
};
