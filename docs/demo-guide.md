# Demo BookingHub trong 5–10 phút

Demo dùng ba phiên trình duyệt cùng mở <http://localhost:3000>, chẳng hạn ba profile riêng. Điều này giữ cookie CUSTOMER, STAFF và ADMIN độc lập. Dùng dữ liệu mẫu trên PostgreSQL local và chọn một ngày trong cửa sổ đặt, từ thứ Hai đến thứ Bảy. [Khởi động và seed](../README.md#chạy-nhanh-bằng-git-bash-trên-windows)

## Chuẩn bị

- Chạy database, migration và seed. Khởi động web cùng API bằng `pnpm dev`.
- Sử dụng ba email đã được seed và mật khẩu tự đặt. Chọn **Mai Nguyễn** (`staff-mai@demo.bookinghub.test`) cho kịch bản này.
- Chọn ngày còn trống, cách thời điểm hiện tại hơn hai giờ nếu muốn thử hủy. Seed mới có ca 09:00–17:00 và nghỉ 12:00–13:00 theo giờ salon.

## 1. CUSTOMER · Chọn giờ và đặt lịch (2–3 phút)

1. Mở **Dịch vụ → Gội và sấy tạo kiểu → Chọn nhân viên và giờ**. Chọn **Mai Nguyễn**, ngày thử và một giờ trống.
2. Bấm **Tiếp tục → Đăng nhập để xác nhận**. Dùng `customer@demo.bookinghub.test`. Kiểm tra trang quay lại đúng dịch vụ, nhân viên, ngày và giờ đã chọn.
3. Bấm **Xác nhận đặt lịch**. Mở **Lịch của tôi** để đối chiếu lịch mới ở trạng thái **Chờ xác nhận** và giá, thời lượng lúc đặt. Giữ tab khách để kiểm tra sau khi nhân viên xác nhận.

## 2. STAFF · Xem lịch được giao và xác nhận (1–2 phút)

1. Đăng nhập ở profile thứ hai bằng `staff-mai@demo.bookinghub.test`. Trong **Lịch làm việc của tôi**, chọn đúng ngày salon và bấm **Xem lịch**.
2. Mở lịch vừa tạo. Bấm **Xác nhận lịch** rồi **Lưu thay đổi** trong hộp thoại.
3. Tải lại tab khách. Lịch và lịch sử hiển thị **Đã xác nhận**. Trên trang đặt lịch, slot đang giữ biến mất cho Mai Nguyễn. Nhân viên khác vẫn có thể nhận cùng giờ nếu có ca và được phân công dịch vụ.

## 3. ADMIN · Đối chiếu dashboard và bản chụp (2–3 phút)

1. Đăng nhập ở profile thứ ba bằng `admin@demo.bookinghub.test`. Tại **Tổng quan salon**, đặt **Từ ngày** và **Đến ngày** cùng bằng ngày vừa đặt, rồi bấm **Áp dụng**.
2. Mở liên kết đối chiếu danh sách lịch và tìm đúng lịch đã xác nhận. Quay lại để kiểm tra bộ lọc khoảng ngày vẫn được giữ. Trên DB có sẵn lịch mẫu hoặc các lần demo trước, tổng số sẽ gồm các lịch khác trong khoảng lọc.
3. Trên DB demo, có thể đổi tạm giá hoặc thời lượng của dịch vụ. Mở lại chi tiết lịch cũ ở tab khách và đối chiếu bản chụp. Sau khi xem, nhập lại cấu hình ban đầu nếu cần dùng kịch bản lần nữa.
4. Nếu còn thời gian, thử lưu ca không chứa giờ của lịch vừa xác nhận. Backend phải báo lịch bị ảnh hưởng và giữ ca cũ. Chỉ làm bước này với dữ liệu demo.

## Kết thúc phiên demo

Lịch đã xác nhận tiếp tục giữ chỗ. Nếu muốn dùng lại slot, khách có thể hủy khi còn ít nhất hai giờ trước lịch hẹn. STAFF hoặc ADMIN có thể hủy lịch còn ở trạng thái hợp lệ và cần điền lý do. Không cần reset database để chạy lại demo, có thể chọn slot khác.

## Chụp ảnh lại khi cần

Dùng profile trình duyệt sạch, chỉ mở dữ liệu giả và ẩn thông tin trình duyệt bên ngoài nội dung web. Ở viewport desktop khoảng 1440 px, lưu năm ảnh vào `docs/screenshots/` theo tên sau.

| Tệp                         | Màn hình cần chụp                                               |
| --------------------------- | --------------------------------------------------------------- |
| `01-trang-chu.png`          | Trang chủ, gồm phần giới thiệu và nút đặt lịch                  |
| `02-chon-gio.png`           | Trang đặt lịch khi đã chọn dịch vụ, nhân viên, ngày và một slot |
| `03-lich-cua-khach.png`     | **Lịch của tôi** sau khi nhân viên xác nhận lịch                |
| `04-lich-nhan-vien.png`     | **Lịch làm việc của tôi** ở ngày có lịch mẫu                    |
| `05-dashboard-quan-tri.png` | **Tổng quan salon** với khoảng ngày có dữ liệu                  |

Ảnh chỉ cần nội dung sản phẩm. Giữ email thật, mật khẩu, cookie, URL chứa dữ liệu nhạy cảm và thông báo máy cá nhân ngoài ảnh.
