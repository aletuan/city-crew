# cityCrew — app React Native (Expo)

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

> **Vì sao SDK 54?** Expo Go trên App Store đang kẹt ở SDK 54 (Apple chưa
> duyệt bản mới — xem changelog "Expo Go and the App Store in May 2026").
> App pin SDK 54 để mở được trong Expo Go; nâng SDK khi Expo Go cập nhật.

**Cách 2 — không cần máy tính (qua GitHub Actions):**

1. Tạo tài khoản miễn phí tại expo.dev → Access tokens → tạo token.
2. Repo → Settings → Secrets → thêm secret `EXPO_TOKEN`.
3. ✅ Secret đã cấu hình — mỗi lần `app/` thay đổi trên `main`, workflow *Publish app preview*
   đẩy bản mới lên EAS Update — mở trang project trên expo.dev bằng
   điện thoại → Open in Expo Go.

## Cấu hình

Client Supabase nằm ở `src/lib/supabase.ts` — URL + publishable key là
giá trị công khai (RLS là lớp bảo vệ). Override khi cần bằng
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Cấu trúc

```
App.tsx                 — fonts, i18n provider, stack + bottom tabs
src/theme.ts            — design tokens port từ mockup (màu, gradient, chữ Figtree)
src/lib/supabase.ts     — public Supabase client
src/lib/data.ts         — types + hooks usePlaces/useCollections (query y hệt export-snapshot)
src/lib/i18n.tsx        — chuyển EN/VI toàn app
src/components/         — Screen/Chip/Card/LangPill, PlaceCard
src/screens/            — Explore, PlaceDetail, Collections, CollectionDetail, ComingSoon
```

## Bước tiếp theo (đề xuất)

1. Port wizard + itinerary generator (logic thuần JS đã có sẵn).
2. Trips: lưu kế hoạch (bảng `trips` mới + Supabase Auth như dashboard).
3. EAS Build + TestFlight khi cần chia sẻ ngoài Expo Go ($99/năm Apple).
