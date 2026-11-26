# Kiến trúc dự kiến

## Trách nhiệm

| Thành phần         | Trách nhiệm                                                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js App Router | React, TypeScript, Tailwind CSS và shadcn/ui cho tra cứu công khai và màn hình theo vai trò. Gọi REST API, hiển thị kết quả và phản hồi khi giờ vừa được đặt.                                                                                                                               |
| NestJS             | Điểm thực thi nghiệp vụ và truy cập database. Chia module theo xác thực, dịch vụ, nhân viên, lịch làm việc, lịch hẹn và dashboard khi cần. Controller nhận request, DTO validate đầu vào, service kiểm tra quyền và nghiệp vụ, truy cập PostgreSQL qua Prisma. Swagger mô tả hợp đồng REST. |
| PostgreSQL         | Lưu quan hệ, phân công, lịch làm và lịch hẹn cùng bản chụp giá, thời lượng. Duy trì toàn vẹn tham chiếu và bảo vệ điều kiện chống trùng giữa các giao dịch. Docker Compose cung cấp PostgreSQL local.                                                                                       |

Web lấy giờ trống và kết quả xử lý từ API. Không truy cập database từ Next.js hoặc nhân đôi thuật toán đặt lịch ở frontend. Chưa có nhu cầu tạo repository pattern.

## Cấu trúc dự kiến

| Đường dẫn      | Mục đích                                                       |
| -------------- | -------------------------------------------------------------- |
| `apps/web/`    | Ứng dụng Next.js trong pnpm workspace.                         |
| `apps/api/`    | Ứng dụng NestJS, module nghiệp vụ, Prisma schema và migration. |
| `docs/`        | Tài liệu sản phẩm, quy tắc và kế hoạch triển khai.             |
| Gốc repository | Cấu hình workspace và Compose dùng chung cho M1.               |

## Luồng ghi lịch

API đọc phân công và dịch vụ, tính thời điểm kết thúc, đối chiếu ca, khoảng nghỉ, ngày nghỉ và lịch giữ chỗ. Khi ghi, cần giữ bản chụp giá và thời lượng nhất quán với dữ liệu đã kiểm tra. PostgreSQL phân xử các yêu cầu đồng thời. API trả kết quả xung đột để web có thể tải lại giờ trống. Thay đổi lịch làm việc cũng phải phối hợp với luồng tạo lịch để việc kiểm tra lịch bị ảnh hưởng còn đúng khi ghi.

Ca định kỳ biểu diễn theo ngày trong tuần và giờ địa phương tại salon. Một lịch hẹn cụ thể có thời điểm tuyệt đối, dự kiến dùng timestamp có múi giờ trong PostgreSQL và chuyển sang giờ salon khi hiển thị.

## Quyết định cần xác minh

Bộ phiên bản M1 đã được chọn và ghi trong [hướng dẫn thiết lập](setup.md).

Xác thực và phân quyền dùng [session PostgreSQL và cookie cùng origin](adr/0001-auth-session.md).

M5A áp dụng [giao dịch, thứ tự khóa và exclusion constraint](adr/0002-booking-concurrency.md).
