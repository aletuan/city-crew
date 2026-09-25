# Đo đạc trên máy thật — trace log, và cách dùng lại

Tài liệu này ghi lại toàn bộ cơ chế đo hiệu năng/animation của app: có
những gì, bật tắt ra sao, đọc ở đâu, và những cái bẫy đã mất nhiều giờ
để phát hiện. Viết để phiên làm việc sau không phải dò lại từ đầu.

**Bối cảnh:** app này được phát triển từ điện thoại. Không ai ngồi trước
terminal xem console của máy thật, nên "cảm thấy chậm" hay "cảm thấy
giật" không có cách nào biến thành con số — trừ khi app tự ghi lại và
gửi lên. Đó là lý do hai bảng dưới đây tồn tại.

---

## 1. Luật bất di bất dịch: bản App Store không gửi gì

`app/src/lib/legal.ts` — chính sách hiển thị cho người dùng, cả EN lẫn VI:

> **Không quảng cáo, không tracker, không analytics bên thứ ba.** Bản
> phát hành trên App Store không gửi bất kỳ dữ liệu chẩn đoán hay thống
> kê sử dụng nào.

Mọi công tắc trace đều phải tôn trọng câu này.

**Đã từng vi phạm một lần** (24/9/2026): `DECK_TRACE_UPLOAD` bị bật cứng
thành `true` để lấy số từ một máy chạy bản production. Các dòng ghi lên
không chứa gì định danh nên không ai bị lộ, nhưng **câu trên đã sai
trong suốt thời gian đó**. Sai lầm gốc: đổi hành vi gửi dữ liệu mà không
tra `legal.ts` trước.

Có một test chặn việc này tái diễn:

```
app/src/lib/decktrace.test.ts
  › "is silent on the build the policy says is silent"
```

Nó nạp module với channel giả lập là `production` và đòi cả hai hằng số
phải `false`. Một hằng số bị bật cứng sẽ làm test đỏ. **Muốn bật trace
trên bản App Store thì phải sửa `legal.ts` trong cùng commit, nếu không
là không được phép.**

---

## 2. Channel — thứ quyết định mọi thứ

Channel là một chuỗi **đóng dấu vào binary lúc build**, không đổi suốt
đời bản cài. `eas.json` gán theo profile:

| profile | channel | dùng cho | trace |
|---|---|---|---|
| `development` | `development` | dev client (JS chạy từ Metro) | bật |
| `preview` | `preview` | bản release nội bộ / TestFlight thử nghiệm | **bật** |
| `production` | `production` | bản lên App Store | **tắt** |

`app/src/lib/channel.ts` đọc `Updates.channel` và dựng:

```ts
export const CHANNEL = Updates.channel ?? null;
export const IS_PRODUCTION_CHANNEL = CHANNEL === 'production';
```

### Ba cái bẫy đã mắc phải

**TestFlight KHÔNG quyết định channel.** TestFlight chỉ là cách Apple
phân phối. `app-release.yml` mặc định build bằng profile `production` rồi
đẩy lên TestFlight — nên bản TestFlight bạn đang cài **là** production
channel và trace tắt. Đây là nguyên nhân của hai vòng chẩn đoán sai.

**Dev client không dùng để đo được.** `__DEV__ = true`, JS chưa tối ưu,
có dev tooling — mọi con số mili-giây đều sai lệch. Chỉ `preview` mới vừa
đo được vừa nhanh như bản thật.

**Đừng suy đoán channel — hãy đọc nó.** `deck_traces.channel` ghi thẳng
`Updates.channel`. Hai lần suy đoán từ việc "bảng im lặng" đều sai.

---

## 3. Hai bảng đang có

Cả hai nằm ở Supabase project `citycrew-data` (`amdvitzpogaejzzqroco`),
schema `public`. **Không có bên thứ ba nào** — không Sentry, không
Firebase, không analytics SDK.

### `startup_traces` — thời gian khởi động

Một dòng mỗi lần mở app, gửi **10 giây sau khi** màn hình Khám phá tải
xong (đủ muộn để không tranh chấp với thứ người dùng đang chờ).

| cột | nội dung |
|---|---|
| `platform`, `os_version`, `is_dev` | ios/android, phiên bản OS, có phải bản dev |
| `total_ms` | tổng tới mốc cuối |
| `marks[]` | `[{name, ms}]` — `city:bootstrap`, `city:committed`, `catalog:places`, `explore:mounted`, `explore:content`… |

Code: `app/src/lib/trace.ts` (ghi mốc) + `tracereport.ts` (gửi).

### `deck_traces` — dòng thời gian của deck ảnh khi lên kế hoạch

Một dòng mỗi lượt đi qua màn hình phác, gửi ngay trước khi rời màn hình.

| cột | nội dung |
|---|---|
| `platform`, `os_version`, `is_dev`, `channel` | như trên, cộng kênh build |
| `options`, `span`, `still` | mấy lựa chọn, mấy thẻ/hàng, có bật Reduce Motion |
| `total_ms` | tổng |
| `events[]` | `[{ms, option, slot, what, place}]` |

Năm loại `what`:

| | nghĩa |
|---|---|
| `ask` | ô được trao ảnh mới — lúc *yêu cầu* tan chéo |
| `load` | ảnh đã giải mã, vẽ được |
| `fail` | không tải được ảnh |
| `name` | chữ dưới ảnh đổi (đáy hố mờ của nó) |
| `option` | deck chuyển sang plan kế |

**`load − ask` là phép đo quan trọng nhất.** `expo-image` giữ ảnh cũ cho
tới khi ảnh mới giải mã xong, nên khoảng đó *chính là* thời gian ảnh cũ
đứng chờ. Đo thực tế trên iPhone: **21–31ms** trên bản preview, **9–47ms**
trên bản production trước đó — prefetch hoạt động tốt, và hai bản độc lập
cho cùng một câu trả lời. Số liệu đầy đủ ở mục 6.

Không có sự kiện "biến mất": một địa điểm rời ô đúng vào `ask` của địa
điểm kế tiếp trong ô đó. Cũng không có sự kiện "xong": bằng `name` cộng
`NAME_IN`, một hằng số đã biết — *số đã biết không phải phép đo*.

Code: `app/src/lib/decktrace.ts` (cả ghi lẫn gửi).

---

## 4. Quy ước chung của cả hai

| | |
|---|---|
| cấu trúc | một factory ghi + một factory gửi, tách rời để test được |
| hai công tắc | `*_TRACE` (ghi + console) và `*_TRACE_UPLOAD` (gửi) — tắt độc lập được |
| quy tắc gửi | không nằm trên đường tới hạn · gửi một lần · **nuốt lỗi** |
| nội dung | mili-giây, platform, OS, slug công khai. **Không** user id, **không** vị trí, **không** device id |
| RLS | điện thoại `insert` được, `select` không; chỉ `is_editor()` đọc |

Khác nhau có chủ đích:

- `makeTrace` **khử trùng lặp** theo tên (khởi động qua mỗi mốc một lần);
  `makeDeckTrace` **ghi nối tiếp** vì chỗ lặp lại *chính là* phép đo — bù
  lại có `EVENT_CAP`.
- Gửi **một lần/tiến trình** (khởi động) so với **một lần/lượt vào màn
  hình** (deck mở lại được, nên có `reportDeck.reset()`).

Khác nhau **không** có chủ đích — `startup_traces` thiếu cột `channel`:

`deck_traces` có `channel`, `startup_traces` không. Cột đó là thứ duy
nhất kết thúc được hai ngày chẩn đoán sai kênh build, và bảng kia không
có nó. Giá phải trả đã hiện ra ngay: dòng `startup_traces` lúc
`03:15:26` ngày 25/9 **không giải thích được**. Công tắc khởi động luôn
là `!IS_PRODUCTION_CHANNEL` và chưa từng bị bật tay (khác công tắc deck,
xem #679), nên một bản production đáng lẽ không ghi gì; mà bản preview
thì tới 03:46 mới được dựng. Không có cột `channel` thì không cách nào
biết máy lúc ấy đang chạy kênh gì, và mọi câu trả lời đều là suy đoán —
đúng thứ tài liệu này tồn tại để chặn.

**Việc cần làm:** thêm `channel` vào `startup_traces` với cùng
`default '(not sent)'`, và gửi nó từ `tracereport.ts` như `decktrace.ts`
đang gửi.

---

## 5. Quy trình một đợt đo

1. **Dựng bản preview:** Actions → *Release app to TestFlight* → Run
   workflow → `profile: preview`. Hoặc `eas build --profile preview
   --auto-submit-with-profile production`.
2. **Cài qua TestFlight**, mở app.
3. Thao tác cần đo. Với deck: vào màn hình lên kế hoạch, **để chạy hết**
   tới khi ra ba lựa chọn (thoát giữa chừng thì không có dòng nào gửi).
4. Đọc bảng (mục 6).
5. Xong việc thì xoá: `delete from deck_traces;` — **không có cơ chế xoá
   tự động**, cả hai bảng đều dọn bằng tay.

### Bản preview và EAS Update — đã sửa 25/9/2026

`app-preview.yml` đẩy update bằng `eas update --branch main`. Channel nào
nhận branch nào là do ánh xạ trên EAS, và ánh xạ đó **không tự có**.

Lần đầu dựng bản preview, channel `preview` đang trỏ vào branch `preview`
— một branch chưa từng có update nào (`Platforms`, `Runtime Version`,
`Group ID` đều `N/A`). Bản preview cài lên máy sẽ không bao giờ nhận
được EAS Update, và triệu chứng là "sửa JS mà app không đổi" — rất khó
đoán ra nếu không biết trước.

Đã trỏ lại:

```
eas channel:edit preview --branch main
→ Channel preview is now set to branch main.
```

Từ đó bản preview nhận cùng luồng update với bản production. Kiểm tra
lại bằng `eas channel:view preview` nếu có nghi ngờ — cả hai lệnh cần
đăng nhập EAS, nên phải chạy ở máy có `eas login`, không chạy được từ
phiên agent.

### Version phải cao hơn bản đang ở trên App Store

Bản `preview` vẫn đi qua App Store Connect — đó là đường duy nhất tới
TestFlight — nên nó chịu đúng luật của một bản nộp thật.

Apple giữ một **pre-release train cho mỗi `version`** (tức
`CFBundleShortVersionString`). Khi một version được duyệt lên App Store,
train của nó **đóng vĩnh viễn**: mọi lần upload sau đó dưới version ấy
đều bị từ chối, bất kể build number là bao nhiêu.

```
Validation failed (409) Invalid Pre-Release Train.
The train version '1.0.3' is closed for new build submissions
```

Bản preview đầu tiên chết đúng ở đây. EAS tăng build number 20 → 21 và
build thành công; App Store Connect từ chối vì 1.0.3 đã lên store rồi.
`autoIncrement` không cứu được — nó đếm build, còn train tính theo
version.

**Luật:** ngay sau khi một version được duyệt, nâng `version` trong
`app/app.json` lên patch kế tiếp. Mọi build TestFlight sau đó — kể cả
build chỉ để đo — đi trên train đang mở.

Giá của việc quên: mất trọn một lượt build, và lỗi chỉ hiện ra ở bước
submit, vài phút **sau** khi build đã chạy xong và đã trả tiền. Nếu binary
vẫn tốt và chỉ hỏng khâu submit vì lý do khác, dùng input `build_id` của
`app-release.yml` để nộp lại chính binary đó, khỏi build lần hai — nhưng
train đóng thì không: phải đổi version, tức là phải build lại.

---

## 6. Đọc dữ liệu

Qua MCP Supabase (bỏ qua RLS) hoặc bất kỳ client nào đăng nhập bằng tài
khoản editor.

```sql
-- Tổng quan các lượt gần nhất
select to_char(created_at,'HH24:MI:SS') as at, platform, os_version,
       coalesce(channel,'(explicit null)') as channel,
       options, span, still, total_ms, jsonb_array_length(events) as n
from public.deck_traces order by created_at desc limit 10;

-- Bung dòng thời gian của lượt mới nhất
select (e->>'ms')::int as ms, (e->>'option')::int as opt,
       coalesce(e->>'slot','-') as slot, e->>'what' as what, e->>'place' as place
from public.deck_traces t, jsonb_array_elements(t.events) e
where t.created_at = (select max(created_at) from public.deck_traces)
order by ms;
```

### Cách đọc một dòng thời gian khoẻ mạnh

```
    0ms   option 0   → chỉ có `load`, không có `ask`
                       ← im lặng đúng DECK_HOLD_MS (2400ms)
 2420ms   option 1   → ask/load/name cho từng ô, lệch ~150ms
 4840ms   option 2   → như trên
```

- **Có `ask` trước lần `option` đầu tiên** = bộ ảnh bị vẽ lại giữa chừng.
  Đây là lỗi đã sửa ở PR #676 (`planTrips` chạy lại khi catalog / saved
  lists / taste profile về muộn); nếu thấy lại thì nó đã quay về.
- Số sự kiện đúng cho 3 option × 2 thẻ là **17**. Nhiều hơn = có gì đó
  đổi ngoài dự kiến.
- Một `load` xuất hiện *trước* `ask` của cùng ô là `expo-image` báo xong
  tấm ảnh nó **đang giữ**, không phải tấm mới. Đừng trừ nhầm cặp đó.

### Dữ liệu mẫu — 25/9/2026, bản preview 1.0.4 (22)

iPhone, iOS 26.3, `is_dev: false`, `channel: preview`, `span: 2`. Đây là
lượt đo hợp lệ đầu tiên: mọi con số trước đó đến từ bản production chạy
bundle có công tắc bị bật tay, thứ đã phải gỡ ở #679.

**Lượt A** — `04:05:18`, `options: 2`, `total_ms: 2785`, 10 sự kiện:

```
   ms  opt  slot  what   place
    0    0    -   option
   36    0    0   load   sidney-myer-music-bowl
   46    0    1   load   her-bar
 2415    1    -   option
 2418    1    0   ask    melbourne-skydeck
 2439    1    0   load   melbourne-skydeck
 2568    1    1   ask    la-camera-italian-restaurant
 2599    1    1   load   la-camera-italian-restaurant
 2634    1    0   name   melbourne-skydeck
 2785    1    1   name   la-camera-italian-restaurant
```

**Lượt B** — `04:06:01`, `options: 2`, `total_ms: 2781`, 11 sự kiện:

```
   ms  opt  slot  what   place
    0    0    -   option
   27    0    0   load   sidney-myer-music-bowl
   43    0    1   load   la-camera-italian-restaurant
 2424    1    -   option
 2431    1    0   ask    melbourne-skydeck
 2452    1    0   load   melbourne-skydeck
 2485    1    1   load   la-camera-italian-restaurant   ← load không có ask
 2564    1    1   ask    her-bar
 2592    1    1   load   her-bar
 2649    1    0   name   melbourne-skydeck
 2781    1    1   name   her-bar
```

Dòng `2485` là **đúng cái bẫy nói ở trên**, gặp ngoài đời: ô 1 báo `load`
cho `la-camera` trong khi `ask` của nó (`her-bar`) mãi `2564` mới tới.
Đó là `expo-image` báo xong tấm nó *đang giữ* từ option 0. Trừ `2485 −
2431` sẽ ra 54ms và hoàn toàn vô nghĩa. Cặp đúng là `2592 − 2564 = 28`.
Đây cũng là lý do lượt B có 11 sự kiện còn lượt A có 10 — không phải lỗi.

**Rút ra từ hai lượt:**

| đại lượng | công thức | thiết kế | lượt A | lượt B |
|---|---|---|---|---|
| hold mỗi option | `option[n+1] − option[n]` | 2400 | 2415 | 2424 |
| lệch giữa hai ô | `ask(slot1) − ask(slot0)` | 140 | 150 | 133 |
| chữ chìm rồi nổi | `name − ask` cùng ô | 200 | 216 / 217 | 218 / 217 |
| giải mã ảnh | `load − ask` cùng ô | — | 21 / 31 | 21 / 28 |

Ba dòng đầu bám sát con số thiết kế trong `SketchDeck.tsx`, sai lệch
7–13ms — đúng mức một `setTimeout` của JS thread. Dòng cuối là con số
**không ai thiết kế cả, và là con số quan trọng nhất**: khoảng cách từ
lúc hỏi ảnh tới lúc ảnh sẵn sàng chỉ 21–31ms. Bốn vòng sửa trước đó đã
đuổi theo một độ trễ giải mã không tồn tại. Số liệu cũ trên bản
production (9–47ms) cho cùng kết luận — hai bản khác nhau, cùng một câu
trả lời, nên đây không phải nhiễu.

Không lượt nào có `ask` trước lần `option` đầu tiên. Lỗi vẽ lại giữa
chừng đã sửa ở #676 không quay lại.

**Hai lượt quá ngắn để đo** — `04:04:43` và `04:04:54`, cùng
`options: 1` và 3 sự kiện, `total_ms` 45 và 22. Lượt đầu:

```
   ms  opt  slot  what   place
    0    0    -   option
   36    0    0   load   her-bar
   45    0    1   load   la-camera-italian-restaurant
```

Màn hình rời đi trước khi hết hold đầu tiên, nên không có `ask`, không có
`name`, không có lần đổi option nào. Không có gì để đo — nhưng dòng vẫn
được ghi, và **`options: 1` là dấu hiệu nhận ra ngay**. Khi lọc dữ liệu
để phân tích thì bỏ các dòng `options < 2`.

### Dữ liệu mẫu — `startup_traces`, cùng máy, `04:04:28`

`total_ms: 2695`, `is_dev: false`:

```
    9  bundle:evaluated
   26  theme:ready
   39  fonts:settled
   39  first-frame:released      ← người dùng thấy gì đó ở đây
   88  explore:mounted
   91  city:bootstrap
   93  city:store-read
   94  city:committed(cached)
  368  explore:content
  368  catalog:places(cached)
  368  catalog:collections(cached)
  368  catalog:avatars
 1975  city:cities-fetched
 1975  city:committed(stored)
 2102  catalog:places
 2695  catalog:collections
```

Cách đọc: **39ms tới khung hình đầu, 368ms tới nội dung thật** (từ cache),
rồi mạng về dần trong 2.7 giây tiếp theo và thay dữ liệu cache bằng dữ
liệu tươi. Cái đáng theo dõi là `first-frame:released` và
`explore:content`; các mốc sau đó là mạng, thay đổi theo từng lần và
không nói gì về app.

---

## 7. Khi bảng trống — thứ tự chẩn đoán

Reporter **cố ý nuốt lỗi** (trace hỏng không được ảnh hưởng app). Nghĩa
là bảng trống *không* nói lên điều gì. Đừng suy luận, hãy đi theo thứ tự:

**1. App có gửi không?** Đọc log API — đây là bước đã bị bỏ qua và làm
mất nhiều giờ.

```sql
-- MCP Supabase: query_logs
select toStartOfMinute(timestamp) as minute,
       log_attributes['response.status_code'] as status, count(*) as n
from logs
where source = 'edge_logs'
  and position(log_attributes['request.path'], 'deck_traces') > 0
group by minute, status order by minute desc
```

- Không có POST nào → app không chạy đoạn ghi (xem bước 2).
- Có POST nhưng 4xx → server từ chối (xem bước 3).

**2. Không có POST** → hoặc công tắc đang tắt (máy chạy production
channel), hoặc máy chưa nhận bundle mới. EAS Update **tải ở lần mở này,
áp dụng ở lần mở kế tiếp** — phải tắt hẳn app và mở lại **hai lần**.

Nếu đang chờ một bản preview mới: **build xanh không có nghĩa là bản đó
đã tới TestFlight.** `app-release.yml` chạy `--no-wait`, nên job GitHub
xanh chỉ nghĩa là "EAS đã nhận việc". Sau khi build xong còn một bước
submit chạy trên EAS, và bước đó có thể hỏng riêng — xem trang
*Submissions* trên expo.dev chứ không chỉ trang *Builds*. Mục 5 có hai
kiểu hỏng đã gặp ở đây.

**3. Có POST nhưng lỗi** → xem lý do thật:

```sql
select timestamp, event_message from logs
where source = 'postgres_logs' and position(event_message,'deck_traces') > 0
order by timestamp desc limit 10
```

Đã gặp: `violates check constraint "deck_traces_platform_check"` — ràng
buộc `platform in ('ios','android')` chép từ `startup_traces` mà không có
lý do, chặn sạch mọi dòng. **Bài học: bảng trace tồn tại để nhận bất cứ
thứ gì máy gửi lên; một ràng buộc từ chối chính giá trị giải thích được
lỗi là ràng buộc phá thứ nó gắn vào.**

**4. Cột null mà không rõ nghĩa** → `deck_traces.channel` có
`default '(not sent)'`. Đọc như sau:

| giá trị | nghĩa |
|---|---|
| `(not sent)` | bundle cũ hơn cột này — máy chưa update |
| `null` | xem ngay dưới — **hai nghĩa**, phân biệt bằng `created_at` |
| `preview` / `production` | channel thật |

`null` mơ hồ vì `alter table add column` **điền null vào mọi dòng đã có**,
và `default` chỉ áp cho dòng ghi *sau* đó. Nên `null` là:

- **dòng ghi trước migration** — không phải máy nói gì cả, chỉ là cột
  chưa tồn tại lúc ấy. Cột thêm ở `20260925003000`, default thêm ở
  `20260925011500`.
- **dòng ghi sau đó mà bundle gửi null thật** — build không có dấu
  channel (Expo Go, hoặc dev không qua EAS).

So `created_at` với hai mốc trên là xong. Ví dụ thật: 17 dòng `null` từ
21:10 ngày 24/9 tới 01:06 ngày 25/9 **cùng một máy** (`ios 26.3`,
`is_dev: false`) với các dòng đọc `production` từ 01:51 — máy không đổi
gì, cột mới sinh ra ở giữa.

*(Bài học: giá trị mặc định chỉ cứu được tương lai. Muốn dòng cũ nói
đúng thì phải `update` chúng trong chính migration ấy, hoặc chấp nhận
rằng `created_at` là thứ duy nhất phân biệt được.)*

*(Bài học tổng quát: đừng để giá trị mặc định của một dụng cụ đo trùng
với một trong các câu trả lời nó cần phân biệt.)*

---

## 8. Test không được chạm mạng

`app/src/uitest/setup.tsx` thay `lib/supabase` bằng `fakeSupabase` cho
**mọi** UI test. Lý do: `SketchingScreen.ui.test.tsx` từng ghi fixture
của nó thẳng vào bảng production, mỗi lần chạy, kể cả trên CI — hơn 60
dòng, không có gì báo lỗi.

Chốt chặn này được bảo vệ bởi `app/src/uitest/network.test.ts` (một chốt
mà giá trị là "không có gì xảy ra" thì không ai nhận ra lúc nó hỏng).

Nhận diện dòng rác do test sinh ra: `platform: 'web'`, `os_version:
'0.0.0'`, `options` 2 hoặc 4, `total_ms` vài chục ms.

**Chỉ chặn Supabase.** `fetch` chưa bị stub, nên test vẫn gọi được host
khác.

---

## 9. Bản đồ file

| file | vai trò |
|---|---|
| `app/src/lib/channel.ts` | đọc `Updates.channel`, dựng `IS_PRODUCTION_CHANNEL` |
| `app/src/lib/trace.ts` · `tracereport.ts` | trace khởi động (ghi · gửi) |
| `app/src/lib/decktrace.ts` | trace deck (cả hai nửa) |
| `app/src/lib/legal.ts` | **lời hứa phải tôn trọng** |
| `app/src/uitest/setup.tsx` · `network.test.ts` | chốt chặn mạng trong test |
| `.github/workflows/app-release.yml` | build binary (`profile: production|preview`) |
| `.github/workflows/app-preview.yml` | đẩy EAS Update mỗi lần merge chạm `app/` |
| `app/eas.json` | ánh xạ profile → channel |
| `supabase/migrations/20260825070000_startup_traces.sql` | bảng khởi động |
| `supabase/migrations/20260924140000_deck_traces.sql` (+3 bản vá sau) | bảng deck |
