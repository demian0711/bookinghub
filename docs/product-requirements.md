# Yêu cầu sản phẩm

BookingHub phục vụ một salon tóc, một chi nhánh. Các tiêu chí dưới đây dùng để nghiệm thu các lượt triển khai sau.

| Người dùng | Nhu cầu | Tiêu chí chấp nhận |
| --- | --- | --- |
| Khách chưa đăng nhập | Tôi muốn chọn dịch vụ, nhân viên và giờ phù hợp. | Có thể xem danh mục và giờ trống công khai. Chỉ gợi ý nhân viên nhận dịch vụ đã chọn và giờ đáp ứng toàn bộ thời lượng. API yêu cầu đăng nhập khi đặt. |
| CUSTOMER | Tôi muốn đặt một dịch vụ với một nhân viên. | API xác định khách từ phiên, kiểm tra giờ còn hợp lệ khi ghi, lưu giá và thời lượng tại lúc đặt. Hai yêu cầu trùng giờ cho cùng nhân viên chỉ có tối đa một yêu cầu giữ được chỗ. |
| CUSTOMER | Tôi muốn xem và hủy lịch của mình. | Chỉ truy cập được lịch thuộc về mình. Có thể hủy lịch đang giữ chỗ khi còn ít nhất hai giờ. API từ chối khi đã qua mốc hoặc khi khách thao tác lên lịch người khác. |
| STAFF | Tôi muốn xem và xử lý các lịch được phân công. | Chỉ xem và chuyển trạng thái lịch được giao, đúng thời điểm cho phép. Khi hủy phải nhập lý do. |
| ADMIN | Tôi muốn quản lý dịch vụ, nhân viên và phân công dịch vụ. | Có thể cập nhật giá, thời lượng và phân công. Lịch đã đặt giữ nguyên thông tin giá, thời lượng và các tham chiếu lịch sử. |
| ADMIN | Tôi muốn quản lý ca làm, khoảng nghỉ và ngày nghỉ. | Giờ trống phản ánh cấu hình làm việc. Khi thay đổi ảnh hưởng lịch đang giữ chỗ, hệ thống chỉ ra các lịch bị ảnh hưởng trước khi áp dụng và bảo toàn lịch hiện hữu. |
| ADMIN | Tôi muốn theo dõi và xử lý lịch toàn salon. | Xem và xử lý lịch của mọi nhân viên theo cùng bảng trạng thái, ghi lý do khi hủy. Dashboard cơ bản dùng dữ liệu lịch toàn salon, có thể đối chiếu với danh sách lịch theo cùng điều kiện. Chỉ số cụ thể còn mở. |

## Giới hạn

Chưa đưa vào phạm vi nhiều chi nhánh, thanh toán, voucher, chat, AI, realtime, Google Calendar, email và SMS. Đổi lịch thực hiện theo hai thao tác độc lập, hủy lịch cũ theo chính sách rồi đặt lịch mới. Lịch mới vẫn phải qua kiểm tra giờ trống.

[Bảng trạng thái và các trường hợp biên](business-rules.md) quy định chi tiết cách nghiệm thu các luồng trên.
