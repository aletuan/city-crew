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
đứng chờ. Đo thực tế trên iPhone: **9–47ms** (prefetch hoạt động tốt).

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

### ⚠️ Bản preview và EAS Update

`app-preview.yml` đẩy update bằng `eas update --branch main`. Channel nào
nhận branch nào là do ánh xạ trên EAS. Nếu channel `preview` chưa được
trỏ vào branch `main`, **bản preview sẽ không nhận được update JS** — mỗi
lần sửa code phải build lại binary.

Kiểm tra và sửa (cần EXPO_TOKEN, chạy ở máy có đăng nhập EAS):

```
eas channel:view preview
eas channel:edit preview --branch main
```

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
| `null` | bundle mới, build không có dấu channel (Expo Go / dev) |
| `preview` / `production` | channel thật |

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
