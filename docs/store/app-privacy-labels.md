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
| User Content → Photos or Videos | **Yes** (ảnh đại diện tự chọn; từ 1.0.4 thêm ảnh địa điểm do local guide upload, #614) | Yes | No | App Functionality |
| User Content → Other User Content | **Yes** (bộ sưu tập, kế hoạch, lưu/thích, đề xuất địa điểm, hồ sơ, **văn bản mô tả buổi tối gửi cho planner**) | Yes | No | App Functionality |
| Identifiers → User ID | **Yes** (id tài khoản Supabase) | Yes | No | App Functionality |
| Usage Data → Product Interaction | **Yes** | Yes | No | App Functionality (xem ghi chú) |
| Location (Precise/Coarse) | **No — xem lại trước lần nộp tới** | — | — | Trên máy: chọn thành phố gần nhất, sắp theo khoảng cách. **Rời máy ở một chỗ**: màn "Bắt đầu từ đâu?" khi chưa có ghim gửi vị trí qua `fetch-place` tới Google Geocoding/Places; server của mình chuyển tiếp, không lưu. Định nghĩa *collect* của Apple là truyền ra khỏi máy **và** giữ lâu hơn thời gian phục vụ yêu cầu: phía mình vẫn là không thu thập, phía Google tuỳ điều khoản Google Maps Platform — xem mục Google Maps SDK. Câu cũ ở ô này ("không bao giờ gửi lên server") sai, phát hiện 26/09 |
| Identifiers → Device ID | **No** | — | — | Không đọc advertising ID / định danh thiết bị |
| Diagnostics | **No** | — | — | `STARTUP_TRACE_UPLOAD` tự tắt trên channel `production` (`lib/channel.ts`) — bản App Store không gửi telemetry |
| Purchases / Financial / Health / Contacts / Browsing / Search history ngoài app | **No** | — | — | Không tồn tại trong app |

**Ghi chú Usage Data:** khai `Product Interaction` (linked, App Functionality) vì
tính năng lịch sử xem địa điểm tồn tại. Apple hỏi app **có thu thập loại dữ liệu
đó không**, không hỏi trạng thái mặc định — nên câu trả lời không phụ thuộc vào
việc công tắc bật hay tắt sẵn.

Đó là lý do **bảng trên không đổi một ô nào** khi mặc định chuyển từ tắt sang
bật (migration `20260829120000_history_on_by_default.sql`): cùng loại dữ liệu,
cùng liên kết danh tính, cùng mục đích, vẫn không tracking. Không phải điền lại
App Privacy trong App Store Connect.

Ghi chú này từng nói "dù mặc định tắt và người dùng phải tự bật" — không còn
đúng. Mặc định giờ là **bật**, màn hình đăng ký nói rõ điều đó trước khi ghi bất
cứ gì, và công tắc tắt nằm trong Sửa hồ sơ → *Nâng cao trải nghiệm cá nhân*.

**ATT vẫn là No.** Lịch sử này là dữ liệu bên thứ nhất, không rời khỏi tài khoản,
không ghép với dữ liệu của app hay website nào khác — không phải "tracking" theo
định nghĩa của Apple, dù bật sẵn.

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
  điều gì không được phép; cả hai văn bản đọc được **ngay trong app** (dưới nút
  Đăng ký, và Cá nhân → Tuỳ chọn), không cần rời app.

Hai trang HTML này **được sinh ra**, không sửa tay: nội dung nằm ở
`app/src/lib/legal.ts`, `npm run legal:build` ghi lại chúng, và
`app/scripts/legalhtml.test.ts` đỏ nếu file đã commit không khớp dữ liệu. Sửa chữ
ở `legal.ts` rồi build lại — app và web đổi cùng lúc, không có bản nào nói khác.

## Điều kiện phải giữ để tài liệu này còn đúng

1. Vị trí chỉ rời máy qua đúng hai đường đã khai trong privacy policy (mục
   "Vị trí của bạn và bản đồ"): màn Bắt đầu từ đâu? khi chưa có ghim (qua
   `fetch-place` tới Google), và chấm xanh do Google Maps SDK vẽ. Thêm đường
   thứ ba, hoặc bắt đầu *lưu* vị trí, là phải sửa policy, bảng này và khối
   Notes trong `review-notes.md` **trước** khi nộp. (Điều kiện cũ ở đây là
   "chỉ on-device" — nó đã bị phá khi chú thích dưới bản đồ bắt đầu đặt tên
   theo vị trí người dùng, và không ai thấy cho tới 26/09.)
2. `STARTUP_TRACE_UPLOAD` tiếp tục đọc channel — nếu có ngày ép bật cả
   production, phải khai thêm Diagnostics → Performance Data. (`STARTUP_TRACE`,
   cờ log console, cũng đọc cùng channel; nó không rời khỏi máy nên không đụng
   tới nhãn, nhưng bật nó ở production thì bản App Store ghi log launch vào log
   hệ điều hành.)
3. Không thêm SDK quảng cáo/analytics nào mà chưa cập nhật bảng.
4. Nếu `plan-assist` bắt đầu gửi thêm dữ liệu (vị trí, id tài khoản, lịch sử) hay
   đổi sang chatbot tự do, phải sửa cả privacy policy, nhãn App Privacy và age
   rating **trước** khi nộp bản build đó.
5. Lịch sử xem địa điểm tiếp tục ở lại trong tài khoản: chỉ chủ tài khoản đọc
   được (`owners read their events`), không hiện cho ai khác, không rời khỏi
   Supabase. Ngày nào nó được dùng để nhắm nội dung xuyên app hay chia sẻ ra
   ngoài, ATT và nhãn tracking phải được xét lại — trạng thái mặc định không
   đụng tới hai thứ đó, nhưng việc dùng dữ liệu vào đâu thì có.

## Google Maps SDK (từ 09/2026)

Bản đồ trong màn "Bắt đầu từ đâu?" là **Google Maps SDK** (iOS và Android),
không còn là Apple MapKit. SDK là mã của bên thứ ba chạy trong app và tự gọi
về Google, nên theo hướng dẫn của Apple nó tính vào bảng App Privacy của
*mình*. Trước mỗi lần nộp:

1. Đọc trang Google công bố cho Apple privacy labels của **Maps SDK for iOS**
   (mục "Data collection" trong tài liệu SDK) ở đúng phiên bản
   `react-native-maps` đang pin, vì nội dung đó đổi theo bản SDK.
2. Khai đúng những mục Google liệt kê — thường là dữ liệu chẩn đoán/hiệu năng
   và định danh thiết bị ở mức không liên kết danh tính — vào bảng ở trên.
3. Vị trí: SDK nhận toạ độ để vẽ chấm xanh. `fetch-place` nhận **vị trí người
   dùng** khi màn Bắt đầu từ đâu? mở mà chưa có ghim (`StartSheet`:
   `near = pinned ?? me`), để đặt tên đường và làm điểm ưu tiên cho ô tìm
   kiếm. Câu cũ ở đây — "toạ độ ghim (không phải vị trí người dùng)" — là
   sai; đã kiểm trong code ngày 26/09. Khi quyết dòng *Location* ở bảng trên,
   đọc cả điều khoản Google Maps Platform về việc Google giữ dữ liệu request
   bao lâu: đó là điều quyết định phía Google có tính là "thu thập" không.

Thư trả lời reviewer `review-reply-2.1.md` ghi "No Google Maps SDK is
bundled" và liệt kê Photon/Nominatim — đúng ở thời điểm gửi, sai từ #525.
**Đã viết lại** thành mục MAPS trong khối Notes của `review-notes.md` cho
1.0.4: Google Maps SDK vẽ bản đồ (Explore map, place page, start sheet);
Google Places và Geocoding qua Edge Function `fetch-place` cho tìm điểm bắt
đầu, gửi toạ độ ghim chứ không phải vị trí người dùng. **Vế cuối đó sai** —
xem mục 3 ở trên. MAPS và LOCATION trong `review-notes.md` đã viết lại ngày
26/09; nếu khối Notes cũ đã được dán cho 1.0.4 thì Apple đã nhận câu sai, và
lần nộp tới dán bản đã sửa.
