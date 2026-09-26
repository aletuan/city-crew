# City Crew — app React Native (Expo)

Khởi đầu **sản phẩm thật**: app native đọc thẳng danh mục địa điểm đã
published từ Supabase (publishable key + RLS — đúng đường truy cập mà
mockup snapshot dùng, không cần server riêng).

**Trạng thái hiện tại**

App đã lên App Store (1.0.3) và có 23 màn hình chạy dữ liệu thật. Bảng
này từng liệt kê từng màn và đã nói sai suốt một thời gian — Ideas,
Trips và Profile bị ghi là placeholder rất lâu sau khi cả ba đã ship,
mỗi màn kèm bộ test riêng. Một bảng phải sửa bằng tay sau mỗi lần ship
là một bảng sẽ sai; nên thay bằng thứ không cần sửa:

| | |
|---|---|
| Đọc | Explore (danh sách + bản đồ Google), Place detail, Gallery, Collections, Search |
| Lên kế hoạch | Ideas → Sketching → PlanOptions → PlanEdit → Trips → Trip detail |
| Người dùng | Profile, Edit profile, Sign in / Sign up, Crew, Activity |
| Thêm dữ liệu | Add place, Scan city — hỏi Google rồi đề xuất vào catalog |
| Ba ngôn ngữ | EN / VI / JA, đổi trong Cá nhân |

Danh sách đầy đủ là `ls src/screens/`, và nó luôn đúng.

Mockup HTML (`citycrew-mockup-dark.html`) **đã xoá** — nó là bản dựng
trước khi có app, và app chính là bản demo. Xem `git show cc5d64f`.

## Chạy trên điện thoại

**Cách 1 — có máy tính (nhanh nhất khi dev):**

```bash
cd app
npm install
npx expo start          # thêm --tunnel nếu điện thoại khác mạng
```

Cài **Expo Go** (App Store / Play Store) rồi quét QR.

> **Bản đồ trong Expo Go.** Màn "Bắt đầu từ đâu?" vẽ bản đồ Google. Expo Go
> trên Android có sẵn Google Maps nên vẫn thấy; Expo Go trên iPhone chỉ có
> Apple Maps nên ô bản đồ **trống**, phần còn lại của màn vẫn chạy. Muốn
> thấy bản đồ trên iPhone thì dùng development build (Cách 3).

> **Vì sao SDK 57?** Expo Go trên App Store chỉ chạy đúng một SDK — bản
> mới nhất — và không cài được bản cũ. App theo SDK mà Expo Go đang có
> (57 từ tháng 9/2026; trước đó kẹt ở 54 vì Apple duyệt chậm). Khi Expo Go
> lên SDK mới, màn "Project is incompatible with this version of Expo Go"
> là dấu hiệu phải nâng: `npx expo install expo@^<sdk>` rồi
> `npx expo install --fix`.

**Cách 2 — không cần máy tính (qua GitHub Actions):**

1. Tạo tài khoản miễn phí tại expo.dev → Access tokens → tạo token.
2. Repo → Settings → Secrets → thêm secret `EXPO_TOKEN`.
3. ✅ Secret đã cấu hình — mỗi lần `app/` thay đổi trên `main`, workflow *Publish app preview*
   đẩy bản mới lên EAS Update — mở trang project trên expo.dev bằng
   điện thoại → Open in Expo Go.

**Cách 3 — development build / TestFlight (EAS Build):**

```bash
cd app
npx eas-cli build --profile development --platform ios   # cài lên máy, chạy cùng expo start
npx eas-cli build --profile production  --platform ios   # rồi eas submit lên TestFlight
```

Build cần hai biến môi trường để gắn key Google Maps SDK vào binary (xem
`app.config.js`); thiếu thì build vẫn xong nhưng không có bản đồ:

```bash
npx eas-cli env:create --scope project --name GOOGLE_MAPS_IOS_KEY     --value … --environment development --environment preview --environment production
npx eas-cli env:create --scope project --name GOOGLE_MAPS_ANDROID_KEY --value … --environment development --environment preview --environment production
```

Tạo hai key trên Google Cloud, mỗi key chỉ bật **Maps SDK for iOS** /
**Maps SDK for Android** và giới hạn theo bundle id `com.aletuan.citycrew`
/ package name. Key server `GOOGLE_MAPS_API_KEY` của Edge Function là key
thứ ba, riêng, và phải bật cả **Places API (New)** lẫn **Geocoding API**
— `fetch-place` dùng Geocoding cho chú thích dưới bản đồ.

## Cấu hình

Client Supabase nằm ở `src/lib/supabase.ts` — URL + publishable key là
giá trị công khai (RLS là lớp bảo vệ). Override khi cần bằng
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

`app.json` là cấu hình tĩnh; `app.config.js` đọc nó rồi gắn thêm hai key
Google Maps từ môi trường lúc build. Không bao giờ ghi key vào `app.json`.

## Cấu trúc

```
App.tsx                 — fonts, i18n provider, stack + bottom tabs
src/theme.ts            — design tokens: màu, gradient, khoảng cách, bo góc,
                          chữ Space Grotesk
src/lib/supabase.ts     — public Supabase client
src/lib/data.ts         — types + hooks usePlaces/useCollections
src/lib/i18n.tsx        — chuyển EN/VI/JA toàn app
src/lib/planner.ts      — chọn/xếp/định giờ ba phương án, thuần và deterministic
src/lib/itinerary.ts    — sửa plan mà không đè lên giờ người dùng đã đặt
src/lib/format.ts       — giờ mở cửa, ngày tháng, đơn vị — thuần, 100% coverage
src/components/         — Screen, Card, Chip, GradientCta… trong ui.tsx,
                          cộng các component có màn hình riêng
src/screens/            — 23 màn; `ls src/screens/` là danh sách đúng
```

`src/lib/*.ts` là nửa thuần của app và bị chặn ở **100% coverage** — thêm
một hàm vào đó mà không có test thì CI đỏ. Đó là cơ chế duy nhất trong
repo này không phụ thuộc vào việc người viết có nhớ hay không.

## Đã xong, giữ lại để biết chúng ở đâu

1. ~~`plan-assist` Edge Function~~ — có ở `supabase/functions/plan-assist`;
   phía app là `src/lib/assist.ts`, gọi trước ở màn Sketching để thẻ hiện
   ra là đã có tên chứ không phải viết lại dưới tay người đọc.
2. ~~EAS Build + TestFlight~~ — xem Cách 3 ở trên.

Việc còn mở nằm ở issue chứ không ở đây: một danh sách "bước tiếp theo"
trong README là danh sách sẽ mục, và nó đã mục.
