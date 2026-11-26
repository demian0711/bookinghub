# ADR 0002 · Ghi lịch hẹn đồng thời

**Đã áp dụng ở M5A.** Mỗi lượt đặt chạy trong một giao dịch PostgreSQL READ COMMITTED. Tất cả tiến trình API dùng cùng khóa trong database.

| Thao tác                                         | Thứ tự khóa và kết quả                                                                                                                                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đặt lịch                                         | Khóa dòng StaffProfile bằng FOR UPDATE, dòng Service bằng FOR SHARE, sau đó dòng User của khách bằng FOR SHARE. Sau khi nhận đủ khóa mới đọc lại phân công, trạng thái, snapshot dịch vụ, ca, nghỉ và thời điểm hiện tại. Giữ khóa đến khi commit. |
| Sửa ca, khoảng nghỉ hoặc ngày nghỉ               | Khóa cùng StaffProfile trước khi đọc các lịch giữ chỗ chưa kết thúc. Nếu cấu hình mới làm sai lịch hiện có, trả 409 kèm mã SCHEDULE_AFFECTS_APPOINTMENTS và danh sách ID cho admin. Giao dịch giữ nguyên cấu hình cũ.                              |
| Thay phân công hoặc sửa nhân viên                | Khóa StaffProfile trước khi thay các dòng phân công hoặc cập nhật User. Nếu admin ngừng nhân viên sau khi khách đã đặt, lịch cũ được giữ. Nếu admin ghi trước, lần đặt sau đọc trạng thái mới.                                                     |
| Đổi giá, thời lượng, tên hoặc active của dịch vụ | UPDATE khóa dòng Service tới khi commit. Lượt đặt đọc trọn bộ giá trị trước hoặc sau thay đổi. Lịch cũ giữ bản chụp.                                                                                                                               |

Việc tuần tự hóa các lần đặt của cùng nhân viên làm đơn giản hóa kiểm tra cấu hình. Hai nhân viên khác nhau có thể nhận lịch đồng thời cho cùng dịch vụ. Nếu thêm thao tác ghi liên quan nhiều nhân viên, phải lấy khóa hồ sơ theo thứ tự UUID trước các khóa dịch vụ.

## Ràng buộc và lỗi

Migration cài extension btree_gist để UUID có phép so sánh bằng trong GiST. Constraint appointment_staff_held_excl kết hợp staffId với phép giao của tstzrange nửa mở. Predicate chỉ xét PENDING và CONFIRMED. PostgreSQL kiểm tra cả INSERT và UPDATE, kể cả đường ghi không qua API.

POST dùng ON CONFLICT ON CONSTRAINT appointment_staff_held_excl DO NOTHING và kiểm tra số dòng được ghi. Không có dòng mới do đúng constraint này thì API trả HTTP 409 với code APPOINTMENT_SLOT_TAKEN. Vi phạm khác hoặc lỗi ghi lịch sử làm giao dịch thất bại; không được gắn mã hết chỗ. DB mới cần có extension trên server và tài khoản migration có quyền cài extension hoặc extension đã được DBA cài sẵn. [PostgreSQL 17 · INSERT](https://www.postgresql.org/docs/17/sql-insert.html)

## Lịch sử và thời gian

Appointment tham chiếu User, StaffProfile và Service bằng khóa ngoại RESTRICT khi xóa. Bản chụp tên, giá và thời lượng cùng startAt/endAt tồn tại độc lập với danh mục. Trigger ghi sự kiện tạo với actor là khách từ phiên; thay đổi status ghi trạng thái trước/sau và thời điểm database. Ở M6, service kiểm tra phạm vi lịch từ phiên, lấy khóa StaffProfile, kiểm tra thời gian sau khi có khóa, đặt actor đã xác thực qua set_config('bookinghub.actor_id', ..., true) và đặt lý do hủy trong cùng transaction. UPDATE chỉ thành công nếu trạng thái nguồn vẫn khớp. Thiếu actor khi chuyển trạng thái làm toàn bộ cập nhật rollback.

Availability đọc cấu hình và lịch giữ chỗ nhất quán ở REPEATABLE READ. Kết quả chỉ đúng tại snapshot của request. Chỉ HTTP 201 từ POST xác nhận đã giữ chỗ.

## M5B · Sửa cấu hình khi đang nhận lịch

POST preview ca trả danh sách lịch bị ảnh hưởng tại thời điểm đọc. Khóa kết thúc cùng transaction của preview. PUT lấy lại khóa hàng StaffProfile và đọc lại các lịch chưa kết thúc ở READ COMMITTED trước khi ghi. Nếu khách vừa đặt thành công, admin nhận 409. Nếu admin ghi trước, khách phải thỏa cấu hình vừa lưu. Xóa ca dùng cùng PUT với mảng ca rỗng. Thay khoảng nghỉ cũng dùng toàn bộ cấu hình của thứ đó.

Thêm ngày nghỉ kiểm tra khoảng nửa mở từ đầu ngày salon đến đầu ngày kế tiếp. PATCH chuyển ngày nghỉ kiểm tra ngày nguồn, ngày đích và lịch giữ chỗ trước khi cập nhật khóa ngày trong cùng transaction. DELETE bỏ ngày nghỉ chỉ mở thêm thời gian làm việc. Mọi thao tác này đều lấy khóa của nhân viên. Lỗi 409 chứa mã lịch, trạng thái và hai thời điểm để admin xác định khoảng cần giữ. Admin có thể chỉnh đề xuất và gửi lại. Việc thay cấu hình không ghi vào lịch hẹn hay lịch sử trạng thái.
