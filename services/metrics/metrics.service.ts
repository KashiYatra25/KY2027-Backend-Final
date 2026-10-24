/**
 * Metrics Service - Push-based metrics to Grafana Cloud
 * ═══════════════════════════════════════════════════════════════════
 *
 * Simple manual metrics without auto-instrumentation magic.
 * Initialize once at server startup, then use metrics.* anywhere.
 *
 * Usage:
 *   import { initMetrics, metrics } from "@services/metrics/index.js";
 *   await initMetrics(); // Call once at startup
 *   metrics.recordHttpRequest({ method: "GET", path: "/api", status: 200, durationMs: 45 });
 */

import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from "@opentelemetry/semantic-conventions";
import type { Meter } from "@opentelemetry/api";

const SERVICE_NAME = "ky-2027-backend";
const PUSH_INTERVAL_MS = 60_000; // 60 seconds

let meter: Meter | null = null;
let meterProvider: MeterProvider | null = null;

// ═══════════════════════════════════════════════════════════════════
// METRIC INSTRUMENTS (created after init)
// ═══════════════════════════════════════════════════════════════════

let httpRequestCounter: ReturnType<Meter["createCounter"]> | null = null;
let httpRequestDuration: ReturnType<Meter["createHistogram"]> | null = null;
let usersCounter: ReturnType<Meter["createCounter"]> | null = null;
let paymentsCounter: ReturnType<Meter["createCounter"]> | null = null;
let paymentsAmountCounter: ReturnType<Meter["createCounter"]> | null = null;
let webhooksCounter: ReturnType<Meter["createCounter"]> | null = null;
let errorsCounter: ReturnType<Meter["createCounter"]> | null = null;

// Observable gauges for process metrics
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();
let eventLoopLag = 0;

function getCpuPercent(): number {
  const currentCpuUsage = process.cpuUsage(lastCpuUsage);
  const currentTime = Date.now();
  const elapsedMs = currentTime - lastCpuTime;
  if (elapsedMs === 0) return 0;
  const totalCpuMicros = currentCpuUsage.user + currentCpuUsage.system;
  const cpuPercent = (totalCpuMicros / 1000 / elapsedMs) * 100;
  lastCpuUsage = process.cpuUsage();
  lastCpuTime = currentTime;
  return Math.round(cpuPercent * 100) / 100;
}

// Measure event loop lag every second
setInterval(() => {
  const start = Date.now();
  setImmediate(() => {
    eventLoopLag = Date.now() - start;
  });
}, 1000).unref();

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

export async function initMetrics(): Promise<void> {
  const endpoint = env.GRAFANA_OTLP_ENDPOINT;
  const instanceId = env.GRAFANA_OTLP_INSTANCE_ID;
  const token = env.GRAFANA_OTLP_TOKEN;

  if (!endpoint || !instanceId || !token) {
    logger.warn("Metrics disabled - missing GRAFANA_OTLP_* env vars");
    return;
  }

  const url = `${endpoint.replace(/\/$/, "")}/v1/metrics`;
  const authHeader = `Basic ${Buffer.from(`${instanceId}:${token}`).toString("base64")}`;

  const exporter = new OTLPMetricExporter({
    url,
    headers: { Authorization: authHeader },
  });

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: env.NODE_ENV,
  });

  meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: PUSH_INTERVAL_MS,
      }),
    ],
  });

  meter = meterProvider.getMeter(SERVICE_NAME);

  // Create instruments
  httpRequestCounter = meter.createCounter("ky_http_requests_total", {
    description: "Total HTTP requests",
  });

  httpRequestDuration = meter.createHistogram("ky_http_request_duration_ms", {
    description: "HTTP request duration in milliseconds",
  });

  usersCounter = meter.createCounter("ky_users_total", {
    description: "Total registered users",
  });

  paymentsCounter = meter.createCounter("ky_payments_total", {
    description: "Total payments",
  });

  paymentsAmountCounter = meter.createCounter("ky_payments_rupees_total", {
    description: "Total payment amount in rupees",
  });

  webhooksCounter = meter.createCounter("ky_webhooks_total", {
    description: "Total webhooks received",
  });

  errorsCounter = meter.createCounter("ky_errors_total", {
    description: "Total errors",
  });

  // Observable gauges for process metrics
  meter.createObservableGauge("ky_process_memory_bytes", {
    description: "Process memory usage",
  }).addCallback((result) => {
    const mem = process.memoryUsage();
    result.observe(mem.heapUsed, { type: "heap_used" });
    result.observe(mem.heapTotal, { type: "heap_total" });
    result.observe(mem.rss, { type: "rss" });
  });

  meter.createObservableGauge("ky_process_cpu_percent", {
    description: "Process CPU usage",
  }).addCallback((result) => {
    result.observe(getCpuPercent());
  });

  meter.createObservableGauge("ky_eventloop_lag_ms", {
    description: "Event loop lag in milliseconds",
  }).addCallback((result) => {
    result.observe(eventLoopLag);
  });

  logger.info("Metrics initialized", {
    endpoint: url,
    pushIntervalMs: PUSH_INTERVAL_MS,
  });

  // Graceful shutdown
  const shutdown = async () => {
    await meterProvider?.shutdown();
    logger.info("Metrics provider shut down");
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export const metrics = {
  /**
   * Record an HTTP request
   */
  recordHttpRequest(data: {
    method: string;
    path: string;
    status: number;
    durationMs: number;
    isGraphQL?: boolean;
    graphqlOperation?: string;
  }): void {
    const labels = {
      method: data.method,
      path: data.path,
      status: String(data.status),
      status_class: `${Math.floor(data.status / 100)}xx`,
      is_graphql: String(data.isGraphQL ?? false),
      ...(data.graphqlOperation && { graphql_operation: data.graphqlOperation }),
    };
    httpRequestCounter?.add(1, labels);
    httpRequestDuration?.record(data.durationMs, labels);
  },

  /**
   * Increment user registration counter
   */
  incrementUsers(): void {
    usersCounter?.add(1);
  },

  /**
   * Record a successful payment
   */
  recordPayment(type: "main" | "zonal", amountRupees: number): void {
    paymentsCounter?.add(1, { type });
    paymentsAmountCounter?.add(amountRupees, { type });
  },

  /**
   * Record webhook received
   */
  recordWebhook(status: "accepted" | "repeat" | "failed", type: "main" | "zonal" = "main"): void {
    webhooksCounter?.add(1, { status, type });
  },

  /**
   * Record an error
   */
  recordError(errorType: string, severity: "warning" | "error" | "critical" = "error"): void {
    errorsCounter?.add(1, { type: errorType, severity });
  },
};
