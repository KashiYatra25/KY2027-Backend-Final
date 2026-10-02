// import { SendAdminInviteEmail } from "@email/helpers/email.sender.js";
// import { CryptoService } from "@utils/helper/crypto.encryption.helper.js";
// import { AdminInviteSchemaType } from "@middleware/schemas/admin/adminInvite.schema.js";
// import { AdminSecurityStepperModel } from "databaseManagers/mongoose/security/adminAccountSecurity.model.js";
// import { VerificationTokenModel } from "databaseManagers/mongoose/security/verificationToken.model.js";
// import { prisma } from "../prisma.js"
// import { NextFunction, Response } from "express";
// import { catchAsync, VerifiedRequest } from "zodex-axon/core";
// import { BadRequest, InternalServerError } from "zodex-axon/errors";
// import { OkResponseStrategy } from "zodex-axon/responses";

// export const sendAdminInvite = catchAsync(
//   async (
//     req: VerifiedRequest<{ body: AdminInviteSchemaType }>,
//     res: Response,
//     next: NextFunction,
//   ): Promise<void> => {
//     const { email } = req.validatedData;

//     const existingAdminCreds = await prisma.adminAuthCreds.findUnique({
//       where: { userId: email },
//     });

//     if (existingAdminCreds) {
//       return next(
//         new BadRequest().handleResponse(res, {
//           info: "Admin invite already exists for this email",
//         }),
//       );
//     }

//     const tempPassword = CryptoService.generateTempPassword();
//     const hashedPassword = await CryptoService.hash(tempPassword);

//     const existingUser = await prisma.user.findUnique({
//       where: { email },
//       select: { id: true, firstName: true, lastName: true, avatarUrl: true },
//     });

//     if (existingUser) {
//       const [adminAuthCreds] = await Promise.all([
//         prisma.adminAuthCreds.create({
//           data: { userId: existingUser.id, hashedPassword },
//         }),
//         AdminSecurityStepperModel.create({
//           userId: existingUser.id,
//           hasEmailBeenAcknowledged: true,
//         }),
//       ]);

//       if (!adminAuthCreds) {
//         return next(
//           new InternalServerError().handleResponse(res, {
//             info: "Failed to create admin credentials",
//           }),
//         );
//       }

//       const userName =
//         [existingUser.firstName, existingUser.lastName]
//           .filter(Boolean)
//           .join(" ") || "Admin";

//       // we will send this to bull mq
//       await new SendAdminInviteEmail(
//         { name: userName, email },
//         tempPassword,
//       ).SendEmail(next);

//       new OkResponseStrategy().handleResponse(res, {
//         info: "Admin invite sent successfully to existing user",
//       });
//       return;
//     }

//     const verificationToken = CryptoService.generateRandomToken();
//     const hashedToken = await CryptoService.hash(verificationToken);

//     await VerificationTokenModel.create({
//       userId: email,
//       tokenType: "TWO_FA_DASHBOARD_ADMIN_TOKEN",
//       tokenValue: hashedToken,
//       expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//     });

//     await new SendAdminInviteEmail(
//       { name: "Admin", email },
//       tempPassword,
//     ).SendEmail(next);

//     new OkResponseStrategy().handleResponse(res, {
//       info: "Verification email sent to new user",
//     });
//   },
// );
