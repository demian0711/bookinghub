import Link from 'next/link';
import { StaffDetail } from '@/components/staff-detail';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = new URLSearchParams();
  const selected = await searchParams;
  for (const key of ['from', 'to', 'status', 'serviceId', 'page']) {
    const value = selected[key];
    if (typeof value === 'string') query.set(key, value);
  }
  return (
    <>
      <Link
        href={'/admin/lich-hen' + (query.size ? '?' + query : '')}
        className="text-link"
      >
        ← Quay lại danh sách lịch
      </Link>
      <StaffDetail id={id} area="admin" />
    </>
  );
}
