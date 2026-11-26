'use client';
import { useEffect, useRef, useState } from 'react';
import { notifySession, submitAuth, type User } from '@/lib/account';
export function Account() {
  const [user, setUser] = useState<User | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const loggingOut = useRef(false);
  useEffect(() => {
    let active: AbortController | undefined;
    async function load() {
      if (loggingOut.current) return;
      active?.abort();
      const request = new AbortController();
      active = request;
      setUser(null);
      setError('');
      try {
        const r = await fetch('/api/v1/auth/me', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: request.signal,
        });
        if (request.signal.aborted || loggingOut.current) return;
        if (r.status === 401) {
          window.location.replace('/dang-nhap?next=/tai-khoan');
          return;
        }
        if (!r.ok) throw Error();
        const current: User = await r.json();
        if (!request.signal.aborted && !loggingOut.current) setUser(current);
      } catch {
        if (!request.signal.aborted && !loggingOut.current)
          setError('Chưa tải được tài khoản.');
      }
    }
    const channel = new BroadcastChannel('bookinghub-session');
    channel.onmessage = load;
    function visible() {
      if (document.visibilityState === 'visible') void load();
    }
    void load();
    window.addEventListener('pageshow', load);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active?.abort();
      channel.close();
      window.removeEventListener('pageshow', load);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  async function logout() {
    loggingOut.current = true;
    setBusy(true);
    setError('');
    try {
      const r = await submitAuth('logout');
      if (!r.ok && r.status !== 401) throw Error();
      setUser(null);
      notifySession();
      window.location.replace('/');
    } catch {
      setError('Chưa đăng xuất được. Vui lòng thử lại.');
      loggingOut.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="account-panel">
      <h1>Tài khoản</h1>
      {error && (
        <p role="alert">
          {error}{' '}
          {!user && (
            <button onClick={() => window.location.reload()}>Thử lại</button>
          )}
        </p>
      )}
      {user ? (
        <>
          <dl>
            <div>
              <dt>Tên hiển thị</dt>
              <dd>{user.displayName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
          <button disabled={busy} className="secondary" onClick={logout}>
            {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </>
      ) : (
        !error && <p role="status">Đang tải tài khoản…</p>
      )}
    </section>
  );
}
