# Việc còn mở trước pilot — bên thứ ba và vận hành

Tài liệu này từng là bản đánh giá "còn cách App Store bao xa", viết 16/08/2026
khi app chưa từng có bản build native. Câu hỏi đó đã trả lời xong: app ở
`1.0.0`, đã nộp App Store, và hai nhóm chặn của bản gốc — A (build native) và
B (chính sách Apple) — đóng hết. Giữ nguyên chúng ở đây chỉ tạo ra một danh
sách mà 2/3 nội dung nói sai về hiện tại.

Nên từ 02/09/2026 nó chỉ còn là **danh sách việc chưa làm**: rủi ro bên thứ
ba (nhóm C) và mức sẵn sàng vận hành (nhóm D). Bản đánh giá đầy đủ — cả nhóm
A và B với đủ lý do từng mục tồn tại — nằm nguyên trong lịch sử git ở commit
ngay trước bản cắt này: `git show ef911e3:docs/tech-eval-app-store.md`.

Kết luận của bản gốc vẫn đúng và không cần nhắc lại dài dòng: **stack không
phải vấn đề.** Expo SDK 54 + Supabase + RLS là lựa chọn phù hợp, nền móng
tốt hơn mặt bằng, không có gì phải viết lại. Quy mô hiện tại: ~51k dòng
TS/TSX trong `app/`, 45 migration, 7 Edge Function.

---

## Đã đóng — không liệt kê chi tiết nữa

Kiểm lại từng mục ngày 02/09/2026, đối chiếu mã nguồn chứ không theo trí nhớ:

| Nhóm | Bản gốc nói | Hiện tại |
|---|---|---|
| A1–A2 | thiếu bundle id / package | `com.aletuan.citycrew` cả hai |
| A3 | không có `eas.json` | có, đủ `development` / `preview` / `production` |
| A4 | `version: 0.1.0`, không versioning | `1.0.0` + `autoIncrement` |
| A5–A6 | thiếu splash, adaptiveIcon trỏ sai | đã cấu hình, trỏ `android-icon-foreground.png` |
| A7–A8 | chưa verify New Architecture, chỉ có kênh `main` | đã test trên máy thật; ba kênh OTA tách riêng |
| B1 | không có filter / report / block / EULA | `blocks.sql`, `reports.sql`, `moderation_actions.sql`, `reportFlow.tsx`, Edge Function `suspend-user` |
| B2 | không có xoá tài khoản | `functions/delete-account` + `DeleteAccountScreen.tsx` |
| B3 | không có privacy policy | `privacy.html`, `terms.html`, `support.html`, `docs/store/app-privacy-labels.md` |
| B4 | tab Ideas chạy đồng hồ giả | planner thật từ Phase 1–4 |

**Đường găng 14 ngày closed testing của Google Play** — cảnh báo lớn nhất của
bản gốc — vẫn còn nguyên giá trị nếu định phát hành qua Play Store, và vẫn là
việc phải khởi động sớm nhất.

---

## 1. Nhóm C — Rủi ro pháp lý bên thứ ba

### C1. Cache dữ liệu Google Places

`import-place.ts` ghi vĩnh viễn vào Postgres: `rating`, `rating_count`,
`price_level`, `opening_hours`, `website`, `phone`, `editorialSummary`, và
tham chiếu ảnh. Google Maps Platform ToS chỉ cho cache **`place_id` vô thời
hạn**; nội dung khác bị giới hạn (thường hiểu là 30 ngày).

Việc cần làm: thêm `google_refreshed_at`, job làm mới định kỳ theo
`google_place_id`, và cân nhắc trường nào thật sự cần lưu — giờ mở cửa và
rating là hai trường "tươi" nhất, cũng là hai trường sai nhiều nhất khi cũ.

#### Cập nhật 01/09/2026 — hoãn có chủ đích, kèm số đo

Đã rà lại và **quyết định hoãn** job làm mới. Ghi lại số đo tại thời điểm
hoãn để lần sau không phải đo lại:

- 442 địa điểm. Bản ghi cũ nhất tạo **06/08/2026**. Tại 01/09 chưa có bản
  ghi nào quá 30 ngày — lô đầu tiên vượt mốc vào khoảng **05/09/2026**.
- 441/442 có `rating`, 432/442 có `opening_hours`.
- 2.303 ảnh, trong đó **2.159 từ Google**. `photo_ref` (tên resource, bền)
  được lưu cùng `photo_uri` (URL media từ lh3.googleusercontent.com).
  `photo_ref` là thứ cho phép resolve lại mà không gọi lại Places Details —
  nếu `photo_uri` hết hạn, job làm mới không phải mua lại dữ liệu.
- Chưa có cột `google_refreshed_at`.

Khi làm, hai thứ nên đi cùng nhau vì cùng một job trả cả hai:

1. **Tuân thủ**: làm mới `rating`, `rating_count`, `opening_hours`,
   `price_level`, `website`, `phone` theo `google_place_id`.
2. **Tín hiệu xu hướng**: *độ chênh* `rating_count` giữa hai lần làm mới là
   proxy lưu lượng khách thật — một dòng chảy, không phải một con số tích
   luỹ, và phủ 441/442 địa điểm. Đây là câu trả lời đúng cho "địa điểm nào
   đang hot", tốt hơn hẳn follower count trên mạng xã hội (xem C4).

### C2. Nominatim / Photon ở quy mô pilot

`find-address` gọi **cả hai** dịch vụ công cộng miễn phí cho mỗi lần tìm.
Nominatim public instance giới hạn ~1 request/giây tuyệt đối cho toàn bộ
ứng dụng và cấm dùng nặng.

Giảm nhẹ đã có: yêu cầu đăng nhập, tìm khi submit (không phải gõ tới đâu gọi
tới đó), `User-Agent` hợp lệ. Đủ cho vài chục người.

Ceiling: khoảng vài trăm người dùng hoạt động. Vượt qua đó cần **cache kết
quả tìm kiếm** trong Postgres và/hoặc self-host Nominatim, hoặc chuyển sang
nhà cung cấp trả phí (Mapbox/Geoapify). Nên thêm cache trước khi pilot — nó
rẻ và mua thêm một bậc quy mô.

### C3. Attribution còn thiếu

- **Open-Meteo** yêu cầu ghi nguồn (CC-BY-4.0) — chưa thấy ở đâu.
- **Apple Maps** yêu cầu hiển thị logo/legal notice khi dùng MapKit.
- **OpenStreetMap** đã có nhãn trên StartSheet, nhưng ODbL cũng áp dụng cho
  toạ độ đã lưu lại từ kết quả OSM.

### C4. Chỉ số mạng xã hội — đã cân nhắc và không lưu (01/09/2026)

Đã cân nhắc lưu `followers` / "recent views" của tài khoản Threads chính chủ
để đo độ hot. Không làm, vì bốn lý do:

- **Đo marketing của quán, không đo độ hot của địa điểm.** Arata Pasta có
  5.837 follower; SALEM Social House có 17 — trong khi SALEM mới mở, nằm ngay
  chân metro Thảo Điền và có ba reviewer khác nhau viết về nó trong tháng 6–8.
  Xếp hạng theo follower sẽ chôn SALEM và đẩy Arata lên.
- **Là số tích luỹ, không phải dòng chảy.** Follower gần như không giảm. Một
  quán hot năm 2024 vẫn giữ nguyên follower năm 2026. Muốn có xu hướng thì
  phải chụp nhiều lần theo thời gian, chứ một con số thì không nói được gì.
- **Độ phủ 5/442.** Không xếp hạng được catalog bằng một trường mà 99% bản
  ghi không có.
- **"Recent views" không có trong API nào.** Nó chỉ hiện trên trang profile
  khi đã đăng nhập. Thu thập định kỳ là scraping — đúng ranh giới ToS của
  Meta mà phần Threads đang tránh.

Nếu về sau vẫn muốn: lưu thành **snapshot có ngày** ở bảng riêng
(`place_social_stats(place_id, source, followers, captured_at)`), không bao
giờ là một cột trên `places`, và gọi đúng tên là "audience của quán" chứ
không phải "độ phổ biến".

Đây là lý do `places.threads_handle` (PR #452) chỉ lưu handle: handle là định
danh bền và tra cứu được, follower count là con số đo sai thứ cần đo.

---

## 2. Nhóm D — Sẵn sàng vận hành

Nhóm này quyết định pilot *học được gì*, không phải pilot *chạy được hay
không*. Trạng thái kiểm lại 02/09/2026.

| # | Thiếu | Vì sao quan trọng |
|---|---|---|
| D1 | **Không có crash reporting.** Không có Sentry/Bugsnag/Crashlytics trong `app/package.json` | Với người dùng thật, một crash không được báo cáo là một crash không tồn tại. Hạng mục đơn lẻ giá trị cao nhất trong cả tài liệu — và app **đã lên App Store**, nên nó không còn là việc chuẩn bị |
| D2 | **Không có ErrorBoundary** ở `App.tsx` | Một lỗi render = màn hình trắng, không thông báo, không phục hồi |
| D3 | **Không có analytics** | Pilot không đo được thì không phải pilot, chỉ là phát hành sớm |
| D4 | **Một môi trường Supabase duy nhất** | Migration apply thẳng vào production. Không có staging để thử |
| D5 | **Migration/Edge Function không deploy tự động** | CI *test* migration trên Postgres thật nhưng không *chạy* chúng lên project. Deploy thủ công là nơi lỗi sẽ xảy ra |
| D6 | **Supabase vẫn ở gói `free`** (xác nhận qua API ngày 02/09) | Project **tự pause sau 7 ngày không hoạt động**, 500MB DB, 5GB egress. App đang ở trên App Store — pause là app chết với người lạ đang cài. Pro **25 USD/tháng**, kèm PITR backup. Đây là mục gấp nhất nhóm D |
| D7 | **Không có quota chống lạm dụng** | Một tài khoản có thể tạo vô hạn collection, upload lại avatar không giới hạn, spam `place_submissions`. RLS kiểm soát *ai*, không kiểm soát *bao nhiêu* |
| D7b | **`place_events` không có gì trim** | Taste profile chỉ đọc 90 ngày gần nhất, nên dòng cũ hơn là nợ và là rủi ro. Chặn duy nhất hiện có là nút xoá của người dùng và cascade khi xoá tài khoản. `pg_cron` có sẵn trên project, chưa cài |
| D8 | **Không có budget alarm trên Google Maps key** | `scan-city` có `MAX_API_CALLS = 45` mỗi lần gọi, nhưng không giới hạn số lần gọi. Một tài khoản editor bị chiếm có thể đốt hết ngân sách |
| D9 | Không có xử lý offline / retry | Mỗi màn hình gọi mạng trực tiếp. Có timeout trong `auth.tsx` nhưng không cache, không retry, không trạng thái offline |
| D10 | Không có E2E test | Test hiện có đều là hàm thuần và test UI ở mức component — không có luồng nào chạy trên thiết bị |
| D11 | Accessibility chưa được đánh giá | Dynamic Type, VoiceOver label, độ tương phản. Apple kiểm nhẹ; người dùng pilot thì không |

---

## 3. Thứ tự nên làm

Xếp theo "hỏng thì mất gì", không theo công sức:

1. **D6 — nâng Supabase Pro.** App đã ở trên store; free tier tự pause là
   hỏng ngoài tầm kiểm soát. 25 USD/tháng.
2. **D1 + D2 — crash reporting và ErrorBoundary.** Người lạ đang cài app mà
   không có đường nào để lỗi của họ đi về.
3. **C1 — job làm mới Google Places.** Mốc 30 ngày đầu tiên rơi vào khoảng
   05/09/2026; sau mốc đó là cache quá hạn theo ToS.
4. **D8 + D7 — budget alarm rồi quota.** Chặn thiệt hại tài chính trước, chặn
   phiền nhiễu sau.
5. D3 analytics — tối thiểu: mở app, xem place, lưu place, tạo collection, publish.
6. C3 attribution Open-Meteo + Apple Maps.
7. D7b `pg_cron` trim `place_events` cũ hơn 90 ngày.
8. C2 cache `find-address` trong Postgres.
9. D4/D5 staging + tự động `supabase db push` và deploy function trong CI.
10. D9 offline, D10 E2E, D11 accessibility.

---

## 4. Tiêu chí "xong" cho pilot

Những điều kiện của bản gốc đã đạt (xoá tài khoản trong app, không có màn
hình chạy tiến trình giả, privacy policy công khai, có report/block) không
liệt kê lại. Còn lại bốn điều, tất cả đều thuộc nhóm C và D:

1. Một crash trên máy người lạ **tới được** người phát triển trong vài phút,
   kèm stack trace.
2. Supabase ở gói Pro, không có nguy cơ tự pause giữa pilot.
3. Một tài khoản đơn lẻ không thể làm hỏng trải nghiệm của người khác, cũng
   không đốt được ngân sách API.
4. Không trường Google Places nào bị giữ quá hạn ToS mà không có đường làm mới.
