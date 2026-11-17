# Kế hoạch: bộ sưu tập là trung tâm của tương tác

Chốt với chủ dự án ngày 17/11/2026. Tài liệu này ghi hướng đi, nguyên
tắc và các bước. Mỗi bước xong thì đánh dấu ở đây, trong chính PR làm
bước đó.

## Hướng đi

Trang cá nhân và mục Bộ sưu tập cộng đồng dần trở thành feed, trong đó
**bộ sưu tập và địa điểm là nhân tố trung tâm**; mọi tương tác (tạo,
thích, lưu bản sao, check-in, đi chơi cùng nhau, moment) xoay quanh
chúng.

Mục tiêu POC không đổi: kiểm chứng chia sẻ tự nhiên trước khi đầu tư
marketing hay hạ tầng.

## Nguyên tắc

1. **Tương tác nào cũng phải gắn vào một bộ sưu tập hoặc một địa
   điểm.** Không gắn được thì không làm. Vì vậy bình luận tự do và nhắn
   tin chưa nằm trong kế hoạch.
2. **Một thẻ là một bộ sưu tập, không phải một tương tác.** Mỗi bộ xuất
   hiện một lần trong feed, kèm một dòng lý do cho biết vì sao nó nổi
   lên ("Trang vừa tạo", "Minh và 2 người bạn đã thích"). Không lặp thẻ
   khi một bộ có nhiều lượt thích.
3. **Một loại thẻ, dùng ở mọi nơi** (`app/src/components/ActivityCard.tsx`).
   Mục Hoạt động trên trang cá nhân là feed chung lọc theo một người.
4. **Giai đoạn này chỉ thả tim.** Thả tim vào thẻ bộ sưu tập chính là
   lượt thích bộ sưu tập sẵn có.
5. **Người lạ thấy ít hơn bạn bè.** Check-in và chuyến đi chỉ bạn bè
   (hoặc người trong chuyến) thấy.
6. **Chính sách quyền riêng tư (`app/src/lib/legal.ts`) là ràng buộc.**
   Bước nào hiện thêm dữ liệu cá nhân ra chỗ mới thì sửa chính sách
   trong cùng PR.
7. **Bảng mới nào cũng phải vào "Tải dữ liệu của bạn" và "Xoá tài
   khoản".**

## Tên gọi (xong, #1401)

- Tab chứa email, theme, ngôn ngữ, xoá tài khoản: **Tài khoản** (Account).
- Trang người khác mở ra xem: **Trang cá nhân** (Profile).
- "Sửa hồ sơ" giữ nguyên.

## Các bước

### Bước 1. Trang cá nhân: Hoạt động thay cho lưới — xong

- Mục **Hoạt động** thay lưới bộ sưu tập: mỗi bộ công khai một thẻ "đã
  tạo bộ sưu tập", mới nhất trước, năm thẻ một lần.
- Thẻ gồm: dòng lý do (ai, làm gì, khi nào), ảnh bìa, tên bộ, số địa
  điểm, hai dòng mô tả, nút tim.
- Thẻ tự nạp khi cuộn: còn cách đáy một màn hình rưỡi thì vẽ thêm năm
  thẻ (`lib/feed.ts`), và ảnh bìa của năm thẻ kế tiếp được tải trước vào
  bộ nhớ. Nút "Xem thêm" còn lại làm dự phòng. Danh sách ảo hoá và phân
  trang từ máy chủ để dành cho bước 2.
- Lưới không mất: số đếm "N bộ sưu tập" bên phải tiêu đề mục chuyển mục
  sang lưới, và "Hoạt động" chuyển lại.
- Migration: không. Dùng `collections.created_at` và `collection_likes`.
- Code: `app/src/screens/person/Shared.tsx`, `ActivityCard`, `lib/ago.ts`.

### Bước 2. Bộ sưu tập cộng đồng thành feed

- Mỗi bộ một thẻ, kèm dòng lý do. Lý do đọc từ dữ liệu sẵn có: tạo bộ,
  lượt thích, thêm địa điểm (`collection_places.created_at`), lưu bản
  sao (`copied_from`).
- Thứ tự: bộ có tương tác gần nhất từ bạn bè lên trước; hết thì theo
  xếp hạng sẵn có (`listRank`, xem `docs/collection-ranking.md`). Khách
  và người chưa có bạn thấy lý do kiểu "Nổi bật ở Hà Nội".
- Migration: không.
- **Cần rà trước khi bật:** chính sách hiện cho phép hiện tên người
  thích trên trang hoạt động của từng bộ; đưa tên lên feed chung là
  phơi rộng hơn, phải sửa câu chữ.

### Bước 3. Check-in cho bạn bè, và thả tim vào check-in

- Check-in thành một lý do nổi lên của bộ sưu tập ("Dương vừa check-in
  ở một quán trong bộ này"), chỉ bạn bè thấy, chỉ ghi ngày không ghi giờ.
- **Migration: có.** Bảng lượt thích check-in, quyền truy cập chỉ cho
  bạn bè của người check-in; kiểm tra và mở quyền đọc bảng `checkins`
  cho bạn bè nếu hiện chỉ chính chủ đọc được.
- Sửa chính sách quyền riêng tư; thêm bảng mới vào xuất dữ liệu và xoá
  tài khoản.

### Bước 4. Chuyến đi làm lý do nổi lên

- "Trang và 2 người bạn đã lên kế hoạch từ bộ này". Dùng tính năng "lên
  kế hoạch từ một bộ sưu tập" đã có.
- Chỉ người trong chuyến và bạn bè thấy.

### Bước 5. Moment

- Ảnh kèm một dòng tại một địa điểm trong bộ.
- Đắt nhất: nội dung người dùng đăng thì Apple yêu cầu báo cáo, chặn,
  kiểm duyệt; thêm lưu trữ ảnh. Làm cuối.

### Để sau, chưa xếp bước

- Tương tác nhẹ trên từng địa điểm (ví dụ thả tim một quán trong bộ),
  để "xoay quanh địa điểm" có nội dung ngoài check-in.
- Ghim một bộ sưu tập lên đầu trang cá nhân.
- Dòng "Hay đi": các thành phố người đó có nhiều địa điểm nhất.
- "Điểm chung" (đã xây, đang tắt bằng `IN_COMMON_ON`) làm lý do trên
  feed: "Bạn và Minh cùng thích 3 bộ".

## Thước đo

Một con số theo dõi qua các bước: tỉ lệ người mở một thẻ rồi làm tiếp
một việc (thích, lưu bản sao, lên kế hoạch).

Bản App Store không gửi dữ liệu phân tích nào (cam kết trong
`legal.ts`), nên con số này chỉ đọc được từ dữ liệu phía máy chủ (lượt
thích, bản sao, chuyến đi theo thời gian), không đo được lượt mở thẻ.
Cần quyết định cách đo trước bước 2.

## Số liệu nền (17/11/2026)

- 126 hồ sơ, 14 có giới thiệu.
- Hơn 60 bộ sưu tập công khai; người nhiều nhất có 24 bộ, phần lớn có
  1 đến 4.
- Check-in thưa: phần lớn tài khoản dưới 10.
