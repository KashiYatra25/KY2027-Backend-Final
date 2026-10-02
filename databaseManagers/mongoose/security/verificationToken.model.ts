import { connInstance } from '../connection.js';
import mongoose, { Schema, type HydratedDocument,type InferSchemaType } from 'mongoose';

export const VerificationTokenSchema = new Schema(
  {
    tokenType: {
      type: String,
      enum: [
        // These are OTPs at the controller level, named token to keep it generic and reusable
        'TWO_FA_DASHBOARD_ADMIN_TOKEN',
        'PHONE_NUMBER_VERIFICATION_TOKEN',
        'CSRF_TOKEN',
      ],
      required: true,
    },
    tokenValue: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

VerificationTokenSchema.index({ userId: 1, tokenType: 1 });

export type VerificationTokenSchemaType = InferSchemaType<typeof VerificationTokenSchema>;
export type VerificationTokenDoc = HydratedDocument<VerificationTokenSchemaType>;

export const VerificationTokenModel = connInstance.getModel<VerificationTokenDoc>(
  'VerificationToken',
  VerificationTokenSchema
);
