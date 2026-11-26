# Kiến trúc dự kiến

## Trách nhiệm

| Thành phần | Trách nhiệm |
| --- | --- |
| Next.js App Router | React, TypeScript, Tailwind CSS và shadcn/ui cho tra cứu công khai và màn hình theo vai trò. Gọi REST API, hiển thị kết quả và phản hồi khi giờ vừa được đặt. |
| NestJS | Điểm thực thi nghiệp vụ và truy cập database. Chia module theo xác thực, dịch vụ, nhân viên, lịch làm việc, lịch hẹn và dashboard khi cần. Controller nhận request, DTO validate đầu vào, service kiểm tra quyền và nghiệp vụ, truy cập PostgreSQL qua Prisma. Swagger mô tả hợp đồng REST. |
| PostgreSQL | Lưu quan hệ, phân công, lịch làm và lịch hẹn cùng bản chụp giá, thời lượng. Duy trì toàn vẹn tham chiếu và bảo vệ điều kiện chống trùng giữa các giao dịch. Docker Compose cung cấp PostgreSQL local. |

Web lấy giờ trống và kết quả xử lý từ API. Không truy cập database từ Next.js hoặc nhân đôi thuật toán đặt lịch ở frontend. Chưa có nhu cầu tạo repository pattern.

## Cấu trúc dự kiến

| Đường dẫn | Mục đích |
| --- | --- |
| `apps/web/` | Ứng dụng Next.js trong pnpm workspace. |
| `apps/api/` | Ứng dụng NestJS, module nghiệp vụ, Prisma schema và migration. |
| `docs/` | Tài liệu sản phẩm, quy tắc và kế hoạch triển khai. |
| Gốc repository | Cấu hình workspace và Compose sẽ được thêm ở milestone khởi tạo. |

## Luồng ghi lịch

API đọc phân công và dịch vụ, tính thời điểm kết thúc, đối chiếu ca, khoảng nghỉ, ngày nghỉ và lịch giữ chỗ. Khi ghi, cần giữ bản chụp giá và thời lượng nhất quán với dữ liệu đã kiểm tra. PostgreSQL phân xử các yêu cầu đồng thời. API trả kết quả xung đột để web có thể tải lại giờ trống. Thay đổi lịch làm việc cũng phải phối hợp với luồng tạo lịch để việc kiểm tra lịch bị ảnh hưởng còn đúng khi ghi.

Ca định kỳ biểu diễn theo ngày trong tuần và giờ địa phương tại salon. Một lịch hẹn cụ thể có thời điểm tuyệt đối, dự kiến dùng timestamp có múi giờ trong PostgreSQL và chuyển sang giờ salon khi hiển thị.

## Quyết định cần xác minh

- Kiểm tra phiên bản ổn định, tương thích của runtime, pnpm, framework, Prisma và PostgreSQL ở lượt khởi tạo.
- Chọn cách xác thực và quản lý phiên phù hợp với REST API và Next.js.
- Thử nghiệm ràng buộc loại trừ theo nhân viên và khoảng thời gian nửa mở cho hai trạng thái giữ chỗ. Xác minh migration với Prisma, cách ánh xạ lỗi và kết quả khi hai giao dịch ghi đồng thời trên PostgreSQL thật.
- Xác minh cách đồng bộ thao tác đổi cấu hình ca/nghỉ với thao tác đặt lịch. Chốt cách admin giải quyết các lịch bị ảnh hưởng trước khi áp dụng thay đổi.
