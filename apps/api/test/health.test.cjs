const { createApplication } = require('../dist/application');
const { afterEach, expect, test } = require('@jest/globals');
const originalUrl = process.env.DATABASE_URL;
let app;
afterEach(async () => {
  if (app) await app.close();
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
});
async function start() {
  app = await createApplication();
  await app.listen(0, '127.0.0.1');
  return (await app.getUrl()) + '/api/v1';
}
test('PostgreSQL trả lời truy vấn readiness qua HTTP', async () => {
  const base = await start();
  const response = await fetch(base + '/ready');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ready' });
});
test('mất kết nối database trả 503, liveness vẫn trả 200', async () => {
  process.env.DATABASE_URL =
    'postgresql://test:private_marker@127.0.0.1:1/unreachable';
  const base = await start();
  const response = await fetch(base + '/ready');
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    statusCode: 503,
    message: 'Database chưa sẵn sàng.',
    error: 'Service Unavailable',
  });
  const health = await fetch(base + '/health');
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ status: 'ok' });
});
