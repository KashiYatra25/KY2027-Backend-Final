import winston from "winston";
import LokiTransport from "winston-loki";

type Environments = "development" | "test" | "production";

const SERVICE_NAME = "ky-2027-backend";

/**
 * Loki configuration from environment variables.
 * Supports both local Loki and Grafana Cloud.
 * 
 * Local Loki:
 *   LOKI_HOST=http://localhost:3100
 * 
 * Grafana Cloud:
 *   LOKI_HOST=https://logs-prod-xxx.grafana.net
 *   LOKI_USER=<your-grafana-cloud-user-id>
 *   LOKI_API_KEY=<your-grafana-cloud-api-key>
 */
function getLokiConfig() {
  const host = process.env.LOKI_HOST ?? "http://localhost:3100";
  const user = process.env.LOKI_USER;
  const apiKey = process.env.LOKI_API_KEY;
  
  // If user and apiKey are set, we're using Grafana Cloud
  const isGrafanaCloud = !!(user && apiKey);
  
  return {
    host,
    user,
    apiKey,
    isGrafanaCloud,
    // Grafana Cloud requires basic auth
    basicAuth: isGrafanaCloud ? `${user}:${apiKey}` : undefined,
  };
}

class WinstonLogger {
  private static readonly devFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: "HH:mm:ss" }),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `[${timestamp}] ${level}: ${message}${
          Object.keys(meta).length ? " " + JSON.stringify(meta) : ""
        }`,
    ),
  );

  private static readonly prodFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  /**
   * Creates a LokiTransport with the appropriate configuration.
   * Works with both local Loki and Grafana Cloud.
   */
  private static createLokiTransport(
    env: Environments,
    options?: { batching?: boolean; interval?: number }
  ): LokiTransport {
    const lokiConfig = getLokiConfig();
    
    return new LokiTransport({
      host: lokiConfig.host,
      labels: { app: SERVICE_NAME, env },
      json: true,
      format: WinstonLogger.prodFormat,
      replaceTimestamp: true,
      // Grafana Cloud auth
      ...(lokiConfig.basicAuth && { basicAuth: lokiConfig.basicAuth }),
      // Optional batching for production
      ...(options?.batching && { batching: true }),
      ...(options?.interval && { interval: options.interval }),
      onConnectionError: (err) =>
        console.error(`[Loki] connection error (${env}):`, err),
    });
  }

  /**
   * Builds the array of Winston transports for the given runtime environment.
   *
   * A "transport" in Winston is a storage/output destination for log entries.
   * Each environment gets a different combination of transports depending on
   * what is useful at that stage of the lifecycle:
   *
   *  - development  →  Console only          (fast feedback, human-readable)
   *  - test         →  Console (errors) + Loki (all levels)
   *  - production   →  Loki only             (structured, queryable, no stdout noise)
   *
   * @param env - The current NODE_ENV value, narrowed to the Environments union.
   * @returns    An array of instantiated winston.transport objects ready to be
   *             passed directly into winston.createLogger({ transports }).
   */
  private static buildTransports(env: Environments): winston.transport[] {
    switch (env) {
      /**
       * DEVELOPMENT
       * ─────────────────────────────────────────────────────────────────────
       * Single transport: Console.
       *
       * Why Console only?
       *   During local development you want instant, colourised, human-readable
       *   output directly in your terminal without any network round-trips.
       *   Sending logs to Loki locally would add latency and require the Docker
       *   stack to be running just to start the server.
       *
       * Format used: devFormat
       *   - colorize({ all: true })  — colours the entire line (level + message)
       *     so different severity levels are visually distinct at a glance.
       *   - timestamp({ format: "HH:mm:ss" })  — short time-only stamp; the date
       *     is irrelevant during a local session.
       *   - printf(...)  — custom single-line template:
       *       [HH:mm:ss] level: message { ...meta }
       *     Meta is JSON-stringified inline so it stays on one line and is easy
       *     to scan without a log viewer.
       *
       * Log level: "debug" (set in createLogger)
       *   Every log level (error → warn → info → http → verbose → debug) is
       *   emitted so nothing is hidden during development.
       */
      case "development":
        return [
          new winston.transports.Console({ format: WinstonLogger.devFormat }),
        ];

      /**
       * TEST
       * ─────────────────────────────────────────────────────────────────────
       * Two transports: Console (errors only) + LokiTransport (all levels).
       *
       * Why two transports?
       *   Tests run in CI or locally with a lot of output already. Flooding the
       *   terminal with debug/info logs makes test failures hard to spot.
       *   The Console transport is therefore restricted to "error" level only —
       *   you still see crashes immediately in the terminal.
       *   Meanwhile LokiTransport captures everything at the full "debug" level
       *   so you can open Grafana after a test run and do a post-mortem on the
       *   exact sequence of events that led to a failure.
       */
      case "test":
        return [
          new winston.transports.Console({
            level: "error",
            format: WinstonLogger.devFormat,
          }),
          WinstonLogger.createLokiTransport("test"),
        ];

      /**
       * PRODUCTION
       * ─────────────────────────────────────────────────────────────────────
       * Single transport: LokiTransport only (with batching).
       *
       * Why no Console in production?
       *   In a clustered Node.js process (clusterManager.ts forks one worker
       *   per CPU core) stdout from every worker gets interleaved, making it
       *   unreadable. All observability in production goes through Loki →
       *   Grafana where logs are indexed, searchable, and can be correlated
       *   with metrics and traces.
       *
       * Batching is enabled to reduce HTTP round-trips under high throughput.
       */
      case "production":
        return [
          WinstonLogger.createLokiTransport("production", { batching: true, interval: 5 }),
        ];
    }
  }

  public static createLogger(): winston.Logger {
    const env = (process.env.NODE_ENV as Environments) ?? "development";

    return winston.createLogger({
      level: env === "production" ? "info" : "debug",
      defaultMeta: { service: SERVICE_NAME },
      transports: WinstonLogger.buildTransports(env),
      exitOnError: false,
    });
  }
}

export const logger = WinstonLogger.createLogger();
