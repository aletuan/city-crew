# Marker dạng ảnh có icon cho PlacesMap — Thiết kế

**Ngày:** 2026-09-21
**Trạng thái:** đã ship. Kế hoạch triển khai: `docs/history/2026-09-21-map-pin-images.md`. Code hiện tại là `app/src/components/mapPins.ts`.

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

Dùng prop **`icon`** của `Marker` (`react-native-maps` 1.27.2) với PNG dựng sẵn: hình giọt nước, nền màu category, vành trắng, icon Ionicons màu trắng ở giữa.

Ảnh là thứ ta kiểm soát từng pixel. Đây là đòn bẩy duy nhất thật sự.

### `image` chứ không phải `icon`

Quyết định này **đã bị đảo ngược tại cổng xác minh trên simulator**, và đây là lý do cổng đó tồn tại. Bản thiết kế ban đầu chọn `icon`; chạy thật cho thấy nó hỏng.

Hai prop là một trên Android (`MapMarkerManager.java:216` và `:224` cùng gọi `view.setImage(source)`). Trên iOS chúng khác nhau, và cái khác biệt quyết định **không phải** thứ đọc code sẽ đoán ra:

| prop | đường đi trên iOS | sống sót qua `didInsertInMap`? |
|---|---|---|
| `icon` | `setIconSrc` gán thẳng `_realMarker.icon` | **Không** |
| `image` | `setImageSrc` dựng `UIImageView` → `_realMarker.iconView` | **Có** |

`didInsertInMap` (`AIRGoogleMapMarker.m:92`) **vứt marker cũ đi và dựng một `AIRGMSMarker` mới**, rồi áp lại một danh sách cố định các thuộc tính đã lưu: vị trí, `_iconView`, rotation, identifier, title, anchor, flat, draggable, tappable, `_pinColor`, opacity. **Icon không nằm trong danh sách đó.**

Nên với `icon`, kết quả phụ thuộc vào một cuộc đua: ảnh tải xong *sau* khi chèn thì icon còn, tải xong *trước* thì bị vứt và pin thành **pin đỏ mặc định của Google, vĩnh viễn**. Đo được: chạm một pin là đủ — chọn một địa điểm làm cluster tính lại và mount marker mới. Lấy mẫu pixel ra `#EA4335`, không tự phục hồi.

`image` sống sót cả hai thứ tự. `didInsertInMap` khôi phục icon view, và completion block của `setImageSrc` kết thúc bằng `[realMarker setIconView:]` — thứ nào xảy ra sau cũng đặt lại được ảnh. Đo: sáu lần chọn liên tiếp cộng ba lần pan, **0 pixel đỏ mặc định**.

Chính phép gán lại đó cũng là lý do `tracksViewChanges={false}` an toàn ở đây, dù `cluster.ts` ghi rằng một custom view bị đóng băng sẽ hiện ra trắng trơn: không gì gán lại một React child, còn thư viện thì gán lại cái này.

Cái giá là marker nền View thật. Nhưng đó là **một `UIImageView` cho mỗi pin**, không phải một cây component React — nhẹ hơn hẳn thứ mà mệnh đề "288 marker phải là bản đồ chứ không phải 288 View" nói tới. Ở zoom sâu nhất, nơi cluster tan hết và cả 288 pin cùng vẽ, bản đồ vẫn mượt.

### Vì sao giọt nước chứ không phải badge tròn

Đuôi nhọn chỉ đúng toạ độ. Badge tròn lấy tâm hình tròn làm điểm neo, mơ hồ hơn khi nhiều pin chồng nhau. Cũng giữ nguyên thói quen đọc bản đồ của người dùng.

Kiểu "đĩa trắng viền màu" bị loại vì xung đột với quyết định đã ghi trong `cluster.ts`: *"a white disc inside a hard dark ring is Google's own annotation style, and a reader should be able to tell our groups from the map's furniture without reading either."*

### Vì sao chỉ một bộ asset, không có biến thể sáng/tối

Đã ghép marker dựng thử lên ảnh chụp bản đồ thật ở cả hai scheme và cả nền công viên. Vành trắng gánh việc tách pin khỏi nền, nên cùng một bộ ảnh đọc tốt trên cả bốn nền. Số file giảm một nửa.

Đây là khác biệt so với lần thử trước, vốn giả định cần hai tông cho hai nền — giả định đó xuất phát từ việc đo hex khai báo thay vì đo pixel.

## Bảng màu

Mỗi nền pin giữ **đúng hue** của chip category (trôi 0.00°). Quy tắc chọn đầy đủ nằm ngay dưới bảng — cần cả ba vế.

| key | icon Ionicons | chip `color` | nền PNG | icon trắng vs nền |
|---|---|---|---|---|
| `cafes` | `cafe-outline` | `#D2A679` | `#B75F05` | 4.51 |
| `focus` | `book-outline` | `#989AD7` | `#6468E2` | 4.55 |
| `eats` | `restaurant-outline` | `#E09A6B` | `#A45E2F` | 4.98 |
| `views` | `business-outline` | `#6FB3C0` | `#216572` | 6.63 |
| `heritage` | `library-outline` | `#D98A80` | `#DA3C28` | 4.51 |
| `nature` | `leaf-outline` | `#8FBF8A` | `#28881E` | 4.54 |
| `markets` | `bag-outline` | `#C98BB0` | `#DB2190` | 4.53 |
| `nightlife` | `wine-outline` | `#A98CD9` | `#8E54EE` | 4.51 |
| `fun` | `ticket-outline` | `#C88BD0` | `#B93FC9` | 4.55 |
| neutral (không phân loại) | `ellipse-outline` | — | `#5F5A4E` | 6.86 |

Ràng buộc là tương phản với icon, **không phải** độ sáng HSL cố định. Lam và lục có luminance cảm nhận cao hơn ở cùng độ sáng HSL, nên `nature` và `views` phải sẫm hơn `heritage` để icon trắng đọc được. Một bảng khoá theo L cố định cho `nature` chỉ 2.32:1.

Quy tắc đầy đủ, theo đúng thứ tự ưu tiên — cần cả ba vế, bỏ vế nào cũng ra bảng khác:

1. **hue trùng khít hue của chip** (đây là vế nặng nhất: nó là thứ làm pin và chip thành *một* màu),
2. **saturation ≥ 55%** (dưới ngưỡng này màu ngả xám và mất tư cách mã màu),
3. trong số còn lại, lấy màu **sáng nhất** mà icon trắng vẫn ≥ 4.5:1.

Ba giá trị vượt xa ngưỡng — `views` 6.63, `eats` 4.98, neutral 6.86 — **không phải nhầm lẫn, đừng "sửa" chúng**. Trên hue của `views` có `#2A8192` sáng hơn và vẫn đạt 4.51, nhưng hue của nó lệch 0.18°; `#216572` lệch 0.0000°. Vế 1 thắng vế 3. Tương tự `eats`: `#AD6332` sáng hơn nhưng lệch 0.20°.

Neutral không nằm trên đường hue nào cả — nó là xám chọn tay, vì `#8A8578` có chroma quá nhỏ nên phép giữ-hue khuếch đại sai số và đẩy nó thành cam.

Một category thứ mười phải được giải bằng đúng ba vế này, không phải bằng mắt.

### Pin đang được chọn

Giữ **nguyên coral thương hiệu `#FF6F5B`** (bằng `colors.accentFill`), nhưng icon **đảo sang mực `#17150F`** thay vì trắng, và pin to hơn **1.28×**. Vẫn giữ icon của category.

Icon trắng trên coral chỉ đạt 2.74:1. Làm coral tối đi để cõng icon trắng thì nó rơi trúng `heritage` (1.65:1) — chính là xung đột hue đã biết (coral 7.3°, heritage 6.7°). Đảo icon giải được cả hai: `#17150F` trên `#FF6F5B` đạt **6.67:1**, và coral giữ đúng màu thương hiệu.

Ba kênh cùng báo "đang chọn": nền coral, icon đảo màu, kích thước lớn hơn. Xung đột hue coral↔Culture **tan hẳn** vì icon đã gánh việc nói category — màu không còn phải làm hai việc.

## Khi một chip đang bật

Hành vi hiện tại **giữ nguyên**: dưới một chip category, **mọi** pin mặc lấy ảnh của chip đó, không phải ảnh category riêng của từng địa điểm.

Quy tắc này đã được bảo vệ trong doc comment của prop `category` (`PlacesMap.tsx:87-96`): *"one kind asked for, one colour back"* — một quán cà phê kiêm chỗ làm việc không được hiện ra nâu-cà-phê khi đang đứng trong chip Focus, vì một địa điểm nhiều nhãn luôn lấy nhãn đứng trước.

Nghĩa là hàm tra ảnh nhận **cả chip**, đúng như `pinTint(p, chip)` hôm nay:

```
pinImage(place, chip, chosen)  →  chip có trong bảng ? ảnh của chip : ảnh của category đứng đầu
```

Điều này cũng buộc phải giữ để `MapPlaceCard` ở đáy bản đồ còn đồng bộ: `ExploreScreen.tsx:1538` truyền `tint={pinTint(selected, cat === ALL ? null : cat)}` cho chấm tròn trên thẻ, vốn tồn tại để mắt đi được từ thẻ về đúng cái pin. Hai bên phải cùng một quy tắc chọn category, khác nhau chỉ ở chỗ thẻ lấy `color` (pastel, nền app) còn pin lấy ảnh.

`pinTint` **không đổi** và vẫn phục vụ thẻ.

## Kiến trúc

```
lib/categories.ts        category nào thắng + màu nền PNG của nó   (thuần, cổng 100%)
scripts/map-pins.py      sinh PNG từ bảng trên                     (chạy tay, hiếm)
assets/pins/*.png        asset đã commit                           (60 file)
components/mapPins.ts    pinImage(place, chip, chosen) → module ảnh (import tĩnh)
components/PlacesMap.tsx icon={...}  tracksViewChanges={false}
```

### Ranh giới từng đơn vị

| Đơn vị | Làm gì | Phụ thuộc |
|---|---|---|
| `lib/categories.ts` | Trả về category đứng đầu của một địa điểm, và màu nền pin của mỗi category. Không biết gì về ảnh. | không |
| `scripts/map-pins.py` | Đọc bảng category, vẽ 20 pin × 3 mật độ = 60 PNG, ghi `pins.manifest.json`. | Pillow, Ionicons.ttf |
| `components/mapPins.ts` | `import` tĩnh từng PNG, export `pinImage(place, chip, chosen)`. Không tự giải category — uỷ cho `lib` và chỉ tra bảng. | asset + `lib/categories` |
| `components/PlacesMap.tsx` | Lấy ảnh qua `mapPins`, đặt `icon` + `anchor`. Không truyền `pinColor`. | `mapPins` |

`lib` giữ nguyên quy tắc "không React, không native khi import" của repo — nó không chạm asset.

## Kiểm kê asset

| | số |
|---|---|
| pin thường: 9 category + 1 neutral | 10 |
| pin được chọn: 9 category + 1 neutral | 10 |
| × ba mật độ: gốc, `@2x`, `@3x` | **60 file** |

Metro tự chọn mật độ theo hậu tố tên file, nhưng **file gốc bắt buộc phải tồn tại** — `import x from './cafes.png'` phân giải từ tên đó rồi mới tìm `cafes@2x.png` / `cafes@3x.png`. Nên vẫn phải sinh cả bản `@1x` dù không thiết bị nào dùng tới.

Kích thước: pin thường 34×44pt, pin được chọn 44×56pt (1.28×). So được với pin mặc định của Google (~28×44pt).

## Chống trôi lệch giữa bảng màu và asset

Rủi ro thật của asset sinh sẵn: thêm một category rồi quên chạy lại generator, và bản đồ im lặng vẽ thiếu.

Generator ghi kèm `assets/pins/pins.manifest.json` dạng `{ key: { file, icon, fill, ink } }`. Một vitest đối chiếu manifest với `CATEGORY_ORDER` và với màu nền khai báo trong `CATEGORIES`. Bắt được lệch mà không cần giải mã PNG trong test — đúng tinh thần "test giữ bất biến, không giữ giá trị" của repo.

Test này thay cho việc chạy generator trong CI, vì generator cần Python và Pillow mà CI không có.

### Vì sao Python, khi `app/scripts/` toàn `.mts`

Đã cân nhắc generator bằng Node cho khớp quy ước (`legal-html.mts`) và để CI chạy được — như thế sẽ **loại bỏ** hẳn lớp lỗi trôi lệch thay vì chỉ phát hiện nó, mạnh hơn hẳn.

Cái giá là rasterizer: Node cần thêm một dependency native (`sharp`, `@napi-rs/canvas`) chỉ để vẽ 20 hình tròn và đặt glyph từ một file TTF. `react-native-svg` 15.15.4 có sẵn nhưng là bộ render lúc chạy, không dùng để build asset được.

Chọn Python + Pillow vì generator chạy **hiếm** — chỉ khi thêm hoặc đổi màu một category, tức vài lần mỗi năm — và test manifest đã chặn được trường hợp quên chạy. Đổi lại là một script không thuộc toolchain của repo; nếu sau này bảng category biến động nhiều hơn dự kiến thì nên chuyển sang Node.

## Chi tiết dễ sai

- **`anchor` đã mặc định đúng là `{x: 0.5, y: 1}`** (`MapMarker.d.ts:20`, `MapMarkerManager.java:200-207`) — không có độ lệch nào phải sửa. Vẫn truyền tường minh, nhưng lý do là *khoá điểm neo vào đuôi giọt nước*: nếu sau này ai đổi hình asset sang badge tròn, điểm neo phải được xem lại một cách có ý thức chứ không im lặng kế thừa.
- **`pinColor` phải bị bỏ hẳn, không được giữ làm "lưới đỡ".** Đây là cái bẫy nguy hiểm nhất của thay đổi này. `AIRGoogleMapMarker.m:470-473` — `setPinColor:` gán **vô điều kiện** `_realMarker.icon = [GMSMarker markerImageWithColor:pinColor]`, tức là nó *ghi đè icon*. Tệ hơn, `didInsertInMap:127-130` áp lại `_pinColor` một lần nữa sau khi marker được chèn vào bản đồ, đồng bộ, trong khi `setIconSrc` nạp ảnh bất đồng bộ. Và `PlacesMap.tsx` truyền `pinColor` **động** theo `selectedSlug`, nên mỗi lần người dùng chạm một pin, RN gửi lại `pinColor` → icon vừa nạp bị thay bằng pin mặc định của Google, mà vì `icon` không đổi nên RN **không** gửi lại nó để khôi phục. Giữ `pinColor` không phải vô hại: nó làm hỏng đúng thứ đang xây.
- **Trên iOS pin vô hình trong một hai khung hình đầu.** `setIconSrc` chèn sẵn một `UIImage` rỗng rồi mới nạp ảnh qua `ImageLoader` bất đồng bộ. Với 288 marker, bước xác minh bằng mắt phải nhìn luôn điều này thay vì phát hiện lúc chạy thật.
- **Vitest xử lý được `import x from '*.png'`** — Vite phân giải asset tĩnh thành chuỗi URL. Tiền lệ trong repo: `SignUpScreen.tsx:27`, `WelcomeSheet.tsx:68`, cả hai đều có UI test đang chạy. Nghĩa là test khẳng định được "category này ra đúng ảnh này".
- **Hằng `INK` bị khai tử.** `PlacesMap.tsx:34` hiện tách nền tảng (mực trên iOS, xanh azure trên Android) chỉ vì Android bóp màu về hue. Pin neutral dạng ảnh áp dụng như nhau cho cả hai, nên xoá `INK`, nhánh `?? INK` ở dòng 258, và cả `import { Platform }` — nó không còn ai dùng trong file.

## Phạm vi

**Trong phạm vi:** pin của địa điểm, pin được chọn, pin không phân loại; cả iOS lẫn Android.

**Ngoài phạm vi:**
- **Bubble cluster vẫn là View.** Chúng mang số đếm liên tục (tới 288) nên không bộ ảnh hữu hạn nào phủ được; đây là ràng buộc cấu trúc, không phải việc chưa làm. Chúng là thứ duy nhất còn cần `tracksViewChanges` + `SETTLE_MS`.

  *Bổ sung sau khi merge:* bảng màu của chúng **đã đổi**. Xem `clusterSkin` — đất ấm cũ nằm lọt trong cung màu của `cafes` và `eats`, và khi pin thôi là pastel thì bubble-100 với pin Eats đo ra 1.04:1, tức cùng một màu. Nay là xám (saturation dưới 10, trong khi mọi category từ 55 trở lên), nên bubble không thể đọc ra một loại địa điểm.
- **Không đổi hue category.** Ưu tiên 2 trong bản review ban đầu (tách `heritage` khỏi coral) **không còn cần** — icon đã tách kênh.
- **Không đổi màu chip.** `CATEGORIES[key].color` giữ nguyên: nó vẽ glyph trên nền app, cạnh chữ, và được vẽ đúng nguyên văn.

## Android được lợi nhiều nhất

Đây là lần đầu Android có màu pin thật. Hiện tại nó vứt bỏ mọi thứ trừ hue, nên pin `cafes` và `eats` (lệch 6°) gần như trùng nhau trên Android. `icon` bỏ qua đường `colorToHSV` hoàn toàn.

Lần thử trước cố tình không chạm Android; việc này thì sửa hẳn.

## Kiểm thử

| Mức | Khẳng định |
|---|---|
| thuần (`lib`) | category đứng đầu được chọn đúng theo thứ tự filter row — đã có trong `taxonomy.test.ts` |
| bất biến | manifest phủ hết `CATEGORY_ORDER`; mỗi `fill` khớp màu khai báo |
| UI (`PlacesMap`) | stub `Marker` ghi `icon`, `anchor`, `tracksViewChanges`; mỗi category ra đúng ảnh; **dưới một chip, mọi pin ra ảnh của chip**; pin được chọn ra ảnh coral kể cả khi có chip; địa điểm không phân loại ra ảnh neutral; `anchor.y === 1`; `tracksViewChanges === false` |
| mắt thường | simulator, cả hai scheme, đo pixel pin để xác nhận PNG tới màn hình nguyên vẹn |

Bước cuối không phải thủ tục: chính nó đã bác bỏ lần thử trước. Không kết luận gì về hiển thị mà không chụp màn hình và lấy mẫu pixel.
