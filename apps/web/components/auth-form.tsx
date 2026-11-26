'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { notifySession, submitAuth } from '@/lib/account';
export function AuthForm({
  register,
  next,
  created = false,
}: {
  register: boolean;
  next: string;
  created?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const target = '?next=' + encodeURIComponent(next);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get('email')).trim();
    const password = String(fields.get('password'));
    const displayName = String(fields.get('displayName') ?? '').trim();
    if (register && !displayName) {
      setError('Vui lòng nhập tên hiển thị.');
      form.querySelector<HTMLInputElement>('#displayName')?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await submitAuth(
        register ? 'register' : 'login',
        register ? { displayName, email, password } : { email, password },
      );
      if (!r.ok) {
        setError(
          (
            {
              401: 'Email hoặc mật khẩu chưa đúng.',
              409: 'Email này đã được đăng ký.',
              429: 'Bạn đã thử nhiều lần. Vui lòng thử lại sau.',
              400: 'Vui lòng kiểm tra lại các trường đã nhập.',
            } as Record<number, string>
          )[r.status] ?? 'Chưa thể xử lý yêu cầu. Vui lòng thử lại.',
        );
        return;
      }
      if (register) {
        window.location.replace('/dang-nhap' + target + '&created=1');
      } else {
        notifySession();
        window.location.replace(next);
      }
    } catch {
      setError('Kết nối bị gián đoạn. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }
  const title = register ? 'Tạo tài khoản' : 'Đăng nhập';
  return (
    <section className="account-panel">
      <h1>{title}</h1>
      {created && !register && (
        <p role="status">Đã tạo tài khoản. Hãy đăng nhập để tiếp tục.</p>
      )}
      <form
        onSubmit={submit}
        onInvalid={(event) => {
          const input = event.target;
          if (input instanceof HTMLInputElement) {
            input.setCustomValidity(
              input.validity.valueMissing
                ? 'Vui lòng điền trường này.'
                : input.type === 'email'
                  ? 'Vui lòng nhập email hợp lệ.'
                  : 'Mật khẩu cần từ 12 đến 128 ký tự.',
            );
          }
        }}
        onInput={(event) => {
          if (event.target instanceof HTMLInputElement)
            event.target.setCustomValidity('');
        }}
      >
        {register && (
          <label htmlFor="displayName">
            Tên hiển thị
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              required
              maxLength={100}
            />
          </label>
        )}
        <label htmlFor="email">
          Email
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label htmlFor="password">
          Mật khẩu
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            required
            minLength={12}
            maxLength={128}
            aria-describedby="password-hint"
          />
        </label>
        <small id="password-hint">Từ 12 đến 128 ký tự.</small>
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'Đang xử lý…' : title}
        </button>
      </form>
      <p>
        {register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
        <Link
          className="text-link"
          href={(register ? '/dang-nhap' : '/dang-ky') + target}
        >
          {register ? 'Đăng nhập' : 'Đăng ký'}
        </Link>
      </p>
    </section>
  );
}
