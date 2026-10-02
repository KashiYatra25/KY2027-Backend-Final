import { getMyAccountResolver } from '@gql/resolver/user.resolver.js';

export const resolvers = {
  Query: {
    myAccount: getMyAccountResolver,
  },
};
