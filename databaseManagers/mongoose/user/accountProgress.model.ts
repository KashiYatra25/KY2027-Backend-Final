import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument,type InferSchemaType } from "mongoose";
import { autoSetPaidForIITBhuUserHook, assignKyIdHook } from "./hooks/index.js";

export const AccountProgressSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    accountStatus: {
      type: String,
      default: "ACTIVE",
      enum: ["ACTIVE", "SUSPENDED"],
    },
    profileCompletionAndVerification: {
      hasVerifiedPhoneNumber: {
        type: Boolean,
        default: false,
      },
      hasSelectedCollegeDetails: {
        type: Boolean,
        default: false,
      },
      hasAadhaarBeenUploaded: {
        type: Boolean,
        default: false,
      },
      hasAadhaarBeenVerified: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// userId already has unique: true which creates an index

export type AccountProgressSchemaType = InferSchemaType<
  typeof AccountProgressSchema
> & {
  createdAt : Date,
  updatedAt : Date, 
}

export type AccountProgressDoc = HydratedDocument<AccountProgressSchemaType>;

// ═══════════════════════════════════════════════════════════════════
// POST-SAVE HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook 1: Auto-set isPaidUser for IIT BHU users on profile completion
 */
AccountProgressSchema.post("save", async function (doc: AccountProgressDoc) {
  await autoSetPaidForIITBhuUserHook(doc);
});

/**
 * Hook 2: Assign unique kyId on profile completion
 */
AccountProgressSchema.post("save", async function (doc: AccountProgressDoc) {
  await assignKyIdHook(doc);
});

// ═══════════════════════════════════════════════════════════════════

export const AccountProgressModel = connInstance.getModel<AccountProgressDoc>(
  "AccountProgress",
  AccountProgressSchema
);
