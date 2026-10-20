// ═══════════════════════════════════════════════════════════════════
// K6 LOAD TEST - Full Kashiyatra Flow
//
// Tests BOTH main KY and Zonals flows:
//
// MAIN KY:
//   - KonfHub webhook → creates KY pass (Darbar/Swarnim/Yatri)
//   - /user/purchases → check purchased passes
//   - /user/registrations → check event registrations
//   - /events → browse events
//   - /event/:id/register → register for event
//
// ZONALS:
//   - KonfHub webhook → creates zonal pass
//   - /zonals/my-passes → check zonal passes
//   - /zonals/colleges/:slug/register → register for zonal event
//
// SETUP:
//   1. Get session token from browser (login, copy next-auth.session-token cookie)
//   2. Set in .env: TEST_SESSION_TOKEN=<token>
//   3. Optionally set TEST_USER_EMAIL, TEST_USER_KY_ID
//
// Run: 
//   k6 run full-flow.js                    # Basic (no auth)
//   k6 run -e TEST_SESSION_TOKEN=xxx full-flow.js  # With auth
// ═══════════════════════════════════════════════════════════════════

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ───────────────────────────────────────────────────────────────────
// CONFIGURATION
// ───────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000/api/v1';
const WEBHOOK_SECRET = __ENV.WEBHOOK_SECRET || 'D8nKhso9NxXeqzV7YAgSmQFMljIZ4E1C';
const SESSION_TOKEN = __ENV.TEST_SESSION_TOKEN || '';

// Main KY Pass Types (ticket names that trigger different passes)
const KY_PASS_TYPES = [
  { ticketName: 'Darbar Pass - VIP Experience', passType: 'Darbar', price: 2999 },
  { ticketName: 'Swarnim Pass - Gold', passType: 'Swarnim', price: 1499 },
  { ticketName: 'Yatri Pass - Regular', passType: 'Yatri', price: 499 },
];

// Zonals Pass Types
const ZONAL_PASS_TYPES = [
  { ticketName: 'RGIPT Single Event Pass', college: 'rgipt', type: 'single', price: 200 },
  { ticketName: 'RGIPT Multi Event Pass', college: 'rgipt', type: 'multi', price: 500 },
];

// ───────────────────────────────────────────────────────────────────
// METRICS
// ───────────────────────────────────────────────────────────────────

// Webhook metrics
const kyWebhookSuccess = new Counter('ky_webhook_success');
const kyWebhookFailed = new Counter('ky_webhook_failed');
const zonalWebhookSuccess = new Counter('zonal_webhook_success');
const zonalWebhookFailed = new Counter('zonal_webhook_failed');

// Latency metrics
const webhookLatency = new Trend('webhook_latency');
const purchasesLatency = new Trend('purchases_latency');
const registrationsLatency = new Trend('registrations_latency');
const zonalPassesLatency = new Trend('zonal_passes_latency');
const eventsLatency = new Trend('events_latency');

// Auth metrics
const authEndpointSuccess = new Counter('auth_endpoint_success');
const authEndpointFailed = new Counter('auth_endpoint_failed');

// ───────────────────────────────────────────────────────────────────
// TEST OPTIONS
// ───────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Scenario 1: Public endpoints (always runs)
    public_browsing: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      exec: 'publicBrowsing',
    },
    
    // Scenario 2: KY Webhook stress
    ky_webhooks: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 50,
      stages: [
        { duration: '10s', target: 2 },
        { duration: '30s', target: 5 },
        { duration: '10s', target: 10 },
        { duration: '10s', target: 2 },
      ],
      exec: 'kyWebhookFlow',
    },
    
    // Scenario 3: Zonals Webhook stress
    zonal_webhooks: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 30,
      stages: [
        { duration: '10s', target: 1 },
        { duration: '30s', target: 3 },
        { duration: '10s', target: 5 },
        { duration: '10s', target: 1 },
      ],
      exec: 'zonalWebhookFlow',
      startTime: '5s',
    },
    
    // Scenario 4: Authenticated user flows (if token provided)
    authenticated_users: {
      executor: 'constant-vus',
      vus: 3,
      duration: '50s',
      exec: 'authenticatedFlow',
      startTime: '10s',
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    webhook_latency: ['p(95)<1500'],
    purchases_latency: ['p(95)<500'],
    zonal_passes_latency: ['p(95)<500'],
    events_latency: ['p(95)<500'],
    ky_webhook_failed: ['count<20'],
    zonal_webhook_failed: ['count<10'],
  },
};

// ───────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────

function generateBookingId(prefix) {
  return `${prefix}-${Date.now()}-${randomIntBetween(1000, 9999)}`;
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (SESSION_TOKEN) {
    headers['Cookie'] = `next-auth.session-token=${SESSION_TOKEN}`;
  }
  return headers;
}

function buildKonfhubPayload(bookingId, ticketName, price, email, kyId) {
  return {
    "Id": `webhook-${bookingId}`,
    "Event Type": "registration",
    "Event At": Date.now(),
    "Data": {
      "Attendee Details": {
        "Booking Id": bookingId,
        "Name": `K6 Test User ${randomIntBetween(1, 1000)}`,
        "Email Address": email,
        "Phone Number": `+91${randomIntBetween(7000000000, 9999999999)}`,
        "KY_ID": kyId,
        "Ticket Details": {
          "Ticket Name": ticketName,
          "Ticket Price": price,
        },
        "Amount Details": {
          "Amount Paid": price,
          "Currency": "INR",
          "Payment ID": `pay_${bookingId}`,
        },
        "Ticket URL": `https://konfhub.com/ticket/${bookingId}`,
        "Invoice URL": `https://konfhub.com/invoice/${bookingId}`,
      },
    },
  };
}

// ───────────────────────────────────────────────────────────────────
// SCENARIO 1: PUBLIC BROWSING
// Tests public endpoints without auth
// ───────────────────────────────────────────────────────────────────

export function publicBrowsing() {
  group('Public - Events', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/events`);
    eventsLatency.add(Date.now() - start);
    
    check(res, {
      'events: status 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  group('Public - Schedule', function () {
    const res = http.get(`${BASE_URL}/schedule`);
    check(res, {
      'schedule: status 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  group('Public - Passes Info', function () {
    const res = http.get(`${BASE_URL}/pass`);
    check(res, {
      'passes: status 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  group('Public - Zonals Colleges', function () {
    const res = http.get(`${BASE_URL}/zonals/colleges`);
    check(res, {
      'zonals colleges: status 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  group('Public - CA Leaderboard', function () {
    const res = http.get(`${BASE_URL}/campus-ambassador/leaderboard`);
    check(res, {
      'ca leaderboard: status 2xx': (r) => r.status >= 200 && r.status < 300,
    });
  });

  sleep(1);
}

// ───────────────────────────────────────────────────────────────────
// SCENARIO 2: KY MAIN WEBHOOK FLOW
// Simulates KonfHub webhooks for main KY passes
// ───────────────────────────────────────────────────────────────────

export function kyWebhookFlow() {
  const passType = randomItem(KY_PASS_TYPES);
  const bookingId = generateBookingId('ky');
  const email = `k6-ky-${randomIntBetween(1, 10000)}@loadtest.local`;
  const kyId = `KY-2027-K6-${randomIntBetween(10000, 99999)}`;

  const payload = JSON.stringify(buildKonfhubPayload(
    bookingId, passType.ticketName, passType.price, email, kyId
  ));

  group('KY Webhook', function () {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/payment/webhooks/konfhub?secret=${WEBHOOK_SECRET}`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );
    webhookLatency.add(Date.now() - start);

    const success = check(res, {
      'ky webhook: status 200': (r) => r.status === 200,
      'ky webhook: processed': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true || body.skipped === true || body.webhookId;
        } catch {
          return false;
        }
      },
    });

    if (success) {
      kyWebhookSuccess.add(1);
    } else {
      kyWebhookFailed.add(1);
      console.log(`KY Webhook failed: ${res.status} - ${res.body?.substring(0, 200)}`);
    }
  });

  sleep(0.1);
}

// ───────────────────────────────────────────────────────────────────
// SCENARIO 3: ZONALS WEBHOOK FLOW
// Simulates KonfHub webhooks for zonal passes
// ───────────────────────────────────────────────────────────────────

export function zonalWebhookFlow() {
  const passType = randomItem(ZONAL_PASS_TYPES);
  const bookingId = generateBookingId('zonal');
  const email = `k6-zonal-${randomIntBetween(1, 10000)}@loadtest.local`;
  const kyId = `KY-2027-K6Z-${randomIntBetween(10000, 99999)}`;

  const payload = JSON.stringify(buildKonfhubPayload(
    bookingId, passType.ticketName, passType.price, email, kyId
  ));

  group('Zonals Webhook', function () {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/payment/webhooks/zonals?secret=${WEBHOOK_SECRET}`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );
    webhookLatency.add(Date.now() - start);

    const success = check(res, {
      'zonal webhook: status 200': (r) => r.status === 200,
      'zonal webhook: processed': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true || body.skipped === true || body.webhookId;
        } catch {
          return false;
        }
      },
    });

    if (success) {
      zonalWebhookSuccess.add(1);
    } else {
      zonalWebhookFailed.add(1);
      console.log(`Zonal Webhook failed: ${res.status} - ${res.body?.substring(0, 200)}`);
    }
  });

  sleep(0.1);
}

// ───────────────────────────────────────────────────────────────────
// SCENARIO 4: AUTHENTICATED USER FLOW
// Tests endpoints that require login
// ───────────────────────────────────────────────────────────────────

export function authenticatedFlow() {
  const headers = getAuthHeaders();
  const hasAuth = !!SESSION_TOKEN;

  // ─── KY Main Endpoints ───
  
  group('Auth - My Purchases (KY Passes)', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/user/purchases`, { headers });
    purchasesLatency.add(Date.now() - start);

    if (hasAuth) {
      const success = check(res, {
        'purchases: status 200': (r) => r.status === 200,
      });
      if (success) authEndpointSuccess.add(1);
      else authEndpointFailed.add(1);
    } else {
      check(res, { 'purchases: requires auth': (r) => r.status === 401 });
    }
  });

  sleep(0.5);

  group('Auth - My Registrations', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/user/registrations`, { headers });
    registrationsLatency.add(Date.now() - start);

    if (hasAuth) {
      const success = check(res, {
        'registrations: status 200': (r) => r.status === 200,
      });
      if (success) authEndpointSuccess.add(1);
      else authEndpointFailed.add(1);
    } else {
      check(res, { 'registrations: requires auth': (r) => r.status === 401 });
    }
  });

  sleep(0.5);

  group('Auth - Payment Status', function () {
    const res = http.get(`${BASE_URL}/user/payment-status`, { headers });

    if (hasAuth) {
      check(res, {
        'payment-status: status 200': (r) => r.status === 200,
      });
    } else {
      check(res, { 'payment-status: requires auth': (r) => r.status === 401 });
    }
  });

  sleep(0.5);

  // ─── Zonals Endpoints ───

  group('Auth - My Zonal Passes', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/zonals/my-passes`, { headers });
    zonalPassesLatency.add(Date.now() - start);

    if (hasAuth) {
      const success = check(res, {
        'zonal passes: status 200': (r) => r.status === 200,
        'zonal passes: has data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.passes !== undefined;
          } catch {
            return false;
          }
        },
      });
      if (success) authEndpointSuccess.add(1);
      else authEndpointFailed.add(1);
    } else {
      check(res, { 'zonal passes: requires auth': (r) => r.status === 401 });
    }
  });

  sleep(1);

  // ─── Event Registration (if authenticated) ───

  if (hasAuth) {
    group('Auth - Register for Zonal Event', function () {
      const college = 'rgipt';
      const eventId = `test-event-${randomIntBetween(1, 5)}`;
      
      const payload = JSON.stringify({ eventId });
      const res = http.post(
        `${BASE_URL}/zonals/colleges/${college}/register`,
        payload,
        { headers }
      );

      check(res, {
        'zonal register: handled': (r) => r.status !== 500,
      });
    });
  }

  sleep(1);
}

// ───────────────────────────────────────────────────────────────────
// DEFAULT (for simple k6 run without scenarios)
// ───────────────────────────────────────────────────────────────────

export default function () {
  publicBrowsing();
  kyWebhookFlow();
  zonalWebhookFlow();
  authenticatedFlow();
}

// ───────────────────────────────────────────────────────────────────
// SETUP / TEARDOWN
// ───────────────────────────────────────────────────────────────────

export function setup() {
  console.log('═'.repeat(70));
  console.log('  KASHIYATRA 2027 - FULL LOAD TEST');
  console.log('═'.repeat(70));
  console.log(`  Base URL:      ${BASE_URL}`);
  console.log(`  Auth Token:    ${SESSION_TOKEN ? '✓ PROVIDED' : '✗ NOT PROVIDED'}`);
  console.log(`  Webhook Secret: ${WEBHOOK_SECRET.substring(0, 8)}...`);
  console.log('─'.repeat(70));
  console.log('  Testing:');
  console.log('    • Public endpoints (events, schedule, passes, zonals)');
  console.log('    • KY Main webhook (Darbar/Swarnim/Yatri passes)');
  console.log('    • Zonals webhook (RGIPT Single/Multi passes)');
  console.log('    • Authenticated endpoints (purchases, registrations)');
  console.log('═'.repeat(70));
  
  // Verify backend is up
  const res = http.get(`${BASE_URL}/zonals/colleges`);
  if (res.status !== 200) {
    console.error(`❌ Backend not reachable! Status: ${res.status}`);
    return { backendUp: false };
  }
  console.log('✓ Backend is reachable');
  
  return { backendUp: true, startTime: Date.now() };
}

export function teardown(data) {
  const duration = data.startTime ? Math.round((Date.now() - data.startTime) / 1000) : 0;
  console.log('═'.repeat(70));
  console.log('  TEST COMPLETE');
  console.log('═'.repeat(70));
  console.log(`  Duration:     ${duration}s`);
  console.log(`  Backend up:   ${data.backendUp ? '✓' : '✗'}`);
  console.log('─'.repeat(70));
  console.log('  ⚠️  Test data created in DB:');
  console.log('      - KY passes with booking IDs starting with "ky-"');
  console.log('      - Zonal passes with booking IDs starting with "zonal-"');
  console.log('      - Users with emails ending in "@loadtest.local"');
  console.log('  Run cleanup query if needed.');
  console.log('═'.repeat(70));
}
