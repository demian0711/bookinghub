# Checklist phát hành BookingHub

Kết quả theo từng lệnh nằm trong [báo cáo M9](test-report.md).

## M9 · Kiểm tra bản ứng viên

- [x] Đối chiếu quyền ở controller và phạm vi lịch ở service cho CUSTOMER, STAFF và ADMIN.
- [x] Rà soát vòng đời session, cookie, CSRF và giới hạn đăng nhập/đăng ký. Kiểm tra API công khai, dữ liệu trả về và cache của dữ liệu cá nhân, giờ trống.
- [x] Rà soát truy vấn phân trang, chỉ mục theo khách/nhân viên/ngày, tổng hợp dashboard và khóa khi đặt lịch hoặc đổi cấu hình.
- [x] Rà soát tệp Git theo dõi, mẫu môi trường và các dấu hiệu khóa/token thông dụng.
- [x] Dựng PostgreSQL trống bằng migration trên container riêng. Chạy lại seed trong bộ tích hợp.
- [x] Kiểm tra kết quả cuối của unit, smoke, integration, E2E HTTPS và build trong báo cáo.
- [ ] Xem kết quả workflow GitHub Actions của bản ứng viên và kiểm tra artifact khi E2E thất bại.

## M10 · Kiểm tra ở môi trường đích

- [ ] Xác minh origin HTTPS, đích proxy API và cách xử lý giới hạn đăng nhập qua proxy.
- [ ] Xác minh PostgreSQL, quyền dùng migration và extension `btree_gist`. Sao lưu trước khi migrate và thử khôi phục trên database riêng.
- [ ] Xác minh HTTPS, cookie `Secure`, health/readiness và luồng khách, nhân viên, admin trên cấu hình đích.
- [ ] Ghi bản build đang phát hành, kế hoạch quay lui ứng dụng và phương án khôi phục dữ liệu.
