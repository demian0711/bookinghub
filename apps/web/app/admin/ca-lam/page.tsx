import { ScheduleEditor } from '@/components/admin/schedule';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ staffId?: string }>;
}) {
  const q = await searchParams;
  return (
    <ScheduleEditor
      id={typeof q.staffId === 'string' ? q.staffId : undefined}
    />
  );
}
