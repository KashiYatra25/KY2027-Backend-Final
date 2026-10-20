// ═══════════════════════════════════════════════════════════════════
// K6 LOAD TEST - Zonals Registration Flow
//
// Simulates heavy traffic during zonals event registration:
//   - Multiple users checking passes
//   - Concurrent event registrations
//   - Pass purchase webhook simulation
//
// Run: k6 run zonals-stress.js
// ═══════════════════════════════════════════════════════════════════

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const registrationSuccess = new Counter('registration_success');
const registrationFailed = new Counter('registration_failed');
const passCheckLatency = new Trend('pass_check_latency');

export const options = {
  // Simulate registration rush
  scenarios: {
    // Steady browsing traffic
    browsers: {
      executor: 'constant-vus',
      vus: 20,
      duration: '3m',
      exec: 'browsingUsers',
    },
    // Spike of registrations
    registrations: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 200,
      stages: [
        { duration: '30s', target: 10 },  // Warm up
        { duration: '1m', target: 50 },   // Heavy load
        { duration: '30s', target: 100 }, // Spike
        { duration: '1m', target: 20 },   // Cool down
      ],
      exec: 'registerForEvent',
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // Allow 1s for complex operations
    registration_failed: ['count<50'],   // Max 50 failed registrations
    pass_check_latency: ['p(95)<200'],   // Pass check should be fast
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000/api/v1';
const COLLEGES = ['rgipt', 'iitbhu', 'bhu'];

// ───────────────────────────────────────────────────────────────────
// BROWSING USERS - Check colleges and events
// ───────────────────────────────────────────────────────────────────

export function browsingUsers() {
  group('Browse Zonals', function () {
    // Get colleges list
    let res = http.get(`${BASE_URL}/zonals/colleges`);
    check(res, { 'colleges loaded': (r) => r.status === 200 });
    
    sleep(1);
    
    // Browse a random college's page (simulated by loading events)
    const college = COLLEGES[Math.floor(Math.random() * COLLEGES.length)];
    res = http.get(`${BASE_URL}/events?category=zonals&college=${college}`);
    check(res, { 'college events loaded': (r) => r.status === 200 });
    
    sleep(2);
  });
}

// ───────────────────────────────────────────────────────────────────
// REGISTRATION FLOW - User checks passes and registers
// ───────────────────────────────────────────────────────────────────

export function registerForEvent() {
  // Note: This requires auth. Without real auth tokens, we test the flow
  // that would happen if user is NOT logged in (should get 401)
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  group('Check Passes', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/zonals/my-passes`, { headers });
    passCheckLatency.add(Date.now() - start);
    
    // Expect 401 since we're not authenticated
    check(res, {
      'passes endpoint responds': (r) => r.status === 401 || r.status === 200,
    });
  });
  
  group('Attempt Registration', function () {
    // Pick random event ID (in real test, would get from events list)
    const eventId = `event-${Math.floor(Math.random() * 100)}`;
    const college = COLLEGES[Math.floor(Math.random() * COLLEGES.length)];
    
    const payload = JSON.stringify({
      eventId: eventId,
    });
    
    const res = http.post(
      `${BASE_URL}/zonals/colleges/${college}/register`,
      payload,
      { headers }
    );
    
    if (res.status === 200 || res.status === 201) {
      registrationSuccess.add(1);
    } else if (res.status !== 401) {
      // 401 is expected without auth, other errors count as failures
      registrationFailed.add(1);
    }
    
    check(res, {
      'registration handled': (r) => r.status !== 500,
    });
  });
  
  sleep(0.5);
}

// ───────────────────────────────────────────────────────────────────
// WEBHOOK SIMULATION (optional - tests webhook endpoint)
// ───────────────────────────────────────────────────────────────────

export function webhookStress() {
  // Simulate KonfHub webhook calls
  // This would need the correct secret and payload format
  
  const secret = __ENV.WEBHOOK_SECRET || 'test-secret';
  
  const payload = JSON.stringify({
    event_id: 'test-event',
    ticket_name: 'RGIPT Single Event Pass',
    attendee: {
      email: `test${Math.random()}@example.com`,
      KY_ID: `KY-2027-${Math.floor(Math.random() * 10000)}`,
    },
  });
  
  const res = http.post(
    `${BASE_URL}/payment/webhooks/zonals?secret=${secret}`,
    payload,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(res, {
    'webhook processed': (r) => r.status !== 500,
  });
}
