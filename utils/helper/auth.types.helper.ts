import { type RoleLevel } from '@lib/prisma/index.js';
import { type Request } from 'express';

export type API_PROTOCOL_CONTEXT_TYPE = 'REST' | 'GraphQL';
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
// User has logged in via NextAuth — email + id available, phone not yet verified
export interface AuthenticatedUserRequestWithVerifiedEmail extends Request {
  user: {
    id: string;
    email: string;
    role : RoleLevel
  };
}

// User has completed phone verification — required before course purchase
export interface AuthenticatedRequestWithVerifiedPhoneNumberAndEmail extends Request {
  user: {
    id: string;
    phoneNumber: string;
    email: string;
    role : RoleLevel
  };
}

// Admin authenticated request
export interface AuthenticatedAdminRequest extends Request {
  admin: {
    id: string;
    email: string;
  };
}
