import { env } from "@lib/env/environment.js";

export const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, status: boolean) => void,
  ) => {
    if (
      origin === env.CLIENT_ORIGIN ||
      !origin ||
      origin === env.CLIENT_ADMIN_PANEL_ORIGIN
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"), false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
};
