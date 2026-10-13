import "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * Raw request body bytes, captured by the `express.json({ verify })`
       * hook in app.ts. Needed for HMAC signature verification of webhooks,
       * where the signature is computed over the exact bytes received rather
       * than a re-serialised object (which would be ambiguous).
       */
      rawBody?: Buffer;
    }
  }
}

export {};
