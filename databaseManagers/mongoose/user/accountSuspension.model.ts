import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

export const AccountSuspensionSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      ref: "AccountProgress",
    },
    suspendedBy: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      minlength: 10,
    },
    suspendedOn: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

AccountSuspensionSchema.index({ userId: 1 });
AccountSuspensionSchema.index({ suspendedBy: 1 });
AccountSuspensionSchema.index({ isActive: 1 });
AccountSuspensionSchema.index({ userId: 1, isActive: 1 });

export type AccountSuspensionSchemaType = InferSchemaType<typeof AccountSuspensionSchema>;
export type AccountSuspensionDoc = HydratedDocument<AccountSuspensionSchemaType>;

export const AccountSuspensionModel = connInstance.getModel<AccountSuspensionDoc>(
  "AccountSuspension",
  AccountSuspensionSchema
);
