# Tìm trang Threads của quán

Ghi chú cách tìm trang chủ Threads cho các địa điểm trong `data/seeds/candidates.json`.
Handle đã tra được nằm ở `data/seeds/socials.json`; script kiểm tra là
`data/scripts/verify-threads.mjs`.

## Quy tắc: handle Threads = handle Instagram

Threads không có hệ thống tài khoản riêng — mỗi tài khoản Threads **là** một tài khoản
Instagram, dùng chung username. Nên trang chủ Threads luôn là:

```
https://www.threads.com/@<handle Instagram>
```

Ví dụ trong đề bài: Rehab Station có Instagram `@rehabstationsaigon`, và trang Threads
đúng bằng `https://www.threads.com/@rehabstationsaigon`.

Vậy bài toán "tìm trang Threads" rút gọn thành "tìm handle Instagram" — việc dễ hơn
nhiều, vì Instagram được Google index tốt còn Threads thì không.

Hệ quả duy nhất cần nhớ: có handle Instagram **chưa chắc** có trang Threads. Nếu chủ
quán chưa bật Threads, URL trên sẽ 404. Đó là thứ duy nhất phải kiểm tra thật.

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

- **Handle khác nhau giữa các nền tảng.** The Workshop Coffee là `theworkshopcoffee`
  trên Instagram nhưng `the.workshop.coffee` trên Facebook. Lấy handle từ Facebook rồi
  ghép vào URL Threads sẽ ra trang sai hoặc 404.
- **Chuỗi có handle riêng theo từng nước.** Cộng Cà Phê có `congcaphe.ca` (Canada) và
  `congcaphe.tw` (Đài Loan) đều đang hoạt động trên Threads. Đừng mặc định `congcaphe`
  là tài khoản Việt Nam.

## Quy trình

1. **Tra handle Instagram** bằng web search: `<tên quán> <đường/quận> Instagram official`.
   Kết quả trả về URL `instagram.com/<handle>` kèm bio và số follower để đối chiếu
   đúng chi nhánh — dữ liệu này index tốt và đáng tin.
2. **Ghép thành URL Threads**: `https://www.threads.com/@<handle>`.
3. **Kiểm tra tài khoản có tồn tại trên Threads không** bằng `verify-threads.mjs`.

```bash
cd data
npm install                    # cần playwright
npm run verify-threads         # in kết quả
node scripts/verify-threads.mjs --write             # ghi lại threads_status
node scripts/verify-threads.mjs --only okkio-caffe  # kiểm tra một quán
```

Script mở thật trang `threads.com/@handle` bằng Chromium và đọc dòng follower — dòng
này chỉ render trên profile có thật, nên phân biệt được profile thật với trang 404 và
với tường đăng nhập. Nó chỉ ghi đè `threads_status` khi kết quả rõ ràng
(`confirmed`/`missing`); `inconclusive` và `error` nghĩa là phép kiểm tra hỏng, không
phải tài khoản không tồn tại.

## Cách xác minh khi không mở được threads.com

Sandbox của Claude Code on the web chặn toàn bộ domain của Meta
(threads.com, instagram.com, facebook.com) ở tầng egress proxy — cả browser lẫn
WebFetch đều nhận 403 ở bước CONNECT. Khi đó vẫn xác minh được gián tiếp bằng web
search giới hạn trong `threads.com`: nếu kết quả trả về trang profile
(`threads.com/@handle`) hoặc một bài **do chính tài khoản đó đăng**
(`threads.com/@handle/post/...`) thì tài khoản chắc chắn tồn tại.

Lưu ý giới hạn: cách này **chính xác nhưng không đầy đủ**. Threads được index rất
thưa — chính `@rehabstationsaigon` (đã biết là có thật) cũng không ra kết quả nào.
Nên "không tìm thấy" chỉ có nghĩa là chưa xác minh được, không có nghĩa là không tồn
tại. Chỉ `verify-threads.mjs` chạy trên mạng bình thường mới kết luận được phủ định.
