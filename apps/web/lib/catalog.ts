export interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceVnd: number;
}
export interface ServicePage {
  items: Service[];
  hasNext: boolean;
}
export const price = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
    amount,
  );
