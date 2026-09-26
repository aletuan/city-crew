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

### Cập nhật 26/09/2026 — ảnh đã về nhà

Ảnh không còn là phần lớn của C1. Truy vấn `place_photos` theo host của
`photo_uri`: **4.171** ảnh nằm trên storage Supabase của mình (việc của
`rehost-photos`), **2** ảnh còn ở `lh3.googleusercontent.com`, 1 ở
`aletuan.github.io`. Hai ảnh còn trên Google là việc dọn dữ liệu, không
phải lý do để thiết kế job làm mới quanh ảnh. Phần còn lại của C1 là các
trường văn bản ở trên, và vẫn chưa có cột `google_refreshed_at`.

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
