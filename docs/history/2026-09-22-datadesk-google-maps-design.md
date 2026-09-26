# Data Desk chuyển từ OpenStreetMap sang Google Maps — Thiết kế

**Ngày:** 2026-09-22
**Trạng thái:** đã ship (không có kế hoạch triển khai riêng — người dùng yêu cầu làm ngay).

## Vấn đề

Data desk vẽ bản đồ bằng hai cơ chế khác nhau, cả hai đều không phải Google:

| Màn hình | Cơ chế hiện tại |
|---|---|
| `PlaceEditor.jsx:360` — khung **Fact-check** | `<iframe>` trỏ `openstreetmap.org/export/embed.html`, bbox ±0.004°/±0.003° quanh place, một marker, read-only |
| `Coverage.jsx` — bản đồ **phủ sóng** | Mosaic tile tĩnh ghép từ `<img>` lấy ở `basemaps.cartocdn.com/dark_all` (dữ liệu OSM), phủ SVG bubble theo quận |

Cùng một cái desk nhìn vào hai nền bản đồ khác nhau, và không nền nào khớp với bản đồ mà **chính app** dùng (`react-native-maps` + Google). Người curate đối chiếu một địa điểm trên OSM rồi bấm "Open in Google Maps ↗" để thấy một thế giới được vẽ khác đi — nhãn khác, đường khác, đôi khi cả vị trí POI cũng khác.

## Ràng buộc: key Google Maps được cấp cho phép làm gì

Đã đo trực tiếp ngày 2026-09-22 (curl + load thật trong Chrome từ `localhost`), không đoán từ tài liệu:

| API | Kết quả |
|---|---|
| **Maps JavaScript API** | **Được phép.** Load thật trong Chrome, request xác thực `GetViewportInfo` trả `200`, `mapConfigs:batchGet` trả `200`, không có `gm_authFailure` |
| Maps Embed API (iframe) | Bị chặn bởi *API restrictions* của key |
| Maps Static API | Bị chặn bởi *API restrictions* |
| Places API (new) | Bị chặn bởi *API restrictions* |
| Map Tiles API | Bị chặn bởi *API restrictions* |
| Geocoding / Places legacy | Google không cho dùng với key có referrer restriction |

Cách phân biệt hai loại lỗi: với referrer **không** được phép Google trả *"This IP, site or mobile application is not authorized"*; với referrer **được** phép nhưng API không nằm trong allowlist, Google trả *"not authorized to use this service or API… check the API restrictions settings"*. Toàn bộ bảng trên đo ở trạng thái thứ hai, tức là referrer đã qua.

Referrer được chấp nhận: `http://localhost` **mọi port**. Bị từ chối: `https://citycrew.app`, `https://data.citycrew.app`, `http://127.0.0.1`, và mọi request không có referer.

Hai hệ quả trực tiếp lên thiết kế:

1. **Không thể đổi iframe OSM thành iframe Maps Embed** — cách ít việc nhất lại là cách duy nhất chắc chắn hỏng.
2. **Không thể tự ghép tile của Google** — mosaic tĩnh của Coverage không có nguồn tile hợp lệ.

Vậy cả hai màn hình đều phải dựng trên **Maps JavaScript API**. Người dùng đã chọn phương án này thay vì bật thêm API trong Cloud Console.

Kéo theo hai ràng buộc nữa, vì không có **Map ID** (tạo Map ID đòi vào Cloud Console):

- Dark theme phải dùng **inline `styles` JSON** trên raster map. Cloud-based styling không dùng được. (Inline styling chỉ hoạt động khi *không* có `mapId` — điều này thành ra có lợi cho ta.)
- Marker phải là **`google.maps.Marker`** cổ điển. `AdvancedMarkerElement` đòi `mapId`. `Marker` đã bị Google đánh dấu deprecated từ tháng 2/2024 nhưng vẫn chạy và vẫn được hỗ trợ; đây là đánh đổi bắt buộc, không phải lựa chọn.

## Phát hiện làm cho việc migrate rẻ đi

`coverage.js` đang chiếu toạ độ bằng **đúng phép chiếu Web Mercator 256px mà Google JS API dùng**:

```js
export const TILE = 256;
export const lngToX = (lng, z) => ((lng + 180) / 360) * TILE * 2 ** z;
export const latToY = (lat, z) => { … }   // mercator chuẩn
```

Nghĩa là toạ độ pixel-thế-giới mà file này tính ra **trùng khít** với hệ toạ độ của `google.maps.Map` ở cùng mức zoom. Lớp SVG bubble không cần biết gì về Google: chỉ cần biết góc trên-trái của khung nhìn nằm ở pixel-thế-giới nào.

Toàn bộ `buildCoverage`, `districtOf`, `fitView`, `bubbleRadius` và test của chúng **giữ nguyên, không sửa một dòng**.

## Giải pháp

### Coverage — map tương tác, bubble bám theo projection

Người dùng chọn **pan/zoom đầy đủ** (không giữ chế độ tĩnh như hiện tại). Bubble vì thế phải theo map mỗi khi khung nhìn đổi:

```
map 'bounds_changed'  ──▶  đọc center + zoom từ map
                      ──▶  left = lngToX(center.lng(), z) − width/2
                           top  = latToY(center.lat(), z) − height/2
                      ──▶  SVG re-render bằng lngToX/latToY như cũ
```

`left`/`top` là **đúng hai biến mà code hiện tại đã tính** từ `fitView`. Khác biệt duy nhất: nguồn của chúng chuyển từ một giá trị tính một lần sang một giá trị đọc từ map mỗi khi map động.

`fitView()` giữ vai trò **khung hình ban đầu** — nó mã hoá ý đồ sản phẩm (clamp zoom 9–14, chừa margin 70px cho bán kính bubble và nhãn) mà `map.fitBounds` của Google không diễn đạt được, nhất là ở trường hợp suy biến một điểm duy nhất (`fitBounds` sẽ nhảy lên zoom 21). Để đưa kết quả của nó cho `map.setCenter`, cần chiếu ngược pixel-thế-giới về lat/lng — thêm `xToLng` / `yToLat` vào `coverage.js`.

**Đánh đổi đã cân nhắc.** Cách thay thế là bọc SVG trong một `google.maps.OverlayView`: Google tự dịch chuyển cả pane khi pan, nên không phải re-render frame nào, chỉ tính lại khi đổi zoom. Không chọn cho lần này vì: khoảng 25 bubble × 4 phần tử = ~100 node SVG, React reconcile dưới 2ms mỗi frame, trong khi `OverlayView` thêm một tầng coupling vào API mà file này cố tình tránh ("no map library rides along"). Nếu chạy thật thấy giật khi pan thì nâng cấp sang `OverlayView` mà **không phải viết lại toán học** — đó là lý do phần tính toạ độ nằm trong `coverage.js` chứ không nằm trong component.

### PlaceEditor — khung Fact-check

`<iframe>` thành một `<div>` chứa `google.maps.Map`: center tại toạ độ place, zoom 16, một `Marker`, dark style, `disableDefaultUI` nhưng giữ zoom control, cho pan/zoom để soi kỹ vị trí. Dòng toạ độ và link "Open in Google Maps ↗" giữ nguyên — nay link trỏ về cùng một nhà cung cấp với bản đồ ngay phía trên, điều mà iframe OSM không làm được.

### Loader dùng chung

`dashboard/src/lib/googleMaps.js` (mới):

- `loadGoogleMaps()` → `Promise<google.maps | null>`. Inject thẻ `<script>` **đúng một lần** cho cả hai màn hình, cache promise, trả `null` (không ném lỗi, không log ồn) khi thiếu key hoặc script hỏng.
- `DARK_STYLE` — mảng style JSON khớp token của desk (nền `#0d0a12`, chữ mờ, nhấn tím/hồng).

Không thêm dependency npm (`@googlemaps/js-api-loader` là 12 KB cho việc mà 40 dòng làm được). Dashboard hiện có đúng 4 dependency và giữ như vậy là có chủ ý.

### Không có key

`loadGoogleMaps()` trả `null`:

- **Coverage**: bubble đứng trên nền `#0d0a12`. Đây **đúng bằng** hành vi đã được thiết kế sẵn cho trường hợp tile CDN chết ("If the tile CDN is unreachable the bubbles still stand on the dark ground — the numbers never depend on the network").
- **PlaceEditor**: khối lặng hiển thị toạ độ + link Google Maps.

Bỏ hẳn OSM/CARTO, không giữ đường code dự phòng: hai nhà cung cấp là hai đường code và hai dòng attribution phải nuôi mãi mãi.

`.covattr` ("© OpenStreetMap · © CARTO") bị xoá — JS API **tự** render logo Google và "Map data ©Google", và **điều khoản dịch vụ cấm che chúng**. Lớp SVG vì thế đặt `pointer-events: none` ở gốc (bubble tự bật lại `auto`) và không được phủ mờ góc dưới-trái.

## Các file thay đổi

| File | Việc |
|---|---|
| `dashboard/src/lib/googleMaps.js` **(mới)** | Loader + `DARK_STYLE` |
| `dashboard/src/coverage.js` | Thêm `xToLng` / `yToLat`. Phần còn lại không đụng |
| `dashboard/src/components/Coverage.jsx` | Bỏ mosaic `<img>` và `tileUrl`; dựng `google.maps.Map` dưới lớp SVG; SVG theo `bounds_changed` |
| `dashboard/src/components/PlaceEditor.jsx` | Bỏ iframe; dựng map + marker |
| `dashboard/src/theme.css` | Bỏ `.covtile`, `.covattr`; `.mapframe` từ iframe thành div; thêm `.covbasemap`; quy tắc `pointer-events` |
| `dashboard/.env.example` | Thêm `VITE_GOOGLE_MAPS_KEY` **không kèm giá trị** |
| `.github/workflows/deploy-dashboard.yml` | Inject `VITE_GOOGLE_MAPS_KEY` từ repo secret, **không** default inline |

### Vì sao key này không được commit, khác với Supabase anon key

`.env.example` và workflow đang ghi thẳng giá trị Supabase URL + anon key, kèm ghi chú "public by design (RLS is the security boundary)". Key Google **không** có tính chất đó: không có RLS phía sau, và thứ chặn lạm dụng chỉ là HTTP referrer — mà referrer thì giả mạo được bằng một dòng curl. Key vẫn sẽ nằm trong bundle công khai trên GitHub Pages; điều đó không tránh được, nhưng không cần thêm một bản sao nữa trong repo cho bot quét.

## Test

- `tests/coverage.test.mjs`: thêm test round-trip `xToLng(lngToX(lng, z), z) ≈ lng` và `yToLat(latToY(lat, z), z) ≈ lat`.
- `tests/googleMaps.test.mjs` (mới): thiếu key → `null`; gọi hai lần → chỉ một thẻ `<script>`; promise được cache; script lỗi → `null` chứ không reject.
- Repo chưa có harness DOM cho JSX, và spec này không dựng một cái mới. Hai component được xác minh bằng **chạy thật** trên `localhost` trong Chrome, chụp màn hình cả hai màn hình ở chế độ dark.
- Giữ ngưỡng `npm run coverage` hiện tại (lines 46 / branches 69 / functions 11).

## Việc thuộc về người vận hành, không thuộc về repo

1. **Thêm referrer `https://aletuan.github.io/*`** vào key. Nếu không: map chạy ở local nhưng **trắng trên production** — đây là cách hỏng dễ xảy ra nhất của toàn bộ thay đổi này.
2. Tạo repo secret `VITE_GOOGLE_MAPS_KEY`.
3. Đặt **quota cap hằng ngày** trong Cloud Console. Vì referrer giả mạo được, quota cap là cái phanh thật sự.
4. **Rotate key** đã bị dán vào chat.
