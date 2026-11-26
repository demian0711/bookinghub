# ADR 0001 · Phiên đăng nhập và ranh giới tin cậy

**Đã chấp nhận ở M2.** NestJS xác thực và phân quyền. PostgreSQL giữ User và Session. Email được trim, chuyển chữ thường và có ràng buộc duy nhất. Giá trị mặc định của role là CUSTOMER. DTO đăng ký từ chối trường ngoài hợp đồng. Argon2id dùng salt riêng cho mỗi mật khẩu, bộ nhớ 19 MiB, hai lượt và một luồng.

## Vòng đời phiên

Đăng ký trả hồ sơ công khai. Mỗi lần đăng nhập thành công, backend sinh 32 byte ngẫu nhiên và mã hóa base64url. SHA-256 của token là khóa tra cứu trong database. Cookie host-only `bookinghub_session` có `HttpOnly`, `SameSite=Lax`, `Path=/api/v1` và hạn tuyệt đối 7 ngày khớp với `expiresAt`. Production yêu cầu HTTPS và đặt `Secure`. Local development dùng HTTP. Trình duyệt tự gửi cookie, frontend không đọc hoặc lưu token.

AuthGuard mặc định bảo vệ controller. Route công khai phải khai báo `@PublicRoute()`. Mỗi request được bảo vệ phải còn phiên chưa thu hồi, chưa hết hạn và user đang active. Vai trò được đọc từ user hiện tại. `@Roles(...)` giới hạn quyền theo route. Đăng xuất đánh dấu `revokedAt` cho đúng phiên rồi xóa cookie. Các phiên trên thiết bị khác tiếp tục hoạt động. Từ M3, service còn phải kiểm tra quyền trên tài nguyên cụ thể theo quy tắc nghiệp vụ.

## Browser, proxy và CSRF

Trình duyệt gọi `/api/v1` tại origin web. Next.js rewrite sang `API_ORIGIN` ở server, chuyển cookie đi và chuyển Set-Cookie về. NestJS so sánh nguyên văn Origin với `WEB_ORIGIN` cấu hình sẵn và yêu cầu `X-BookingHub-CSRF: 1` cho các method ngoài GET/HEAD/OPTIONS, kể cả login và register. Header này là dấu hiệu request từ JavaScript cùng origin, có thể công khai. Trang khác muốn tự đặt header phải qua CORS preflight và API không cấp quyền CORS. Giữ các method đọc không thay đổi trạng thái.

Không suy ra origin hoặc IP người dùng từ Host, Forwarded hoặc X-Forwarded-*. Express giữ trust proxy mặc định tắt. Throttler cho tối đa 10 request mỗi 60 giây cho từng route login/register theo IP kết nối trực tiếp. Khi qua Next.js, các khách dùng chung hạn mức của proxy. Bộ đếm nằm trong bộ nhớ của một tiến trình và được đặt lại khi khởi động. Nếu triển khai nhiều replica, cần chọn nơi lưu bộ đếm chung và cấu hình rõ proxy tin cậy.

`401` biểu thị yêu cầu đăng nhập lại, `403` biểu thị sai quyền hoặc sai kiểm tra CSRF, `429` yêu cầu thử lại sau. Response auth dùng `Cache-Control: no-store`. JSON hồ sơ chỉ gồm id, email, displayName và role.

Tham khảo [OWASP về header riêng và kiểm tra Origin](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) và [NestJS về rate limiting](https://docs.nestjs.com/security/rate-limiting).
