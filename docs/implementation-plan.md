# Kế hoạch triển khai

Các milestone sau bước thiết kế là công việc dự kiến. Mỗi hàng có đầu ra đủ nhỏ để review riêng.

| Mốc | Phụ thuộc | Đầu ra | Tiêu chí kiểm tra |
| --- | --- | --- | --- |
| M0 · Tài liệu nền tảng | Yêu cầu sản phẩm | README, AGENTS và bộ tài liệu trong docs | Phạm vi, quyền, thời gian, trạng thái và trách nhiệm kỹ thuật nhất quán. |
| M1 · Khởi tạo | M0 | pnpm workspace, web/API tối thiểu, PostgreSQL local qua Compose, kết nối Prisma | Xác minh và ghi nhận phiên bản tương thích. Hai ứng dụng khởi động, API kết nối được database, các script kiểm tra cơ bản chạy được. |
| M2 · Danh tính | M1 | Xác thực, ba vai trò và kiểm tra quyền API | Jest kiểm tra request thiếu phiên và sai vai trò bị từ chối. |
| M3 · Danh mục | M2 | Dịch vụ, nhân viên, phân công và API tra cứu công khai | Admin cập nhật được giá, thời lượng và phân công. Khách chỉ tra cứu, dữ liệu được tham chiếu được bảo toàn. |
| M4 · Lịch làm và giờ trống | M3 | Ca, khoảng nghỉ, ngày nghỉ, API gợi ý giờ theo dịch vụ và nhân viên | Kiểm tra bước 15 phút, múi giờ salon, lịch sát biên và dịch vụ vượt ca hoặc chạm khoảng nghỉ. |
| M5 · Tạo lịch và bảo vệ dữ liệu | M4 | Tạo PENDING, lưu bản chụp, bảo vệ chống trùng ở PostgreSQL, kiểm tra ảnh hưởng khi sửa lịch làm | Hai giao dịch cạnh tranh chỉ giữ được một chỗ. Lịch nối tiếp hợp lệ. Giờ trống loại cả PENDING và CONFIRMED. Sửa giá không đổi lịch cũ. Sửa ca hoặc ngày nghỉ báo đúng lịch bị ảnh hưởng, kể cả khi có yêu cầu đặt đồng thời. |
| M6 · Xử lý lịch hẹn | M5 | API xem lịch và thao tác theo bảng trạng thái | Kiểm tra quyền sở hữu/phân công, lý do hủy, mốc hai giờ, thời điểm hoàn thành và NO_SHOW, chuyển đổi từ trạng thái kết thúc. |
| M7 · Web cho khách | M6 | Xem dịch vụ, chọn giờ, đăng nhập, đặt, xem và hủy lịch | Playwright chạy luồng qua API thật, bao gồm phản hồi khi giờ vừa hết chỗ. |
| M8 · Web vận hành | M6, M7 | Màn hình staff/admin và dashboard cơ bản | Kiểm tra staff chỉ xử lý lịch được giao, admin quản lý toàn salon. Đối chiếu số liệu dashboard với lịch thực và kiểm tra lại luồng khách sau thay đổi cấu hình. |

Trước M1 cần kiểm tra bộ phiên bản. Trước M2 chốt cách quản lý phiên. Trước M5 xác minh cơ chế chống trùng và xử lý thay đổi lịch làm. Trước M8 chốt chỉ số và kỳ thống kê cho dashboard.
