import winston from "winston";
import LokiTransport from "winston-loki";

type Environments = "development" | "test" | "production";

const SERVICE_NAME = "ky-2027-backend";

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
    const lokiHost = process.env.LOKI_HOST ?? "http://localhost:3100";

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
       *
       * Console transport (level: "error")
       *   - Only log entries at severity "error" or above reach stdout.
       *   - Still uses devFormat so the output is colourised and readable when
       *     something does print.
       *
       * LokiTransport
       *   host        — The Loki push API base URL. Reads LOKI_HOST from the
       *                 environment so it can point at a local Docker container
       *                 (http://localhost:3100) or a remote instance without a
       *                 code change.
       *
       *   labels      — Key/value pairs attached to every log stream in Loki.
       *                 { app: "ky-2027-backend", env: "test" }
       *                 These become the Loki stream selectors you use in LogQL:
       *                   {app="ky-2027-backend", env="test"}
       *                 Keeping env in the label lets you filter test vs
       *                 production logs in the same Grafana datasource.
       *
       *   json: true  — Serialises each log entry as a JSON string before
       *                 pushing to Loki. Required when using prodFormat (which
       *                 already outputs JSON) so Loki stores a parseable object
       *                 rather than a double-encoded string.
       *
       *   format      — prodFormat is used (not devFormat) because Loki expects
       *                 structured JSON, not ANSI-coloured strings.
       *                 prodFormat applies:
       *                   timestamp()          — ISO-8601 timestamp field
       *                   errors({ stack })    — expands Error objects so the
       *                                         stack trace is a top-level field
       *                   json()               — serialises the whole entry
       *
       *   replaceTimestamp: true
       *                 — Tells the transport to use Loki's ingest time as the
       *                   log timestamp instead of the one Winston generated.
       *                   Prevents clock-skew issues where logs appear out of
       *                   order in Grafana because the app clock drifted.
       *
       *   onConnectionError
       *                 — Callback fired when the HTTP push to Loki fails
       *                   (network down, wrong host, etc.). We fall back to a
       *                   raw console.error so the failure is visible without
       *                   causing an unhandled rejection or crashing the process.
       */
      case "test":
        return [
          new winston.transports.Console({
            level: "error",
            format: WinstonLogger.devFormat,
          }),
          new LokiTransport({
            host: lokiHost,
            labels: { app: SERVICE_NAME, env: "test" },
            json: true,
            format: WinstonLogger.prodFormat,
            replaceTimestamp: true,
            onConnectionError: (err) =>
              console.error("[Loki] connection error (test):", err),
          }),
        ];

      /**
       * PRODUCTION
       * ─────────────────────────────────────────────────────────────────────
       * Single transport: LokiTransport only.
       *
       * Why no Console in production?
       *   In a clustered Node.js process (clusterManager.ts forks one worker
       *   per CPU core) stdout from every worker gets interleaved, making it
       *   unreadable. All observability in production goes through Loki →
       *   Grafana where logs are indexed, searchable, and can be correlated
       *   with metrics and traces.
       *
       * LokiTransport — same options as test with two additions:
       *
       *   labels      — env label is "production" so LogQL queries can target
       *                 production streams exclusively:
       *                   {app="ky-2027-backend", env="production"}
       *
       *   batching: true
       *                 — Instead of pushing each log entry as an individual
       *                   HTTP request, the transport accumulates entries in
       *                   memory and flushes them as a single batch. This
       *                   dramatically reduces the number of HTTP round-trips
       *                   to Loki under high throughput (the README targets
       *                   10k req/s) and avoids overwhelming Loki's ingest API.
       *
       *   interval: 5  — The flush interval in seconds. Every 5 seconds the
       *                  accumulated batch is pushed to Loki regardless of size.
       *                  Balances latency (logs appear in Grafana within ~5s)
       *                  against throughput (not one HTTP call per log line).
       *                  Tune this down (e.g. 2) if near-real-time alerting is
       *                  needed, or up (e.g. 15) to further reduce Loki load.
       *
       * Log level: "info" (set in createLogger)
       *   debug and verbose entries are suppressed in production to reduce
       *   storage costs and Loki ingest volume. Only info, warn, and error
       *   entries are forwarded.
       */
      case "production":
        return [
          new LokiTransport({
            host: lokiHost,
            labels: { app: SERVICE_NAME, env: "production" },
            json: true,
            format: WinstonLogger.prodFormat,
            replaceTimestamp: true,
            batching: true,
            interval: 5,
            onConnectionError: (err) =>
              console.error("[Loki] connection error (production):", err),
          }),
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
