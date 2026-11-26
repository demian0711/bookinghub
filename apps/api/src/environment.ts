export function readEnvironment() {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const url = URL.parse(databaseUrl);
  if (
    !url ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length < 2
  ) {
    throw new Error(
      'DATABASE_URL phải là URL PostgreSQL có tên máy chủ và database.',
    );
  }
  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT phải nằm trong khoảng 1–65535.');
  const mode = process.env.NODE_ENV ?? 'development';
  if (!['production', 'development', 'test'].includes(mode))
    throw new Error('NODE_ENV không hợp lệ.');
  return { databaseUrl, port, mode };
}
