# Kiến trúc — các tầng, luật giữa chúng, và cái gì canh luật

Bản đồ, không phải bài giảng. Lý do của từng quyết định nằm ở comment đầu
file làm ra quyết định đó; ở đây chỉ nói file nào nằm ở tầng nào, tầng nào
được gọi tầng nào, và **cái gì trong CI đỏ lên** khi luật bị phá. Một luật
không có gì canh chỉ là lời khuyên — xem mục cuối cho những chỗ còn như vậy.

Số đo ngày 27/09/2026.

## Một câu

**Không có app server.** App và dashboard nói thẳng với Supabase bằng khoá
công khai và session của người dùng; **RLS là tầng phân quyền**, không phải
code phía client. Edge Function chỉ tồn tại cho thứ cần một bí mật (khoá
Google, khoá Claude, service role) — không phải để "có backend".

```
 app/ (Expo)                               dashboard/ (Vite, web)
 ┌───────────────────────────────┐         ┌────────────────────────┐
 │ screens/     23 màn           │         │ components/ → api.js   │
 │   ↓                           │         └───────────┬────────────┘
 │ components/  40 file          │                     │
 │   ↓                           │                     │
 │ lib/*.tsx    context + hook   │                     │
 │   ↓                           │                     │
 │ lib/data/    truy vấn         │                     │
 │ lib/*.ts     83 module thuần  │                     │
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
| Màn hình | `src/screens/` | một màn một file; ghép component, đọc provider và hook dữ liệu | components, lib, `nav.ts`, `theme.ts` |
| Component | `src/components/` | UI dùng lại; `ui.tsx` là design system | lib, `theme.ts`, `nav.ts` — **không** screens |
| Provider | `src/lib/*.tsx` | trạng thái dùng chung: 9 React context (auth, thành phố, catalog, crew, trips…) và vài hook | lib, lib/data |
| Dữ liệu | `src/lib/data/` | mọi câu hỏi tới Postgres/Storage, mỗi aggregate một file, `index.ts` là barrel | `lib/supabase.ts`, lib thuần |
| Nghiệp vụ thuần | `src/lib/*.ts` | planner, xếp hạng, giờ mở cửa, định dạng… — không React, chạy được trong Node | lib thuần |

Chiều mũi tên chỉ đi xuống. Hai điểm hay bị hiểu nhầm:

- **`lib/` là hai tầng đội một tên.** `.ts` là phần thuần, `.tsx` là
  provider. Ranh giới được giữ bằng đuôi file, vì cổng coverage đọc đuôi
  file (xem dưới) — một `.ts` không thuần phải được ghi tên vào `IMPURE`
  trong `app/vitest.config.ts` kèm lý do (hiện có 10).
- **Không màn hình hay component nào nói chuyện với Supabase.** Muốn đọc
  hay ghi thì gọi một hàm trong `lib/data` hoặc một provider. Đây là lý do
  `planner.test.ts` chạy không cần mạng, và là lý do đổi một câu truy vấn
  không chạm vào UI.

## Luật, và cái gì canh

| luật | canh bởi | đỏ ở đâu |
|---|---|---|
| screens và components không import `lib/supabase` hay `@supabase/*` | `no-restricted-imports`, `app/eslint.config.js` | `npm run lint` |
| components không import screens | như trên | `npm run lint` |
| `lib/` không import components hay screens | như trên, trừ `lib/save.tsx` | `npm run lint` |
| `lib/*.ts` và `lib/data/*.ts` thuần, test được trong Node | coverage 100% từng file, `app/vitest.config.ts` | `npm run coverage` |
| màn nào cũng có cầu dao lỗi riêng | `ScreenBoundary.ui.test.tsx` đọc `App.tsx` | `npm test` |
| taxonomy khớp ở app, dashboard và check constraint | `data/test/categories-sync.test.mjs` | job `data` |
| policy RLS hỏi "bạn là ai" một lần mỗi truy vấn — viết `(select auth.uid())`, `(select is_editor())` — và không đọc lại chính bảng của nó | `supabase/tests/rls_ask_once_test.sql`; lượt chạy thứ hai của `run.sh` chạy lại mọi test RLS trên policy đã viết lại | job `migrations` |

Ba luật đầu được viết ra ngày 27/09. Hai trong số đó đã đúng từ trước mà
không ai canh; luật thứ nhất thì **đã bị phá một chỗ**: `useAddPhoto`
(component) gọi thẳng `supabase.storage`. Phần upload đã chuyển xuống
`lib/data/guide.ts › uploadPlacePhoto` trong cùng thay đổi đặt luật.

**Ngoại lệ duy nhất, có chủ ý:** `lib/save.tsx` import `AuthSheet` và
`SaveSheet`. Nó là bộ điều phối UI — mở hai sheet đó từ ba màn — mà nằm
trong `lib/` vì nó là provider. Chỗ đúng của nó là `components/`; chưa
chuyển vì chưa tốn gì.

## Luồng dữ liệu

**Đọc.** `lib/data/<aggregate>.ts` là hàm async thuần trên một client
Supabase → `lib/data/fetch.ts › usePersistedFetch` (cache trên máy có
version, stale-while-revalidate) → hook trong `lib/data/hooks.ts` → provider
hoặc màn hình. Hai tập dữ liệu nhiều màn cùng đọc — catalog công khai và
danh sách riêng — được **nâng lên provider** (`catalog.tsx`, `save.tsx`)
để chỉ có một bản; header của `catalog.tsx` kể hai lỗi thật đã sinh ra từ
việc mỗi màn tự fetch.

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
`Catalog` › `Crew` › `Invitations` › `MyTrips` › `Save` › `TabBarDuck`.

Năm tab (Ideas, Explore, Trips, Collections, Profile), mỗi tab một native
stack. Màn chi tiết được khai báo lặp ở nhiều stack **có chủ ý** (để mở một
địa điểm từ tab Trips không nhảy sang tab Explore). Mỗi màn được bọc cầu
dao qua `screenLayout`; `AppBoundary` là lớp cuối.

**Bấm lại tab đang mở** lùi từng bước, như mọi tab bar trên iOS: lần đầu
về màn gốc của tab (native stack tự làm), lần sau cuộn lên đầu
(`useScrollToTop` ở màn gốc của cả năm tab). Explore có thêm một bước ở
giữa — đang ở Map View thì thoát ra danh sách (listener `tabPress` trong
`ExploreScreen`). Màn gốc mới của một tab phải gắn `useScrollToTop` vào
list của nó; test "its tab, pressed again" ở mỗi màn canh việc đó.

## Phía server

**Edge Functions** — `supabase/functions/<tên>/index.ts`, dùng chung code
trong `_shared/` (test từ `app/src/lib/*.test.ts`, ngoài cổng coverage):

| function | ai gọi | ai được gọi |
|---|---|---|
| `fetch-place` | app (`findplace.ts`, `suggest.ts`), dashboard | người đã đăng nhập; import vào catalog chỉ editor |
| `plan-assist` | app (`assist.ts`) | người đã đăng nhập |
| `delete-account` | app (`auth.tsx`) | chính chủ tài khoản |
| `scan-city`, `suspend-user` | dashboard | editor |
| `refresh-places`, `shrink-photos` | `pg_cron` (`cron.sql` cạnh function) | token `ops_tokens` hoặc editor — `_shared/gate.ts` |
| `rehost-photos`, `refresh-photos` | chạy tay khi cần | như trên |

**Việc định kỳ** chạy bằng `pg_cron` + `pg_net` gọi Edge Function với
token trong `ops_tokens`. Script lịch nằm ở `supabase/functions/<job>/cron.sql`
và **áp tay**, không phải migration — nó mint một bí mật lúc chạy, và môi
trường test migration không có `pg_cron`. Hiện có: `shrink-photos` (mỗi
giờ), `refresh-places` (mỗi đêm).

**Migration** được CI test nhưng **không tự apply** — xem `CLAUDE.md`,
mục Supabase.

## Dashboard

`dashboard/` là web app Vite cho desk. Cùng mô hình với app: `api.js` nói
thẳng với Supabase bằng session của editor, RLS quyết định ai được ghi gì,
và gọi `fetch-place`, `scan-city`, `suspend-user` cho những thứ cần bí mật.
Không có tầng nào giữa dashboard và database.

## Cố ý không có

- **App server.** Mọi thứ nó làm được thì RLS hoặc một Edge Function đã làm,
  và nó thêm một thứ để deploy, để trả tiền, để hỏng.
- **Redux / Zustand / TanStack Query.** Context + `usePersistedFetch` đủ cho
  lượng trạng thái dùng chung ở đây; cache trên máy đã có version.
- **Kế thừa class.** Cả `src/` có ba class (hai error boundary và một lỗi).
  Đa hình đi qua hàm — `planner.ts` tự khai `Taste = { affinity }` và
  `tasteProfile.tsx` hiện thực nó, chứ không có cây kế thừa.

## Chỗ kiến trúc chưa sạch

Ghi ra để không ai tưởng là có chủ ý:

- **`components/ui.tsx`** — 1.208 dòng, năm mối quan tâm (hằng số layout,
  hook, haptics, primitive, hiệu ứng) mà màn nào cũng import.
- **Màn hình to** — trung bình ~717 dòng một file so với ~163 ở `lib/`;
  `ExploreScreen.tsx` gần 1.700. Sàn coverage giữ chúng đúng, nhưng không
  giữ chúng dễ đọc.
- **`lib/save.tsx`** nằm sai tầng, như trên.
- **Không có luật nào canh `lib/*.ts` không import React.** Cổng coverage
  canh gián tiếp — một hook không đạt 100% trong Node — và `IMPURE` là nơi
  ngoại lệ phải tự khai.
