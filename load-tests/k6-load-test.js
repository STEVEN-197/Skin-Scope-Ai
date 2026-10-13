import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Ramp-up to 50 users
    { duration: '40s', target: 100 }, // Hold 100 concurrent virtual users
    { duration: '10s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500', 'avg<500'], // Avg response time < 500ms, 95% < 1.5s
    http_req_failed: ['rate<0.01'],               // Error rate < 1%
  },
};

const BASE_URL = __ENV.SKINSCOPE_BASE_URL || 'https://skinscopeai-main.vercel.app';

export default function () {
  // 1. Home page & Lovable interface assets
  const res1 = http.get(`${BASE_URL}/`);
  check(res1, {
    'home status 200': (r) => r.status === 200,
    'theme-color present': (r) => r.body && r.body.includes('theme-color'),
  });

  sleep(0.5);

  // 2. Authentication view
  const res2 = http.get(`${BASE_URL}/login`);
  check(res2, {
    'login route 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // 3. Manifest and critical static asset response
  const res3 = http.get(`${BASE_URL}/manifest.webmanifest`);
  check(res3, {
    'manifest accessible': (r) => r.status === 200,
  });

  sleep(1);
}
