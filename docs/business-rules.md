# Quy tắc nghiệp vụ

## Đặt lịch và giữ chỗ

Mỗi lịch gắn với đúng một khách, một dịch vụ và một nhân viên được phân công dịch vụ đó. NestJS xác định khách từ phiên đăng nhập, lấy giá và thời lượng từ dịch vụ khi đặt, lưu bản chụp hai giá trị này và tính giờ kết thúc. Việc sửa danh mục sau đó phải bảo toàn lịch sử. Dùng ngừng hoạt động khi phù hợp cho dữ liệu đã được tham chiếu.

Giờ bắt đầu gợi ý cách nhau 15 phút. Tính ca định kỳ theo giờ địa phương của salon, `Asia/Ho_Chi_Minh`. Lưu thời điểm bắt đầu và kết thúc lịch hẹn dưới dạng thời điểm tuyệt đối nhất quán. Khi kiểm tra, quy đổi cả ca và khoảng nghỉ của ngày đang xét về cùng trục thời gian với lịch hẹn.

Toàn bộ khoảng `[start, end)` phải thuộc một ca, tránh khoảng nghỉ và ngày nghỉ. Không được đặt trong quá khứ. Lịch mới bắt đầu ở `PENDING`. Cả `PENDING` và `CONFIRMED` giữ chỗ. Hai lịch của cùng nhân viên trùng nhau khi mỗi lịch bắt đầu trước lúc lịch kia kết thúc. NestJS kiểm tra lại tại thời điểm ghi vì giờ trống đã hiển thị có thể vừa được người khác đặt.

PostgreSQL phải bảo vệ điều kiện chống trùng khi các giao dịch đồng thời cùng ghi lịch giữ chỗ. Chỉ đọc kiểm tra trước khi ghi vẫn cho phép hai giao dịch cùng thấy chỗ trống. M5A áp dụng exclusion constraint trong PostgreSQL và trả APPOINTMENT_SLOT_TAKEN khi bị trùng.

## Chuyển trạng thái

| Từ                     | Sang      | Người được phép và điều kiện                                                                      |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| PENDING                | CONFIRMED | STAFF được phân công hoặc ADMIN.                                                                  |
| PENDING hoặc CONFIRMED | CANCELLED | CUSTOMER sở hữu lịch khi còn ít nhất hai giờ. STAFF được phân công hoặc ADMIN phải ghi lý do hủy. |
| CONFIRMED              | COMPLETED | STAFF được phân công hoặc ADMIN, khi thời điểm hiện tại đã đến hoặc qua giờ kết thúc.             |
| CONFIRMED              | NO_SHOW   | STAFF được phân công hoặc ADMIN, khi thời điểm hiện tại đã đến hoặc qua giờ bắt đầu.              |

NestJS kiểm tra danh tính, vai trò, phạm vi lịch, trạng thái nguồn và thời gian theo đồng hồ backend. Chỉ cho phép các chuyển đổi trong bảng. CANCELLED, COMPLETED và NO_SHOW kết thúc vòng đời. Khi hai thao tác cạnh tranh, điều kiện trạng thái nguồn phải còn đúng tại thời điểm cập nhật.

## Trường hợp biên để kiểm thử

| Tình huống                                                | Kết quả mong đợi                                                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Lịch 09:00–09:45, lịch tiếp theo bắt đầu 09:45            | Cho phép nếu các điều kiện khác đạt. Bắt đầu 09:30 với cùng nhân viên sẽ bị chặn khi lịch trước đang giữ chỗ.                     |
| Dịch vụ dài 45 phút bắt đầu 11:30, ca kết thúc 12:00      | Từ chối dù có ca kế tiếp bắt đầu ngay lúc 12:00.                                                                                  |
| Khoảng nghỉ 12:00–13:00                                   | Có thể kết thúc đúng 12:00 hoặc bắt đầu đúng 13:00. Lịch kéo dài qua khoảng nghỉ bị từ chối.                                      |
| Khách hủy lịch 14:00                                      | Đúng 12:00 được hủy, sau 12:00 bị từ chối.                                                                                        |
| Hai khách cùng đặt một nhân viên vào hai khoảng giao nhau | Tối đa một giao dịch thành công. Hai nhân viên khác nhau có thể nhận lịch cùng giờ nếu từng người đủ điều kiện.                   |
| Lịch CONFIRMED bắt đầu 10:00, kết thúc 10:45              | Sớm nhất ghi NO_SHOW lúc 10:00 hoặc COMPLETED lúc 10:45.                                                                          |
| Admin rút ngắn ca, thêm khoảng nghỉ hoặc ngày nghỉ        | Phát hiện các lịch giữ chỗ bị ảnh hưởng và báo cho admin. Chỉ áp dụng cấu hình bảo toàn lịch hiện hữu, không tự hủy hay dời lịch. |

## Danh mục và bảo toàn lịch

M3 lưu giá nguyên 0–10.000.000 VND và thời lượng nguyên 1–480 phút. Bước gợi ý giờ 15 phút không yêu cầu thời lượng là bội số của 15. Backend và PostgreSQL cùng kiểm tra các giới hạn này.

Ngừng dịch vụ hoặc tài khoản nhân viên bằng active=false. Hồ sơ, dịch vụ và phân công vẫn tồn tại. Danh mục công khai chỉ trả nhân viên đang hoạt động được gán cho dịch vụ đang hoạt động. Có thể chuẩn bị phân công trong khi dịch vụ ngừng; phân công chỉ có hiệu lực công khai khi cả hai phía hoạt động.

Ở M5A, API đọc lại trạng thái hai phía và phân công lúc ghi, lấy giá và thời lượng từ dịch vụ trong database để lưu bản chụp trên lịch. Ngừng hoạt động, bỏ phân công hoặc thay đổi giá/thời lượng không tự hủy, dời hay tính lại lịch cũ. Lịch sẽ tham chiếu trực tiếp nhân viên và dịch vụ; bỏ một dòng phân công chỉ thay đổi khả năng nhận lịch mới.

## Lịch làm việc và giờ trống (M4)

Salon dùng múi giờ IANA `Asia/Ho_Chi_Minh`. Ca định kỳ và khoảng nghỉ được lưu dưới dạng số phút trên đồng hồ địa phương; thứ dùng ISO 1–7 (thứ Hai–Chủ nhật). Ngày nghỉ của nhân viên là một ngày lịch, không mang múi giờ. API dùng Temporal và trả thời điểm bắt đầu/kết thúc kèm offset.

- Cửa sổ đặt gồm **hôm nay và 29 ngày tiếp theo** tính theo ngày địa phương salon. Ngày ngoài cửa sổ bị từ chối. Trong ngày hôm nay, loại mọi giờ bắt đầu sớm hơn thời điểm hiện tại; đúng thời điểm hiện tại vẫn hợp lệ.
- Chỉ bắt đầu tại phút **:00, :15, :30, :45**. Ca 09:07 có giờ bắt đầu đầu tiên là 09:15. Giá và thời lượng lấy từ dịch vụ đang hoạt động ở backend.
- Giờ cấu hình dùng HH:mm. Chỉ cho phép 24:00 làm mốc kết thúc ngày. Không hỗ trợ ca qua nửa đêm. Mỗi ca và mỗi khoảng nghỉ phải có start < end. Các ca cùng nhân viên và thứ không chồng nhau; các khoảng nghỉ nằm trọn trong ca cha và không chồng nhau.
- Dùng khoảng nửa mở [start, end). Dịch vụ phải nằm trọn trong **một** ca, không ghép các ca kể cả khi nối sát. Có thể kết thúc đúng lúc bắt đầu nghỉ hoặc kết thúc ca, và bắt đầu đúng lúc hết nghỉ. Ngày nghỉ chặn toàn bộ ca của nhân viên trong ngày đó.
- M5A chỉ trả giờ phù hợp cấu hình cho cặp nhân viên–dịch vụ đang hoạt động và có phân công. API đọc các lịch PENDING/CONFIRMED của nhân viên, loại mọi khoảng giao với chúng và kiểm tra lại khi ghi lịch. Thao tác tạo lịch và thay đổi cấu hình phải phối hợp khóa cùng nhân viên để phát hiện lịch bị ảnh hưởng.
