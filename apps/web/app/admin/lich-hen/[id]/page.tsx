import { StaffDetail } from '@/components/staff-detail';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <StaffDetail id={(await params).id} area="admin" />;
}
