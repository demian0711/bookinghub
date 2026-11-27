import { Reports } from '@/components/admin/reports';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const from = typeof q.from === 'string' ? q.from : undefined;
  const to = typeof q.to === 'string' ? q.to : undefined;
  return (
    <Reports
      key={JSON.stringify([from, to])}
      dashboard
      initial={{ from, to }}
    />
  );
}
