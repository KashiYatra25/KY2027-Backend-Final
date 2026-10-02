import { env } from "@lib/env/environment.js";
import bcrypt from "bcrypt";
import Cryptr from "cryptr";
import crypto from "crypto";

export class CryptoService {
  private static readonly SALT_ROUNDS = 10;
  private static readonly cryptr = new Cryptr(env.ENCRYPTION_KEY);

  static async hash(value: string): Promise<string> {
    return bcrypt.hash(value, CryptoService.SALT_ROUNDS);
  }

  static async verify(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }

  static encrypt(value: string): string {
    return CryptoService.cryptr.encrypt(value);
  }

  static decrypt(value: string): string {
    return CryptoService.cryptr.decrypt(value);
  }

  static generateRandomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString("hex");
  }

  static generateTempPassword(bytes = 12): string {
    return crypto.randomBytes(bytes).toString("base64url");
  }
}
