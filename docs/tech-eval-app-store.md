# Dữ liệu bên thứ ba — những gì đã đo và đã quyết

Tài liệu này ghi **kiến thức**, không ghi việc cần làm. Việc còn mở nằm ở
[issue #708](https://github.com/aletuan/city-crew/issues/708), nơi mỗi mục
đóng được khi xong.

Nó từng là một danh sách việc cần làm, và đó là lý do nó phải đổi. Đến
26/09/2026 file vẫn ghi ba việc đã làm là chưa làm — trong đó có việc nó
xếp **số 1**, nâng Supabase lên Pro, đã là Pro từ lâu. Một danh sách trong
markdown không có dấu "xong": làm xong một việc, không ai quay lại gạch đi.

Tên file giữ nguyên vì #485 và lịch sử commit trỏ vào nó. Lịch sử của nó:

- bản đánh giá gốc tháng 8, đủ nhóm A và B: `git show ef911e3:docs/tech-eval-app-store.md`
- danh sách C + D ngay trước khi chuyển sang #708: `git show b8941bb:docs/tech-eval-app-store.md`

Kết luận của bản gốc vẫn đúng: **stack không phải vấn đề.** Expo + Supabase
+ RLS là lựa chọn phù hợp, nền móng tốt hơn mặt bằng, không có gì phải viết
lại.

---

## C1. Cache dữ liệu Google Places

`import-place.ts` ghi vĩnh viễn vào Postgres: `rating`, `rating_count`,
`price_level`, `opening_hours`, `website`, `phone`, `editorialSummary`, và
tham chiếu ảnh. Google Maps Platform ToS chỉ cho cache **`place_id` vô thời
hạn**; nội dung khác bị giới hạn (thường hiểu là 30 ngày).

Việc cần làm (theo dõi ở #708): thêm `google_refreshed_at`, job làm mới định kỳ theo
`google_place_id`, và cân nhắc trường nào thật sự cần lưu — giờ mở cửa và
rating là hai trường "tươi" nhất, cũng là hai trường sai nhiều nhất khi cũ.

### Cập nhật 01/09/2026 — hoãn có chủ đích, kèm số đo

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

### Cập nhật 26/09/2026 — ảnh: bản đầu của mục này đã sai

Bản đầu của mục này (#709) ghi "ảnh đã về nhà" và "không còn là phần lớn
của C1". Sai. Nó đếm ảnh theo **host** của `photo_uri`, mà host chỉ nói ảnh
đang nằm ở đâu, không nói ảnh của ai. Đếm theo `photo_ref` (chỉ ảnh lấy từ
Google mới có):

- **3.871** ảnh từ Google, nằm **vĩnh viễn** trên storage Supabase của mình;
- 300 ảnh local guide; 2 ảnh còn ở `lh3.googleusercontent.com`, 1 ở
  `aletuan.github.io`.

`rehost-photos` sửa được một lỗi thật — URL media của Google hết hạn, thẻ
địa điểm trắng — nhưng làm việc đó bằng cách giữ một bản sao ảnh của Google
không thời hạn. Về ToS, đó là **phần lớn nhất** của C1, lớn hơn mọi trường
văn bản. Chủ dự án đã quyết: ảnh Google chỉ là **seeding ban đầu**, sẽ được
thay bằng ảnh local guide rồi xoá bản sao. Việc đó theo dõi ở #708.

### Cập nhật 26/09/2026 — job làm mới

Có `refresh-places` (Edge Function + `cron.sql` áp tay), logic ở
`supabase/functions/_shared/refresh-place.ts`. Mỗi đêm hỏi lại Google về
tối đa 60 địa điểm chưa được trả lời trong 25 ngày.

Quyết định về từng trường, và lý do:

| trường | làm gì | vì sao |
|---|---|---|
| `opening_hours`, `rating`, `rating_count` | lấy lại, ghi đè | chỉ Google viết; là hai thứ sai sớm nhất khi cũ |
| `business_status` *(mới)* | lấy thêm | quán đóng cửa hẳn phải tới tay desk trước khi tới tay người đọc; Google không còn biết `place_id` thì ghi `NOT_FOUND` |
| `website`, `phone` | theo Google **chỉ khi** giá trị vẫn là của Google | desk sửa được hai trường này; `google_website` / `google_phone` nhớ lần cuối Google nói gì để phân biệt |
| `price_level`, `google_summary` *(mới)* | lấy lại, giữ để **tái sử dụng** | chủ dự án chọn giữ; app không hiện `price_level` |
| `desc_en` | theo Google chỉ khi desk đánh dấu `reviewer_source = google` | chữ desk viết không bao giờ bị ghi đè |
| `price_vnd` | không đụng | là giá của desk |
| nội dung review | **không lấy** | văn của người khác, không phải của mình để hiện; "why go" là giọng biên tập của mình |

Hai hệ quả phải biết:

- `editorialSummary` là trường đắt nhất trong mask và quyết định giá của cả
  call (Places API tính theo trường đắt nhất). Giữ nó là lựa chọn có giá.
  Khoảng 30 call/ngày khi đã hết tồn đọng; bảng giá chưa kiểm được từ môi
  trường này.
- `rating_count` bị ghi đè, không lưu lịch sử — nên *độ chênh* ở mục
  01/09 vẫn chưa được ghi lại. Muốn có tín hiệu xu hướng thì cần bảng
  snapshot có ngày, như C4 mô tả cho số liệu mạng xã hội.

Một mâu thuẫn còn mở: **44** `desc_en` đang là chữ của Google
(`reviewer_source = google`), trong khi câu trả lời gửi Apple
(review-reply 2.1) nói mô tả do desk tự viết. Job làm mới giữ cho 44 dòng đó
đúng với Google; nó không làm cho chúng thành của mình.

## C2. Google thay Nominatim / Photon — hoá đơn là thứ phải canh

`find-address` (Photon + Nominatim) đã bỏ từ 09/2026; tìm điểm bắt đầu và
chú thích dưới bản đồ đi qua `fetch-place` tới Google Places và Geocoding.
Không còn giới hạn 1 request/giây hay
câu hỏi self-host; cái phải theo dõi thay vào đó là hoá đơn Google: một lần
tìm là một Text Search, một lần dời ghim là một Geocoding call, cả hai tính
theo nghìn request sau hạn mức miễn phí hàng tháng.

Đây là lý do D8 (cảnh báo ngân sách trên key Google) nằm trong #708.

## C3. Ghi nguồn

- **Open-Meteo** (CC BY 4.0) — ghi ở mục "Weather data" của Điều khoản
  (#706), có test trong `weather.test.ts` giữ cho dòng ghi nguồn khớp với nhà
  cung cấp mà code thật sự gọi.
- **Google Maps** — logo do SDK tự vẽ.
- **OpenStreetMap** — không còn dùng. Toạ độ điểm bắt đầu lưu trong `trips`
  từ trước 09/2026 có thể đến từ kết quả OSM; ODbL áp dụng cho chúng nếu có
  ngày xuất ra ngoài.

## C4. Chỉ số mạng xã hội — đã cân nhắc và không lưu (01/09/2026)

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
