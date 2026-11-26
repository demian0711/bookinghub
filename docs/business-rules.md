# Quy tắc nghiệp vụ

## Đặt lịch và giữ chỗ

Mỗi lịch gắn với đúng một khách, một dịch vụ và một nhân viên được phân công dịch vụ đó. NestJS xác định khách từ phiên đăng nhập, lấy giá và thời lượng từ dịch vụ khi đặt, lưu bản chụp hai giá trị này và tính giờ kết thúc. Việc sửa danh mục sau đó phải bảo toàn lịch sử. Dùng ngừng hoạt động khi phù hợp cho dữ liệu đã được tham chiếu.

Giờ bắt đầu gợi ý cách nhau 15 phút. Tính ca định kỳ theo giờ địa phương của salon, `Asia/Ho_Chi_Minh`. Lưu thời điểm bắt đầu và kết thúc lịch hẹn dưới dạng thời điểm tuyệt đối nhất quán. Khi kiểm tra, quy đổi cả ca và khoảng nghỉ của ngày đang xét về cùng trục thời gian với lịch hẹn.

Toàn bộ khoảng `[start, end)` phải thuộc một ca, tránh khoảng nghỉ và ngày nghỉ. Không được đặt trong quá khứ. Lịch mới bắt đầu ở `PENDING`. Cả `PENDING` và `CONFIRMED` giữ chỗ. Hai lịch của cùng nhân viên trùng nhau khi mỗi lịch bắt đầu trước lúc lịch kia kết thúc. NestJS kiểm tra lại tại thời điểm ghi vì giờ trống đã hiển thị có thể vừa được người khác đặt.

PostgreSQL phải bảo vệ điều kiện chống trùng khi các giao dịch đồng thời cùng ghi lịch giữ chỗ. Chỉ đọc kiểm tra trước khi ghi vẫn cho phép hai giao dịch cùng thấy chỗ trống. Cơ chế cụ thể cần được kiểm chứng bằng kiểm thử tích hợp.

## Chuyển trạng thái

| Từ | Sang | Người được phép và điều kiện |
| --- | --- | --- |
| PENDING | CONFIRMED | STAFF được phân công hoặc ADMIN. |
| PENDING hoặc CONFIRMED | CANCELLED | CUSTOMER sở hữu lịch khi còn ít nhất hai giờ. STAFF được phân công hoặc ADMIN phải ghi lý do hủy. |
| CONFIRMED | COMPLETED | STAFF được phân công hoặc ADMIN, khi thời điểm hiện tại đã đến hoặc qua giờ kết thúc. |
| CONFIRMED | NO_SHOW | STAFF được phân công hoặc ADMIN, khi thời điểm hiện tại đã đến hoặc qua giờ bắt đầu. |

NestJS kiểm tra danh tính, vai trò, phạm vi lịch, trạng thái nguồn và thời gian theo đồng hồ backend. Chỉ cho phép các chuyển đổi trong bảng. CANCELLED, COMPLETED và NO_SHOW kết thúc vòng đời. Khi hai thao tác cạnh tranh, điều kiện trạng thái nguồn phải còn đúng tại thời điểm cập nhật.

## Trường hợp biên để kiểm thử

| Tình huống | Kết quả mong đợi |
| --- | --- |
| Lịch 09:00–09:45, lịch tiếp theo bắt đầu 09:45 | Cho phép nếu các điều kiện khác đạt. Bắt đầu 09:30 với cùng nhân viên sẽ bị chặn khi lịch trước đang giữ chỗ. |
| Dịch vụ dài 45 phút bắt đầu 11:30, ca kết thúc 12:00 | Từ chối dù có ca kế tiếp bắt đầu ngay lúc 12:00. |
| Khoảng nghỉ 12:00–13:00 | Có thể kết thúc đúng 12:00 hoặc bắt đầu đúng 13:00. Lịch kéo dài qua khoảng nghỉ bị từ chối. |
| Khách hủy lịch 14:00 | Đúng 12:00 được hủy, sau 12:00 bị từ chối. |
| Hai khách cùng đặt một nhân viên vào hai khoảng giao nhau | Tối đa một giao dịch thành công. Hai nhân viên khác nhau có thể nhận lịch cùng giờ nếu từng người đủ điều kiện. |
| Lịch CONFIRMED bắt đầu 10:00, kết thúc 10:45 | Sớm nhất ghi NO_SHOW lúc 10:00 hoặc COMPLETED lúc 10:45. |
| Admin rút ngắn ca, thêm khoảng nghỉ hoặc ngày nghỉ | Phát hiện các lịch giữ chỗ bị ảnh hưởng và báo cho admin. Chỉ áp dụng cấu hình bảo toàn lịch hiện hữu, không tự hủy hay dời lịch. |
