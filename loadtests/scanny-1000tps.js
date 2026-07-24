import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

/**
 * Scanny mixed 1000 TPS readiness scenario.
 *
 * Traffic mix (approx):
 *   40% menu GET
 *   25% menu scan POST
 *   20% order create
 *   10% payment initiate/status
 *   5%  light reads (health / providers)
 *
 * Usage:
 *   k6 run -e BASE_URL=http://localhost:4000 -e BUSINESSES=1000 loadtests/scanny-1000tps.js
 *
 * Sustained gate (plan):
 *   k6 run --vus 200 --duration 15m -e BASE_URL=https://api.scanny.app loadtests/scanny-1000tps.js
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const BUSINESS_COUNT = Number(__ENV.BUSINESSES || 1000);

const errorRate = new Rate('scanny_errors');
const menuLatency = new Trend('scanny_menu_ms', true);
const orderLatency = new Trend('scanny_order_ms', true);
const scanLatency = new Trend('scanny_scan_ms', true);
const paymentLatency = new Trend('scanny_payment_ms', true);
const okCount = new Counter('scanny_ok');

const businesses = new SharedArray('businesses', () => {
  const ids = [];
  for (let i = 1; i <= BUSINESS_COUNT; i++) {
    ids.push(`biz-load-${i}`);
  }
  return ids;
});

export const options = {
  scenarios: {
    mixed_peak: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.TPS || 1000),
      timeUnit: '1s',
      duration: __ENV.DURATION || '2m',
      preAllocatedVUs: Number(__ENV.VUS || 300),
      maxVUs: Number(__ENV.MAX_VUS || 800),
    },
  },
  thresholds: {
    scanny_errors: ['rate<0.001'],
    http_req_failed: ['rate<0.001'],
    scanny_menu_ms: ['p(99)<200'],
    scanny_order_ms: ['p(99)<200'],
    scanny_scan_ms: ['p(99)<200'],
  },
};

function pickBusiness() {
  return businesses[Math.floor(Math.random() * businesses.length)];
}

function record(res, trend, okStatuses) {
  const ok = okStatuses.includes(res.status);
  errorRate.add(!ok);
  if (ok) {
    okCount.add(1);
  }
  trend.add(res.timings.duration);
  return ok;
}

export default function () {
  const roll = Math.random();
  const businessId = pickBusiness();
  const headers = { 'Content-Type': 'application/json', 'User-Agent': `k6-${__VU}` };

  if (roll < 0.4) {
    const res = http.get(`${BASE_URL}/api/businesses/${businessId}/menu`, { headers, tags: { name: 'menu' } });
    check(res, { 'menu ok': (r) => r.status === 200 || r.status === 404 });
    record(res, menuLatency, [200, 404]);
  } else if (roll < 0.65) {
    const res = http.post(
      `${BASE_URL}/api/businesses/${businessId}/scans`,
      null,
      { headers, tags: { name: 'scan' } }
    );
    check(res, { 'scan ok': (r) => r.status === 204 || r.status === 404 || r.status === 429 });
    record(res, scanLatency, [204, 404, 429]);
  } else if (roll < 0.85) {
    const payload = JSON.stringify({
      customer: { name: `Load ${__VU}`, phone: '0700000000', note: 'k6' },
      items: [{ itemId: 'ITM-LOAD-1', quantity: 1 }],
    });
    const res = http.post(`${BASE_URL}/api/businesses/${businessId}/orders`, payload, {
      headers,
      tags: { name: 'order' },
    });
    check(res, { 'order ok': (r) => [201, 200, 400, 404].includes(r.status) });
    // 400/404 expected until seed data exists; still counts toward capacity of the write path
    record(res, orderLatency, [200, 201, 400, 404]);
  } else if (roll < 0.95) {
    const initiate = http.post(
      `${BASE_URL}/api/payments/initiate`,
      JSON.stringify({
        context: 'ORDER',
        referenceId: `ORD-LOAD-${__VU}-${Date.now()}`,
        amount: 1000,
        currency: 'UGX',
        customerPhone: '0700000000',
        provider: 'stub',
        businessId,
      }),
      { headers, tags: { name: 'pay_init' } }
    );
    record(initiate, paymentLatency, [200, 400, 404, 429]);
    if (initiate.status === 200) {
      let paymentId = null;
      try {
        paymentId = initiate.json('paymentId');
      } catch (_) {
        paymentId = null;
      }
      if (paymentId) {
        const status = http.get(`${BASE_URL}/api/payments/${paymentId}/status`, {
          headers,
          tags: { name: 'pay_status' },
        });
        record(status, paymentLatency, [200]);
      }
    }
  } else {
    const res = http.get(`${BASE_URL}/api/payments/providers`, { headers, tags: { name: 'providers' } });
    check(res, { 'providers ok': (r) => r.status === 200 });
    record(res, menuLatency, [200]);
  }

  sleep(0.01);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        tps_target: Number(__ENV.TPS || 1000),
        duration: __ENV.DURATION || '2m',
        http_reqs: data.metrics.http_reqs && data.metrics.http_reqs.values,
        scanny_errors: data.metrics.scanny_errors && data.metrics.scanny_errors.values,
        thresholds: data.root_group && data.root_group.checks,
      },
      null,
      2
    ),
  };
}
