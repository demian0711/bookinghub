# BookingHub

BookingHub là dự án portfolio Fullstack cho một salon tóc có một chi nhánh. Web hỗ trợ đặt và quản lý lịch cho khách, xử lý lịch được phân công cho nhân viên và quản lý salon cho quản trị viên. Xem [hướng dẫn khởi động trên Windows](docs/setup.md), [checklist phát hành](docs/release-checklist.md) và [báo cáo kiểm tra](docs/test-report.md).

## Phạm vi

- Khách có thể xem dịch vụ, nhân viên và giờ trống trước khi đăng nhập. Sau khi đăng nhập, khách có thể đặt, xem và hủy lịch của mình theo chính sách.
- Nhân viên xử lý lịch được phân công. Quản trị viên quản lý dịch vụ, nhân viên, ca làm, khoảng nghỉ, ngày nghỉ, toàn bộ lịch hẹn và dashboard cơ bản.
- Khi cần đổi lịch, khách hủy lịch cũ theo chính sách rồi đặt lịch mới. Chi tiết phạm vi và tiêu chí nghiệm thu nằm trong [yêu cầu sản phẩm](docs/product-requirements.md).

## Công nghệ

Monorepo dùng pnpm workspace. Web dùng Next.js App Router, React, TypeScript, Tailwind CSS và shadcn/ui. API dùng NestJS, REST, Prisma, PostgreSQL và Swagger. PostgreSQL cục bộ chạy bằng Docker Compose. Jest kiểm tra backend và Playwright kiểm tra xuyên suốt trên trình duyệt. Bộ phiên bản M1 được ghi trong hướng dẫn khởi động.

## Lộ trình

1. Ghi nhận [quy tắc đặt lịch](docs/business-rules.md) và [kiến trúc dự kiến](docs/architecture.md) trong lượt thiết kế này.
2. Khởi tạo workspace, sau đó xây dựng xác thực, phân quyền và dữ liệu dịch vụ, nhân viên.
3. Xây dựng lịch làm việc, tra cứu giờ trống, đặt lịch chống trùng và xử lý trạng thái.
4. Hoàn thiện các luồng giao diện, dashboard và kiểm thử xuyên suốt.

Xem [milestone và điều kiện kiểm tra](docs/implementation-plan.md), [quy trình phát triển](docs/development-workflow.md) và [hướng dẫn làm việc trong repo](AGENTS.md).
