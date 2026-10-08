import { z } from 'zod';
import { RequestGuardMiddleware as GqlRequestGuardMiddleware } from 'gql-axon';
import { type GqlGlobalContext } from '../engine/engine.js';
import { BadRequestError } from 'gql-axon/errors';
import { checkForProfileCompletion } from '@controller/helper/checkWhetherProfileIsCompleted.js';

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

// Profile completion guard - throws if profile is not complete
// Use this for features that require completed profile (CA application, etc.)
export const isProfileCompleteGuard = async (
  _parent: unknown,
  _args: unknown,
  context: { validatedContext: GqlValidatedContextType },
  _info: unknown
) => {
  const userId = context.validatedContext.user?.id;
  
  if (!userId) {
    throw new BadRequestError('Authentication required');
  }

  const profileResult = await checkForProfileCompletion({ userId });

  if (!profileResult.isComplete) {
    throw new BadRequestError(
      `Profile incomplete. Missing steps: ${profileResult.missingSteps.join(', ')}`
    );
  }
};
