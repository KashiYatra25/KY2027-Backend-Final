import { getMyAccountResolver } from "./getMyAccount.resolver.js";
import { getMyCaInfoResolver } from "./getMyCaInfo.resolver.js";

export const resolvers = {
  Query: {
    myAccount: getMyAccountResolver,
    myCaInfo: getMyCaInfoResolver,
  },
};
