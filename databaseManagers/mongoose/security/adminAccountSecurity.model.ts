import { connInstance } from '../connection.js';
import { Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const AdminSecurityStepperSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    hasEmailBeenAcknowledged: {
      type: Boolean,
      default: false,
    },
    hasModifiedPassword: {
      type: Boolean,
      default: false,
    },
    hasSetup2FA: {
      type: Boolean,
      default: false,
    },
    hasSetupOTP: {
      type: Boolean,
      default: false,
    },
    hasUserBeenVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

AdminSecurityStepperSchema.index({ userId: 1 });

export type AdminSecurityStepperSchemaType = InferSchemaType<typeof AdminSecurityStepperSchema>;
export type AdminSecurityStepperDoc = HydratedDocument<AdminSecurityStepperSchemaType>;

export const AdminSecurityStepperModel = connInstance.getModel<AdminSecurityStepperDoc>(
  'AdminSecurityStepper',
  AdminSecurityStepperSchema
);
