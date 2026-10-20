// ═══════════════════════════════════════════════════════════════════
// K6 LOAD TEST - KY-2027 Backend
//
// Tests key API endpoints under load:
//   - Health check
//   - Public endpoints (events, colleges)
//   - Auth endpoints
//   - Zonals endpoints
//
// Run locally:
//   k6 run loadtest.js
//
// Run with Grafana Cloud output:
//   K6_PROMETHEUS_RW_SERVER_URL=https://prometheus-prod-43-prod-ap-south-1.grafana.net/api/prom/push \
//   K6_PROMETHEUS_RW_USERNAME=3636715 \
//   K6_PROMETHEUS_RW_PASSWORD=<your-api-key> \
//   k6 run -o experimental-prometheus-rw loadtest.js
// ═══════════════════════════════════════════════════════════════════

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const zonalsLatency = new Trend('zonals_latency');

// Test configuration
export const options = {
  // Stages simulate realistic traffic pattern
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Spike to 100 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  
  // Thresholds - test fails if these aren't met
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    errors: ['rate<0.1'],               // Error rate < 10%
    zonals_latency: ['p(95)<300'],      // Zonals endpoint < 300ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000/api/v1';

// ───────────────────────────────────────────────────────────────────
// TEST SCENARIOS
// ───────────────────────────────────────────────────────────────────

export default function () {
  // Randomize which endpoint to hit (simulates real traffic mix)
  const scenario = Math.random();
  
  if (scenario < 0.3) {
    testHealthCheck();
  } else if (scenario < 0.5) {
    testZonalsColleges();
  } else if (scenario < 0.7) {
    testEvents();
  } else {
    testPublicEndpoints();
  }
  
  sleep(Math.random() * 2 + 0.5); // Random sleep 0.5-2.5s
}

// ───────────────────────────────────────────────────────────────────
// ENDPOINT TESTS
// ───────────────────────────────────────────────────────────────────

function testHealthCheck() {
  // No dedicated health endpoint, test schedule as proxy
  const res = http.get(`${BASE_URL}/schedule`);
  
  check(res, {
    'schedule: status 200': (r) => r.status === 200,
  });
  
  errorRate.add(res.status !== 200);
}

function testZonalsColleges() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/zonals/colleges`);
  const duration = Date.now() - start;
  
  zonalsLatency.add(duration);
  
  check(res, {
    'zonals/colleges: status 200': (r) => r.status === 200,
    'zonals/colleges: has colleges': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.colleges && body.colleges.length > 0;
      } catch {
        return false;
      }
    },
  });
  
  errorRate.add(res.status !== 200);
}

function testEvents() {
  const res = http.get(`${BASE_URL}/events`);
  
  check(res, {
    'events: status 200': (r) => r.status === 200,
  });
  
  errorRate.add(res.status !== 200);
}

function testPublicEndpoints() {
  // Test multiple public endpoints
  const endpoints = [
    '/schedule',
    '/pass',
    '/schedule/venues',
    '/campus-ambassador/leaderboard',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`);
  
  check(res, {
    [`${endpoint}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  
  errorRate.add(res.status >= 400);
}

// ───────────────────────────────────────────────────────────────────
// AUTHENTICATED TESTS (optional - requires valid session)
// ───────────────────────────────────────────────────────────────────

export function authenticatedTest() {
  // This would require setting up auth tokens
  // For now, just placeholder
  
  const headers = {
    'Content-Type': 'application/json',
    // 'Authorization': `Bearer ${__ENV.AUTH_TOKEN}`,
  };
  
  const res = http.get(`${BASE_URL}/user/profile`, { headers });
  
  check(res, {
    'profile: requires auth': (r) => r.status === 401 || r.status === 200,
  });
}
