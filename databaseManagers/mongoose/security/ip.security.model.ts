import { connInstance } from '../connection.js';
import { Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const IpSecuritySchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

IpSecuritySchema.index({ userId: 1 });

export type IpSecuritySchemaType = InferSchemaType<typeof IpSecuritySchema>;
export type IpSecurityDoc = HydratedDocument<IpSecuritySchemaType>;

export const IpSecurityModel = connInstance.getModel<IpSecurityDoc>(
  'IpSecurity',
  IpSecuritySchema
);
