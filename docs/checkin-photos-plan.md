# Kế hoạch: ảnh kèm check-in

Chốt hướng với chủ dự án ngày 24/11/2026. Tài liệu này ghi các quyết
định, mô hình bảo mật và các bước. Mỗi bước xong thì đánh dấu ở đây,
trong chính PR làm bước đó. Câu hỏi còn mở nằm ở cuối; bước nào chạm tới
câu hỏi nào thì chốt nó trước khi làm.

## Vì sao làm

Thẻ check-in trên trang cá nhân (`person/CheckinAct`) hiện dùng ảnh bìa
của địa điểm: cùng một tấm ảnh như thẻ trong catalog, nên nó chỉ nói
"Trang đã tới Phở Thìn". Ảnh do chính người đó chụp mới là thứ khiến
bạn bè dừng lại; bình luận trên check-in (để sau) cũng cần có thứ để
bình luận. Vì vậy ảnh đi trước bình luận.

## Điều khác hẳn so với ảnh đã có

Ứng dụng đã có hai luồng tải ảnh: ảnh địa điểm của editor và local guide
(`useAddPhoto`, bucket `place-photos`) và ảnh hồ sơ (`avatars`). Cả hai
bucket đều **công khai**, và luồng ảnh địa điểm chỉ dành cho người được
cấp quyền. Ảnh check-in khác ở hai điểm, và mọi quyết định dưới đây đi
ra từ hai điểm đó:

1. **Mọi tài khoản đều tải được.** Kẻ tấn công chỉ cần đăng ký.
2. **Ảnh có người xem riêng.** Chỉ chủ ảnh, hoặc bạn bè khi check-in để
   "Bạn bè". Link công khai là không được.

Khi rà soát cho kế hoạch này đã tìm ra và vá một lỗ hổng cùng loại ở
bucket `avatars` (#1612): bucket công khai, quyền ghi chỉ kiểm thư mục
chứ không kiểm tên tệp, nên ai cũng dùng được làm hosting miễn phí.

## Quyết định

1. **Tối đa 3 ảnh mỗi lần check-in** (chủ dự án). Ảnh thứ nhất là ảnh
   của thẻ. Bản đầu không có sắp xếp lại: xoá rồi thêm lại.
2. **Ai xem được ảnh = ai xem được check-in.** Đổi check-in sang "Chỉ
   mình tôi" thì ảnh cũng thôi hiện với bạn bè, không cần làm gì thêm.
   Giờ chụp không bao giờ hiện, như giờ ghé.
3. **Thêm ảnh ở bảng check-in**, cả ngay sau khi chạm Check-in lẫn khi
   sửa một lần ghé cũ (`CheckinSheet`). Không có màn hình đăng riêng.
   **Không giới hạn thời gian** (chủ dự án, 24/11/2026): một lần ghé
   ba tháng trước vẫn thêm ảnh được. Ảnh lấy từ thư viện, nên không xác
   minh được nó thuộc lần ghé đó dù thêm ngay hay thêm sau; thời hạn chỉ
   làm hẹp khoảng hở đó, mà cái giá là 142 lần ghé đã có (của 19 tài
   khoản, ngày 24/11) mãi không có ảnh. Swarm, app gần nhất về cách dùng
   check-in, cũng cho thêm ảnh vào check-in cũ; Instagram thì không, vì
   ở đó một bài là một lần xuất bản. Thêm ảnh không đẩy thẻ lên đầu
   trang (thẻ xếp theo ngày ghé), và hạn mức ảnh mỗi ngày chặn lạm dụng.
   Đã cân nhắc và bỏ: 7 ngày sau lần ghé (quy tắc khó hiểu, bỏ rơi lịch
   sử); chỉ nhận ảnh chụp đúng ngày ghé theo EXIF (sửa được, và ảnh chụp
   màn hình hay ảnh qua app chat mất thông tin này).
4. **Ảnh check-in không tự thành ảnh của địa điểm.** Đó là ảnh của người
   dùng, không phải giấy phép cho catalog. Nếu sau này muốn mời người
   dùng tặng ảnh cho địa điểm thì đó là một tính năng khác, có đồng ý
   riêng.
5. **Sau cờ `checkin_photos`, tắt** cho tới bản đã qua duyệt của Apple
   (Guideline 1.2: nội dung người dùng tải lên phải có báo cáo, lọc và
   chặn), như bình luận đã làm.

## Mô hình bảo mật

### Các kiểu tấn công

| | kẻ tấn công muốn | chặn bằng |
|---|---|---|
| A | dùng bucket làm hosting miễn phí, kể cả nội dung bất hợp pháp | bucket riêng tư, link ký có hạn, chỉ người được xem mới xin được |
| B | lấp đầy bộ nhớ, đẩy chi phí | giới hạn ảnh mỗi ngày; 3 ảnh mỗi check-in; giới hạn kích thước |
| C | tải file không phải ảnh, giả nhãn `image/jpeg` | client không ghi thẳng vào bucket; Edge Function kiểm byte thật |
| D | lộ vị trí qua EXIF / GPS | Edge Function bỏ mọi phần metadata trước khi ghi |
| E | gửi ảnh xấu cho bạn bè | báo cáo, editor ẩn, khoá tài khoản ẩn hết |
| F | xem ảnh của người không phải bạn | quyền đọc đi qua `checkin_seen`, cùng hàm với check-in |

### Lưu trữ

- Bucket **`checkin-photos`, `public = false`**, chỉ nhận `image/jpeg`,
  giới hạn **1 MB** mỗi tệp. Con số đo trên 4.433 ảnh local guide đã
  tải (cùng cách thu nhỏ: cạnh dài 1200px, chất lượng 0,74): trung bình
  157 KB, lớn nhất 452 KB. 1 MB là hơn hai lần tấm lớn nhất.
- Đường dẫn **`<uid>/<checkin_id>/<photo_id>.jpg`**.
- **Client không có quyền ghi nào trên bucket.** Không có policy
  insert, update hay delete cho `authenticated`. Mọi lần ghi và xoá đi
  qua Edge Function bằng service role.
- Quyền đọc (để client tự xin link ký) là một policy `select` gọi một
  hàm definer: đường dẫn phải ứng với một dòng `checkin_photos` chưa bị
  ẩn, của một check-in mà `checkin_seen` cho phép người hỏi xem.

### Bảng

`checkin_photos`: `id`, `checkin_id` (cascade theo check-in), `user_id`,
`position` 1–3, `path`, `width`, `height`, `bytes`, `created_at`,
`hidden_at`, `hidden_by`. Duy nhất trên (`checkin_id`, `position`).
Đóng với client như `checkin_likes`: đọc qua `person_checkins` (thêm
cột ảnh) và qua hàm riêng cho chủ ảnh.

### Edge Function `checkin-photo`

Tải lên, một ảnh mỗi lần gọi:

1. Có JWT; người gọi là chủ check-in.
2. Check-in còn chỗ (dưới 3 ảnh) và người gọi còn hạn mức hôm nay.
3. Kích thước thân request ≤ 1 MB.
4. Byte đầu là JPEG thật (`FF D8 FF`), đọc được khung `SOF` và cạnh dài
   ≤ 1600px. Không phải JPEG thì từ chối, bất kể nhãn.
5. **Bỏ mọi đoạn `APP1`–`APP15` và `COM`**: EXIF, GPS, XMP, ghi chú.
   Làm ở server, không tin app đã làm.
6. Ghi vào bucket, thêm dòng `checkin_photos`. Ghi tệp lỗi thì không
   thêm dòng; thêm dòng lỗi thì xoá tệp vừa ghi.

Xoá: người gọi là chủ ảnh; xoá dòng rồi xoá tệp qua Storage API. **Xoá
dòng trong database không xoá file thật**, nên không dựa vào cascade.

### Hạn mức

- **15 ảnh mỗi ngày mỗi tài khoản**, theo cách các giới hạn ngày khác
  đang làm (`lib/quota`, `DAILY_CAPS`). Con số chọn, chưa đo: đủ cho ba
  lần ghé đầy ảnh và vài lần thử lại. Một tài khoản lạm dụng tối đa
  khoảng 15 MB mỗi ngày; một người dùng bình thường dưới 3 MB.
- **Hạn mức ảnh là chặn thật, không phải số check-in.** Check-in chỉ bị
  giới hạn 3 lần mỗi quán mỗi ngày, không có giới hạn tổng
  (`20261009090000_checkins_per_place.sql` đã bỏ mức 30 mỗi ngày của bản
  đầu), mà catalog có hàng nghìn quán. Từ 24/11/2026 có lại mức 50 mỗi
  ngày, nên ảnh tối đa là 150 mỗi ngày nếu chỉ dựa vào đó: vẫn cần hạn
  mức ảnh riêng.
- Thêm một mức trần trên toàn tài khoản, **300 ảnh**, để một tài khoản
  sống lâu cũng không tích được vô hạn. Chạm trần thì app nói rõ và mời
  xoá bớt ảnh cũ.

### Dọn dẹp

- Gỡ một lần ghé: app gọi xoá ảnh trước, rồi mới xoá check-in.
- Xoá tài khoản (`delete-account`): xoá cả thư mục `<uid>/`.
- **`prune-checkin-photos`**, chạy định kỳ: xoá tệp không còn dòng
  (check-in bị xoá bằng đường khác, lần ghi lỗi giữa chừng), và báo
  tổng dung lượng bucket.

### Kiểm duyệt

- Nút báo cáo trên ảnh khi xem (của người khác). `reports.kind` thêm
  `checkin_photo`, vào hàng đợi đã có ở Data Desk.
- Editor ẩn một ảnh (`hidden_at`). Ảnh bị ẩn không được ký link và
  không hiện ở đâu, kể cả với chủ ảnh (thấy một dòng "Ảnh đã bị ẩn").
- `suspend-user` ẩn mọi ảnh check-in của tài khoản bị khoá.

## Hiển thị

- Thẻ check-in: ảnh thứ nhất thay ảnh bìa quán; có ảnh thứ hai trở đi
  thì góc ảnh hiện số đếm. Chạm vào ảnh mở trình xem ảnh đã có
  (`PhotoViewer`) để vuốt qua cả ba. Chạm phần còn lại vẫn mở địa điểm.
- Danh sách check-in: ô ảnh của hàng dùng ảnh thứ nhất.
- Link ký sống **1 giờ**. Link đổi mỗi lần xin, nên ảnh được cache theo
  `photo_id` (`expo-image` `cacheKey`), không theo URL.
- Không có ảnh thì như bây giờ: ảnh bìa quán.

## Pháp lý và dữ liệu

- `app/src/lib/legal.ts`: ảnh bạn kèm check-in, ai thấy, bỏ vị trí trong
  ảnh, ảnh không thành ảnh của địa điểm, xoá khi nào. Cùng PR mở luồng
  tải ảnh, và trước khi bật cờ.
- Xuất dữ liệu: danh sách ảnh (địa điểm, ngày, tên tệp). Xem câu hỏi mở.
- Xoá tài khoản: như trên.

## Các bước

Mỗi bước một PR, theo thứ tự. Cờ `checkin_photos` tắt suốt cả quá trình.

- **K0. Tài liệu này.**
- **K1. Database và storage — xong (24/11/2026).** Bảng `checkin_photos`, bucket riêng tư,
  policy đọc, hàm kiểm hạn mức, `person_checkins` trả thêm ảnh, test
  trong `supabase/tests`. Migration: có; áp lên live trước khi merge.
  Đã làm: `20261124230000_checkin_photos.sql`. Đường dẫn do chính dòng
  dữ liệu quy định (kiểm bằng ràng buộc), một trigger buộc ảnh thuộc chủ
  check-in, chủ ảnh đọc được dòng của mình nhưng không đọc được ai đã ẩn
  ảnh, `checkin_photo_slot` chỉ service role gọi được. Ảnh bị xoá trả lại
  chỗ trong hạn mức ngày: vòng xoá rồi thêm chỉ tốn lượt ghi, không tốn
  dung lượng, vì tổng không vượt 300.
- **K2. Edge Function `checkin-photo` — xong (25/11/2026).** (tải lên, xoá) và
  **`prune-checkin-photos`**, kèm `*.fn.test.ts` (sàn coverage của Edge
  Function là 100 dòng / 94 nhánh). Xoá tài khoản xoá cả thư mục.
  Đã làm: `checkin-photo` (ảnh gửi dạng base64 trong JSON; tải lên và
  xoá), `_shared/jpeg.ts` (kiểm JPEG, bỏ APP1–APP15 trừ APP14 của Adobe
  vì nó chỉ nói cách đổi màu, bỏ COM, cắt mọi thứ sau EOI — đo trên ảnh
  thật: điểm ảnh giữ nguyên từng điểm, hết EXIF/GPS, 2–7 ms một ảnh),
  `prune-checkin-photos` với hàm `checkin_photo_orphans` /
  `checkin_photos_usage` (`20261125000000_checkin_photo_orphans.sql`) và
  `cron.sql` chạy mỗi ngày (áp tay, như các cron khác), `delete-account`
  xoá ảnh check-in theo dòng trước khi xoá tài khoản.
- **K3. Thêm ảnh trong `CheckinSheet`:** tối đa ba ô, thêm, bỏ, tiến độ
  tải, lỗi từng ảnh. Sau cờ.
- **K4. Hiển thị:** thẻ trên trang cá nhân, danh sách check-in, trình
  xem ảnh, link ký và cache. Sau cờ.
- **K5. Kiểm duyệt và pháp lý:** báo cáo, ẩn ở Data Desk, khoá tài
  khoản, `legal.ts`, xuất dữ liệu.
- **K6. Bật cờ** sau bản đã qua duyệt của Apple.

## Câu hỏi mở

1. **Xuất dữ liệu có kèm chính các tấm ảnh không?** File xuất hiện là
   một JSON tạo trên máy. Kèm link ký (hết hạn sau vài ngày) thì dễ; kèm
   ảnh thật thì phải đổi sang tệp nén. Chốt trước K5.
2. ~~**Thêm ảnh cho lần ghé cũ có giới hạn thời gian không?**~~ Không
   giới hạn — quyết định 3.
3. **15 ảnh mỗi ngày và 300 ảnh mỗi tài khoản** là số chọn. Xem lại sau
   hai tuần có dữ liệu.
4. ~~**Check-in không có giới hạn tổng mỗi ngày.**~~ Đã đặt 50 mỗi
   ngày mỗi tài khoản (`20261124210000_checkins_per_day.sql`), và giờ
   của một lần ghé không còn do client ghi.
