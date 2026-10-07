/**
 * Base62 encoding utility
 * Alphabet: 0-9, A-Z, a-z (62 characters)
 * Used for generating short, URL-safe referral IDs
 */

const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = 62;

/**
 * Encode a number to base62 string
 * @param num - Positive integer to encode
 * @returns Base62 encoded string
 */
export function encodeBase62(num: number): string {
  if (num === 0) return BASE62_ALPHABET[0]!;
  if (num < 0) throw new Error("Cannot encode negative numbers");

  let result = "";
  let n = num;

  while (n > 0) {
    result = BASE62_ALPHABET[n % BASE]! + result;
    n = Math.floor(n / BASE);
  }

  return result;
}

/**
 * Decode a base62 string to number
 * @param str - Base62 encoded string
 * @returns Decoded number
 */
export function decodeBase62(str: string): number {
  let result = 0;

  for (const char of str) {
    const index = BASE62_ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Invalid base62 character: ${char}`);
    result = result * BASE + index;
  }

  return result;
}

/**
 * Encode to base62 with minimum padding
 * @param num - Number to encode
 * @param minLength - Minimum length of output (padded with leading zeros)
 * @returns Padded base62 string
 */
export function encodeBase62Padded(num: number, minLength: number = 4): string {
  const encoded = encodeBase62(num);
  return encoded.padStart(minLength, "0");
}
