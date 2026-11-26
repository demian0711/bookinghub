# Chạy BookingHub bằng Git Bash trên Windows

Mở Git Bash tại gốc repository (thư mục có `compose.yaml`). Dự án dùng Node 22.14.0, pnpm 10.32.1, Next.js 16.4.6, NestJS 11.2.12, Prisma 7.10.1 và PostgreSQL 17.12. Lockfile ở gốc dùng chung cho Windows và CI Linux.

Nguồn đối chiếu gồm [vòng đời Node](https://nodejs.org/en/about/previous-releases), [cài Next.js](https://nextjs.org/docs/app/getting-started/installation), [yêu cầu NestJS 11](https://docs.nestjs.com/migration-guide), [yêu cầu Prisma](https://www.prisma.io/docs/orm/reference/system-requirements) và [các nhánh PostgreSQL được hỗ trợ](https://www.postgresql.org/support/versioning/).

## Công cụ

1. Cài [Git for Windows](https://git-scm.com/downloads/win) và [Node.js 22.14.0](https://nodejs.org/dist/v22.14.0/) nếu thiếu. Kiểm tra bằng `git --version` và `node -v`.
2. Kiểm tra `pnpm --version`. Nếu thiếu hoặc sai phiên bản, chạy `npm install --global pnpm@10.32.1`, mở lại Git Bash và kiểm tra kết quả là `10.32.1`. Dùng `type -a pnpm` để xem thứ tự tìm lệnh khi có nhiều bản.
3. Cài [Docker Desktop cho Windows](https://docs.docker.com/desktop/setup/install/windows-install/), chọn Linux containers và khởi động Docker Desktop. Chạy `docker compose version` để kiểm tra CLI và `docker info` để kiểm tra kết nối tới Engine.

## Chuẩn bị env

Chạy từ gốc repo. `cp -n` giữ nguyên file đích nếu đã tồn tại.

```bash
cp -n .env.example .env
cp -n apps/api/.env.example apps/api/.env
cp -n apps/web/.env.example apps/web/.env.local
```

| File                  | Nơi đọc                   | Cấu hình                                                                                                                              |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `.env`                | Docker Compose ở gốc      | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` dùng để khởi tạo volume. `POSTGRES_PORT` là cổng trên máy Windows, mặc định 5432. |
| `apps/api/.env`       | Node khi chạy API và Jest | `DATABASE_URL` phải khớp với cổng, database và thông tin đăng nhập của Compose. `PORT=4000`, `NODE_ENV=development` bật Swagger.      |
| `apps/web/.env.local` | Next.js phía server       | `API_ORIGIN` mặc định là http://127.0.0.1:4000. Trình duyệt gọi đường dẫn cùng origin `/api/v1`.                                      |

API chạy trên máy Windows nên dùng host `127.0.0.1` và cổng do Compose publish. Với env mẫu, đích là `127.0.0.1:5432/bookinghub`. Nếu đã đổi cấu hình Compose, đối chiếu lại URL trong env của API. Biến đã export trong shell được ưu tiên hơn file. Nếu từng export URL database tạm để test, chạy `unset DATABASE_URL` trong Git Bash trước khi khởi động API hoặc Jest.

Prisma Client được sinh khi chạy dev, typecheck, test hoặc build. M1 chưa có migration nghiệp vụ.

## Khởi động và kiểm tra

```bash
pnpm install --frozen-lockfile
pnpm db:up
docker compose ps
pnpm dev
```

Mở http://localhost:3000 rồi bấm **Kiểm tra kết nối**. Swagger ở http://localhost:4000/api/docs trong development. Từ một cửa sổ Git Bash thứ hai, kiểm tra API trực tiếp và readiness qua proxy của web.

```bash
curl -i http://localhost:4000/api/v1/health
curl -i http://localhost:3000/api/v1/ready
```

Health trả HTTP 200 khi API đang chạy. Ready trả HTTP 200 sau khi API truy vấn thành công PostgreSQL. Để kiểm tra mất kết nối, giữ dev chạy, dùng `pnpm db:down` ở cửa sổ thứ hai rồi gọi lại hai URL. Health phải trả 200 và ready trả 503. Chạy `pnpm db:up` rồi gọi lại ready để xác nhận phục hồi.

Dừng dev bằng Ctrl+C trước khi chạy bộ kiểm tra để tránh các tiến trình cùng ghi output. Giữ PostgreSQL chạy cho smoke test.

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm db:down
```

Lệnh `db:down` giữ volume cho lần chạy tiếp theo.

## Chẩn đoán

- **Không kết nối được Docker** — mở Docker Desktop và chờ `docker info` đọc được trạng thái server. Kiểm tra service bằng `docker compose ps` và `docker compose logs postgres`.
- **Ready trả 503** — đối chiếu hai file env và cổng publish bằng `docker compose port postgres 5432`. Volume đã khởi tạo giữ tài khoản và mật khẩu ban đầu. Khởi động lại dev sau khi sửa env của API.
- **Cổng đã dùng** — chạy `netstat -ano | grep -E ':(3000|4000|5432)[[:space:]]'` trong Git Bash. Nếu đổi cổng PostgreSQL, cập nhật cả `POSTGRES_PORT` và `DATABASE_URL`. Nếu đổi cổng API, cập nhật `API_ORIGIN` rồi khởi động lại web hoặc build lại.
