# City Crew — app React Native (Expo)

Khởi đầu **sản phẩm thật**: app native đọc thẳng danh mục địa điểm đã
published từ Supabase (publishable key + RLS — đúng đường truy cập mà
mockup snapshot dùng, không cần server riêng).

**Trạng thái hiện tại**

| Màn hình | Trạng thái |
|---|---|
| Explore (For you / Food / Outdoors, thẻ địa điểm) | ✅ dữ liệu thật |
| Place detail (ảnh vuốt ngang, rating Google thật, giờ mở cửa, maps/web) | ✅ dữ liệu thật |
| Collections + Collection detail | ✅ dữ liệu thật |
| Ideas (wizard) / Trips (itinerary) / Profile | 🚧 placeholder — port từ `data/scripts/itinerary-runtime.js` ở bước sau |
| Song ngữ EN/VI | ✅ nút chuyển ở góc mỗi màn hình |

Mockup HTML (`citycrew-mockup-dark.html`) từ giờ **đóng băng** làm
artifact cho pitch video — sản phẩm phát triển ở đây.

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
src/theme.ts            — design tokens port từ mockup (màu, gradient, chữ Figtree)
src/lib/supabase.ts     — public Supabase client
src/lib/data.ts         — types + hooks usePlaces/useCollections (query y hệt export-snapshot)
src/lib/i18n.tsx        — chuyển EN/VI toàn app
src/components/         — Screen/Chip/Card/LangPill, PlaceCard
src/lib/planner.ts      — chọn/xếp/định giờ ba phương án, thuần và deterministic
src/lib/itinerary.ts    — sửa plan mà không đè lên giờ người dùng đã đặt
src/screens/            — Explore, PlaceDetail, Collections, CollectionDetail,
                          Ideas → Sketching → PlanOptions → PlanEdit, Trips
```

## Bước tiếp theo (đề xuất)

1. `plan-assist` Edge Function: đặt tên chuyến đi và viết lý do cho từng điểm.
2. Ô "kể tôi nghe bạn muốn gì" ở Ideas, parse thành `TripDraft`.
3. ~~EAS Build + TestFlight~~ — đã có; xem Cách 3 ở trên.
