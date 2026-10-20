# Observability Stack

Grafana Alloy-based observability + k6 load testing for ky-2027-backend.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Node.js App    │     │   k6 Load Test  │
│  (port 8000)    │     │                 │
└────────┬────────┘     └────────┬────────┘
         │ logs                   │ test metrics
         │ metrics                │
         ▼                        ▼
┌─────────────────┐     ┌─────────────────────────────────┐
│  Grafana Alloy  │────▶│     Grafana Cloud               │
│  (port 3100)    │     │  • Loki (logs)                  │
└─────────────────┘     │  • Prometheus (metrics + k6)    │
                        │  • Dashboards                   │
                        └─────────────────────────────────┘
```

## Quick Start

### 1. Set Environment Variables

Create `observability/.env`:
```bash
# Required - your Grafana Cloud API key
GRAFANA_CLOUD_API_KEY=glc_eyJvIjoi...

# Optional - these have defaults for your stack
# GRAFANA_CLOUD_LOKI_URL=https://logs-prod-028.grafana.net/loki/api/v1/push
# GRAFANA_CLOUD_LOKI_USER=1814024
# GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-prod-43-prod-ap-south-1.grafana.net/api/prom/push
# GRAFANA_CLOUD_PROMETHEUS_USER=3636715
```

### 2. Start Alloy

```bash
cd observability
docker-compose up -d alloy
```

### 3. Verify Logs in Grafana Cloud

1. Go to [Grafana Cloud](https://grafana.com) → Your stack → Explore
2. Select Loki datasource
3. Query: `{app="ky-2027-backend"}`

---

## k6 Load Testing

### Install k6

```bash
# Windows
winget install k6

# Mac
brew install k6

# Linux
sudo apt install k6
```

### Run Load Tests

**Basic test (console output only):**
```bash
cd observability/k6
k6 run loadtest.js
```

**With Grafana Cloud output (see results in dashboards):**

> **Note:** You need a Grafana Cloud API key with **MetricsPublisher** role (write access).
> Generate at: Grafana Cloud → Your Stack → Prometheus → Generate API Key

```powershell
# Windows PowerShell
$env:K6_PROMETHEUS_RW_SERVER_URL="https://prometheus-prod-43-prod-ap-south-1.grafana.net/api/prom/push"
$env:K6_PROMETHEUS_RW_USERNAME="3636715"
$env:K6_PROMETHEUS_RW_PASSWORD="<your-write-api-key>"
k6 run -o experimental-prometheus-rw loadtest.js
```

```bash
# Linux/Mac
K6_PROMETHEUS_RW_SERVER_URL="https://prometheus-prod-43-prod-ap-south-1.grafana.net/api/prom/push" \
K6_PROMETHEUS_RW_USERNAME="3636715" \
K6_PROMETHEUS_RW_PASSWORD="<your-api-key>" \
k6 run -o experimental-prometheus-rw loadtest.js
```

**Custom base URL:**
```bash
k6 run -e BASE_URL=https://your-ngrok-url.ngrok-free.dev/api/v1 loadtest.js
```

### Available Tests

| Script | Description |
|--------|-------------|
| `loadtest.js` | General API load test (health, events, zonals) |
| `zonals-stress.js` | Zonals registration stress test (simulates event rush) |

### Test Thresholds

Tests fail if:
- 95th percentile latency > 500ms
- Error rate > 10%
- Zonals endpoint latency > 300ms

---

## Local Development Stack (Optional)

For full local observability without Grafana Cloud:

```bash
docker-compose --profile development up -d
```

This starts:
- Alloy
- Local Loki (port 3100)
- Local Prometheus (port 9090)
- Local Grafana (port 3200)

Access local Grafana at http://localhost:3200 (admin/admin)

---

## What Gets Collected

### Logs
- All Winston logs from the app
- Labels: `app`, `env`, `level`
- Queryable via LogQL in Grafana

### Metrics
- HTTP request duration, count, status
- Database query metrics
- Redis operation metrics
- WebSocket connection metrics
- Node.js runtime metrics (memory, event loop)

---

## Useful Queries

### LogQL (Logs)
```logql
# All errors
{app="ky-2027-backend"} |= "error"

# Webhook logs
{app="ky-2027-backend"} |~ "webhook"

# Slow requests
{app="ky-2027-backend"} | json | duration > 1000

# By user
{app="ky-2027-backend"} | json | userId="123"
```

### PromQL (Metrics)
```promql
# Request rate
rate(http_request_duration_seconds_count[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m]))

# k6 test metrics
k6_http_reqs_total
k6_http_req_duration_p95
```

---

## Files

```
observability/
├── alloy.config              # Grafana Alloy pipeline
├── docker-compose.yml        # Container orchestration
├── prometheus.yml            # Local Prometheus config
├── README.md                 # This file
├── k6/
│   ├── loadtest.js           # General load test
│   └── zonals-stress.js      # Zonals-specific stress test
└── grafana/
    └── provisioning/
        └── datasources/      # Auto-configured datasources
```

## App Configuration

Backend `.env` for logging:
```env
# Push logs to Alloy (local)
LOKI_HOST=http://localhost:3100

# OR push directly to Grafana Cloud
LOKI_HOST=https://logs-prod-028.grafana.net
LOKI_USER=1814024
LOKI_API_KEY=<your-api-key>
```
