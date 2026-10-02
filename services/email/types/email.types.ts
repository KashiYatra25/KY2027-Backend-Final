import { type ValidDataBrand } from 'zodex-axon/core';

export type EmailBrand = ValidDataBrand<string>;

export interface IUser {
  email: string;
  name: string;
}
