export function returnPath(raw: string | string[] | undefined) {
  // Giới hạn đích quay lại ở các trang sản phẩm đã có. Giữ query và fragment của trang hợp lệ.
  if (
    typeof raw !== 'string' ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('\\') ||
    Array.from(raw).some((c) => c.charCodeAt(0) < 32)
  )
    return undefined;
  try {
    const base = 'https://bookinghub.invalid';
    const url = new URL(raw, base);
    if (
      url.origin === base &&
      /^\/(?:admin(?:\/(?:dich-vu|nhan-vien|ca-lam|lich-hen(?:\/[a-f0-9-]{36})?))?|tai-khoan|dat-lich|(?:staff|lich-cua-toi|dich-vu)(?:\/[a-f0-9-]{36})?)?$/i.test(
        url.pathname,
      )
    )
      return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
  return undefined;
}
export interface User {
  id: string;
  displayName: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
}
export function afterLogin(next: string | undefined, role: User['role']) {
  const target = returnPath(next);
  const section = target?.split(/[/?#]/)[1]?.toLowerCase();
  // Ưu tiên đích hợp lệ khi đăng nhập giữa luồng, còn đăng nhập trực tiếp mở trang theo vai trò.
  if (
    target &&
    (section !== 'admin' || role === 'ADMIN') &&
    (section !== 'staff' || role === 'STAFF') &&
    (section !== 'lich-cua-toi' || role === 'CUSTOMER')
  )
    return target;
  return { CUSTOMER: '/', STAFF: '/staff', ADMIN: '/admin' }[role];
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
