export function returnPath(raw: string | string[] | undefined) {
  // Giới hạn đích quay lại ở các trang sản phẩm đã có. Giữ query và fragment của trang hợp lệ.
  if (
    typeof raw !== 'string' ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('\\') ||
    Array.from(raw).some((c) => c.charCodeAt(0) < 32)
  )
    return '/tai-khoan';
  try {
    const base = 'https://bookinghub.invalid';
    const url = new URL(raw, base);
    if (
      url.origin === base &&
      /^\/(?:tai-khoan|dat-lich|(?:lich-cua-toi|dich-vu)(?:\/[a-f0-9-]{36})?)?$/i.test(
        url.pathname,
      )
    )
      return url.pathname + url.search + url.hash;
  } catch {
    return '/tai-khoan';
  }
  return '/tai-khoan';
}
export interface User {
  id: string;
  displayName: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
}
export function submitAuth(
  action: 'register' | 'login' | 'logout',
  data?: object,
) {
  return fetch('/api/v1/auth/' + action, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'X-BookingHub-CSRF': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
export function notifySession() {
  const channel = new BroadcastChannel('bookinghub-session');
  channel.postMessage('refresh');
  channel.close();
}
