import { getMyAccountResolver } from "@gql/resolver/user.resolver.js";
import { getMyCaInfoResolver } from "@gql/resolver/ca.resolver.js";

export const resolvers = {
  Query: {
    myAccount: getMyAccountResolver,
    myCaInfo: getMyCaInfoResolver,
  },
};
