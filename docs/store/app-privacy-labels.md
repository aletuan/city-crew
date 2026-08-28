# App Privacy — câu trả lời cho App Store Connect

Bảng "App Privacy" (nutrition labels) điền một lần trong App Store Connect.
Mỗi câu trả lời dưới đây bám vào mã nguồn thật; khi hành vi của app đổi,
tài liệu này phải đổi theo **trước** khi bản build mới được nộp.

## Tổng quát

- **Do you or your third-party partners collect data from this app?** → **Yes**
  (email + nội dung người dùng có được thu thập).
- **Tracking (ATT)** → **No**. Không quảng cáo, không chia sẻ dữ liệu cho bên
  thứ ba phục vụ tracking → không cần App Tracking Transparency.

## Khai từng loại dữ liệu

| Loại dữ liệu (Apple) | Thu thập? | Liên kết danh tính? | Dùng để tracking? | Mục đích |
|---|---|---|---|---|
| Contact Info → Email Address | **Yes** | Yes (email là tài khoản) | No | App Functionality |
| User Content → Photos or Videos | **Yes** (ảnh đại diện tự chọn) | Yes | No | App Functionality |
| User Content → Other User Content | **Yes** (bộ sưu tập, kế hoạch, lưu/thích, đề xuất địa điểm, hồ sơ) | Yes | No | App Functionality |
| Location (Precise/Coarse) | **No** | — | — | Vị trí chỉ đọc trên máy để chọn thành phố gần nhất; **không bao giờ gửi lên server** → theo định nghĩa của Apple là *không thu thập* |
| Identifiers (User ID) | **Yes** (id tài khoản Supabase) | Yes | No | App Functionality |
| Identifiers (Device ID) | **No** | — | — | Không đọc advertising ID / định danh thiết bị |
| Usage Data | **No** | — | — | `place_events` là opt-in và mặc định tắt — nhưng vì *có thể* bật, nếu muốn tuyệt đối an toàn có thể khai "Product Interaction — linked — App Functionality"; khuyến nghị: khai mục này là **Yes/linked** cho chắc chắn |
| Diagnostics | **No** | — | — | `STARTUP_TRACE_UPLOAD` tự tắt trên channel `production` (lib/channel.ts) — bản App Store không gửi telemetry |
| Purchases / Financial / Health / Contacts / Browsing / Search history bên ngoài app | **No** | — | — | Không tồn tại trong app |

**Ghi chú Usage Data:** lời khuyên cuối cùng là khai `Product Interaction`
(linked to identity, App Functionality) vì tính năng lịch sử xem địa điểm tồn
tại dù mặc định tắt — Apple không có khái niệm "opt-in nên khỏi khai", và khai
thừa một mục an toàn hơn bị reviewer bắt thiếu.

## Các URL cần điền

- Privacy Policy URL: `https://aletuan.github.io/city-crew/privacy.html`
- Support URL: `https://aletuan.github.io/city-crew/support.html`

## Điều kiện phải giữ để bảng này còn đúng

1. Vị trí tiếp tục chỉ xử lý on-device (không thêm query gửi toạ độ lên server).
2. `STARTUP_TRACE_UPLOAD` tiếp tục đọc channel — nếu có ngày ép bật cả production,
   phải khai thêm Diagnostics → Performance Data (not linked).
3. Không thêm SDK quảng cáo/analytics nào mà chưa cập nhật bảng.
