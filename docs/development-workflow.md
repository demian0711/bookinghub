# Quy trình phát triển

1. **Chọn một thay đổi nhỏ.** Đọc milestone, tiêu chí chấp nhận, quy tắc liên quan và code hiện có. Dùng `git status --short --branch` để nhận biết nhánh và công việc chưa commit.
2. **Làm việc theo nhánh.** Dùng nhánh đã giao hoặc nhánh riêng theo mục đích, chẳng hạn `docs/project-foundation` hay `feat/availability`. Giữ thay đổi của người khác và giới hạn diff vào mục tiêu của nhánh.
3. **Triển khai và kiểm tra.** Cập nhật nghiệp vụ tại API, hợp đồng và tài liệu liên quan. Dùng Jest cho quy tắc và phân quyền, kiểm thử tích hợp với PostgreSQL thật cho ràng buộc và cạnh tranh. Dùng Playwright cho luồng người dùng qua web và API thật. Chạy lint, typecheck, test và build phù hợp bằng các script thực tế khi đã có workspace.
4. **Tự review.** Đọc `git diff`, kiểm tra cả tệp mới qua `git status` và chạy `git diff --check`. Đối chiếu với tiêu chí chấp nhận, kiểm tra khả năng truy cập tài nguyên người khác, mốc thời gian và trường hợp ghi đồng thời khi liên quan. Với lượt chỉ sửa tài liệu, kiểm tra liên kết, thuật ngữ và tính nhất quán giữa các tệp.
5. **Commit và review khi được giao.** Mỗi commit tập trung vào một thay đổi, thông điệp nêu mục đích, ví dụ `feat: validate booking duration`. Mô tả review ghi phạm vi, quyết định, lệnh đã chạy, kết quả và hạn chế. Chỉ commit, push hoặc triển khai khi có yêu cầu trong lượt làm việc.

Một tính năng chỉ hoàn thành khi luồng thực qua điểm vào của người dùng đáp ứng tiêu chí, các lỗi dự kiến được xử lý, tài liệu và test phản ánh nghiệp vụ. Ghi rõ bước kiểm tra nào chưa chạy cùng lý do.
