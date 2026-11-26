import { redirect } from 'next/navigation';
import { Booking } from '@/components/booking';
export const metadata = { title: 'Đặt lịch salon' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const value = (key: string) => (typeof q[key] === 'string' ? q[key] : '');
  if (!value('serviceId')) redirect('/dich-vu');
  const page = Number(value('staffPage'));
  const draft = {
    serviceId: value('serviceId'),
    staffId: value('staffId'),
    date: value('date'),
    startAt: value('startAt'),
    staffPage:
      Number.isInteger(page) && page >= 1 && page <= 1000000 ? page : 1,
  };
  return <Booking key={JSON.stringify(draft)} draft={draft} />;
}
