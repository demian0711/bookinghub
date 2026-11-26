# Hướng dẫn làm việc trong BookingHub

Áp dụng cho toàn bộ repository.

## Trước khi sửa

- Đọc yêu cầu của lượt giao việc, tài liệu liên quan trong `docs/`, hướng dẫn có hiệu lực ở thư mục đích và code hiện có. Kiểm tra nhánh, trạng thái Git và diff để bảo toàn thay đổi chưa commit.
- Chỉ triển khai phạm vi được giao. Nêu điểm chưa rõ hoặc xung đột với nghiệp vụ trước khi đưa ra quyết định ảnh hưởng người dùng.

## Khi triển khai

- Bật TypeScript strict. Tránh `any` và việc tắt lint để che lỗi. Đặt tên code bằng tiếng Anh. Viết tài liệu và comment giải thích bằng tiếng Việt.
- Dùng comment cho quy tắc, lý do, ràng buộc và đoạn xử lý khó. Bỏ comment chỉ diễn giải lại từng dòng hiển nhiên.
- Chỉ rõ nguồn tin cậy của dữ liệu. Ví dụ, lấy danh tính từ phiên đã xác thực, giá và thời lượng từ danh mục tại backend. Validate DTO và kiểm tra nghiệp vụ tại NestJS, kể cả khi giao diện đã kiểm tra.
- Kiểm tra cả vai trò lẫn quyền sở hữu hoặc phân công trên từng tài nguyên. Giữ controller mỏng, đặt nghiệp vụ trong service theo module. Chỉ thêm abstraction khi có lý do cụ thể.
- Không commit secrets, tệp `.env` thật, `node_modules` hoặc build output. Chỉ dùng placeholder an toàn trong `.env.example`. Không log mật khẩu, token hoặc dữ liệu nhạy cảm.

## Kiểm tra và bàn giao

- Khi thay đổi nghiệp vụ, cập nhật tài liệu và test liên quan trong cùng thay đổi. Viết test có ý nghĩa cho nghiệp vụ, phân quyền và tính đồng thời. Kiểm tra bảo vệ chống trùng trên PostgreSQL thật.
- Không dùng mock thay cho nghiệp vụ thật trong tính năng báo hoàn thành. Chỉ báo test hoặc build đạt khi đã chạy và quan sát kết quả.
- Báo cáo thay đổi, lệnh kiểm tra đã chạy, kết quả và hạn chế còn lại. Chỉ commit, push hoặc triển khai khi lượt giao việc yêu cầu.
