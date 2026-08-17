# Đánh giá công nghệ & tiêu chí lên store / mở pilot

Tài liệu này trả lời hai câu hỏi tách rời nhau, và việc tách chúng ra là
điều quan trọng nhất ở đây:

1. **Stack hiện tại có đủ tốt không?** — Có. Kiến trúc lành mạnh, không
   có nợ kỹ thuật nào bắt buộc phải trả trước khi mở rộng.
2. **Đưa lên store / mở pilot cần gì?** — Phần lớn *không phải* việc viết
   thêm code. Rào cản lớn nhất là chính sách nền tảng (Apple/Google) và
   vận hành, không phải kỹ thuật.

> **Cập nhật 17/08/2026.** Tài liệu viết ngày 16/08. Từ đó Phase 1–4 của
> `docs/ai-agent-planner.md` đã ship: planner thật, chuyến đi lưu được, lời
> dẫn do model viết, cá nhân hoá. Điều đó **gỡ hẳn chặn B4** và thêm bốn bảng
> mà mục B3 phải khai báo. Các mục đã sửa được đánh dấu tại chỗ; phần còn lại
> giữ nguyên vì vẫn đúng.

Trạng thái tại thời điểm viết: app phân phối qua **EAS Update → Expo Go**,
chưa từng có bản build native, chưa có Apple/Google developer account.
Khoảng cách tới "một người lạ tải app từ App Store" lớn hơn vẻ ngoài.

---

## 1. Stack hiện tại

| Lớp | Công nghệ | Phiên bản | Nhận xét |
|---|---|---|---|
| Mobile | Expo (managed) + React Native | SDK 54 / RN 0.81.5 / React 19 | Hiện đại. Pin SDK 54 vì Expo Go trên App Store kẹt ở đó |
| Ngôn ngữ | TypeScript | 5.9, `strict` qua `tsc --noEmit` trong CI | Có gate thật |
| Điều hướng | React Navigation 7 (native-stack + bottom-tabs) | | Chuẩn |
| Bản đồ | `react-native-maps` 1.20 | Apple Maps trên iOS | Xem §5 về ràng buộc ToS |
| Backend | Supabase: Postgres + RLS + Auth + Storage + Edge Functions (Deno) | | Không có server riêng — đúng lựa chọn ở quy mô này |
| Dashboard curation | Vite 6 + React 18 + react-router 6 → GitHub Pages | | Dùng được từ điện thoại |
| Pipeline dữ liệu | Node scripts + Google Places API (New) | | Chạy server-side, key không lộ |
| Test | Vitest, 29 file test thuần Node (598 test) + 7 file test SQL chạy trên Postgres 16 thật | | Xem §2 |
| CI/CD | GitHub Actions: `checks`, `app-preview` (EAS Update), `deploy-dashboard`, `sync-mockup` | | |
| Dịch vụ ngoài | Google Places (server), OSM Photon + Nominatim (server), Open-Meteo (client, không key) | | |
| i18n | EN / VI / JA, tự cuộn (`lib/i18n.tsx`) | | |

Quy mô: ~18k dòng TS/TSX trong `app/`, 25 migration, 6 Edge Function.

---

## 2. Những gì đang làm tốt (không cần sửa)

Đây không phải phần lịch sự — mấy điểm này là lý do phần còn lại của tài
liệu ngắn hơn nó đáng ra phải dài.

- **Mô hình bảo mật RLS-first.** Client chỉ cầm publishable key; service
  role key không xuất hiện ở bất kỳ đâu ngoài Edge Function. Quyền ghi
  gắn với allow-list `editors` qua hàm `is_editor()` (security definer,
  bảng `editors` bật RLS không policy → chỉ service role đọc được). Đây
  là kiểu thiết kế mà đa số dự án cùng giai đoạn làm sai.
- **Storage scoped theo uid.** `avatars/${auth.uid()}/avatar.jpg`, policy
  ghi kiểm tra `storage.foldername(name)[1] = auth.uid()::text` — không
  ai ghi đè được ảnh người khác. Bucket giới hạn 2MB + MIME allow-list.
- **Publish là hành động hai bước.** Collection sinh ra luôn `is_public
  = false` (pin ở policy insert); `curator_handle` do trigger đóng dấu
  từ `profiles`, client không tự khai được → không mạo danh byline.
- **Handle chống mạo danh.** Unique index trên `lower(handle)` +
  bảng `reserved_handles` chặn `admin`, `citycrew`, `hanoicrew`…
- **Migration được test thật.** CI dựng Postgres 16, chạy migration, rồi
  assert — không phải "SQL đã đọc qua".
- **Test múi giờ tách riêng** (`test:tz` với `America/New_York`). Đã bắt
  được bug DST thật mà suite chạy ở giờ Hà Nội không thể thấy.
- **Biên hàm thuần.** Logic ở `src/lib/*.ts` chạy được trong Node trần —
  đó là lý do 29 file test tồn tại được mà không cần simulator.
- **Ý thức ToS bên thứ ba đã có sẵn trong code.** Không hiển thị kết quả
  Google Places trên Apple Maps (Places ToS §5.3); attribution ảnh
  Google render trên `PlaceCard`; nhãn "Kết quả từ OpenStreetMap" trên
  sheet tìm kiếm; `find-address` gửi `User-Agent` cho Nominatim; tìm
  kiếm chạy khi **submit**, không phải search-as-you-type (đây là điều
  giữ cho Nominatim không bị lạm dụng).
- **Open-Meteo gọi bằng toạ độ *thành phố*, không phải vị trí thiết bị.**
  Một quyết định riêng tư đúng và đã được ghi lại.

---

## 3. Nhóm A — Chặn kỹ thuật: chưa build được bản native

Đây là những thứ khiến `eas build` **thất bại ngay**, chưa nói tới nộp
store. Tất cả đều nhỏ, nhưng chưa cái nào tồn tại.

| # | Thiếu | Hậu quả | Việc cần làm |
|---|---|---|---|
| A1 | `ios.bundleIdentifier` trong `app.json` | EAS Build iOS dừng ngay | Đặt `com.citycrew.app` (hoặc domain thật) — **không đổi được sau khi lên store** |
| A2 | `android.package` | EAS Build Android dừng ngay | Cùng giá trị với A1 |
| A3 | Không có `app/eas.json` | Không có build profile, không có `eas submit` | Tạo profile `development` / `preview` / `production` |
| A4 | `version: 0.1.0`, không có `ios.buildNumber` / `android.versionCode` | Không nộp được bản thứ hai | Bật `autoIncrement` trong `eas.json` |
| A5 | Không cấu hình splash screen | App mở ra màn trắng/đen mặc định | Thêm plugin `expo-splash-screen`; asset `splash-icon.png` đã có sẵn nhưng chưa được khai báo |
| A6 | `android.adaptiveIcon.foregroundImage` trỏ `./assets/icon.png` | Icon Android bị crop sai — icon vuông nhét vào mặt nạ tròn | Trỏ sang `android-icon-foreground.png` / `-background` / `-monochrome` đã có trong `assets/` |
| A7 | Chưa quyết New Architecture | SDK 54 bật Fabric mặc định; `react-native-maps` + `react-native-svg` cần verify trên bản build thật | Build preview và test trên máy thật trước khi nộp |
| A8 | Kênh OTA chỉ có `main` | Update đẩy thẳng vào tay người dùng thật, không có bậc trung gian | Tách channel `production` / `preview`; workflow hiện đẩy `--branch main` |

**Chi phí tài khoản:** Apple Developer Program **99 USD/năm**, Google Play
Console **25 USD một lần**.

**Lưu ý Google Play (dễ bị bỏ sót):** tài khoản developer cá nhân mở sau
13/11/2023 bắt buộc chạy **closed testing với tối thiểu 12 tester liên
tục 14 ngày** trước khi được phép phát hành production. Nếu pilot dự kiến
qua Play Store, đây là ràng buộc lịch trình *hai tuần* nằm ngoài tầm kiểm
soát kỹ thuật — cần khởi động sớm.

---

## 4. Nhóm B — Chặn chính sách: đây mới là phần khó

App này có **nội dung do người dùng tạo và công khai được**: profile
(handle, bio, ảnh đại diện), collection publish cho mọi người đọc, và
`place_submissions` để người dùng đề xuất địa điểm. Điều đó kích hoạt
nguyên một bộ yêu cầu mà hiện **chưa có gì trong code**.

### B1. Apple Guideline 1.2 — User-Generated Content (chặn cứng)

Apple yêu cầu **đủ bốn thứ**, thiếu một là bị từ chối:

| Yêu cầu | Hiện trạng |
|---|---|
| Cơ chế lọc nội dung phản cảm | ❌ Không có. `handle` có regex hình dạng nhưng không có blocklist từ ngữ; `bio`, `full_name`, tên collection hoàn toàn tự do |
| Nút **báo cáo** nội dung phản cảm | ❌ Không có ở bất kỳ màn hình nào |
| **Chặn** người dùng lạm dụng | ❌ Không có |
| Thông tin liên hệ công khai của nhà phát triển | ❌ Không có |
| EULA (hoặc dùng Apple Standard EULA) | ❌ Chưa soạn |

Ngoài ra Apple đòi cam kết **xử lý báo cáo và gỡ người vi phạm trong 24
giờ**. Đây là cam kết *vận hành*, không phải tính năng — cần có người
trực.

> Đường tắt hợp lệ cho pilot: **tắt hẳn khả năng publish** trước khi nộp
> bản đầu (collection chỉ riêng tư, profile không tra cứu chéo được).
> Khi không có nội dung người dùng nào tới được mắt người dùng khác,
> Guideline 1.2 không áp dụng. Bật lại ở bản sau khi đã có report/block.
> Cơ chế đã sẵn sàng cho việc này: chỉ cần đảo lại policy trong
> `20260815120000_publish_collections.sql`.

### B2. Apple Guideline 5.1.1(v) — Xoá tài khoản trong app (chặn cứng)

App tạo tài khoản → **bắt buộc** có đường xoá tài khoản *ngay trong app*,
xoá cả dữ liệu, không được chỉ dẫn ra email hay website.

Hiện trạng: `ProfileScreen` chỉ có **Sign out**. Không có luồng xoá tài
khoản ở bất kỳ đâu trong `app/src` hay `supabase/`.

Việc cần làm:
- Edge Function `delete-account` (service role, gọi `auth.admin.deleteUser`).
- Dọn dữ liệu liên quan: `profiles` đã có `on delete cascade`; `places.submitted_by`
  cố ý dùng `on delete set null` (một quán cà phê không biến mất khi
  người giới thiệu nó rời đi — quyết định này đúng và nên giữ); còn phải
  xử lý `collections` thuộc sở hữu, `collection_places`, và object trong
  bucket `avatars`.
- UI xác nhận hai bước trong Profile.

### B3. Privacy Policy + khai báo dữ liệu (chặn cứng)

Không có file privacy policy nào trong repo. Cả hai store đều yêu cầu URL
công khai. GitHub Pages đang chạy sẵn → host ở đó.

Phải khai báo đúng những gì app thực sự thu thập:

| Dữ liệu | Thu thập ở đâu |
|---|---|
| Email | Supabase Auth (đăng ký/đăng nhập) |
| Tên, handle, bio, location, interests | `profiles` — **công khai với mọi người cầm publishable key** |
| Ảnh đại diện | Bucket `avatars`, public read |
| Vị trí thô (coarse) | `expo-location`, để chọn thành phố gần nhất |
| Ảnh/camera | `expo-image-picker` cho ảnh đại diện |
| Nội dung người dùng | Collection, đề xuất địa điểm |
| Chuyến đi đã lưu | `trips` + `trip_stops` — nơi bạn định đi, ngày nào, mấy giờ |
| Sở thích khai báo | `preferences` — category ưa thích, ngân sách |
| **Lịch sử địa điểm đã mở** | `place_events` — **opt-in, mặc định tắt** |

Tương ứng: **App Privacy nutrition label** (Apple) và **Data Safety form**
(Google Play). Khai sai form này là lý do từ chối phổ biến hơn cả lỗi code.

Lưu ý riêng: bảng `profiles` **ai cũng đọc được toàn bộ** (đúng thiết kế,
đã ghi rõ trong migration). Privacy policy phải nói thẳng điều đó, và
người dùng phải hiểu bio của họ là công khai.

**Thêm từ 17/08 — `place_events` là theo dõi hành vi và phải khai đúng như
thế.** Nó ghi lại chỗ người dùng mở, lưu, bỏ lưu, giữ hoặc bỏ khỏi plan. Bốn
điều kiện Apple/Google đòi cho loại dữ liệu này thì code đã làm đúng cả bốn:
opt-in mặc định **tắt**, opt-in cưỡng chế **trong chính policy insert** của
Postgres chứ không phải lời hứa của client, chủ sở hữu là người duy nhất đọc
được, và có nút "Xoá lịch sử của tôi" trong Profile (policy delete cố ý
**không** hỏi `history_on`, để tắt ghi rồi vẫn xoá được cái đã ghi).

Nhưng làm đúng không miễn cho việc khai báo: cả App Privacy label lẫn Data
Safety form đều phải liệt kê nó, và privacy policy phải nói app dùng nó để
làm gì — xếp lại thứ tự gợi ý, không bán, không chia sẻ. Ba bảng `trips`,
`preferences`, `place_events` đều là dữ liệu **chỉ chủ sở hữu đọc được**,
khác hẳn `profiles`, và policy nên nói rõ sự khác nhau đó.

### B4. Apple Guideline 2.1 / 4.2 — App Completeness — ✅ đã gỡ (17/08/2026)

**Phát hiện gốc (16/08):** `SketchingScreen` chạy trên đồng hồ giả —
`lib/sketch.ts` khi đó ghi rõ *"There is no agent yet. `SKETCH_STEPS` runs on
a clock rather than on work"*. Reviewer mở app, bấm tab Ideas, thấy thanh
tiến trình chạy rồi không dẫn tới đâu: đúng mô tả của "placeholder content"
và "demo version". Rủi ro từ chối thật.

**Đã đóng bằng gì:** Phase 1–4 (PR #195 và các PR sau). Thanh tiến trình giờ
báo cáo công việc có thật — `planner.ts` chọn chỗ, kiểm giờ mở cửa, xếp lộ
trình theo khoảng cách, trả về ba phương án; `sketch.ts` giờ ghi *"There is
one now — `planner.ts`"*. Luồng đi trọn vẹn: Ideas → ba phương án → sửa giờ
và thứ tự → lưu → tab Trips → màn chi tiết. Logic đã port khỏi
`data/scripts/itinerary-runtime.js` vào `app/src/lib/planner.ts` với test.

**Còn lại gì cần để ý khi nộp:** hai nút **Share** và **Invite** ở màn sửa
plan là mock có dán nhãn — bấm vào thì hiện thông báo nói rõ chưa làm. Nhãn
là đúng cách, nhưng reviewer vẫn có thể coi là tính năng chưa hoàn thiện.
Cân nhắc ẩn cả hai khỏi bản nộp đầu; chúng không dẫn tới đâu và không mất gì.

### B5. Chuỗi mô tả quyền

`NSLocationWhenInUseUsageDescription` nói "uses your location **once** to
pick the nearest city". Cần kiểm chứng app đúng là chỉ đọc một lần —
Apple đối chiếu chuỗi này với hành vi thật. Chuỗi camera/photo hiện chỉ
phục vụ ảnh đại diện, khớp với `AvatarPicker`.

---

## 5. Nhóm C — Rủi ro pháp lý bên thứ ba

Code đã ý thức tốt về mảng này, nhưng còn hai điểm hở:

### C1. Cache dữ liệu Google Places (cần rà lại)

`import-place.ts` ghi vĩnh viễn vào Postgres: `rating`, `rating_count`,
`price_level`, `opening_hours`, `website`, `phone`, `editorialSummary`,
và tham chiếu ảnh. Google Maps Platform ToS chỉ cho cache **`place_id`
vô thời hạn**; nội dung khác bị giới hạn (thường hiểu là 30 ngày).

Hiện tại không có cơ chế làm mới hay hết hạn cho các trường này. Ở quy mô
mockup thì không ai để ý; đưa lên store là một sản phẩm thương mại đọc dữ
liệu Google đã cũ.

Việc cần làm: thêm `google_refreshed_at`, job làm mới định kỳ theo
`google_place_id`, và cân nhắc trường nào thật sự cần lưu (giờ mở cửa và
rating là hai trường "tươi" nhất — cũng là hai trường sai nhiều nhất khi
cũ).

### C2. Nominatim / Photon ở quy mô pilot

`find-address` gọi **cả hai** dịch vụ công cộng miễn phí cho mỗi lần tìm.
Nominatim public instance giới hạn ~1 request/giây tuyệt đối cho toàn bộ
ứng dụng và cấm dùng nặng.

Giảm nhẹ đã có: yêu cầu đăng nhập, tìm khi submit (không phải gõ tới
đâu gọi tới đó), `User-Agent` hợp lệ. Đủ cho vài chục người.

Ceiling: khoảng vài trăm người dùng hoạt động. Vượt qua đó cần **cache
kết quả tìm kiếm** trong Postgres và/hoặc self-host Nominatim, hoặc
chuyển sang nhà cung cấp trả phí (Mapbox/Geoapify). Nên thêm cache trước
khi pilot — nó rẻ và mua thêm một bậc quy mô.

### C3. Attribution còn thiếu

- **Open-Meteo** yêu cầu ghi nguồn (CC-BY-4.0) — chưa thấy ở đâu.
- **Apple Maps** yêu cầu hiển thị logo/legal notice khi dùng MapKit.
- **OpenStreetMap** đã có nhãn trên StartSheet ✅, nhưng ODbL cũng áp dụng
  cho toạ độ đã lưu lại từ kết quả OSM.

---

## 6. Nhóm D — Sẵn sàng vận hành cho pilot

Đây là nhóm quyết định pilot *học được gì*, chứ không phải pilot *chạy
được hay không*.

| # | Thiếu | Vì sao quan trọng |
|---|---|---|
| D1 | **Không có crash reporting** (Sentry / Bugsnag) | Với người dùng thật, một crash không được báo cáo là một crash không tồn tại. Đây là hạng mục ưu tiên số 1 của cả nhóm này |
| D2 | **Không có ErrorBoundary** ở `App.tsx` | Một lỗi render = màn hình trắng, không thông báo, không phục hồi |
| D3 | **Không có analytics** | Pilot không đo được thì không phải pilot, chỉ là phát hành sớm |
| D4 | **Một môi trường Supabase duy nhất** | Migration apply thẳng vào production qua SQL editor (theo `docs/mobile-setup.md`). Không có staging để thử |
| D5 | **Migration/Edge Function không deploy tự động** | CI *test* migration nhưng không *chạy* chúng. Deploy thủ công là nơi lỗi sẽ xảy ra |
| D6 | Supabase free tier | Project **tự pause sau 7 ngày không hoạt động**, 500MB DB, 5GB egress. Pause giữa pilot = app chết. Cần Pro **25 USD/tháng** (kèm PITR backup) |
| D7 | **Không có quota chống lạm dụng** | Một tài khoản có thể tạo vô hạn collection, upload lại avatar không giới hạn, spam `place_submissions`. RLS kiểm soát *ai*, không kiểm soát *bao nhiêu* |
| D7b | **`place_events` không có gì trim** | Thêm 17/08. Chính migration đã ghi ra điều này: taste profile chỉ đọc 90 ngày gần nhất, nên dòng cũ hơn là nợ và là rủi ro. Chặn duy nhất hiện có là nút xoá của người dùng và cascade khi xoá tài khoản. Cách đúng là một job xoá định kỳ — `pg_cron` có sẵn trên project, chưa cài |
| D8 | **Không có budget alarm trên Google Maps key** | `scan-city` có `MAX_API_CALLS = 45` mỗi lần gọi, nhưng không giới hạn số lần gọi. Một tài khoản editor bị chiếm có thể đốt hết ngân sách |
| D9 | Không có xử lý offline / retry | Mỗi màn hình gọi mạng trực tiếp. Có timeout trong `auth.tsx` (tốt) nhưng không có cache dữ liệu, không có retry, không có trạng thái offline |
| D10 | Không có E2E test, chưa test trên dải thiết bị thật | 18 unit test đều là hàm thuần — không test nào từng render một màn hình |
| D11 | Accessibility chưa được đánh giá | Dynamic Type, VoiceOver label, độ tương phản. Apple kiểm nhẹ; người dùng pilot thì không |

---

## 7. Lộ trình đề xuất

### Giai đoạn 1 — Bản build native chạy được trên máy thật (~1 tuần)

Mục tiêu: một file `.ipa`/`.aab` cài được, chưa nộp store.

- [ ] A1–A6: bundle ID, package, `eas.json`, versioning, splash, icon Android
- [ ] Mua Apple Developer (99 USD/năm) + Google Play (25 USD)
- [ ] `eas build --profile preview` cho cả hai nền tảng
- [ ] Test trên ≥2 máy iOS + ≥2 máy Android thật (A7: verify maps/svg trên New Architecture)
- [ ] D1: gắn Sentry — làm ở đây, không phải sau, để bắt lỗi ngay từ bản build đầu
- [ ] D2: ErrorBoundary bọc navigation

### Giai đoạn 2 — Đủ điều kiện nộp store (~2 tuần)

- [ ] **B2: xoá tài khoản trong app** (Edge Function + UI) — chặn cứng
- [ ] **B3: privacy policy** host trên GitHub Pages + khai App Privacy / Data Safety
- [x] ~~**B4: quyết định về tab Ideas**~~ — đã hoàn thiện itinerary (Phase 1–4)
- [ ] B4b: cân nhắc ẩn hai nút mock Share/Invite khỏi bản nộp đầu
- [ ] **B1: chọn hướng** — hoặc tắt publish cho bản đầu (rẻ, nhanh), hoặc làm đủ report + block + filter + contact + EULA
- [ ] B5: rà chuỗi mô tả quyền khớp hành vi thật
- [ ] C3: thêm attribution Open-Meteo + Apple Maps
- [ ] D6: nâng Supabase Pro
- [ ] Screenshot, mô tả, age rating, TestFlight internal build

### Giai đoạn 3 — Mở pilot cho nhiều người (~2–3 tuần, chạy song song)

- [ ] **Google Play closed testing: 12 tester × 14 ngày** — khởi động sớm nhất có thể, đây là đường găng
- [ ] TestFlight external (tới 10.000 tester, cần beta review nhẹ)
- [ ] D3: analytics — tối thiểu là các sự kiện: mở app, xem place, lưu place, tạo collection, publish
- [ ] D7: quota chống lạm dụng (số collection/người, tần suất upload avatar, tần suất submit)
- [ ] D7b: `pg_cron` trim `place_events` cũ hơn 90 ngày
- [ ] D8: budget alarm + quota trên Google Maps key
- [ ] C2: cache kết quả `find-address` trong Postgres
- [ ] C1: cơ chế làm mới dữ liệu Google Places
- [ ] D4/D5: tách staging Supabase + tự động `supabase db push` và deploy function trong CI
- [ ] D9: cache dữ liệu + trạng thái offline
- [ ] D11: rà accessibility

---

## 8. Tiêu chí "xong" cho pilot

Pilot được coi là sẵn sàng khi **tất cả** những điều sau đúng:

1. Một người lạ cài app, đăng ký, dùng, và **xoá tài khoản** — trọn vẹn
   trong app, không cần liên hệ ai.
2. Một crash trên máy người lạ **tới được** người phát triển trong vài
   phút, kèm stack trace.
3. Không màn hình nào hiển thị tiến trình cho công việc không tồn tại.
4. Có URL privacy policy công khai, mô tả đúng những gì đang thu thập —
   bao gồm việc `profiles` là công khai.
5. Supabase ở gói Pro, không có nguy cơ tự pause giữa pilot.
6. Nếu nội dung người dùng tới được mắt người dùng khác: có nút báo cáo,
   có cách chặn, có người trực xử lý trong 24 giờ.
7. Một tài khoản đơn lẻ không thể làm hỏng trải nghiệm của người khác,
   cũng không đốt được ngân sách API.
8. Có đường quay lui: OTA channel tách production/preview, và có backup
   database khôi phục được.

---

## 9. Kết luận

Stack không phải vấn đề. Expo SDK 54 + Supabase + RLS là lựa chọn phù
hợp cho quy mô này, và chất lượng nền móng — chính sách RLS, test
migration chạy trên Postgres thật, biên hàm thuần cho phép test không cần
simulator, ý thức ToS nằm sẵn trong code — cao hơn mặt bằng dự án cùng
giai đoạn. Không có gì phải viết lại.

Khoảng cách nằm ở chỗ khác, và nên nhìn nó theo đúng trọng số:

- **Nhóm A** (build native) là việc nửa ngày cho một người biết việc.
- **Nhóm B** (chính sách) là việc thật sự chặn, và phần lớn không phải
  code: xoá tài khoản, privacy policy, quyết định về nội dung công khai,
  và quyết định về tab Ideas.
- **Nhóm D** (vận hành) là thứ quyết định pilot có *học được gì* hay
  không. Crash reporting là hạng mục đơn lẻ có giá trị cao nhất trong cả
  tài liệu này.

Đường găng dài nhất **không nằm trong tay đội phát triển**: 14 ngày closed
testing bắt buộc của Google Play. Nếu pilot có mốc thời gian, đó là việc
phải bắt đầu trước tiên.
