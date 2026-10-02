import { CryptoService } from "./helper/crypto.encryption.helper.js";

export const generateOtp = (data: { prefix: string }): string => {
  const otp = Math.floor(100000 + Math.random() * 900000);
  return `${data.prefix}-${otp}`;
};

export const generateToken = (): string => CryptoService.generateRandomToken();
