# Báo cáo kiểm tra M9

Đây là kết quả lịch sử trên máy kiểm thử. Chế độ production và HTTPS trong báo cáo dùng Next.js/NestJS local với chứng chỉ loopback. Phiên bản portfolio hiện tại chạy local.

**Môi trường** Windows và Git Bash, PostgreSQL 17.12 trên Docker, Google Chrome. Bộ tích hợp và trình duyệt tạo container tạm, áp dụng cả sáu migration và dọn container sau lượt chạy. Smoke health/readiness đọc PostgreSQL Compose cục bộ. Database người dùng không bị reset.

## Lỗi đã sửa

| Phát hiện                                                                            | Sửa và kiểm tra hồi quy                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Biểu mẫu chứa mật khẩu dùng phương thức HTML mặc định khi JavaScript chưa hoạt động. | Khai báo POST trên form đăng nhập/đăng ký và form quản trị tạo nhân viên. Playwright tắt JavaScript để kiểm tra request đăng nhập/đăng ký dùng POST và URL không chứa trường form. |
| Một số phản hồi quản trị và lỗi xác thực của API thiếu chỉ thị tránh cache.          | Áp dụng `Cache-Control: private, no-store` toàn API. Test quyền dùng endpoint quản trị thật và kiểm tra chỉ thị cache trên phản hồi thành công, 401 và 403.                        |
| Bộ E2E cũ chỉ chạy API ở chế độ test qua HTTP.                                       | Chạy NestJS production và Next.js production qua HTTPS loopback, dùng chứng chỉ tự ký mới mỗi lượt. Kiểm tra readiness, Swagger production và thuộc tính cookie từ Chrome.         |

## Kết quả theo lệnh

| Lệnh                                                                   | Kết quả quan sát                                                                                                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                       | Đạt                                                                                                                                                            |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `git diff --check` | Đạt                                                                                                                                                            |
| `pnpm test:unit`                                                       | 3/3 đạt, gồm mốc chuyển ngày và biên ca/nghỉ                                                                                                                   |
| `pnpm db:up`, `pnpm test`                                              | PostgreSQL Compose healthy, 2/2 smoke test đạt                                                                                                                 |
| `pnpm test:integration`                                                | 41/41 đạt, gồm quyền, cookie hết hạn/thu hồi, CSRF, rate limit, dữ liệu trả về, đặt trùng, đổi cấu hình cạnh tranh, thời hạn hủy và seed chạy lại              |
| `pnpm test:web`                                                        | Đạt kiểm tra đăng ký, đăng nhập, reload, cách ly phiên, đăng xuất và quay lại an toàn trên Chrome                                                              |
| `pnpm build`                                                           | Build production Next.js và biên dịch NestJS đạt                                                                                                               |
| `pnpm test:e2e`                                                        | 12/12 đạt. HTTPS production kiểm tra đăng ký, cookie Secure, đặt/xem/hủy lịch, xử lý staff, cấu hình và dashboard admin. Readiness trả 200 và Swagger trả 404. |

Rà soát tệp theo dõi bằng `git ls-files`, tìm mẫu khóa riêng và token phổ biến bằng `git grep`, và đọc các `.env.example`. Các giá trị tìm thấy trong mẫu môi trường dùng cho local. Kiểm tra hiện tại bao phủ cây tệp được theo dõi và các mẫu đã tìm.

## Phạm vi còn cần xác minh

Các mục liên quan đến dịch vụ đích được hoãn cùng M10.

- Chạy workflow trên GitHub Actions, gồm tải artifact khi Playwright lỗi. Local đã tạo trace và HTML report trong lượt lỗi. CI dùng Chromium do Playwright cài đặt.
- Kiểm tra proxy và chứng chỉ tin cậy, sao lưu/khôi phục và migration trên môi trường phát hành đã chọn. Smoke HTTPS hiện dùng chứng chỉ tự ký và PostgreSQL trắng riêng.
- Kiểm tra tải theo dữ liệu vận hành. Rate limit hiện tính theo IP kết nối tới API và bộ nhớ từng tiến trình, vì vậy các khách qua cùng proxy chia sẻ hạn mức.
- E2E vẫn ghi cảnh báo deprecation về truy vấn qua driver pg trong một luồng quản trị. Bộ test hiện đạt trên phiên bản đang khóa.
- Kiểm thử rộng hơn trên trình duyệt khác và bằng trình đọc màn hình. Chrome bao phủ viewport 320 px, 390 px và desktop, gồm thao tác bàn phím trong khu vực nhân viên.
