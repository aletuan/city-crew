# Marker dạng ảnh có icon cho PlacesMap — Thiết kế

**Ngày:** 2026-09-21
**Trạng thái:** đã duyệt, chờ viết kế hoạch triển khai

## Vấn đề

`PlacesMap` vẽ 288 địa điểm bằng `Marker` mặc định của `react-native-maps`, phân biệt bằng `pinColor` lấy từ `CATEGORIES[key].color`. Chín category được mã hoá bằng **một kênh duy nhất là màu**, trên một hình pin không có nhãn, không có icon.

Ngày 2026-09-21 đã thử sửa bằng cách chỉnh tông màu (nhánh `map-pin-weight`, commit `22c3f2c75`, đã xoá). Đo trên simulator cho thấy cách đó **không thể có tác dụng**:

| Nền tảng | `pinColor` thực sự điều khiển được gì |
|---|---|
| iOS | hue và một phần saturation. Marker art của Google áp luminance của chính nó. Đo được: `#A15B2C` (L40%) và `#E9AC83` (L71%) cùng render ra `#7A3405`. |
| Android | chỉ hue. `MapMarkerManager.setPinColor` chạy `Color.colorToHSV` rồi giữ `hsv[0]`. |

Kết quả đo before/after của lần thử đó: tương phản với nền bản đồ sáng đi từ 3.87 → 2.92 cho `nature` (xấu đi 25%), các category khác đứng yên hoặc kém hơn.

Kết luận: chừng nào còn dùng marker mặc định, ta không điều khiển được độ sáng, không có icon, và Android còn ít hơn nữa.

## Giải pháp

Dùng prop `image` của `Marker` (hỗ trợ **cả iOS lẫn Android**, `react-native-maps` 1.27.2) với PNG dựng sẵn: hình giọt nước, nền màu category, vành trắng, icon Ionicons màu trắng ở giữa.

Ảnh là thứ ta kiểm soát từng pixel. Đây là đòn bẩy duy nhất thật sự.

### Vì sao giọt nước chứ không phải badge tròn

Đuôi nhọn chỉ đúng toạ độ. Badge tròn lấy tâm hình tròn làm điểm neo, mơ hồ hơn khi nhiều pin chồng nhau. Cũng giữ nguyên thói quen đọc bản đồ của người dùng.

Kiểu "đĩa trắng viền màu" bị loại vì xung đột với quyết định đã ghi trong `cluster.ts`: *"a white disc inside a hard dark ring is Google's own annotation style, and a reader should be able to tell our groups from the map's furniture without reading either."*

### Vì sao chỉ một bộ asset, không có biến thể sáng/tối

Đã ghép marker dựng thử lên ảnh chụp bản đồ thật ở cả hai scheme và cả nền công viên. Vành trắng gánh việc tách pin khỏi nền, nên cùng một bộ ảnh đọc tốt trên cả bốn nền. Số file giảm một nửa.

Đây là khác biệt so với lần thử trước, vốn giả định cần hai tông cho hai nền — giả định đó xuất phát từ việc đo hex khai báo thay vì đo pixel.

## Bảng màu

Mỗi nền pin giữ **đúng hue** của chip category (trôi ≤ 0.01°), và được chọn là màu sáng nhất trên đường hue đó mà icon trắng vẫn đạt ≥ 4.5:1.

| key | icon Ionicons | chip `color` | nền PNG | icon trắng vs nền |
|---|---|---|---|---|
| `cafes` | `cafe-outline` | `#D2A679` | `#B75F05` | 4.51 |
| `focus` | `laptop-outline` | `#989AD7` | `#6468E2` | 4.55 |
| `eats` | `restaurant-outline` | `#E09A6B` | `#A45E2F` | 4.98 |
| `views` | `business-outline` | `#6FB3C0` | `#216572` | 6.63 |
| `heritage` | `library-outline` | `#D98A80` | `#DA3C28` | 4.51 |
| `nature` | `leaf-outline` | `#8FBF8A` | `#28881E` | 4.54 |
| `markets` | `bag-outline` | `#C98BB0` | `#DB2190` | 4.53 |
| `nightlife` | `wine-outline` | `#A98CD9` | `#8E54EE` | 4.51 |
| `fun` | `ticket-outline` | `#C88BD0` | `#B93FC9` | 4.55 |
| neutral (không phân loại) | `ellipse-outline` | — | `#5F5A4E` | 6.86 |

Ràng buộc là tương phản với icon, **không phải** độ sáng HSL cố định. Lam và lục có luminance cảm nhận cao hơn ở cùng độ sáng HSL, nên `nature` và `views` phải sẫm hơn `heritage` để icon trắng đọc được. Một bảng khoá theo L cố định cho `nature` chỉ 2.32:1.

### Pin đang được chọn

Giữ **nguyên coral thương hiệu `#FF6F5B`** (bằng `colors.accentFill`), nhưng icon **đảo sang mực `#17150F`** thay vì trắng, và pin to hơn **1.28×**. Vẫn giữ icon của category.

Icon trắng trên coral chỉ đạt 2.74:1. Làm coral tối đi để cõng icon trắng thì nó rơi trúng `heritage` (1.65:1) — chính là xung đột hue đã biết (coral 7.3°, heritage 6.7°). Đảo icon giải được cả hai: `#17150F` trên `#FF6F5B` đạt **6.67:1**, và coral giữ đúng màu thương hiệu.

Ba kênh cùng báo "đang chọn": nền coral, icon đảo màu, kích thước lớn hơn. Xung đột hue coral↔Culture **tan hẳn** vì icon đã gánh việc nói category — màu không còn phải làm hai việc.

## Kiến trúc

```
lib/categories.ts        category nào thắng + màu nền PNG của nó   (thuần, cổng 100%)
scripts/map-pins.py      sinh PNG từ bảng trên                     (chạy tay, hiếm)
assets/pins/*.png        asset đã commit                           (40 file)
components/mapPins.ts    bảng tra key → module ảnh                 (import tĩnh, không logic)
components/PlacesMap.tsx image={...} anchor={{x: 0.5, y: 1}}
```

### Ranh giới từng đơn vị

| Đơn vị | Làm gì | Phụ thuộc |
|---|---|---|
| `lib/categories.ts` | Trả về category đứng đầu của một địa điểm, và màu nền pin của mỗi category. Không biết gì về ảnh. | không |
| `scripts/map-pins.py` | Đọc bảng category, vẽ 20 PNG × 2 mật độ, ghi `pins.manifest.json`. | Pillow, Ionicons.ttf |
| `components/mapPins.ts` | `import` tĩnh từng PNG, export hàm `pinImage(key, chosen)`. Không tính toán. | asset |
| `components/PlacesMap.tsx` | Chọn key qua `lib`, lấy ảnh qua `mapPins`, đặt `image` + `anchor`. | cả hai |

`lib` giữ nguyên quy tắc "không React, không native khi import" của repo — nó không chạm asset.

## Kiểm kê asset

| | số |
|---|---|
| pin thường: 9 category + 1 neutral | 10 |
| pin được chọn: 9 category + 1 neutral | 10 |
| × mật độ `@2x`, `@3x` | **40 file** |

Metro tự chọn mật độ theo hậu tố tên file. Không cần `@1x` — không thiết bị nào còn dùng.

Kích thước: pin thường 34×44pt, pin được chọn 44×56pt (1.28×). So được với pin mặc định của Google (~28×44pt).

## Chống trôi lệch giữa bảng màu và asset

Rủi ro thật của asset sinh sẵn: thêm một category rồi quên chạy lại generator, và bản đồ im lặng vẽ thiếu.

Generator ghi kèm `assets/pins/pins.manifest.json` dạng `{ key: { file, fill, size } }`. Một vitest đối chiếu manifest với `CATEGORY_ORDER` và với màu nền khai báo trong `CATEGORIES`. Bắt được lệch mà không cần giải mã PNG trong test — đúng tinh thần "test giữ bất biến, không giữ giá trị" của repo.

Test này thay cho việc chạy generator trong CI, vì generator cần Python và Pillow mà CI không có.

## Chi tiết dễ sai

- **`anchor={{ x: 0.5, y: 1 }}`** — bắt buộc. Mặc định ảnh canh giữa vào toạ độ, nên thiếu prop này thì đuôi pin nằm dưới điểm thật nửa chiều cao pin.
- **Giữ `pinColor` bên cạnh `image`.** `react-native-maps` bỏ qua `pinColor` khi có ảnh, nên không tốn gì; nhưng nếu asset lỗi tải thì pin lùi về một màu hợp lý thay vì đỏ mặc định.
- **Vitest xử lý được `import x from '*.png'`** — Vite phân giải asset tĩnh thành chuỗi URL. Đã có tiền lệ trong repo: `SignUpScreen.tsx:27`, `WelcomeSheet.tsx:68`. Nghĩa là test khẳng định được "category này ra đúng ảnh này".

## Phạm vi

**Trong phạm vi:** pin của địa điểm, pin được chọn, pin không phân loại; cả iOS lẫn Android.

**Ngoài phạm vi:**
- **Bubble cluster không đổi.** Chúng mang số đếm động nên buộc phải là View tự vẽ; không thể là ảnh dựng sẵn.
- **Không đổi hue category.** Ưu tiên 2 trong bản review ban đầu (tách `heritage` khỏi coral) **không còn cần** — icon đã tách kênh.
- **Không đổi màu chip.** `CATEGORIES[key].color` giữ nguyên: nó vẽ glyph trên nền app, cạnh chữ, và được vẽ đúng nguyên văn.

## Android được lợi nhiều nhất

Đây là lần đầu Android có màu pin thật. Hiện tại nó vứt bỏ mọi thứ trừ hue, nên pin `cafes` và `eats` (lệch 6°) gần như trùng nhau trên Android. `image` bỏ qua đường `colorToHSV` hoàn toàn.

Lần thử trước cố tình không chạm Android; việc này thì sửa hẳn.

## Kiểm thử

| Mức | Khẳng định |
|---|---|
| thuần (`lib`) | category đứng đầu được chọn đúng theo thứ tự filter row — đã có trong `taxonomy.test.ts` |
| bất biến | manifest phủ hết `CATEGORY_ORDER`; mỗi `fill` khớp màu khai báo |
| UI (`PlacesMap`) | stub `Marker` ghi `image` và `anchor`; mỗi category ra đúng ảnh; pin được chọn ra ảnh coral; `anchor.y === 1` |
| mắt thường | simulator, cả hai scheme, đo pixel pin để xác nhận PNG tới màn hình nguyên vẹn |

Bước cuối không phải thủ tục: chính nó đã bác bỏ lần thử trước. Không kết luận gì về hiển thị mà không chụp màn hình và lấy mẫu pixel.
