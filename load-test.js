import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
};

export default function () {
  let res = http.get('http://localhost:3000/api/projects');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
