import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument,type InferSchemaType } from "mongoose";

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

AccountProgressSchema.index({ userId: 1 });

export type AccountProgressSchemaType = InferSchemaType<
  typeof AccountProgressSchema
> & {
  createdAt : Date,
  updatedAt : Date, 
}

export type AccountProgressDoc = HydratedDocument<AccountProgressSchemaType>;

export const AccountProgressModel = connInstance.getModel<AccountProgressDoc>(
  "AccountProgress",
  AccountProgressSchema
);
