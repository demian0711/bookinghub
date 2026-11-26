import { StaffList } from '@/components/staff-list';
import { statusNames } from '@/lib/appointments';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const date =
    typeof q.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(q.date)
      ? q.date
      : undefined;
  const status =
    typeof q.status === 'string' && Object.hasOwn(statusNames, q.status)
      ? q.status
      : '';
  const page = Number(q.page);
  return (
    <StaffList
      key={JSON.stringify([date, status, page])}
      date={date}
      status={status}
      page={Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1}
    />
  );
}
