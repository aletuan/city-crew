# Check-in live trên Explore

Chủ dự án, 27/11/2026. Dải "Hoạt động nổi bật" (`explore/CheckinShelf`) chỉ
đổi khi app tải lại: kéo xuống, quay lại app sau hơn 2 phút
(`lib/stale`), đổi thành phố, mở lại app. Một lượt tim hay một check-in
mới không tới màn hình của người đang xem cho tới lúc đó.

Từ nay server tự đẩy thay đổi về máy đang mở Explore. Một PR làm một bước
dưới đây thì đánh dấu bước đó ở đây, trong cùng PR.

## Hiện trạng (đo ngày 27/11/2026)

- App chưa dùng Supabase Realtime ở đâu: đây là hạ tầng mới.
- Gói Supabase: **Pro**. Chưa kiểm spend cap đang bật hay tắt.
- 7 ngày gần nhất trên live: 21 check-in, 33 lượt tim, 19 ảnh, 8 người
  check-in, 154 tài khoản.
- `featured_checkins('hcmc')`: khoảng 95 ms trên server cho 6 thẻ
  (`explain analyze`, chưa tính đường truyền).
- Một check-in ở trên dải tối đa 7 ngày kể từ lúc check-in.

## Quyết định

1. **Realtime Broadcast từ trigger trong database**, kênh theo thành phố
   (`highlights:<city>`). Đã cân và loại:
   - *Hỏi lại định kỳ (polling 60 giây)*: không live, và mỗi người đang
     mở Explore tốn một lần gọi 95 ms mỗi phút dù không có gì đổi.
   - *Postgres Changes trên bảng `checkins`*: mỗi thay đổi phải kiểm RLS
     cho từng người nghe, app phải tự tính lại thứ tự dải, và dễ lộ dữ
     liệu nếu RLS của bảng không khớp hoàn toàn luật của dải.
2. **Hai loại tín hiệu.**
   - *Tim* (thả, bỏ): tín hiệu mang `{place_id, delta: ±1}`. App cộng trừ
     tại chỗ, **không gọi server**. Số tim của check-in công khai không
     phải dữ liệu riêng tư; tín hiệu không mang tên ai.
   - *Cấu trúc* (check-in công khai mới, sửa ghi chú, đổi đối tượng xem,
     xoá, desk ẩn, ảnh thêm hoặc bị ẩn): tín hiệu **rỗng**. App gọi lại
     `featured_checkins`, nên mọi luật hiển thị (`checkin_seen`, chặn, ẩn)
     vẫn do server quyết như bây giờ.
3. **Kênh riêng tư**, chỉ người đã đăng nhập nghe được (chính sách trên
   `realtime.messages`), khớp với việc dải chỉ hiện cho người đăng nhập.
4. **Chỉ nghe khi Explore đang mở và app ở foreground.** Rời màn hình
   hoặc app xuống nền thì rời kênh. Số kết nối bằng số người đang xem
   dải, không phải số người đã cài app.
5. **Hiển thị**: thứ gì nằm gọn trong một thẻ thì đổi ngay; thứ gì làm
   các thẻ dịch chỗ thì chờ người dùng.

   | Thay đổi | Hiển thị |
   |---|---|
   | Tim | Tại chỗ: số tim nhảy (hiệu ứng sẵn có của `LikeHeart`) |
   | Người mới ghé quán đang có thẻ | Tại chỗ: avatar vào đầu chồng, "+N" tăng |
   | Sửa ghi chú, đổi ảnh | Tại chỗ |
   | Quán mới lên dải, thứ tự đổi | Nhãn "Có hoạt động mới"; chạm thì dải cuộn về đầu và xếp lại |
   | Check-in rời dải vì riêng tư, xoá, bị ẩn | Gỡ ngay, kể cả khi dải xê dịch: quyền riêng tư đứng trên bố cục |

6. **Số tim live có thể lệch nhẹ** (ví dụ tim trên lần ghé của người đã
   chặn người xem vẫn được cộng). Nó tự khớp ở lần gọi
   `featured_checkins` kế tiếp. Chấp nhận, vì đổi lại tim không tốn
   database.
7. **Lệch giờ khi gọi lại**: mỗi máy chờ ngẫu nhiên 0–3 giây trước khi
   gọi `featured_checkins` sau một tín hiệu cấu trúc, và gom các tín hiệu
   tới trong lúc chờ thành một lần gọi.
8. **Sau cờ `checkin_live`**, tắt được từ xa mà không cần bản build.
9. **Trang quán không live** (chủ dự án, 27/11/2026). "Đánh giá từ khách"
   giữ cách tải hiện tại; bản này chỉ làm dải trên Explore.
10. **Chính sách riêng tư không đổi** (chủ dự án, 27/11/2026): live không
    thu thêm dữ liệu nào.
11. **Mất kết nối**: dải giữ nguyên những gì đang hiện cho tới khi kết
    nối lại (chủ dự án, 27/11/2026); không báo lỗi, không làm mờ. Khi vào
    lại kênh, gọi `featured_checkins` một lần để bù những gì đã lỡ.
12. **Giảm chuyển động** (cài đặt trợ năng của máy): số tim đổi thẳng,
    avatar hiện ngay, chạm nhãn thì dải nhảy về đầu chứ không cuộn mượt,
    như `LikeHeart` đã làm với `useReducedMotion`.

## Chi phí

Giá Supabase (trang giá Realtime, đọc ngày 27/11/2026): Pro có sẵn 5
triệu tin mỗi tháng, vượt mức $2.50 mỗi triệu; 500 kết nối đỉnh, vượt mức
$10 mỗi 1.000. Một tin broadcast tính một lần gửi cộng một lần cho mỗi
máy nhận, nên **số tin = số sự kiện × (1 + số người đang nghe)**.

**Giả định, không phải số đo**: mỗi người dùng hằng ngày thả 0,5 tim và
tạo 0,1 sự kiện cấu trúc mỗi ngày; 2–3% người dùng hằng ngày đang mở
Explore cùng thành phố lúc có sự kiện.

| Người dùng hằng ngày | Sự kiện/tháng | Người nghe | Tin/tháng | Realtime/tháng |
|---|---|---|---|---|
| Hiện tại | ~250 | ~2 | dưới 1 nghìn | $0 |
| 1.000 | 18 nghìn | 30 | ~0,6 triệu | $0 |
| 10.000 | 180 nghìn | 200 | ~36 triệu | ~$78 |
| 50.000 | 900 nghìn | 1.000 | ~900 triệu | ~$2.240 |

## Hiệu năng và các ngưỡng

- **Tim**: mỗi lượt tim thêm một lần ghi tín hiệu trong trigger. Chưa đo;
  đo ở bước L1 và ghi con số vào đây.
- **Tín hiệu cấu trúc** là chỗ nặng: mọi máy đang nghe gọi lại hàm 95 ms.
  200 người nghe là 19 giây CPU trong vài giây. `featured_checkins` hiện
  gọi `_featured_visits` ba lần cho mỗi quán; tối ưu được (bước L5).
- **Trần của gói**: Pro 500 tin mỗi giây và 500 kết nối; tắt spend cap
  thì 2.500 và 10.000. Ở 10.000 người dùng hằng ngày, 2 lượt tim trong
  một giây × 300 người nghe đã chạm 500.

Hai việc để dành, làm khi tới ngưỡng chứ không làm trước:

| Ngưỡng | Việc |
|---|---|
| ~1.000 người dùng hằng ngày, hoặc p95 của hàm trên 150 ms | L5: tối ưu `featured_checkins` |
| Tin Realtime vượt 3 triệu/tháng, hoặc chạm trần tin mỗi giây | L6: gom tim theo nhịp 10 giây mỗi thành phố (ở mức 50.000: ~$2.240 xuống ~$600) |

## Các bước

- [ ] **L0. Kiểm trước khi làm.** Spend cap của tổ chức; Realtime đã bật
  cho dự án; `realtime.send` gọi được từ trigger trên Postgres 17 của dự
  án; chính sách kênh riêng tư. Ghi kết quả vào mục Hiện trạng.
- [ ] **L1. Server.** Migration: trigger trên `checkin_likes` (tim, có
  `place_id` và `delta`), trên `checkins` và `checkin_photos` (cấu trúc,
  rỗng). Chỉ phát cho check-in công khai, hoặc vừa rời công khai. Chính
  sách `realtime.messages` cho kênh `highlights:*`. Test SQL: đúng kênh,
  đúng loại, không phát cho check-in riêng tư, tín hiệu không mang
  `user_id`. Đo thời gian thêm vào mỗi lượt tim.
- [ ] **L2. App: tim live.** `useHighlightsLive` trong
  `screens/explore`: vào kênh khi Explore focus và app foreground, rời
  khi không. Tim cộng trừ tại chỗ; lượt tim của chính mình không cộng hai
  lần. Cờ `checkin_live`.
- [ ] **L3. App: cấu trúc live.** Chờ lệch 0–3 giây, gom tín hiệu, gọi
  lại, so với dải đang hiện: đổi tại chỗ, gỡ ngay, hoặc bật nhãn "Có hoạt
  động mới". Nhãn chạm thì cuộn về đầu và xếp lại.
- [ ] **L4. Bật cờ**, sau khi chủ dự án thử trên hai máy: một máy thả tim
  và check-in, máy kia nhìn dải đổi.
- [ ] **L5. Tối ưu `featured_checkins`** (khi tới ngưỡng).
- [ ] **L6. Gom tim** (khi tới ngưỡng).
