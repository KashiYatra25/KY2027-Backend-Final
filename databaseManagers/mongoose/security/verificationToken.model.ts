import { connInstance } from '../connection.js';
import { Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const VerificationTokenSchema = new Schema(
  {
    tokenType: {
      type: String,
      enum: [
        // These are OTPs at the controller level, named token to keep it generic and reusable
        'ADMIN_LOGIN_URL_TOKEN',
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
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

VerificationTokenSchema.index({ userId: 1, tokenType: 1 });
// TTL index - MongoDB automatically removes documents when expiresAt is reached
VerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type VerificationTokenSchemaType = InferSchemaType<typeof VerificationTokenSchema>;
export type VerificationTokenDoc = HydratedDocument<VerificationTokenSchemaType>;

export const VerificationTokenModel = connInstance.getModel<VerificationTokenDoc>(
  'VerificationToken',
  VerificationTokenSchema
);
