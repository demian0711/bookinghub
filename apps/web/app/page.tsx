'use client';
import { useState } from 'react';
export default function Home() {
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  async function checkReadiness() {
    setPending(true);
    try {
      const response = await fetch('/api/v1/ready', { cache: 'no-store' });
      setStatus(
        response.ok
          ? 'API và database đã sẵn sàng.'
          : 'Hệ thống chưa sẵn sàng.',
      );
    } catch {
      setStatus('Không thể kết nối tới API.');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="font-serif text-6xl">BookingHub</h1>
      <p className="mt-5 text-xl">
        Ứng dụng đặt lịch cho salon tóc đang được xây dựng.
      </p>
      <button
        onClick={checkReadiness}
        disabled={pending}
        className="mt-10 rounded bg-stone-800 px-5 py-3 text-white disabled:opacity-60"
      >
        {pending ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
      </button>
      <p role="status" className="mt-3">
        {status}
      </p>
    </main>
  );
}
