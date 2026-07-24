import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

/**
 * Local proof run against seeded H2 businesses (kampala-grill, city-lounge).
 * Not a 1000-restaurant / 1000 TPS production gate — validates hot paths under load.
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

const errorRate = new Rate('scanny_errors');
const menuLatency = new Trend('scanny_menu_ms', true);
const orderLatency = new Trend('scanny_order_ms', true);
const scanLatency = new Trend('scanny_scan_ms', true);
const paymentLatency = new Trend('scanny_payment_ms', true);
const okCount = new Counter('scanny_ok');

const shops = [
  { id: 'kampala-grill', items: ['beef-plate', 'chicken-wrap', 'passion-juice'] },
  { id: 'city-lounge', items: ['mocktail', 'wings'] },
];

export const options = {
  scenarios: {
    mixed_peak: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.TPS || 50),
      timeUnit: '1s',
      duration: __ENV.DURATION || '60s',
      preAllocatedVUs: Number(__ENV.VUS || 50),
      maxVUs: Number(__ENV.MAX_VUS || 200),
    },
  },
  thresholds: {
    scanny_errors: ['rate<0.05'],
    http_req_failed: ['rate<0.05'],
    scanny_menu_ms: ['p(95)<500'],
    scanny_scan_ms: ['p(95)<500'],
    scanny_order_ms: ['p(95)<1000'],
  },
};

function shop() {
  return shops[Math.floor(Math.random() * shops.length)];
}

function record(res, trend, okStatuses) {
  const ok = okStatuses.includes(res.status);
  errorRate.add(!ok);
  if (ok) okCount.add(1);
  trend.add(res.timings.duration);
  return ok;
}

export default function () {
  const roll = Math.random();
  const s = shop();
  const headers = { 'Content-Type': 'application/json', 'User-Agent': `k6-local-${__VU}` };

  if (roll < 0.4) {
    const res = http.get(`${BASE_URL}/api/businesses/${s.id}/menu`, { headers, tags: { name: 'menu' } });
    check(res, { 'menu 200': (r) => r.status === 200 });
    record(res, menuLatency, [200]);
  } else if (roll < 0.65) {
    const res = http.post(`${BASE_URL}/api/businesses/${s.id}/scans`, null, { headers, tags: { name: 'scan' } });
    check(res, { 'scan ok': (r) => r.status === 204 || r.status === 429 });
    record(res, scanLatency, [204, 429]);
  } else if (roll < 0.85) {
    const itemId = s.items[Math.floor(Math.random() * s.items.length)];
    const payload = JSON.stringify({
      customer: { name: `Load ${__VU}`, phone: '0700123456', note: 'k6-local' },
      items: [{ itemId, quantity: 1 }],
    });
    const res = http.post(`${BASE_URL}/api/businesses/${s.id}/orders`, payload, {
      headers,
      tags: { name: 'order' },
    });
    check(res, { 'order created': (r) => r.status === 200 || r.status === 201 });
    record(res, orderLatency, [200, 201]);
  } else if (roll < 0.95) {
    // create a cheap order first so payment has a reference when possible
    const itemId = s.items[0];
    const orderRes = http.post(
      `${BASE_URL}/api/businesses/${s.id}/orders`,
      JSON.stringify({
        customer: { name: `Pay ${__VU}`, phone: '0700123456' },
        items: [{ itemId, quantity: 1 }],
      }),
      { headers, tags: { name: 'order_for_pay' } }
    );
    let referenceId = `ORD-FAKE-${__VU}-${Date.now()}`;
    if (orderRes.status === 200 || orderRes.status === 201) {
      try {
        referenceId = orderRes.json('order.id') || orderRes.json('id') || referenceId;
      } catch (_) {}
    }
    const initiate = http.post(
      `${BASE_URL}/api/payments/initiate`,
      JSON.stringify({
        context: 'ORDER',
        referenceId,
        amount: 1000,
        currency: 'UGX',
        customerPhone: '0700123456',
        provider: 'stub',
        businessId: s.id,
      }),
      { headers, tags: { name: 'pay_init' } }
    );
    record(initiate, paymentLatency, [200, 400, 404]);
    if (initiate.status === 200) {
      try {
        const paymentId = initiate.json('paymentId');
        if (paymentId) {
          const status = http.get(`${BASE_URL}/api/payments/${paymentId}/status`, {
            headers,
            tags: { name: 'pay_status' },
          });
          record(status, paymentLatency, [200]);
        }
      } catch (_) {}
    }
  } else {
    const res = http.get(`${BASE_URL}/api/payments/providers`, { headers, tags: { name: 'providers' } });
    check(res, { 'providers 200': (r) => r.status === 200 });
    record(res, menuLatency, [200]);
  }

  sleep(0.01);
}
