import { z } from 'zod';
import { RequestGuardMiddleware as GqlRequestGuardMiddleware } from 'gql-axon';
import { type GqlGlobalContext } from '../engine/engine.js';
import { BadRequestError } from 'gql-axon/errors';

// Schema to validate the user object within the GraphQL context
const gqlContextUserSchema = z.object({
  user: z.object({
    id: z.string().min(1, "User ID is required"),
    email: z.string().email("Invalid email address"),
  }).nullable(),
});

export type GqlValidatedContextType = z.infer<typeof gqlContextUserSchema>;

export const myProfileGuard = GqlRequestGuardMiddleware<
  { context: GqlValidatedContextType },
  GqlGlobalContext
>({
  context: gqlContextUserSchema,
});

// Authentication guard - throws if user not authenticated
// This runs after myProfileGuard which puts validated data in context.validatedContext
export const isAuthenticatedGuard = async (
  _parent: unknown,
  _args: unknown,
  context: { validatedContext: GqlValidatedContextType },
  _info: unknown
) => {
  if (!context.validatedContext.user) {
    throw new BadRequestError('Authentication required');
  }
};
