import { Reports } from '@/components/admin/reports';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const from = typeof q.from === 'string' ? q.from : undefined,
    to = typeof q.to === 'string' ? q.to : undefined,
    status = typeof q.status === 'string' ? q.status : undefined,
    serviceId = typeof q.serviceId === 'string' ? q.serviceId : undefined;
  return (
    <Reports
      key={JSON.stringify([from, to, status, serviceId])}
      initial={{ from, to, status, serviceId }}
    />
  );
}
