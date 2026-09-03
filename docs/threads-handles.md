# Tìm trang Threads của quán

Cách tìm và ghi trang Threads cho các quán trong catalog. Kết quả nằm ở cột
`places.threads_handle` — lưu trần, không `@`, chữ thường; migration
`supabase/migrations/20260901140000_place_threads_handle.sql` là nơi định nghĩa
cột, ràng buộc hình dạng và trigger chuẩn hoá.

Ghi chú này được vớt từ PR #417 — nhánh nghiên cứu đầu tiên của việc này, viết
trước khi cột trên tồn tại. Phần quy tắc và các bẫy giữ nguyên giá trị; phần cơ
chế đã viết lại theo hiện trạng.

## Quy tắc: handle Threads = handle Instagram

Threads không có hệ thống tài khoản riêng — mỗi tài khoản Threads **là** một tài
khoản Instagram, dùng chung username. Nên trang chủ Threads luôn là:

```
https://www.threads.com/@<handle Instagram>
```

Ví dụ: Rehab Station có Instagram `@rehabstationsaigon`, và trang Threads đúng
bằng `https://www.threads.com/@rehabstationsaigon`.

Vậy bài toán "tìm trang Threads" rút gọn thành "tìm handle Instagram" — việc dễ
hơn nhiều, vì Instagram được Google index tốt còn Threads thì không.

Hệ quả duy nhất cần nhớ: có handle Instagram **chưa chắc** có trang Threads. Nếu
chủ quán chưa bật Threads, URL trên sẽ 404. Đó là thứ duy nhất phải kiểm tra
thật.

## Vì sao không đoán được handle từ tên quán

Không có quy tắc đặt tên. Cùng một tập quán ở Sài Gòn đã đủ mọi kiểu biến thể:

| Tên quán | Handle | Kiểu biến thể |
|---|---|---|
| Chill Skybar | `chill_skybar` | gạch dưới |
| Broma: Not A Bar | `broma.not.a.bar` | dấu chấm |
| Secret Garden | `secretgardenvn` | thêm hậu tố quốc gia |
| Social Club Rooftop | `socialclubsaigon` | thêm hậu tố thành phố |
| Blank Lounge | `blankloungelandmark` | thêm tên toà nhà |
| SHIN Heritage | `shincaphevn` | dùng tên tiếng Việt của brand |
| L'Usine | `lusinespace` | thêm từ không có trong tên |

Thêm hai cái bẫy:

- **Handle khác nhau giữa các nền tảng.** The Workshop Coffee là
  `theworkshopcoffee` trên Instagram nhưng `the.workshop.coffee` trên Facebook.
  Lấy handle từ Facebook rồi ghép vào URL Threads sẽ ra trang sai hoặc 404.
- **Chuỗi có handle riêng theo từng nước.** Cộng Cà Phê có `congcaphe.ca`
  (Canada) và `congcaphe.tw` (Đài Loan) đều đang hoạt động trên Threads. Đừng
  mặc định `congcaphe` là tài khoản Việt Nam.

## Một brand — mọi chi nhánh

Tài khoản Threads là của thương hiệu, không phải của từng địa chỉ, nên một
handle đã xác minh được ghi cho **mọi chi nhánh** của brand trong catalog:
`okkiocaffe` đứng tên cả năm chi nhánh OKKIO ở Sài Gòn. Ngoại lệ là chuỗi đa
quốc gia có handle theo từng nước (bẫy Cộng Cà Phê ở trên) — với chuỗi kiểu đó
phải pin đúng tài khoản Việt Nam trước đã.

## Quy trình

1. **Tra handle Instagram** bằng web search:
   `<tên quán> <đường/quận> Instagram official`. Kết quả trả về URL
   `instagram.com/<handle>` kèm bio và số follower để đối chiếu đúng quán.
2. **Ghép thành URL Threads**: `https://www.threads.com/@<handle>`.
3. **Mở URL đó và nhìn tận mắt.** Chỉ ghi khi thấy trang profile thật hoặc bài
   đăng của chính tài khoản. Handle Instagram suông — chưa thấy Threads — thì
   chưa ghi: ô để trống nghĩa là "chưa có hoặc chưa tra", và bộ lọc **No
   handle** trong desk chính là worklist.
4. **Ghi vào database**, một trong hai đường:
   - **Data desk** → mở quán → ô **Threads**: dán nguyên URL profile cũng được,
     `normalizeThreads` bóc handle ra khi rời ô; nút **Open profile ↗** ngay
     cạnh là để làm lại bước 3 lần cuối trước khi lưu.
   - **SQL trực tiếp** (`update places set threads_handle = … where slug = …`):
     trigger `stamp_threads_handle` chuẩn hoá đúng cùng một kiểu, nên dán
     nguyên URL vào SQL cũng ra handle trần.

   Hình dạng lưu: `^[a-z0-9._]{1,30}$` — luật username của Instagram (cho phép
   dấu chấm, tối đa 30 ký tự), *không phải* luật handle hồ sơ người dùng của
   app.

## Cách xác minh khi không mở được threads.com

Sandbox của Claude Code on the web chặn toàn bộ domain của Meta (threads.com,
instagram.com, facebook.com) ở tầng egress proxy — cả browser lẫn WebFetch đều
nhận 403 ở bước CONNECT. Khi đó vẫn xác minh được gián tiếp bằng web search
giới hạn trong `threads.com`: nếu kết quả trả về trang profile
(`threads.com/@handle`) hoặc một bài **do chính tài khoản đó đăng**
(`threads.com/@handle/post/...`) thì tài khoản chắc chắn tồn tại.

Lưu ý giới hạn: cách này **chính xác nhưng không đầy đủ**. Threads được index
rất thưa — chính `@rehabstationsaigon` (đã biết là có thật) cũng không ra kết
quả nào. Nên "không tìm thấy" chỉ có nghĩa là chưa xác minh được, không có
nghĩa là không tồn tại. Chỉ một lần mở thật trang profile trên mạng bình thường
mới kết luận được phủ định.

## Đã xác minh nhưng chưa có trong catalog

- **L'Usine** (Lê Lợi, Sài Gòn) — `lusinespace`, xác minh bằng bài đăng của
  chính tài khoản (08/2026). Quán chưa có trong catalog; khi nào nhập quán thì
  điền handle luôn.

## Còn lại trong PR #417

Nhánh nghiên cứu đó còn hai thứ chưa vớt, nằm nguyên trong PR để khai quật khi
cần:

- `data/scripts/verify-threads.mjs` — script Playwright mở thật từng profile để
  phân biệt profile sống / 404 / tường đăng nhập. Không chạy được trong sandbox
  của Claude (Meta bị chặn) — cần mạng thường.
- Sáu lead handle Instagram chưa xác minh Threads: Chill Skybar
  (`chill_skybar`), Broma (`broma.not.a.bar`), Secret Garden
  (`secretgardenvn`), SHIN Heritage (`shincaphevn`), Social Club Rooftop
  (`socialclubsaigon`), Bâng Khuâng Café (`bangkhuangcafe`) — cộng ghi chú
  rằng tài khoản Việt Nam của Cộng Cà Phê chưa pin được.
