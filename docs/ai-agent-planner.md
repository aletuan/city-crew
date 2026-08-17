# AI Agent cho việc lập kế hoạch chuyến đi — thiết kế và lộ trình

Tài liệu này mô tả cách biến bốn bước giả trong `SketchingScreen` thành một
planner thật, và cách để plan dần cá nhân hoá theo người dùng — mà không phá
kiến trúc "không app server" hiện tại.

## Tại sao

Toàn bộ giá trị hứa hẹn trong `pitch/script.md` nằm ở một khoảnh khắc:
*"tap ✨ Generate plan → WHOLE DAY. DRAFTED IN 30 SECONDS"*. Khoảnh khắc đó
chưa tồn tại trong app.

Hôm nay:

- `app/src/screens/IdeasScreen.tsx` hỏi đủ bốn câu và dựng được `TripDraft`,
  nhưng nút bấm chỉ dẫn sang một màn chờ.
- `app/src/lib/sketch.ts` tự nói ra trong comment: *"There is no agent yet"* —
  bốn bước tiến trình chạy theo đồng hồ, không đo việc gì cả.
- `app/src/screens/SketchingScreen.tsx` kết thúc bằng câu "itinerary sẽ tới
  sau" thay vì trả về một plan.
- Tab **Trips** render `ComingSoonScreen`; không có bảng `trips` nào.
- Thuật toán lập lịch **đã tồn tại** nhưng kẹt trong
  `data/scripts/itinerary-runtime.js` (ES5, inject vào mockup HTML để quay
  video pitch), chưa từng được port sang `app/src/`.

Ngoài ra app chưa cá nhân hoá được gì: `profiles.interests` là free text không
ai đọc, `places.saved_count` là số biên tập viên gõ tay chứ không phải hành vi
quan sát được, và không có event tracking nào.

## Những chỗ đã cắt sẵn seam

Người viết các file dưới đây đã để lại đúng chỗ cho planner cắm vào. Không cần
đổi hình dạng nào trong số này.

| Seam | File | Vai trò |
|---|---|---|
| Input contract | `app/src/lib/trip.ts` — `TripDraft` | Đầu vào của planner |
| Handoff | `app/src/nav.ts` — route `Sketching` | Truyền draft sang màn chờ |
| Progress | `app/src/lib/sketch.ts` — `SKETCH_STEPS` | Timer trở thành report thật |
| Thuật toán | `data/scripts/itinerary-runtime.js` | Nguồn port: `itiScore`, `ITI_SLOTS`, budget pass, time pass |
| Giờ mở cửa | `app/src/lib/format.ts` — `openState()`, `splitHours()` | Lọc chỗ mở cửa đúng giờ |
| Khoảng cách | `app/src/lib/geo.ts` — `distanceKm()` | Xếp lộ trình |
| Hiển thị | `app/src/lib/live.ts` — `isLive()` | Hai cổng lọc place vào plan |
| Từ vựng | `app/src/lib/categories.ts`, `vibes.ts` | Taxonomy đóng |
| Mẫu Edge Function | `supabase/functions/fetch-place/index.ts` | Gate auth + cap suy từ chính dữ liệu |

## Kiến trúc

```
IdeasScreen ── TripDraft ──┐
                           │
   (tuỳ chọn) câu tự do ───┤
                           ▼
              ┌────────────────────────────┐
              │ app/src/lib/planner.ts     │  ← THUẦN, deterministic, chạy client
              │ chọn chỗ · giờ mở · lộ     │     (catalog đã nằm sẵn trong bộ nhớ
              │ trình · ngân sách · giờ    │      qua CatalogProvider)
              └────────────┬───────────────┘
                           │  TripPlan (skeleton)
                           ▼
              ┌────────────────────────────┐
   secret ──▶ │ supabase/functions/        │  ← chỉ phần cần secret
              │   plan-assist/index.ts     │
              │ action: narrate|parse|revise│
              └────────────┬───────────────┘
                           │  Claude API (key trong Supabase secrets)
                           ▼
              SketchingScreen (báo cáo thật) → TripScreen → lưu vào `trips`
```

**Nguyên tắc phân chia:** phần nào quyết định *plan có đúng không* thì chạy
bằng code thuần ở client; phần nào quyết định *plan đọc có hay không* thì để
LLM. Hệ quả trực tiếp: mất mạng tới Claude API vẫn có plan đầy đủ, chỉ thiếu
lời dẫn.

Phần chọn chỗ chạy client-side chứ không phải trong Edge Function vì
`CatalogProvider` (`app/src/lib/catalog.tsx`) đã tải toàn bộ places và
collections của thành phố vào bộ nhớ. Chọn trong tập đã có là phép tính trên
mảng — không cần secret, không cần dữ liệu người khác. Đẩy nó lên server chỉ
thêm độ trễ và một điểm hỏng.

## Ranh giới deterministic ↔ LLM

| Nhiệm vụ | Ai làm | Đường lui khi LLM không dùng được |
|---|---|---|
| Chọn place cho từng slot | `planner.ts` thuần | — (không phụ thuộc LLM) |
| Lọc chỗ mở cửa đúng giờ | `openState()` | — |
| Xếp thứ tự theo quãng đường | `distanceKm()` | — |
| Cân ngân sách | pass swap | — |
| Tính giờ đến từng điểm | time pass | — |
| Đặt tên chuyến đi | LLM | tên suy ra: "Tối thứ Bảy ở Hà Nội" |
| Lý do chọn từng điểm | LLM | dòng dữ kiện: "4.6★ · cách 2.1km · mở tới 23:00" |
| Hiểu câu tự do | LLM → `TripDraft` | wizard bốn câu như hiện tại |

Phần chọn chỗ là hàm thuần, xác định theo đầu vào — trong đó `seed` là một đầu
vào (xem mục *Ngẫu nhiên là đầu vào*). Cùng `TripDraft`, cùng snapshot catalog,
cùng seed cho ra cùng danh sách stop, cùng thứ tự, cùng giờ. Đó là thứ test cần
và là thứ khiến mọi hành vi của planner giải thích được. LLM chỉ thêm chữ, nên
không có gì trong plan phụ thuộc vào việc model trả lời thế nào.

**Chống bịa địa điểm.** LLM không bao giờ được sinh ra place. Prompt chỉ nhận
tập slug đã chọn sẵn; output ép qua `output_config.format` (structured outputs)
với schema `{ stops: [{ slug, why }] }`, trong đó `slug` là `enum` gồm đúng các
slug đã gửi. Edge Function validate lại lần cuối; slug lạ thì bỏ dòng đó chứ
không bỏ cả plan.

## Tầng planner thuần — `app/src/lib/planner.ts`

Port từ `itinerary-runtime.js` nhưng nâng cấp, theo đúng quy ước của repo:
logic thuần trong `lib`, vẽ trong `screens`, test colocated.

```ts
export type Stop = {
  place: Place;
  slot: SlotKey;          // morning | afternoon | evening + vai trò
  arriveMin: number;      // phút từ 00:00
  dwellMin: number;
  why: string | null;     // LLM điền sau; null nghĩa là chưa/không có
};

export type TripPlan = {
  title: string | null;
  stops: Stop[];
  costVnd: { food: number; activity: number; transport: number };
  windowMin: [number, number];
};

export function planTrips(
  draft: TripDraft, places: Place[], now: Date,
  opts?: { taste?: Taste; seed?: number },
): TripPlan[];          // ba phương án, không phải một — xem mục dưới
```

### Hai thứ thuật toán gốc cần mà wizard không hỏi

`itinerary-runtime.js` tính số stop bằng `clamp(round(hours / 2), 2, 6)` và có
một pass swap để ép plan vừa ngân sách. Wizard hiện tại không hỏi cả số giờ lẫn
ngân sách, nên hai cơ chế đó không có đầu vào.

**Số stop suy từ `when`:** `evening` cho 3 stop, `day` cho 5. Không thêm câu hỏi
nào, khớp với mockup, và đúng với thực tế — một buổi tối không đi được năm chỗ.
Với `day`, slot lấy từ nhóm `morning` + `afternoon` của `ITI_SLOTS`; với
`evening` thì lấy nhóm `evening`.

**Ngân sách: bỏ pass swap ở Phase 1.** Plan chỉ *báo* chi phí chứ không *ép*
theo một con số nào — trung thực hơn là bịa ra một trần mặc định rồi cắt bỏ
những chỗ tốt vì nó. Đến Phase 4, `profiles.pref_budget_vnd` trở thành trần
thật và pass swap được bật lại.

### Collection đã lưu là ưu tiên cứng

Câu cuối wizard cho chọn "bắt đầu từ collection đã lưu" (`TripDraft.from`). Chỗ
nằm trong collection đó **được đảm bảo có mặt** — miễn là vẫn `isLive()`, vẫn
mở cửa đúng giờ, và vẫn hợp slot. Ba điều kiện đó không nhân nhượng: một plan
chứa chỗ đóng cửa chỉ vì người ta từng lưu nó là một plan hỏng.

Ưu tiên cứng kéo theo một hệ quả cần chặn: nếu collection đủ chỗ lấp kín mọi
slot thì ba phương án sẽ giống hệt nhau, chỉ khác thứ tự. Nên giới hạn
collection chiếm tối đa `stops - 1` slot, chừa ít nhất một slot cho lens phân
hoá. Người dùng vẫn thấy cái mình đã lưu nằm trong plan, mà ba thẻ vẫn là ba
lựa chọn thật.

### Năm pass

Mỗi pass là một hàm thuần test được riêng:

1. **Lọc** — `isLive()`, đúng `city_id`, và `openState()` nói chỗ đó mở trong
   khung giờ đã chọn. Đây là nâng cấp lớn nhất so với bản mockup, vốn bỏ qua
   giờ mở cửa hoàn toàn.
2. **Chấm điểm** — `itiScore` port sang `categories` (trục mới) thay vì
   `vibes` (trục cũ), cộng thêm số hạng khoảng cách và taste.
3. **Chọn** — một chỗ cho mỗi slot, lấy mẫu có trọng số trong nhóm gần đỉnh
   (xem mục *Ngẫu nhiên* bên dưới), chốt cuối bằng `slug`. Bản gốc tie-break
   theo `id`; `slug` ổn định hơn và là khoá app dùng ở mọi nơi.
4. **Xếp lộ trình** — với ≤ 6 stop, thử mọi hoán vị hợp lệ trong cùng buổi và
   chọn tổng quãng đường ngắn nhất. Bản gốc không làm bước này; đây là chỗ câu
   "Tính thời gian đi bộ giữa các điểm" của `sketch.ts` trở thành sự thật.
5. **Ngân sách + giờ** — port nguyên pass swap và pass thời gian.

Test cần có trong `planner.test.ts`: cùng input **và cùng seed** ra cùng
output, seed khác ra khác; chỗ đóng cửa không bao giờ lọt vào; vượt ngân sách
thì swap và dừng khi hết chỗ rẻ hơn; catalog rỗng trả plan rỗng chứ không ném
lỗi; `TripDraft` ở mức tối thiểu `canPlan` cho phép vẫn ra plan.

### Ngẫu nhiên là đầu vào, không phải hiệu ứng ngầm

Bản mockup xác định tuyệt đối vì pitch recorder cần thế. Trong app thì ràng
buộc đó không còn: recorder chạy chính `itinerary-runtime.js`, một script ES5
riêng, và việc port sang đây không động tới nó.

Xác định tuyệt đối lại còn có hại. Hà Nội có 85 place, trung bình 1.23 category
mỗi chỗ; với slot "cà phê buổi tối", luôn lấy ứng viên điểm cao nhất nghĩa là
**đúng một quán đó xuất hiện trong mọi plan của mọi người, mãi mãi**. Đa dạng ở
đây là điều kiện để dùng được, không phải để cho vui.

Cách giải là thủ pháp repo đã dùng hai lần: `openState(lines, now)` nhận `now`
làm tham số — *"`now` is injected so this is a pure function of its inputs; the
screen passes the real clock"* — và `stepStates(elapsed)` cũng vậy. Làm y hệt
với `seed`. Hàm vẫn thuần, vẫn xác định, chỉ là xác định **theo seed**: test
truyền `seed: 42`, màn hình truyền seed mới mỗi lần bấm Regenerate.

Ngẫu nhiên chỉ tác động ở **bước chọn**, không rải lên toàn bộ điểm số — làm
thế thì plan thành tuỳ tiện. Thay vì luôn lấy `candidates[0]`, lấy mẫu có trọng
số trong nhóm ứng viên cách người dẫn đầu dưới `EPSILON` điểm. Một quán 4.6★ và
một quán 4.5★ cùng vibe, cùng quận là hai lựa chọn tốt ngang nhau — chọn cái
nào là chuyện may mắn chứ không phải chuyện thuật toán. Một quán 3.2★ ở quận
khác vẫn không bao giờ lọt vào vì nó nằm ngoài nhóm.

Cần một PRNG thuần, gieo được — `mulberry32` hay tương đương, khoảng năm dòng —
chứ không dùng `Math.random()`, thứ không gieo được và biến hàm thành không
thuần.

Hai cơ chế đa dạng này khác nhau và không thay thế nhau: **ba lens** lo khác
biệt *giữa ba thẻ trong một lần sinh*; **seed** lo khác biệt *giữa các lần
sinh*.

### Ba phương án, không phải một

Người dùng chọn giữa ba bản nháp rồi tinh chỉnh, thay vì nhận một bản rồi phải
tranh luận với nó. Điều này quan trọng hơn vẻ ngoài: nó **xoá bỏ nhu cầu chat
tự do sửa plan** — thứ vừa tốn token vừa buộc phải thêm một bảng đếm để cap chi
phí. Chọn-trong-ba cộng sửa tay cho người dùng nhiều quyền kiểm soát hơn chat,
với chi phí bằng không.

Ba phương án sinh ra bằng ba **lens** — mỗi lens là một bộ trọng số khác nhau
trên cùng một hàm chấm điểm, không phải ba thuật toán:

| Lens | Badge | Điều chỉnh trọng số |
|---|---|---|
| `match` | ★ Best match | mặc định — bám sát `TripDraft` và taste |
| `iconic` | Iconic views | tăng hệ số `log10(rating_count)`, ưu tiên `views` |
| `lowkey` | Low-key | giảm `rating_count`, giảm `price_vnd`, ưu tiên `chill` |

Kèm một ràng buộc đa dạng: phương án sau phải khác phương án trước ít nhất 2
trên 3 stop; trùng quá thì bỏ và lấy ứng viên kế tiếp. Ba lượt chạy dùng chung
một seed nên vẫn tái lập được trọn vẹn khi cần.

Badge suy ra từ lens, không do LLM đặt. LLM chỉ đặt **tên** ("River first,
rooftop last") — một lời gọi cho cả ba phương án, không phải ba lời gọi.

**Nút Regenerate** truyền một `seed` mới. Ngoài ra nên loại trừ các slug vừa
hiện ở lần trước, để lần bấm thứ hai chắc chắn cho thứ khác chứ không phụ thuộc
hoàn toàn vào may mắn của bộ gieo.

### Thời gian di chuyển — `app/src/lib/travel.ts`

Màn chọn phương án hiển thị quãng đường và cách đi giữa hai stop ("6.8 km ·
≈ 15 min ride", "≈ 12 min walk"). `distanceKm()` cho quãng đường; phần còn lại
là một hàm thuần nữa:

```ts
export type Leg = { km: number; mode: 'walk' | 'ride'; minutes: number };
export function legBetween(a: Place, b: Place): Leg | null;
```

Quy tắc: dưới ~1.2 km thì đi bộ (~12 phút/km), xa hơn thì xe (~2.5 phút/km
trong nội đô). `null` khi một trong hai chỗ thiếu toạ độ — màn hình bỏ dòng đó
đi thay vì đoán, cùng tinh thần với `openState()` trả `null`.

Con số này cũng là đầu vào cho pass thời gian: giờ đến của stop kế tiếp bằng
giờ rời stop trước cộng `leg.minutes`, thay cho hằng số 30 phút của bản mockup.

## Luồng màn hình

```
IdeasScreen ──▶ SketchingScreen ──▶ PlanOptionsScreen ──▶ PlanEditScreen ──▶ Trips
  bốn câu hỏi     báo cáo thật        ba phương án           sửa giờ,          tab
                                      + Regenerate           kéo thả,
                                                             thêm/bớt stop
                                                             → Save to Trips
```

**`PlanOptionsScreen`** — ba thẻ, mỗi thẻ có tên, badge, timeline stop kèm quãng
đường giữa các chặng, và dòng tổng kết (`3 stops · ~4.5h · ~400k ₫ / người`).
Nhãn "Made by City Crew AI" đặt ngay dưới tiêu đề: nói thật cái gì do máy dựng,
cùng tinh thần với cột `generated_by` trong `trips`.

**`PlanEditScreen`** — nhận một `TripPlan` và giữ nó như bản nháp sửa được: ±
giờ từng stop, kéo thả đổi thứ tự, thêm hoặc bớt stop, rồi Save.

Điểm cần cẩn thận: **khi người dùng sửa giờ bằng tay, planner không được tính
lại đè lên.** Plan chuyển từ trạng thái `generated` sang `edited` và từ đó chỉ
người dùng mới đổi được giờ. Nếu không, mỗi lần thêm một stop là mọi giờ người
ta vừa chỉnh bị quét sạch — đúng kiểu bug không ai nhìn ra khi đọc code.

**Chi phí ước tính theo một người.** Dòng tổng kết ghi `~400k ₫ / người` chứ
không phải `/ two`, kèm một dòng nhắc dưới thẻ: *"Ước tính cho một người"*.
Người dùng tự nhân lên theo số người của mình.

Cách này khớp với dữ liệu sẵn có chứ không phải một lựa chọn tuỳ tiện:
`places.price_vnd` suy từ `priceLevel` của Google (1–4 → 50k/150k/300k/500k
theo `PRICE_LEVEL_VND` trong `_shared/import-place.ts`), mà price level của
Google vốn là mức cho một người. Và nó gỡ được nhu cầu hỏi số người — wizard giữ
nguyên bốn câu.

Một chỗ lệch cần biết: `ITI_TRANSPORT_PER_HOP = 15000` là giá **một chuyến xe**,
không phải một người — bốn người đi chung một chuyến Grab vẫn trả từng ấy. Con
số ước tính vì thế đúng cho người đi một mình và **cao hơn thực tế** với nhóm.
Đó là hướng sai an toàn hơn hướng ngược lại, nhưng nên nói ra trong dòng nhắc
nếu phần di chuyển chiếm tỷ trọng đáng kể.

## Crew — chỗ hụt lớn nhất, và nó chưa được model hoá

Mockup có "You & Lan", "5 going", nút **Invite** và nút **Share**. Trong repo
hiện tại, **"crew" hoàn toàn chỉ là chữ**: không bảng group, không membership,
không sharing. `CollectionDetailScreen.tsx` nói thẳng — *"Your collections are
private for now. Sharing one with the crew is on the way."*

Nên phần này mock ở giai đoạn đầu, và mock **cả** Invite lẫn avatar chứ không
riêng Share. Khi làm thật, nó là một thiết kế riêng: bảng `trip_members`, lời
mời, quyền xem/sửa, và RLS cho phép người khác chủ đọc được một `trip` — tức là
phá vỡ mô hình owner-only mà `collections` đang dùng. Đó là một tài liệu khác,
không phải một dòng trong tài liệu này.

## Contract của agent — `supabase/functions/plan-assist/index.ts`

Theo đúng khuôn `fetch-place`: một endpoint POST, dispatch theo `{action}`,
gate bằng `Authorization: Bearer` → `admin.auth.getUser(token)`.

| action | Vào | Ra | Model |
|---|---|---|---|
| `narrate` | draft + **cả ba** phương án (slug, tên, category, rating, khoảng cách) | `{ plans: [{ index, title, stops: [{slug, why}] }] }` | `claude-sonnet-5` |
| `parse` | câu tự do + taxonomy + danh sách quận | `TripDraft` từng phần | `claude-opus-5` |
| `revise` | plan hiện tại + yêu cầu sửa | `{ intent, params }` — planner chạy lại | `claude-opus-5` |

`narrate` đặt tên cho **cả ba phương án trong một lời gọi**, không phải ba lời
gọi — vừa rẻ hơn ba lần, vừa cho model thấy cả ba cùng lúc nên tên phân biệt
được với nhau. Badge ("Best match", "Iconic views", "Low-key") suy ra từ lens
trong `planner.ts`, không do model đặt.

Cả ba ép JSON bằng `output_config.format`. Không dùng assistant prefill (trả
400 trên Opus 5 và Sonnet 5), không truyền `temperature`/`top_p`/`budget_tokens`
(cũng 400); điều khiển độ sâu bằng `thinking: {type: "adaptive"}` và
`output_config.effort`.

`revise` **không** để model tự sửa plan. Model chỉ phân loại ý định
(`swap_stop` / `drop_stop` / `shift_time` / `change_budget` / `add_category`)
kèm tham số; planner thuần chạy lại từ đó. Nhờ vậy plan sau khi sửa vẫn tôn
trọng giờ mở cửa và ngân sách — điều một model tự viết lại JSON không đảm bảo.

## Schema mới

Repo này dè dặt với state mới: `fetch-place/index.ts` đếm cap 20 suggest/ngày
từ chính các row thay vì nuôi một bảng counter. Mỗi bảng dưới đây kèm lý do tại
sao **không suy ra được** từ dữ liệu sẵn có.

### `trips` + `trip_stops`

```sql
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  city_id text not null references public.cities(id),
  title text not null default '',
  -- Câu trả lời của wizard, giữ nguyên: đủ để dựng lại plan sau này.
  company text, categories text[] not null default '{}',
  district text, at_lat double precision, at_lng double precision,
  day date not null,
  when_part text not null check (when_part in ('day','evening')),
  generated_by text not null default 'rules'
    check (generated_by in ('rules','rules+llm')),
  created_at timestamptz not null default now()
);

create table public.trip_stops (
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  sort_order int not null,
  arrive_min int, dwell_min int,
  why text,                      -- câu LLM viết; null khi chạy đường lui
  why_lang text,                 -- 'en' | 'vi' | 'ja' — xem ghi chú dưới
  primary key (trip_id, sort_order)
);
```

**`why` chỉ có một thứ tiếng, và đó là lựa chọn có ý thức.** Mọi cột nội dung
khác trong repo đều có bộ ba `_en`/`_vi`/`_ja`, nhưng những cột đó do desk viết
một lần cho mọi người đọc. `why` thì viết riêng cho một chuyến của một người,
nên sinh cả ba thứ tiếng là trả gấp ba token để hai phần ba không ai đọc. Sinh
theo ngôn ngữ đang chọn, lưu kèm `why_lang`. Đổi ngôn ngữ app sau khi lưu thì
plan cũ giữ nguyên tiếng cũ — `why_lang` cho phép màn hình nói ra điều đó thay
vì để người đọc tự đoán.

RLS theo đúng khuôn `collections.owner_id`.

**Biện minh:** một chuyến đi đã lên là quyết định của người dùng tại một thời
điểm. Catalog đổi — chỗ đóng cửa, bị gỡ publish — thì plan cũ vẫn phải giữ
nguyên hình dạng. Không suy lại được từ `TripDraft`.

### `place_events`

```sql
create table public.place_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  kind text not null
    check (kind in ('view','open','save','unsave','plan_keep','plan_drop')),
  city_id text,
  created_at timestamptz not null default now()
);
create index place_events_user_idx on public.place_events (user_id, created_at desc);
```

**Biện minh:** `places.saved_count` là số biên tập viên gõ tay, không phải hành
vi quan sát được; `collection_places` chỉ ghi cái *đã lưu*. Tín hiệu mạnh nhất
cho gợi ý lại là cái người ta **xem rồi không lưu** — và không bảng nào hiện có
suy ra được điều đó.

**Quyền riêng tư là điều kiện, không phải tính năng phụ:** opt-in trong
Profile, mặc định tắt; RLS chỉ chủ đọc; có nút "Xoá lịch sử của tôi" xoá sạch;
không ghi khi chưa đăng nhập. Thiếu một trong bốn thì chưa ship.

### Preferences tường minh

Thêm cột vào `profiles` thay vì bảng mới — `profiles.interests` đang là free
text không ai đọc, nên đây cũng là dịp cho nó một hình dạng dùng được.

```sql
alter table public.profiles
  add column pref_categories text[] not null default '{}',
  add column pref_budget_vnd int,
  add column pref_walk_max_km numeric not null default 1.5,
  add column pref_pace text not null default 'normal'
    check (pref_pace in ('relaxed','normal','packed'));
```

### pgvector — khuyến nghị chưa làm

Đo trên project `amdvitzpogaejzzqroco` (17/08/2026):

| Chỉ số | Giá trị |
|---|---|
| Tổng place | 141 (Hà Nội 85, HCM 30, Đà Nẵng 26) |
| Đã phân loại `categories` + `vibe_tags` | 141/141 — 100%, `needs_classification` = 0 |
| Độ dài `desc_en` trung bình | 41 ký tự |
| Có mô tả thật (>40 ký tự) | 54/141 — 38% |
| Số category trung bình mỗi place | 1.23 |

Embedding cần văn bản để nén thành ngữ nghĩa. Ở quy mô này, chuỗi đem đi embed
sẽ gần như là `tên · 1.23 category · vibe_tags · quận` — tức mã hoá lại chính
cái taxonomy đã tồn tại dưới dạng cột mảng có GIN index. Một vector 1024 chiều
để diễn đạt 7 category đóng và 8 vibe đóng là phép nén ngược.

Ba lý do thường dùng để biện minh cho vector, và vì sao chưa cái nào đúng:

1. **Catalog quá lớn để quét** — 141 dòng, client đã tải hết vào bộ nhớ. Lọc
   mảng 141 phần tử mất dưới một mili giây.
2. **Từ khoá không bắt được ý** — với nhãn phủ 100%, `categories && vibe_tags`
   bắt gần hết. Chỗ nào hụt thì `pg_trgm` + `unaccent` (đều có sẵn trên
   project, chưa cài) rẻ hơn nhiều bậc; `SearchScreen.tsx` cũng đã fold dấu và
   fold `đ→d` rồi.
3. **Cần hiểu câu tự do** — việc này do LLM làm (`plan-assist` action `parse`),
   không phải vector.

Thêm nữa, Anthropic không có embeddings API, nên pgvector kéo theo một nhà cung
cấp thứ hai và một secret nữa.

**Điều kiện để quay lại** — cần cả ba, không phải một: catalog vượt ~2.000
place và không tải hết vào bộ nhớ được nữa; phần lớn place có mô tả thật cỡ vài
trăm ký tự; và xuất hiện nhu cầu mà taxonomy đóng diễn đạt không nổi ("chỗ ngồi
lâu không ai đuổi", "hợp dẫn bố mẹ đi cùng"). Điều kiện thứ ba mới là điều kiện
thật; hai điều đầu chỉ là quy mô.

## Personalization — taste profile

`app/src/lib/taste.ts`, thuần, tính ở client từ dữ liệu đã có trong bộ nhớ
(`SaveProvider` + `AuthProvider`). Không materialized view — đúng triết lý
suy-ra-thay-vì-lưu của repo.

| Tín hiệu | Nguồn | Trọng số | Có từ phase |
|---|---|---|---|
| Preferences khai báo | `profiles.pref_*` | 4 | 4 |
| Collections đã lưu | `SaveProvider.mine` | 3 | 1 (đã có sẵn) |
| Places đã tự suggest | `places.submitted_by = uid` | 2 | 1 (đã có sẵn) |
| Mở detail rồi không lưu | `place_events` | −1 | 4 |
| Vị trí, thành phố | `useMyPosition`, `CityProvider` | pass khoảng cách | 1 (đã có sẵn) |

Đưa vào điểm số như một số hạng cộng có hệ số `W`:

```
score = overlap(categories, draft.categories) * 3     ← câu trả lời vừa xong
      + overlap(vibe_tags, slot.pref) * 2
      + rating + min(3, log10(1 + rating_count))
      + affinity(place, taste) * W                    ← mới
      - distancePenalty(place, stopTrước)             ← mới
```

`W = 2`, thấp hơn hệ số 3 của câu trả lời trong wizard — có chủ ý. Người dùng
vừa nói họ muốn gì; một plan bỏ qua điều đó để chiều hồ sơ là plan sai. Taste
dùng để phá thế hoà và xếp thứ tự, không để đổi câu trả lời. Nên có test khẳng
định điều này.

## Chi phí và vận hành

Một lời gọi `narrate` đặt tên cho cả ba phương án: vào ~3k token (ba bộ ba
stop cộng draft), ra ~500 token.

| Model | Mỗi lần sinh (3 phương án) | 1.000 lần/tháng |
|---|---|---|
| `claude-sonnet-5` (giá khuyến mãi) | ~$0.011 | ~$11 |
| `claude-opus-5` | ~$0.028 | ~$28 |

Nút Regenerate tính là một lần sinh nữa, nên cap theo ngày cần đếm cả lượt
regenerate chứ không chỉ số `trips` đã lưu — đây là chỗ duy nhất trong thiết kế
này mà con số không suy ra được từ dữ liệu sẵn có. Cách rẻ nhất để tránh thêm
bảng: giới hạn số lần Regenerate **trong phiên** ở client (ví dụ 3 lần), và để
cap theo ngày ở server vẫn dựa trên `trips`.

- **Cache** — system prompt, taxonomy và slot template là bất biến, đặt
  `cache_control: {type:"ephemeral"}` ở cuối khối system. Ngưỡng cache tối
  thiểu là 512 token trên Opus 5 và 1024 trên Sonnet 5; prompt hệ thống dự kiến
  ~800–1200 token nên cache có hiệu lực trên Opus 5, còn Sonnet 5 thì cần prompt
  đủ dài mới ăn.
- **Cap** — đường `narrate` suy cap từ chính các row `trips` tạo trong 24h,
  đúng khuôn `DAILY_SUGGESTIONS = 20`, không thêm bảng counter.
- **Đường lui** — timeout ~4s cho Claude API. Quá hạn hoặc lỗi thì trả
  `{ title: null, stops: [] }`; app dùng tên suy ra và dòng dữ kiện. Người dùng
  vẫn có plan đầy đủ, chỉ khác giọng văn.
- **Quan sát** — `console.log` trong Edge Function đã vào Supabase logs; ghi
  `action`, độ trễ, `usage.input_tokens`/`output_tokens`, và có dùng đường lui
  hay không.

## Lộ trình

### Phase 1 — Ba bản nháp thật *(không LLM, không migration)*

Lát mỏng nhất mang giá trị thật: nút trong Ideas cuối cùng cũng ra ba cách để
đi chơi một buổi tối.

- Thêm `app/src/lib/planner.ts` + `planner.test.ts` (ba lens, ràng buộc đa
  dạng, lấy mẫu theo `seed`)
- Thêm `app/src/lib/travel.ts` + `travel.test.ts`
- Thêm `app/src/screens/PlanOptionsScreen.tsx` — ba thẻ + Regenerate
- Sửa `app/src/lib/sketch.ts`, `app/src/screens/SketchingScreen.tsx`,
  `app/src/nav.ts`
- **Xong khi:** bấm "Lên kế hoạch" ra ba phương án khác nhau thật từ catalog
  thật; Regenerate ra bộ khác; mở lại app hôm sau với cùng câu trả lời cũng ra
  bộ khác; `npm run typecheck && npm test && npm run test:tz` xanh; cùng
  `(draft, seed)` hai lần ra cùng ba phương án.

### Phase 2 — Sửa và lưu

- Thêm `app/src/screens/PlanEditScreen.tsx` — ± giờ, kéo thả, thêm/bớt stop;
  trạng thái `generated` → `edited` khoá việc tính lại giờ
- Migration `trips` + `trip_stops`, `supabase/tests/trips_test.sql` nối vào
  `run.sh`
- `data.ts`: `saveTrip` / `useMyTrips` / `deleteTrip` / `reorderCollection`
- Tab Trips thay `ComingSoonScreen`, hai mục **Sắp tới** và **Đã đi**, chia
  bằng `day >= todayISO()` — không cần cột trạng thái nào, cùng tinh thần với
  cách repo suy cap 20 suggest/ngày từ chính các row
- Kéo thả sắp xếp trong `CollectionDetailScreen` — `sort_order` đã có mặt ở mọi
  chỗ đọc, chỉ thiếu người ghi (theo mẫu `dashboard/src/api.js:reorderPhotos`)
- **Share, Invite và avatar crew đều là mock ở phase này** — xem mục Crew

### Phase 3 — Lời dẫn và câu tự do *(LLM vào cuộc)*

- Thêm `supabase/functions/plan-assist/index.ts`, `app/src/lib/assist.ts`
- Sửa `SketchingScreen` (hiện `why`), `IdeasScreen` (ô nhập tự do)
- `ANTHROPIC_API_KEY` vào Supabase function settings
- **Xong khi:** plan có tên và lý do; gỡ key ra thì vẫn ra plan đầy đủ với
  đường lui.

### Phase 4 — Hiểu bạn

- Migration preferences + `place_events`
- Thêm `app/src/lib/taste.ts` + test; `planner.ts` nhận `taste`
- Sửa `EditProfileScreen`
- **Xong khi:** hai người dùng khác hồ sơ, cùng một `TripDraft`, ra hai plan
  khác nhau — và cả hai đều tôn trọng câu trả lời trong wizard.

### Phase 5 — Tinh chỉnh

- Nút sửa plan cụ thể ("đổi bữa tối", "rẻ hơn", "gần hơn") chạy thẳng vào
  planner
- "Chỗ giống chỗ này" ở PlaceDetail, dựng bằng `categories` + `vibe_tags` +
  khoảng cách
- `pg_trgm` + `unaccent` nếu tìm kiếm bắt đầu hụt

## Những chỗ khuyên không làm

1. **Không để LLM chọn địa điểm.** Kể cả khi nó chọn đúng, ta mất tính xác
   định, mất kiểm soát giờ mở cửa và ngân sách, và mở đường cho việc bịa chỗ.
2. **Không dựng agent loop nhiều bước trong Edge Function.** Deno Deploy có
   giới hạn thời gian; một vòng lặp tool-call dài sẽ hết giờ giữa chừng. Mọi
   lời gọi model nên là một lượt, có schema, có timeout.
3. **Chat tự do sửa plan** phá nguyên tắc "đừng thêm state" — cap chi phí cho
   chat không suy ra được từ bảng nào, buộc phải có counter. Vài nút sửa cụ thể
   chạy thẳng vào planner cho gần hết giá trị mà không tốn token nào.
4. **`place_events` là món nợ nếu làm ẩu.** Chưa opt-in thì chưa ghi; không có
   nút xoá thì chưa ship.
5. **Không dùng Managed Agents cho bài toán này.** Nó giải bài toán agent trạng
   thái dài hạn có sandbox; ở đây chỉ cần vài lời gọi một lượt.
