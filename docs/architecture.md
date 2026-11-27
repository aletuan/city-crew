# Kiến trúc — các tầng, luật giữa chúng, và cái gì canh luật

Bản đồ, không phải bài giảng. Lý do của từng quyết định nằm ở comment đầu
file làm ra quyết định đó; ở đây chỉ nói file nào nằm ở tầng nào, tầng nào
được gọi tầng nào, và **cái gì trong CI đỏ lên** khi luật bị phá. Một luật
không có gì canh chỉ là lời khuyên — xem mục cuối cho những chỗ còn như vậy.

Số đo ngày 25/11/2026, đếm lại trên main; bản đầu là 27/09/2026.

## Một câu

**Không có app server.** App và dashboard nói thẳng với Supabase bằng khoá
công khai và session của người dùng; **RLS là tầng phân quyền**, không phải
code phía client. Edge Function chỉ tồn tại cho thứ cần một bí mật (khoá
Google, khoá Claude, service role) — không phải để "có backend".

```
 app/ (Expo)                               dashboard/ (Vite, web)
 ┌───────────────────────────────┐         ┌────────────────────────┐
 │ screens/     29 màn           │         │ components/ → api.js   │
 │   ↓                           │         └───────────┬────────────┘
 │ components/  107 file         │                     │
 │   ↓                           │                     │
 │ lib/*.tsx    context + hook   │                     │
 │   ↓                           │                     │
 │ lib/data/    truy vấn         │                     │
 │ lib/*.ts     136 module thuần │                     │
 └──────────────┬────────────────┘                     │
                │  anon key + session                  │  anon key + session editor
                ▼                                      ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ Supabase: Postgres + RLS · Storage · Auth                        │
 │ Edge Functions (chỉ thứ cần bí mật) · pg_cron (việc định kỳ)     │
 └──────────────────────────────────────────────────────────────────┘
```

## Các tầng của app

| tầng | thư mục | là gì | được import |
|---|---|---|---|
| Màn hình | `src/screens/` | một màn một file; ghép component, đọc provider và hook dữ liệu. Phần con và hook riêng của một màn nằm ở `screens/<màn>/` (16 thư mục) | components, lib, `nav.ts`, `theme.ts` |
| Component | `src/components/` | UI dùng lại; `ui/` là design system | lib, `theme.ts`, `nav.ts` — **không** screens |
| Provider | `src/lib/*.tsx` | trạng thái dùng chung: các provider (auth, thành phố, catalog, crew, trips…), mỗi cái một hoặc vài React context, và vài hook | lib, lib/data |
| Dữ liệu | `src/lib/data/` | mọi câu hỏi tới Postgres/Storage, mỗi aggregate một file, `index.ts` là barrel | `lib/supabase.ts`, lib thuần |
| Nghiệp vụ thuần | `src/lib/*.ts` | planner, xếp hạng, giờ mở cửa, định dạng… — không React, chạy được trong Node | lib thuần; lời gọi mạng qua từng file `lib/data/*.ts` (không qua barrel, vì barrel kéo theo hook) |

Chiều mũi tên chỉ đi xuống. Hai điểm hay bị hiểu nhầm:

- **`lib/` là hai tầng đội một tên.** `.ts` là phần thuần, `.tsx` là
  provider. Ranh giới được giữ bằng đuôi file, vì cổng coverage đọc đuôi
  file (xem dưới) — một `.ts` không thuần phải được ghi tên vào `IMPURE`
  trong `app/impure.js` kèm lý do (hiện có 11). Cổng coverage và lint đọc
  cùng một danh sách đó.
- **Không màn hình hay component nào nói chuyện với Supabase.** Muốn đọc
  hay ghi thì gọi một hàm trong `lib/data` hoặc một provider. Đây là lý do
  `planner.test.ts` chạy không cần mạng, và là lý do đổi một câu truy vấn
  không chạm vào UI.

## Luật, và cái gì canh

| luật | canh bởi | đỏ ở đâu |
|---|---|---|
| screens và components không import `lib/supabase` hay `@supabase/*` | `no-restricted-imports`, `app/eslint.config.js` | `npm run lint` |
| components không import screens | như trên | `npm run lint` |
| `lib/` không import components hay screens | như trên | `npm run lint` |
| `lib/*.ts` không import `react`, `react-native`, `./supabase` hay `@supabase/*`, trừ file có tên trong `IMPURE` | như trên; `IMPURE` ở `app/impure.js` | `npm run lint` |
| `lib/*.ts` và `lib/data/*.ts` thuần, test được trong Node | coverage 100% từng file, `app/vitest.config.ts` | `npm run coverage` |
| màn hình, component, provider, helper và Edge Function có sàn coverage theo từng file (bảng số ở `CLAUDE.md`) | `app/vitest.config.ts`; sàn là ratchet, nâng tay khi file tốt lên | `npm run coverage` |
| Edge Function nào cũng có test nạp nó, hoặc một lý do có tên | `scripts/edgeFunctionTests.test.ts` | `npm test` |
| một chuỗi tiếng Anh chỉ có một bản dịch ở mọi nơi | `scripts/translations.test.ts` | `npm test` |
| hàm không dài quá 150 dòng code, độ phức tạp không quá 25; file đã vượt thì không được vượt con số của chính nó | `max-lines-per-function`, `complexity`; trần và danh sách ở `app/oversize.js` (27 file) và `dashboard/oversize.js` (7 file) | `npm run lint`; job `dashboard` |
| màn nào cũng có cầu dao lỗi riêng | `ScreenBoundary.ui.test.tsx` đọc `App.tsx` | `npm test` |
| taxonomy khớp ở app, dashboard và check constraint | `data/test/categories-sync.test.mjs` | job `data` |
| policy RLS hỏi "bạn là ai" một lần mỗi truy vấn — viết `(select auth.uid())`, `(select is_editor())` — và không đọc lại chính bảng của nó | `supabase/tests/rls_ask_once_test.sql`; lượt chạy thứ hai của `run.sh` chạy lại mọi test RLS trên policy đã viết lại | job `migrations` |

Ba luật đầu được viết ra ngày 27/09. Hai trong số đó đã đúng từ trước mà
không ai canh; luật thứ nhất thì **đã bị phá một chỗ**: `useAddPhoto`
(component) gọi thẳng `supabase.storage`. Phần upload đã chuyển xuống
`lib/data/guide.ts › uploadPlacePhoto` trong cùng thay đổi đặt luật.

Luật thứ tư được viết ra ngày 20/10/2026, và lúc viết nó **đã bị phá chín
chỗ**: hai hook (`candidates`, `pending`) mang đuôi `.ts`, nay là `.tsx`
cạnh các provider; sáu file gọi thẳng Supabase (`suggest`, `findplace`,
`assist`, `decktrace`, `tracereport`, `signup`), nay gọi qua
`lib/data/functions.ts`, `lib/data/traces.ts`, `lib/data/signup.ts` và
`lib/data/places.ts › fetchPlacesByGoogleId` — chỉ lời gọi chuyển đi,
cách đọc câu trả lời vẫn ở chỗ cũ; và `share.ts` lấy `Share.share` của
React Native làm mặc định, nay nơi gọi tự đưa vào.

**Không còn ngoại lệ nào.** `lib/save.tsx` từng import `AuthSheet` và
`SaveSheet`; từ 20/10/2026 nó chỉ giữ trạng thái của hai sheet và đưa ra
qua context thứ ba, `useSaveSheets`, còn `components/SaveSheets.tsx` vẽ
chúng, gắn trong `App.tsx` ở đúng chỗ hai sheet từng nằm. Ngoại lệ trong
`app/eslint.config.js` đã bỏ.

## Luồng dữ liệu

**Đọc.** `lib/data/<aggregate>.ts` là hàm async thuần trên một client
Supabase → `lib/data/fetch.ts › usePersistedFetch` (cache trên máy có
version, stale-while-revalidate) → hook trong `lib/data/hooks.ts` → provider
hoặc màn hình. Hai tập dữ liệu nhiều màn cùng đọc — catalog công khai và
danh sách riêng — được **nâng lên provider** (`catalog.tsx`, `save.tsx`)
để chỉ có một bản; header của `catalog.tsx` kể hai lỗi thật đã sinh ra từ
việc mỗi màn tự fetch.

**Người đọc là một phần của câu hỏi.** Query nào phụ thuộc người đọc (catalog,
danh sách, lượt thích, sở thích) lấy id từ `useAuth().userId` chứ không từ
`session`. Lúc mở app, `session` có thể phải chờ một vòng mạng (token hết hạn
sau 1 giờ thì `getSession` refresh xong mới trả lời); `userId` là id của lần
mở trước, đọc từ máy trong vài ms, cho tới khi `session` xác nhận hoặc sửa nó.
`undefined` nghĩa là *chưa biết*, không phải khách, và catalog chờ nó như chờ
city. Hỏi trước khi biết ai hỏi đã từng có nghĩa là hai lần fetch catalog mỗi
lần mở app và danh sách về lại skeleton giữa chừng. Còn hành động (mở sheet
lưu, ghi) vẫn hỏi `session`.

**Ghi.** Hàm trong `lib/data` **ném lỗi khi bị từ chối** thay vì im lặng:
một lời từ chối là lỗi ở phía này hoặc phía kia, và màn hình phải biết
thay vì vẽ ra một thành công không có thật. Chỗ nào cần phản hồi tức thì
thì lạc quan có đối chiếu lại (`likes.ts`).

**Quyền.** Luôn ở Postgres. Một policy mới viết `(select auth.uid())`, không phải `auth.uid()`: dạng sau chạy lại ở từng dòng — xem `20260927120000_rls_ask_once.sql` cho số đo và cho cái bẫy đệ quy mà việc bọc mở ra. Một bộ lọc viết ở client mà trùng với một
policy là bản sao yếu hơn của policy đó — `lib/data/guide.ts` giải thích
chỗ nào có lọc và vì sao.

## Provider và điều hướng

`App.tsx` lồng provider theo thứ tự phụ thuộc — cái bên trong đọc cái bên
ngoài: `ThemeProvider` › `AppBoundary` › `Auth` › `I18n` › `City` ›
`Catalog` › `Crew` › `Invitations` › `MyTrips` › `Checkins` › `Save` ›
`Notice` › `Rewards` › `FreshNews` › `CommentQuick` › `TabBarDuck` ›
`SignupTour`. Mười sáu provider; bản 27/09 ghi mười một, trước
khi có check-in, thông báo, phần thưởng, bình luận và tour đăng ký.

Giữa chúng có năm component không vẽ gì, chỉ đồng bộ một thứ theo
session: `GuideGrantSync`, `FlagsSync`, `ReminderSync`, `SessionNavSync`,
`ThemeAccountSync`. Chúng đứng dưới `Checkins` và trên `Save`. Các sheet
và thanh nổi toàn app (`SaveSheets`, `RewardBanner`, `NoticeBar`,
`WelcomeSheet`, `ReminderAskSheet`) cũng gắn ở `App.tsx`, ngoài `Tabs`.

Provider nhiều người đọc mà mỗi người chỉ đọc một phần thì **chia context
theo đường người đọc đã vạch**, vì một context đổi là mọi người đọc nó vẽ
lại, kể cả người không đọc phần vừa đổi: `useSession` / `useProfile` /
`useAuthActions` (auth), `useMyLists` / `useSaveActions` (save), `usePlaces`
và các selector dữ liệu / `useLikes` (catalog — một cú tim không vẽ lại
danh sách địa điểm), `useCurrentCity` / `useCityList` (thành phố — làm mới
danh sách thành phố không vẽ lại mười sáu nơi chỉ đọc `city`). Hook gộp
(`useAuth`, `useSave`, `useCatalog`, `useCity`) vẫn còn cho nơi đọc nhiều
phần; nơi nào chỉ đọc một phần thì gọi hook hẹp. Auth, catalog và thành
phố mỗi cái có một test đếm số lần vẽ để canh đúng điều đó.

Năm tab (Ideas, Explore, Trips, Collections, Profile), mỗi tab một native
stack. Màn chi tiết được khai báo lặp ở nhiều stack **có chủ ý** (để mở một
địa điểm từ tab Trips không nhảy sang tab Explore). Mỗi màn được bọc cầu
dao qua `screenLayout`; `AppBoundary` là lớp cuối.

**Bấm lại tab đang mở** lùi từng bước, như mọi tab bar trên iOS: lần đầu
về màn gốc của tab (native stack tự làm), lần sau cuộn lên đầu
(`useScrollToTop` ở màn gốc của cả năm tab; Collections gắn nó trong
`collections/useShelfScroll.ts`). Explore có thêm một bước ở
giữa — đang ở Map View thì thoát ra danh sách (listener `tabPress` trong
`ExploreScreen`). Màn gốc mới của một tab phải gắn `useScrollToTop` vào
list của nó; test "its tab, pressed again" ở mỗi màn canh việc đó.

## Phía server

**Edge Functions** — `supabase/functions/<tên>/index.ts`, dùng chung code
trong `_shared/` (test từ `app/src/lib/*.test.ts`, ngoài cổng coverage):

| function | ai gọi | ai được gọi |
|---|---|---|
| `fetch-place` | app (`findplace.ts`, `suggest.ts`, qua `lib/data/functions.ts`), dashboard | người đã đăng nhập; import vào catalog chỉ editor |
| `checkin-photo` | app (`lib/data/checkinPhotos.ts`) | người đã đăng nhập, chỉ trên check-in của chính mình; đường ghi duy nhất vào bucket `checkin-photos` |
| `plan-assist` | app (`assist.ts`, qua `lib/data/functions.ts`) | người đã đăng nhập |
| `delete-account` | app (`auth.tsx`) | chính chủ tài khoản |
| `scan-city`, `suspend-user` | dashboard | editor |
| `write-blurb` | dashboard | editor hoặc token `ops_tokens`; không ghi gì, desk bấm Save mới ghi |
| `refresh-places`, `shrink-photos`, `label-photos`, `prune-checkin-photos` | `pg_cron` (`cron.sql` cạnh function) | token `ops_tokens` hoặc editor — `_shared/gate.ts` |
| `rehost-photos`, `refresh-photos`, `prune-photos`, `rate-photos` | chạy tay khi cần (`prune-photos/run.sql`) | như trên |

Function **tự deploy**: `.github/workflows/deploy-functions.yml` deploy
function nào có thư mục đổi trên main (đổi `_shared/` thì deploy tất cả)
rồi kiểm lại project. `find-address` và `backfill-phones-once` đang chạy
trên project mà không có trong repo.

**Việc định kỳ** chạy bằng `pg_cron` + `pg_net` gọi Edge Function với
token trong `ops_tokens`. Script lịch nằm ở `supabase/functions/<job>/cron.sql`
và **áp tay**, không phải migration — nó mint một bí mật lúc chạy, và môi
trường test migration không có `pg_cron`. Hiện có bốn job, đọc từ
`cron.job` của project ngày 25/11/2026, giờ UTC: `shrink-photos` (phút 7
mỗi giờ), `label-photos` (phút 23 mỗi giờ), `refresh-places` (19:43 mỗi
ngày), `prune-checkin-photos` (03:23 mỗi ngày).

**Migration** được CI test nhưng **không tự apply** — xem `CLAUDE.md`,
mục Supabase.

## Dashboard

`dashboard/` là web app Vite cho desk. Cùng mô hình với app: `api.js` nói
thẳng với Supabase bằng session của editor (từ 25/11/2026 nó chỉ ghép
sáu file theo aggregate trong `src/api/`, như `lib/data/` của app; mỗi
file là một factory nhận client, vì test nạp lại `api.js` cho từng ca), RLS quyết định ai được ghi gì,
và gọi `fetch-place`, `scan-city`, `suspend-user`, `write-blurb` cho những
thứ cần bí mật. Không có tầng nào giữa dashboard và database. Từ
24/11/2026 dashboard có cùng trần kích thước hàm với app
(`dashboard/oversize.js`).

## Bốn cấp nút

Một màn hình mới chọn cấp trước, rồi mới chọn component. Mọi cấp lấy màu
từ token của theme (`gradAI`, `accentInk`, `surfaceGlass`, `text`,
`accent`), nên đổi theme trong Profile là đổi cả bốn; không nút nào được
viết màu cứng.

| Cấp | Trông thế nào | Component | Dùng cho |
|---|---|---|---|
| 1. Chính | gradient đặc | `GradientCta`, `PrimaryButton`, `AddPill` | **một** hành động chốt mỗi màn: "Lên kế hoạch", nút trong thẻ trống, đăng nhập, "Đồng ý" một lời mời, nút trong dock nổi |
| 2. Phụ | kính (`surfaceGlass`), chữ `text`, dấu `accent` | `AddPill quiet`, `GradientCta quiet`, `RoundIconButton` | nút trên header cạnh tiêu đề; nút lặp lại mỗi dòng ("Thêm" ở gợi ý kết bạn); lối ra cạnh lối chính ("Thực hiện lại" khi đã có thẻ) |
| 3. Huỷ / gỡ | viền | `quietBtn` của Crew | "Huỷ", "Bỏ chặn", "Từ chối" — việc được phép, không được mời |
| 4. Liên kết | chữ `accent` | `Text` trong `PressableScale` | "Xem & sửa ›", "Xem thêm ·" |

Hai nút cùng một việc trên một màn thì không cùng cấp: nút trong thẻ trống
là cấp 1, nút "Tạo mới" trên header cùng màn là cấp 2. Cấp 2 không dùng
`accent` trên `accentSoft`: đo ngày 26/10/2026 trên cả 20 bảng màu, cặp đó
chỉ 4,14:1 trên paper (dưới 4,5 cho chữ 16pt); `text` trên kính thấp nhất
6,77:1, dấu `accent` trên kính thấp nhất 4,10:1 (đủ 3:1 cho biểu tượng).

## Một khung sheet

Bottom sheet lấy khung từ `components/ui/sheet.tsx` (`Sheet`): Modal, nền
tối, panel bo 28, thanh kéo 38pt `textTertiary`, viền mảnh, safe area, kéo
xuống để đóng. Mười lăm file dùng nó từ 24–25/11/2026; trước đó mỗi sheet
tự chép khung và hai kiểu đã lệch nhau. Khác biệt có lý do đi qua prop
(`scrim`, `rise`, `pull`, `foot`), không qua bản sao.

Ba sheet đứng ngoài, lý do ghi ở đầu `sheet.tsx`: `CheckinSheet` và
`CommentQuick` cưỡi lên bàn phím trong một dock; `PhotoSheet` có lớp blur
và trình xem toàn màn hình trong cùng Modal.

## Cố ý không có

- **App server.** Mọi thứ nó làm được thì RLS hoặc một Edge Function đã làm,
  và nó thêm một thứ để deploy, để trả tiền, để hỏng.
- **Redux / Zustand / TanStack Query.** Context + `usePersistedFetch` đủ cho
  lượng trạng thái dùng chung ở đây; cache trên máy đã có version.
- **Kế thừa class.** Cả `src/` có năm class (hai error boundary và ba lỗi).
  Đa hình đi qua hàm — `planner.ts` tự khai `Taste = { affinity }` và
  `tasteProfile.tsx` hiện thực nó, chứ không có cây kế thừa.

## Chỗ kiến trúc chưa sạch

Ghi ra để không ai tưởng là có chủ ý:

- ~~**`components/ui.tsx`** — 1.208 dòng, năm mối quan tâm~~ Đã tách ngày
  19/10/2026 thành `components/ui/` theo năm mối quan tâm (layout, haptics,
  motion, controls, surfaces); `ui/index.ts` xuất lại mọi tên nên không nơi
  gọi nào phải sửa.
- **Màn hình to** — trung bình ~491 dòng một file so với ~176 ở `lib/`
  (25/11/2026; bản 27/09 là ~717 và ~163).
  Ngày 19/10/2026 `ProfileScreen` (1.338 → 87 dòng) và `ExploreScreen`
  (1.856 → ~1.040) được tách phần con ra `screens/profile/` và
  `screens/explore/`; `PlaceDetailScreen` vẫn ~1.840 dòng. Ngày
  20/10/2026 logic thuần và các đoạn lặp được đưa ra `lib/`
  (`collectionShelf`, `searchRows`, `cityName`, …), nhưng JSX ở lại:
  `CollectionsScreen` còn ~1.760 dòng, `CollectionDetailScreen` ~1.690,
  `SearchScreen` ~810. Sàn coverage giữ chúng đúng, nhưng không giữ
  chúng dễ đọc.
  Ngày 15/11/2026 `CollectionDetailScreen` (đã lên 2.521 dòng) được tách
  bước đầu ra `screens/collectionDetail/`: các ô của danh sách
  (`cells.tsx`), trạng thái trống (`OwnEmpty.tsx`), stylesheet
  (`styles.ts`) và hai hook `useReorderDraft`, `useKindFilter` — còn
  1.898 dòng, và hàm chính vẫn giữ phần JSX của thẻ giới thiệu, menu và
  ai-xem-được. Lúc đó hook của một màn mang đuôi `.tsx`, vì `.ts`
  trong `screens/*/` nằm ngoài `include` của coverage; từ 22/11/2026
  `include` có `src/screens/*/*.ts` với sàn của helper, nên hook mới
  mang đuôi `.ts`.
  Cùng ngày, phần đứng ngoài hàm chính của bốn màn nữa được chuyển ra
  thư mục riêng, không sửa dòng nào: `screens/placeDetail/`,
  `screens/collections/`, `screens/sketching/`, `screens/ideas/` (component
  con và stylesheet). `SearchScreen` và `TripsScreen` lúc đó chưa tách được: bỏ
  phần đã phủ ra thì file cha tụt dưới sàn theo file. Sau khi có test cho
  các đường chưa ai đi (#1356), hai màn được tách cùng cách ra
  `screens/search/` và `screens/trips/` (1.107 → 836 và 779 → 389 dòng).
  Từ 15/11/2026 kích thước hàm có trần: `app/oversize.js` ghi 34 file
  đang vượt, mỗi file với con số của nó, và lint đỏ khi một con số bị
  vượt. Tách bớt thì hạ con số trong cùng thay đổi.
  Ngày 22–25/11/2026, sau code review, ba hàm màn hình lớn nhất xuống
  dưới trần và ra khỏi danh sách: `CollectionDetailScreen` (740 dòng /
  độ phức tạp 137 → 112 / 11), `PlaceDetailScreen` (→ 139 / 13),
  `CollectionsScreen` (→ 148 / 19). Cùng ngày 25/11, `CrewScreen` (576 /
  32 → 125 / 18) ra `screens/crew/`: `useIntros`, `useCrewSheets`, hai
  tab và các mảnh của một dòng. `ExploreScreen` (567 / 49 → 143 / 23) ra
  `screens/explore/`: `useExploreFilters`, `useExploreScroll`, `FilterBar`,
  `ExploreList`, `ExploreMap`. Cũng ngày 25/11, `IdeasScreen` (493 / 51 →
  141 / 14) ra `screens/ideas/`: `useSeedLists`, `useListSeed`, `where.ts`,
  `Asks`, `WhenWhere`, `Seeds`, `PlanCta`, `DayPicker`; và `SearchScreen`
  (461 / 40 → 132 / 19) ra `screens/search/`: năm hook trong
  `useSearch.ts`, `Row`, `rows.tsx`, `SearchEmpty`, `AddingTo`, `google.tsx`.
  Tiếp đó `PlanEditScreen` (317 / 24 → 127 / 11) ra `screens/planEdit/`:
  `usePickedPlan`, `useNarration`, `useSavePlan` trong `usePlan.ts`, và
  `Facts`, `Hint`, `StopRows`, `PlanFoot`, `Gone` trong `parts.tsx`;
  `SignUpScreen` (365 / 16 → 11 / 4) ra `screens/signUp/`: `useSignUp`,
  `FormStep` và ba bước còn lại trong `steps.tsx`, cả bốn vẽ trong một
  `AuthScreen` của màn. Ngày 27/11, `GalleryScreen` (287 / 46 → 116 / 24)
  ra `screens/gallery/`, cạnh `useGalleryWrites` đã có: `useGalleryPlace`,
  `usePhotoMenu`, và `GalleryTools`, `GalleryGrid`, `GalleryTips`,
  `NotYours` trong `parts.tsx`. Cũng ngày 27/11, `TripInvitationScreen`
  (218 / 66 → 60 / 18) ra `screens/invitation/`: `useAnswer`, và `NotHere`,
  `Asker`, `Plan`, `Going`, `Keeps`, `Answers` trong `parts.tsx`. Danh sách
  còn 21 file. Rồi `PlaceCard` (166 / 50 → 66 / 13), phẳng trong
  `components/` vì sàn coverage của component chỉ đọc một tầng:
  `PlaceCardPhoto` (ảnh, bookmark, rating, dải đóng cửa), `PlaceCardMeta`
  (dòng khu vực · khoảng cách · giờ · loại) và `placeCardStyles.ts`.
  Danh sách còn 20 file; từ đây đợt tách theo danh sách dừng — các hàm
  còn lại vượt trần ít, tách chủ yếu là dời code.
- ~~**`lib/save.tsx`** nằm sai tầng~~ Ngày 20/10/2026 phần vẽ hai sheet
  chuyển ra `components/SaveSheets.tsx`; `lib/save.tsx` chỉ còn trạng thái,
  và ngoại lệ trong lint đã bỏ.
- ~~**Không có luật nào canh `lib/*.ts` không import React.**~~ Có từ
  20/10/2026: `no-restricted-imports` cấm `react`, `react-native` và
  Supabase trong `lib/*.ts`, trừ các file trong `IMPURE` — danh sách nay ở
  `app/impure.js`, một bản duy nhất cho cả lint lẫn coverage.
