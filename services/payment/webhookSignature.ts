import crypto from "node:crypto";
import { env } from "@lib/env/environment.js";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Payment webhook signature verification
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The Go payment service signs each webhook request with HMAC-SHA256 over the
 * string:
 *
 *     `${timestamp}.${rawBody}`
 *
 * where:
 *   - `timestamp` is the unix epoch seconds the request was created, sent in
 *     the `x-webhook-timestamp` header.
 *   - `rawBody`   is the exact UTF-8 JSON bytes of the request body.
 *
 * The resulting signature (lowercase hex) is sent in the `x-webhook-signature`
 * header.
 *
 * Verifying the timestamp as part of the signed payload (and separately
 * rejecting stale timestamps) prevents replay attacks: an attacker cannot
 * resend a previously captured request after the tolerance window, nor can
 * they alter the timestamp without invalidating the signature.
 */

/** Shared HMAC secret. Falls back to the service token if a dedicated
 *  webhook secret has not been provisioned. */
function getSigningSecret(): string {
  return env.PAYMENT_WEBHOOK_SECRET ?? env.PAYMENT_SERVICE_TOKEN;
}

export type WebhookVerificationResult =
  | { ok: true }
  | { ok: false; reason: WebhookVerificationFailure };

export type WebhookVerificationFailure =
  | "missing_signature"
  | "missing_timestamp"
  | "invalid_timestamp"
  | "timestamp_out_of_tolerance"
  | "signature_mismatch";

/**
 * Compute the expected hex HMAC-SHA256 signature for a signed payload.
 */
export function computeWebhookSignature(timestamp: string, rawBody: Buffer | string): string {
  const body = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  const hmac = crypto.createHmac("sha256", getSigningSecret());
  hmac.update(`${timestamp}.`);
  hmac.update(body);
  return hmac.digest("hex");
}

/**
 * Constant-time comparison of two hex-encoded signatures.
 *
 * Uses crypto.timingSafeEqual to avoid leaking information about how many
 * leading characters matched (which a naive `===` / string compare would).
 * Lengths are checked first because timingSafeEqual throws on mismatched
 * buffer lengths — but length is not secret, so this does not weaken security.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a payment webhook request's HMAC signature and timestamp freshness.
 *
 * @param signatureHeader - value of the `x-webhook-signature` header
 * @param timestampHeader - value of the `x-webhook-timestamp` header (unix seconds)
 * @param rawBody         - exact bytes of the request body
 * @param nowSeconds      - current unix time in seconds (injectable for tests)
 */
export function verifyWebhookSignature(
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  rawBody: Buffer | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): WebhookVerificationResult {
  if (!signatureHeader) {
    return { ok: false, reason: "missing_signature" };
  }
  if (!timestampHeader) {
    return { ok: false, reason: "missing_timestamp" };
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp) || !Number.isInteger(timestamp) || timestamp <= 0) {
    return { ok: false, reason: "invalid_timestamp" };
  }

  // Reject timestamps outside the allowed window in either direction
  // (stale replays, or implausibly future-dated requests from clock skew/forgery).
  const tolerance = env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS;
  if (Math.abs(nowSeconds - timestamp) > tolerance) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }

  const expected = computeWebhookSignature(timestampHeader, rawBody ?? Buffer.alloc(0));
  if (!constantTimeEqual(signatureHeader, expected)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true };
}
