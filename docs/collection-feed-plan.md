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
2. **Một thẻ là một bộ sưu tập hoặc một địa điểm, không phải một tương
   tác.** Mỗi bộ xuất hiện một lần trong feed, kèm một dòng lý do cho
   biết vì sao nó nổi lên ("Trang vừa tạo", "Minh và 2 người bạn đã
   thích"). Không lặp thẻ khi một bộ có nhiều lượt thích.
   **Check-in là tương tác với địa điểm, nên thẻ của nó là thẻ địa
   điểm** (owner, 24/11/2026): địa điểm không nhất thiết thuộc bộ sưu
   tập nào và có thể thuộc nhiều bộ, và hiện không có gì nối check-in
   với bộ sưu tập. Bản đầu của kế hoạch coi check-in là một lý do nổi
   lên của *bộ sưu tập*; cách đó đã bỏ. Việc check-in đẩy thứ hạng địa
   điểm và bộ sưu tập chứa nó là issue #1596, để sau.
3. **Một loại thẻ, dùng ở mọi nơi** (`app/src/components/ActivityCard.tsx`).
   Mục Hoạt động trên trang cá nhân là feed chung lọc theo một người.
4. **Giai đoạn này chỉ thả tim.** Thả tim vào thẻ bộ sưu tập chính là
   lượt thích bộ sưu tập sẵn có.
5. **Người lạ thấy ít hơn bạn bè.** Check-in và chuyến đi chỉ bạn bè
   (hoặc người trong chuyến) thấy.
   *Sửa 25/11/2026 (owner):* một check-in có thể được chọn **Công khai**
   — người đã đăng nhập nào cũng thấy. Phần còn lại của nguyên tắc vẫn
   giữ: người lạ không thấy nhiều hơn bạn bè (địa điểm, ngày, ghi chú,
   ảnh; không giờ), Công khai không bao giờ là lựa chọn mặc định, và
   người chưa đăng nhập không thấy gì
   (`supabase/migrations/20261125200000_checkin_public.sql`).
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
- **Không chỉ bộ công khai (17/11, cùng ngày):** trang hiện những bộ mà
  người xem vốn đã mở được. Trang của chính mình có mọi bộ của mình; trang
  người khác có bộ công khai và bộ họ chia sẻ với mình. Mọi thẻ
  mang dấu (từ 18/11 thẻ công khai mang quả địa cầu, như trên trang
  của chính bộ đó): địa cầu (công khai), ổ khoá (riêng tư), hai người kèm số bạn (đã chia sẻ),
  hai người kèm "Chia sẻ với bạn" (được chia sẻ). Bộ công khai và bộ
  chia sẻ nhóm có nút tim (nhóm thả tim được,
  `20261117233000_likes_in_the_group.sql`); bộ riêng tư chỉ hiện số tim
  đã giữ, không bấm được. Ảnh bìa trang vẫn chỉ lấy từ bộ công khai. Không migration,
  không sửa chính sách: không ai thấy thêm thứ họ chưa xem được. Quy tắc
  ở `lib/person.ts` (`listsOn`, `seenOn`). Feed cộng đồng ở bước 2 vẫn chỉ
  có bộ công khai.

### Bình luận trên bộ sưu tập — đã quyết làm (18/11/2026)

Kế hoạch riêng: `docs/comments-plan.md`. Bình luận thuộc về bộ sưu tập
công khai (mỗi bộ một luồng), lồng nhau, có tag người và địa điểm, làm
sau cờ `comments` cho tới một bản nộp duyệt. Nguyên tắc 1 không đổi:
bình luận được làm vì nó gắn vào một bộ sưu tập; bình luận tự do thì
chưa.

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

### Bước 3. Check-in cho bạn bè, và thả tim vào check-in — xong phần trang cá nhân (24/11/2026)

Làm thành ba phần; hai phần đầu đã xong, phần ba chờ feed cộng đồng.

- **Ghi chú (xong, #1597).** Chạm Check-in vẫn ghi ngay; sau đó một bảng
  trượt lên với ô ghi chú (≤ 280 ký tự). Check-in cũ chưa có ghi chú
  hiện lời mời bút chì trên danh sách check-in.
  Migration `20261124120000_checkin_notes.sql`.
- **Thẻ địa điểm trên trang cá nhân, quyền xem, tim (xong).** Bảng sau
  check-in hỏi "Chỉ mình tôi / Bạn bè" (mặc định Bạn bè, nhớ lựa chọn
  gần nhất; check-in cũ là Chỉ mình tôi). Mục Hoạt động trên trang cá
  nhân xếp check-in chung cột với bộ sưu tập theo ngày
  (`person.actsOn`), mỗi địa điểm một thẻ với lần ghé mới nhất
  (`person/CheckinAct`, vẫn là `ActivityCard`). Bạn bè thấy địa điểm,
  **ngày** (không giờ) và ghi chú, và thả tim được; chủ trang thấy mọi
  lần ghé của mình kèm dấu ai xem được, và sửa ghi chú ngay trên thẻ.
  Tim thuộc về từng lần check-in, không thuộc về địa điểm.
  *Sửa 28/11/2026 (owner):* thẻ có ghi chú mở đầu bằng ghi chú — dưới
  dòng "ai, khi nào", trước ảnh, cỡ 16 màu chữ chính, 4 dòng rồi "Đọc
  thêm" — và dòng đầu ghi tên địa điểm ("Minh đã check-in tại …"); địa
  điểm thành một hàng chạm được dưới ảnh. Thẻ không có ghi chú giữ như cũ.
  Migration `20261124150000_checkin_friends.sql`: bảng `checkin_likes`
  (đóng với client), `person_checkins`, `like_checkin`,
  `checkin_hearts_takeout`. Bảng `checkins` vẫn chỉ chính chủ đọc: bạn
  bè đọc qua hàm, vì policy không giấu được giờ. Đã sửa chính sách, đã
  vào xuất dữ liệu; xoá tài khoản theo cascade.
- **Thẻ gộp trên feed cộng đồng (chưa làm, issue #1599).** Nhiều bạn
  cùng check-in một địa điểm thì một thẻ. Cần feed ở bước 2 trước.
- Chưa làm: bình luận trên check-in. Ảnh kèm check-in có kế hoạch riêng:
  `docs/checkin-photos-plan.md`.

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
