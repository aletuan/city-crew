# App Privacy + Age Rating — câu trả lời cho App Store Connect

Điền một lần trong App Store Connect. Mỗi câu trả lời dưới đây bám vào mã nguồn
thật; khi hành vi của app đổi, tài liệu này phải đổi theo **trước** khi bản build
mới được nộp.

## Tổng quát

- **Do you or your third-party partners collect data from this app?** → **Yes**
- **Tracking (ATT)** → **No**. Không quảng cáo, không chia sẻ dữ liệu cho bên thứ
  ba phục vụ tracking → không cần App Tracking Transparency.

## Khai từng loại dữ liệu

| Loại dữ liệu (Apple) | Thu thập? | Liên kết danh tính? | Tracking? | Mục đích |
|---|---|---|---|---|
| Contact Info → Email Address | **Yes** | Yes (email là tài khoản) | No | App Functionality |
| User Content → Photos or Videos | **Yes** (ảnh đại diện tự chọn) | Yes | No | App Functionality |
| User Content → Other User Content | **Yes** (bộ sưu tập, kế hoạch, lưu/thích, đề xuất địa điểm, hồ sơ, **văn bản mô tả buổi tối gửi cho planner**) | Yes | No | App Functionality |
| Identifiers → User ID | **Yes** (id tài khoản Supabase) | Yes | No | App Functionality |
| Usage Data → Product Interaction | **Yes** | Yes | No | App Functionality (xem ghi chú) |
| Location (Precise/Coarse) | **No** | — | — | Vị trí chỉ đọc trên máy để chọn thành phố gần nhất; **không bao giờ gửi lên server** → theo định nghĩa của Apple là *không thu thập* |
| Identifiers → Device ID | **No** | — | — | Không đọc advertising ID / định danh thiết bị |
| Diagnostics | **No** | — | — | `STARTUP_TRACE_UPLOAD` tự tắt trên channel `production` (`lib/channel.ts`) — bản App Store không gửi telemetry |
| Purchases / Financial / Health / Contacts / Browsing / Search history ngoài app | **No** | — | — | Không tồn tại trong app |

**Ghi chú Usage Data:** khai `Product Interaction` (linked, App Functionality) vì
tính năng lịch sử xem địa điểm tồn tại, dù mặc định tắt và người dùng phải tự
bật. Apple không có khái niệm "opt-in nên khỏi khai"; khai thừa một mục an toàn
hơn bị reviewer bắt thiếu.

## Bên thứ ba: trợ lý AI trong tính năng Kế hoạch

Đây là điểm dễ bị bỏ sót nhất và là thứ Apple soi kỹ.

**Chuyện gì xảy ra:** `app/src/lib/assist.ts` gọi edge function `plan-assist`,
function này gọi model Claude của Anthropic (`ANTHROPIC_API_KEY` trong Edge
Function settings). Hai luồng:

| Action | Gửi đi cái gì |
|---|---|
| `narrate` | Các điểm dừng **app đã tự chọn** (tên, khu vực, giờ, đánh giá) + câu trả lời wizard (đi với ai, khi nào, thể loại) |
| `parse` | **Văn bản người dùng tự gõ** (giới hạn `MAX_TEXT`), để chuyển thành câu trả lời wizard |

**Không gửi đi:** tên, email, id tài khoản, vị trí. Model không bao giờ được chọn
địa điểm — schema đầu ra khoá cứng bằng `enum` các slug đã gửi, và code lọc lại
lần nữa.

**Hệ quả cho hồ sơ:**

1. **Privacy policy bắt buộc phải nêu** — đã có mục "Plans are written with an AI
   assistant" / "Kế hoạch được viết bằng trợ lý AI" trong `privacy.html`. Apple
   yêu cầu nêu rõ khi chia sẻ dữ liệu người dùng với bên thứ ba, và từ 2025 có
   quy định riêng cho việc chia sẻ với AI bên thứ ba.
2. **Nhãn App Privacy**: nằm trong `User Content → Other User Content` đã khai ở
   trên (văn bản người dùng gõ). Không cần mục riêng, nhưng phải khai mục đó.
3. **Review notes** phải nói trước cho reviewer — xem `review-notes.md`.

## Age Rating — trả lời trung thực, đừng nhắm 4+

Bảng câu hỏi mới của Apple (hệ 4+/9+/13+/16+/18+) hỏi về hai thứ app này đều có.
Đừng cố ép xuống 4+: khai sai bị phát hiện thì gỡ app, mà lợi ích thì gần như
không có.

**1. Nội dung do người dùng tạo / tính năng xã hội** — app có: bộ sưu tập công
khai, hồ sơ công khai, kết bạn, mời bạn vào chuyến đi. Khai **có**, và khai kèm
các biện pháp kiểm soát đã tồn tại:

- Địa điểm qua ban biên tập duyệt trước khi hiển thị (`review_status`)
- Báo cáo nội dung ngay trong app (bảng `reports`, hàng đợi cho desk)
- Chặn người dùng (bảng `blocks`)
- Xoá tài khoản trong app, có hiệu lực ngay

**2. Generative AI** — app có: tiêu đề kế hoạch và một dòng mô tả mỗi điểm dừng
do model viết. Khai **có**, kèm sự thật quan trọng: đầu ra bị ràng buộc chặt
(model chỉ được viết về những địa điểm thuật toán đã chọn từ danh mục đã duyệt,
schema khoá bằng enum), **không phải chatbot tự do**.

**Không có trong app** (trả lời "không"): cờ bạc, nội dung người lớn, rượu/thuốc
lá như chủ đề chính, bạo lực, truy cập web không giới hạn, mua hàng trong app.

**Kỳ vọng thực tế: 13+**, do có nội dung người dùng tạo và AI sinh nội dung. Đó
là mức bình thường cho app dạng này.

## Các URL cần điền

- Privacy Policy URL: `https://aletuan.github.io/city-crew/privacy.html`
- Support URL: `https://aletuan.github.io/city-crew/support.html`
- Điều khoản sử dụng: `https://aletuan.github.io/city-crew/terms.html` — App Store
  Connect không có ô "Terms of Service" riêng ngoài EULA, nên dán URL này vào
  **License Agreement → Custom EULA** (hoặc ô "Terms of Use (EULA)" trong phần
  App Information). Guideline 1.2 đòi app có nội dung người dùng tạo phải nêu rõ
  điều gì không được phép; màn Đăng ký đã trỏ tới cả URL này lẫn URL bảo mật.

## Điều kiện phải giữ để tài liệu này còn đúng

1. Vị trí tiếp tục chỉ xử lý on-device (không thêm query gửi toạ độ lên server).
2. `STARTUP_TRACE_UPLOAD` tiếp tục đọc channel — nếu có ngày ép bật cả
   production, phải khai thêm Diagnostics → Performance Data. (`STARTUP_TRACE`,
   cờ log console, cũng đọc cùng channel; nó không rời khỏi máy nên không đụng
   tới nhãn, nhưng bật nó ở production thì bản App Store ghi log launch vào log
   hệ điều hành.)
3. Không thêm SDK quảng cáo/analytics nào mà chưa cập nhật bảng.
4. Nếu `plan-assist` bắt đầu gửi thêm dữ liệu (vị trí, id tài khoản, lịch sử) hay
   đổi sang chatbot tự do, phải sửa cả privacy policy, nhãn App Privacy và age
   rating **trước** khi nộp bản build đó.
