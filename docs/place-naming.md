# Quy ước đặt tên địa điểm

Tên hiển thị của một địa điểm nằm ở ba cột `places.name_en`, `name_vi`,
`name_ja`. Ghi chú này nói tên đó nên trông như thế nào, và vì sao.

Quy ước được vớt ra từ đợt rà soát 105 địa điểm nhập trong tuần 13–18/9/2026
(`supabase/migrations/20260919030000_place_import_audit.sql`): 21 trong số đó
phải sửa tên. Không có bẫy nào ở đây là giả định — mỗi mục dưới đây là một
dòng dữ liệu thật đã hiển thị sai trong app.

## Vấn đề gốc

`fetch-place` lưu nguyên `displayName` mà Google Places trả về. Google viết
tên đó cho một pin trên bản đồ, không phải cho một catalog: nó gánh thêm giờ
mở cửa, mã chi nhánh, ký hiệu thương hiệu, slogan, và nửa tiếng Hàn hoặc
tiếng Nhật của biển hiệu song ngữ. Trên bản đồ những thứ đó vô hại — pin nào
cũng chỉ hiện khi bấm vào. Trong một danh sách dọc của City Crew, chúng làm
dòng bị cắt, phá sắp xếp A–Z, và khiến hai quán khác nhau trông giống hệt.

Vậy nên: **tên Google là điểm xuất phát, không phải kết quả.**

## Sáu quy tắc

**1. Title Case, giữ nguyên dấu tiếng Việt.**
`donau the cafe` → `Donau The Cafe`. `tán hiên Đà Lạt` → `Tán Hiên Đà Lạt`.

Ngoại lệ: tên viết hoa toàn bộ mà rõ ràng là cách tạo hình thương hiệu thì
giữ nguyên — `LEONA CAFE`, `MRSIMPLE CAFÉ`, `TRỐN để dừng chân`, `ẤP cafe`.
Ranh giới ở đây là chủ ý: chủ quán viết hoa để tạo phong cách, còn chữ thường
đầu dòng thường chỉ là cách họ gõ vào Google.

**2. Không đưa thông tin vận hành vào tên.**
Giờ mở cửa, số điện thoại, "Open 24h", "Mở cửa 24/24" — tất cả đã có cột
riêng (`opening_hours`, `phone`). `Cà Zone - Nguyễn Gia Trí - Open 24h` →
`Cà Zone — Nguyễn Gia Trí`.

**3. Bỏ ký hiệu ®, ™, ©.**
`Chidori Crepe®` → `Chidori Crepe`. Ký hiệu đứng đầu tên còn tệ hơn: nó đẩy
dòng đó ra khỏi thứ tự A–Z. `® XOCOATI - Artisan Cocoa Drinks` từng nằm trên
cùng mọi danh sách vì lý do này.

**4. Hậu tố chi nhánh chỉ thêm khi có từ hai cơ sở trong catalog**, viết dạng
`Tên — Phường/Khu`.

Không dùng "CN", không dùng số nhà: `Tarobu Dessert Chè Đá Bào Khoai Dẻo -
CN Điện Biên Phủ` → `Tarobu Dessert — Điện Biên Phủ`; `1000M Tea & Coffee -
130A Nguyen Dinh Chieu` → `1000M Tea & Coffee — Nguyễn Đình Chiểu`.

Khi hai quán khác nhau trùng tên, đây chính là cách tách chúng ra — hai quán
`Nhâm Coffee` cách nhau 2 km thành `Nhâm Coffee — Thạnh Mỹ Tây` và
`Nhâm Coffee — Gia Định`. Nhưng đừng tách thứ vốn đã khác: `Cafe Linh`,
`Café Linh`, `Cà phê Linh`, `Linh Coffee` là bốn quán với bốn biển hiệu khác
nhau, để nguyên.

**5. Không giữ slogan hay từ chỉ loại hình.**
`Rêverie - Make dreams taste real` → `Rêverie`. `Chilli Thai - Vincom Center
Dong Khoi - Thai restaurant` → `Chilli Thai — Vincom Center Đồng Khởi`. App
đã hiển thị category ngay cạnh tên; nhắc lại "Thai restaurant" chỉ tốn chỗ.

**6. `name_en` chỉ dùng chữ Latin.**
Chữ Hàn, Nhật, Trung trên biển hiệu chuyển sang cột ngôn ngữ của nó, hoặc bỏ
nếu không có cột phù hợp:

| Trước | `name_en` | `name_ja` |
| --- | --- | --- |
| `Kakinoki 호치민 2군 일식 이탈리안` | `Kakinoki` | — |
| `Pacho Pocha Express - 파초포차` | `Pacho Pocha Express` | — |
| `To - Hidden Cocktails Bar ト - 隠れ家バー` | `To — Hidden Cocktails Bar` | `ト — 隠れ家バー` |
| `Meili 美丽 - Mì Bò Đài Loan Bình Thạnh` | `Meili — Mì Bò Đài Loan` | — |

Hiện chưa có cột tiếng Hàn hay tiếng Trung, nên phần chữ Hàn/Trung bị bỏ.
Nếu sau này catalog cần nó, thêm cột chứ đừng nhét lại vào `name_en`.

## Ba cột đi với nhau thế nào

`name_vi` đi theo `name_en` trừ khi quán thật sự có tên tiếng Việt riêng.
Với hầu hết quán cà phê Sài Gòn, hai cột giống hệt nhau và điều đó là đúng —
`Cà Kê Café` không có bản dịch.

`name_ja` để trống được. Nó chỉ nên có giá trị khi quán thật sự có biển hiệu
tiếng Nhật, không phải khi ta phiên âm hộ.

## Dấu gạch

Dùng gạch dài `—` (em dash) giữa tên và hậu tố, không dùng `-`. Google trả
về `-`, tên trong catalog dùng `—`. Đây là tín hiệu đọc được: thấy `-` trong
một tên nghĩa là dòng đó chưa qua rà soát.

## Slug thì không sửa

`slug` là khoá ổn định — nó nằm trong link chia sẻ, trong collection, trong
trip. Đổi tên **không** kéo theo đổi slug. Nên sau đợt rà soát có những cặp
trông lệch nhau, và đó là bình thường:

```
slug: chilli-thai-vincom-center-dong-khoi-thai-restaur
name: Chilli Thai — Vincom Center Đồng Khởi
```

## Kiểm tra nhanh

Quét các lỗi trên toàn bảng:

```sql
select slug, name_en
from public.places
where name_en ~ '[®™©]'                    -- ký hiệu thương hiệu
   or name_en ~ '[가-힣ぁ-んァ-ヶ一-龥]'      -- chữ Hàn/Nhật/Trung
   or name_en ~ '^[a-z]'                   -- chữ thường đầu dòng
   or name_en ilike '%open 24%'            -- giờ mở cửa
   or name_en ilike '% - CN %'             -- mã chi nhánh
order by name_en;
```

Nên chạy sau mỗi đợt import lớn, cùng với kiểm tra `city_id` khớp địa chỉ.

## Việc còn lại

Quy tắc 1, 2, 3 và 6 đều máy làm được: bỏ ký hiệu, cắt hậu tố giờ mở cửa,
tách chữ không phải Latin, Title Case. Chỗ đúng để làm là `fetch-place`,
ngay lúc nhập — rà soát tay chỉ nên còn lại quy tắc 4 và 5, vốn cần biết
trong catalog đã có gì.
