export const statusNames = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
  COMPLETED: 'Đã hoàn thành',
  NO_SHOW: 'Không đến',
};
export type Status = keyof typeof statusNames;
export interface Appointment {
  id: string;
  serviceName: string;
  priceVnd: number;
  durationMinutes: number;
  startAt: string;
  endAt: string;
  status: Status;
}
const zone = 'Asia/Ho_Chi_Minh';
export const dayText = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: zone,
    dateStyle: 'long',
  }).format(new Date(value));
export const timeText = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
export function salonDay(offset = 0) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(
    new Date(Date.now() + offset * 86400000),
  );
}
export function writeAppointment(
  path: string,
  method: 'POST' | 'PATCH',
  body: object,
) {
  return fetch('/api/v1/appointments' + path, {
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-BookingHub-CSRF': '1' },
    body: JSON.stringify(body),
  });
}
