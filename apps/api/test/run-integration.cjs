const { execFileSync } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

async function run() {
  const name = 'bookinghub-test-' + randomUUID();
  const password = randomBytes(24).toString('hex');
  // Docker tự chọn cổng trống. Chỉ container của lượt chạy này được dọn trong finally.
  const id = execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '-d',
      '--name',
      name,
      '-p',
      '127.0.0.1::5432',
      '--tmpfs',
      '/var/lib/postgresql/data',
      '-e',
      'POSTGRES_DB=bookinghub_integration',
      '-e',
      'POSTGRES_PASSWORD',
      '--health-cmd',
      'pg_isready -h 127.0.0.1 -U postgres -d bookinghub_integration',
      '--health-interval',
      '1s',
      '--health-timeout',
      '2s',
      '--health-retries',
      '60',
      'postgres:17.12',
    ],
    { encoding: 'utf8', env: { ...process.env, POSTGRES_PASSWORD: password } },
  ).trim();
  try {
    const deadline = Date.now() + 90000;
    while (
      execFileSync(
        'docker',
        ['inspect', '--format', '{{.State.Health.Status}}', id],
        { encoding: 'utf8' },
      ).trim() !== 'healthy'
    ) {
      if (Date.now() > deadline)
        throw new Error('Database test chưa sẵn sàng.');
      await delay(500);
    }
    const binding = execFileSync('docker', ['port', id, '5432/tcp'], {
      encoding: 'utf8',
    }).trim();
    if (!/^127\.0\.0\.1:\d+$/.test(binding))
      throw new Error('Cổng test không hợp lệ.');
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      TZ: 'America/Los_Angeles',
      WEB_ORIGIN: 'http://localhost:3000',
      DATABASE_URL: `postgresql://postgres:${password}@${binding}/bookinghub_integration`,
    };
    const options = { env, stdio: 'inherit' };
    execFileSync(
      process.execPath,
      ['./node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      options,
    );
    execFileSync(
      process.execPath,
      [
        '--experimental-vm-modules',
        './node_modules/jest/bin/jest.js',
        '--runInBand',
        '--runTestsByPath',
        'test/auth.test.cjs',
        'test/catalog.test.cjs',
        'test/availability.test.cjs',
        'test/appointment.test.cjs',
      ],
      options,
    );
  } finally {
    execFileSync('docker', ['stop', '--time', '1', id], { stdio: 'ignore' });
  }
}
run().catch(() => {
  process.stderr.write('Kiểm thử tích hợp thất bại. Xem kết quả ở trên.');
  process.exitCode = 1;
});
