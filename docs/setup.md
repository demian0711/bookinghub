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

Prisma Client được sinh khi chạy dev, typecheck, test hoặc build. M2 dùng migration cho User và Session.

## Khởi động và kiểm tra

```bash
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
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

## Xác thực M2

Sau khi `pnpm db:up`, chạy `pnpm db:migrate` để áp dụng migration bằng DATABASE_URL của API. Lệnh dùng migrate deploy và giữ dữ liệu hiện có. Mặc định WEB_ORIGIN là `http://localhost:3000` ở development/test. Nếu dùng host khác, đặt chính xác origin web (không có dấu / cuối) trong `apps/api/.env` rồi khởi động lại API. Production yêu cầu WEB_ORIGIN dùng HTTPS.

Để tạo tài khoản demo, đặt ba mật khẩu riêng dài 12–128 ký tự trong Git Bash. Cú pháp dưới đây đọc ẩn và chỉ bật seed cho một lệnh. Tên đăng nhập là `customer@demo.bookinghub.test`, `staff@demo.bookinghub.test` và `admin@demo.bookinghub.test`. Seed chỉ tạo email chưa tồn tại trên PostgreSQL loopback ở development.

```bash
for role in CUSTOMER STAFF ADMIN; do
  read -rsp "Mật khẩu demo cho $role: " "DEMO_${role}_PASSWORD"; echo
  export "DEMO_${role}_PASSWORD"
done
NODE_ENV=development ALLOW_DEMO_SEED=1 pnpm db:seed
unset DEMO_CUSTOMER_PASSWORD DEMO_STAFF_PASSWORD DEMO_ADMIN_PASSWORD
```

### Kiểm tra bằng HTTP client

Chạy `pnpm dev`. Dùng Postman với cookie jar bật và gửi qua `http://localhost:3000/api/v1` để kiểm tra cả proxy. Trong mỗi POST, đặt hai header `Origin: http://localhost:3000` và `X-BookingHub-CSRF: 1`. Chọn JSON cho request body. Swagger development mô tả hợp đồng tại http://localhost:4000/api/docs. Thử thao tác ghi bằng HTTP client vì Swagger trên cổng 4000 có origin khác web.

| Thứ tự | Request             | Body và kết quả                                                                                                                   |
| ------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1      | POST /auth/register | JSON gồm email, password (12–128 ký tự) và displayName (1–100 ký tự). Nhận 201 với role CUSTOMER. Bỏ qua nếu dùng tài khoản seed. |
| 2      | POST /auth/login    | JSON gồm email và password. Nhận 200 và cookie HttpOnly trong cookie jar.                                                         |
| 3      | GET /auth/me        | Cookie jar tự gửi cookie. Nhận 200 với id, email, displayName, role.                                                              |
| 4      | POST /auth/logout   | Gửi hai header như trên và cookie hiện tại. Nhận 204.                                                                             |
| 5      | GET /auth/me        | Nhận 401 sau đăng xuất.                                                                                                           |

Thiếu header CSRF hoặc sai Origin trả 403. Tài khoản bị khóa và mật khẩu sai đều trả 401 khi đăng nhập. Xem [ADR về session và cookie](adr/0001-auth-session.md) cho hạn phiên và giới hạn tần suất.

### Kiểm thử với PostgreSQL riêng

Chạy `pnpm test:integration` từ gốc khi Docker Engine hoạt động. Runner tạo container PostgreSQL mới với mật khẩu và cổng loopback ngẫu nhiên, dùng tmpfs, áp dụng migration, chạy Jest qua HTTP rồi dừng container. DATABASE_URL của test được lấy từ container này. Database local vẫn được giữ cho smoke test M1 (`pnpm test`).

## Kiểm tra danh mục M3 bằng Git Bash

**Cách nhanh nhất** là mở Docker Desktop, rồi chạy `pnpm test:integration` tại gốc repo. Test tự tạo tài khoản, dịch vụ và phân công trong PostgreSQL tạm, gửi HTTP đến NestJS thật và dọn container khi xong.

### Xem API công khai trong trình duyệt

1. Tại gốc repo, chạy `pnpm db:up` rồi `pnpm db:migrate`. Nếu cần dữ liệu mẫu, chạy phần tạo ba tài khoản demo bên trên bằng mật khẩu bạn tự đặt. Seed M3 tạo dịch vụ **Cắt và tạo kiểu** (150.000 VND, 45 phút) và gán cho tài khoản staff demo. Nếu đã seed từ M2, chạy lại seed để thêm danh mục; mật khẩu đã có vẫn được giữ.
2. Chạy `pnpm dev`, giữ cửa sổ Git Bash mở. Nếu đã có một phiên dev đang chạy, dùng lại phiên đó sau khi đã sinh Prisma Client mới và khởi động lại API.
3. Mở http://localhost:3000/api/v1/services trong Chrome. Danh sách nằm trong `items`. Nếu danh mục trống, kết quả hợp lệ là `items: []`.
4. Sau khi seed, mở http://localhost:3000/api/v1/services/bedc0c0a-d5a3-483a-adcb-772ffc926c88/staff để xem nhân viên được phân công. Kết quả công khai chỉ gồm `id`, `displayName` và `bio`.
5. Thử http://localhost:3000/api/v1/services?page=1&pageSize=2&sort=priceVnd&order=desc . Thêm `q` để tìm theo tên, không phân biệt hoa thường. Danh sách dịch vụ cho sort theo `name`, `priceVnd`, `durationMinutes`; danh sách nhân viên theo `displayName`. Hai chiều hợp lệ là `asc` và `desc`. Page bắt đầu từ 1, pageSize mặc định 20, tối đa 50. `hasNext` báo còn trang sau. ID được dùng để thứ tự ổn định khi giá trị sort bằng nhau.

### Thử quyền admin bằng curl

Mở **cửa sổ Git Bash thứ hai**. Dùng mật khẩu bạn đã seed cho `admin@demo.bookinghub.test`. Cookie lưu trong tệp tạm ngoài repo; terminal không hiển thị mật khẩu khi nhập.

```bash
base=http://localhost:3000/api/v1
jar=$(mktemp)
headers=(-H 'Origin: http://localhost:3000' -H 'X-BookingHub-CSRF: 1' -H 'Content-Type: application/json')
read -rsp 'Mật khẩu admin demo: ' DEMO_ADMIN_PASSWORD; echo
export DEMO_ADMIN_PASSWORD
node -e "console.log(JSON.stringify({email:'admin@demo.bookinghub.test',password:process.env.DEMO_ADMIN_PASSWORD}))" |
  curl -sS -c "$jar" "${headers[@]}" --data-binary @- "$base/auth/login"
unset DEMO_ADMIN_PASSWORD
```

Kết quả đăng nhập phải có `"role":"ADMIN"`. Tạo dịch vụ thử:

```bash
curl -sS -b "$jar" "${headers[@]}" "$base/admin/services" \
  -d '{"name":"Goi dau thu","description":"Dich vu test","priceVnd":80000,"durationMinutes":30}'
```

Copy `id` của dịch vụ vừa tạo vào biến `service_id` dưới đây. Khi chạy lệnh PATCH, dịch vụ biến mất khỏi phần công khai. HTTP 404 ở lệnh cuối là kết quả mong đợi.

```bash
service_id='THAY-BANG-ID-VUA-TAO'
curl -sS -b "$jar" "${headers[@]}" -X PATCH "$base/admin/services/$service_id" -d '{"active":false}'
curl -i "$base/services/$service_id"
```

| Endpoint sau `/api/v1`                                      | Thao tác                                                                                                                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /services, GET /services/{id}, GET /services/{id}/staff | Tra cứu công khai. Dịch vụ đã ngừng hoặc ID không tồn tại trả 404 ở hai route theo ID.                                                                                           |
| GET /admin/services, GET /admin/staff                       | Xem cả bản ghi đã ngừng, dùng cùng quy ước tìm kiếm và phân trang. Danh sách nhân viên admin có email, trạng thái và serviceIds.                                                 |
| POST /admin/services, PATCH /admin/services/{id}            | Tạo hoặc sửa tên, mô tả, giá và thời lượng. PATCH nhận thêm `active`; gửi true để mở lại.                                                                                        |
| POST /admin/staff                                           | JSON gồm email, password (12–128 ký tự), displayName và bio tùy chọn. Server tự gán STAFF.                                                                                       |
| PATCH /admin/staff/{id}                                     | Sửa displayName, bio hoặc active. Trạng thái active dùng chung với tài khoản đăng nhập.                                                                                          |
| PUT /admin/staff/{id}/services                              | JSON dạng `{"serviceIds":["UUID-dịch-vụ"]}`. Gửi toàn bộ danh sách mong muốn; mảng rỗng bỏ hết phân công, UUID trùng trả 400, UUID không tồn tại trả 404 và giữ bộ phân công cũ. |

Khi xong, thu hồi phiên và dọn cookie tạm:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -b "$jar" "${headers[@]}" -X POST "$base/auth/logout"
rm -f -- "$jar"
```

Swagger tại http://localhost:4000/api/docs có nhóm `catalog` và `admin/catalog`. Dùng Git Bash như trên cho request ghi để gửi đúng cookie và Origin.

## M4 · Kiểm tra giờ trống bằng Git Bash

**Cách nhanh:** mở Docker Desktop, mở Git Bash ở gốc repo rồi chạy `pnpm test:integration`. Bài test tự tạo nhân viên, dịch vụ, ca và ngày nghỉ trong PostgreSQL riêng. Bạn không cần Postman hoặc tài khoản demo cho cách này.

### Xem giờ trống của nhân viên demo

1. Ở Git Bash, chạy `pnpm install --frozen-lockfile`, `pnpm db:up`, rồi `pnpm db:migrate`. Chạy lại bước **tạo tài khoản demo** ở mục Xác thực M2 để bổ sung ca làm cho tài khoản staff demo. Seed tạo lịch thứ Hai–thứ Bảy, 09:00–17:00, nghỉ 12:00–13:00. Seed giữ nguyên các thứ đã được admin cấu hình, kể cả thứ có danh sách ca rỗng.
2. Chạy `pnpm dev` và giữ cửa sổ này mở. Mở một Git Bash thứ hai tại gốc repo. Dán các lệnh dưới đây. Chúng chọn dịch vụ mẫu, lấy ID nhân viên được phân công và tính ngày thứ Hai kế tiếp theo giờ salon.

```bash
base=http://localhost:3000/api/v1
service=bedc0c0a-d5a3-483a-adcb-772ffc926c88
staff=$(curl -fsS "$base/services/$service/staff" | node -pe "JSON.parse(require('node:fs').readFileSync(0,'utf8')).items[0]?.id ?? ''")
day=$(pnpm --filter @bookinghub/api exec node -p "((d)=>d.add({days:8-d.dayOfWeek}).toString())(require('@js-temporal/polyfill').Temporal.Now.plainDateISO('Asia/Ho_Chi_Minh'))")
curl -sS -G "$base/availability" --data-urlencode "serviceId=$service" --data-urlencode "staffId=$staff" --data-urlencode "date=$day"
```

3. Đọc mảng `slots`. Với seed mặc định và dịch vụ 45 phút, suất đầu là 09:00–09:45, suất cuối trước giờ nghỉ là 11:15–12:00, suất đầu sau nghỉ bắt đầu lúc 13:00. Timestamp có hậu tố `+07:00`. Nếu biến `staff` rỗng, kiểm tra phân công và trạng thái dịch vụ/nhân viên ở M3. Nếu `slots` rỗng với HTTP 200, cấu hình hợp lệ nhưng ngày đã chọn không còn giờ phù hợp.

### Sửa cấu hình bằng tài khoản ADMIN

Dùng bước đăng nhập bằng curl ở mục M3 để có biến `jar` và `headers` trong cùng cửa sổ Git Bash. Các request ghi cần cookie, `Origin` và `X-BookingHub-CSRF`. Đường dẫn gốc bên dưới dành riêng cho nhân viên đang chọn.

```bash
schedule="$base/admin/staff/$staff/schedule"
curl -sS -b "$jar" "$schedule"
```

| Method và đường dẫn                                    | Ý nghĩa                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| GET /admin/staff/{staffId}/schedule                    | Trả `week` và `daysOff`. Thứ chưa cấu hình không có ca.                                                            |
| PUT /admin/staff/{staffId}/schedule/week/{weekday}     | Thay toàn bộ ca và nghỉ của **một thứ** (1 = thứ Hai, 7 = Chủ nhật). Gửi `{"shifts":[]}` để xóa các ca của thứ đó. |
| PUT /admin/staff/{staffId}/schedule/days-off/{date}    | Nghỉ trọn ngày địa phương YYYY-MM-DD, kể cả khi có ca định kỳ.                                                     |
| DELETE /admin/staff/{staffId}/schedule/days-off/{date} | Bỏ ngoại lệ ngày nghỉ; ca định kỳ lại có hiệu lực.                                                                 |

Ví dụ sau thay lịch **mọi thứ Hai** của nhân viên demo bằng hai ca. Mỗi khoảng nghỉ thuộc đúng ca chứa nó.

```bash
curl -i -b "$jar" "${headers[@]}" -X PUT "$schedule/week/1" \
  -d '{"shifts":[{"start":"09:00","end":"12:00","breaks":[{"start":"10:00","end":"10:15"}]},{"start":"13:00","end":"17:00","breaks":[]}]}'
```

Các lệnh ghi thành công trả **204**, không có body. Thử thêm ngày nghỉ bằng `curl -i -b "$jar" "${headers[@]}" -X PUT "$schedule/days-off/$day"`, gọi lại API công khai cho cùng ngày để thấy `slots: []`. Đổi PUT thành DELETE để bỏ ngày nghỉ thử. Giờ sai, ca chồng hoặc ngày tra cứu ngoài cửa sổ trả 400. Cặp nhân viên–dịch vụ không hoạt động hoặc chưa phân công trả 404.

M4 tính theo lịch làm việc. Việc trừ các lịch hẹn thực sự giữ chỗ sẽ được bổ sung ở M5. Xem hợp đồng tại http://localhost:4000/api/docs trong hai nhóm `availability` và `admin/schedule`.
