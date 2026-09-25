# Notes for App Review — dán vào App Store Connect → App Review Information

Phần "Notes" này viết cho reviewer của Apple đọc (tiếng Anh). Kèm giải thích
tiếng Việt bên dưới về vì sao từng đoạn tồn tại.

## Điều kiện bắt buộc trước khi dán khối dưới đây

Khối Notes **khẳng định** hai thứ. Dán nó trước khi hai thứ đó thành sự thật
là nói dối reviewer — và cả hai đều đã từng sai trong chính file này.

1. **Ô Sign-In Information phải chứa thông tin đăng nhập dùng được.**
   Câu "demo credentials are in the Sign-In Information fields above" là câu
   Apple hành động ngay: họ mở app, đăng nhập, và nếu không đăng nhập được
   thì đó là guideline 2.1 — từ chối, không thương lượng. Khối này từng
   khẳng định câu đó trong khi ô còn trống — cái sai nằm ở đó, không phải ở
   chuyện tài khoản "demo" hay tài khoản thật. **Không cần một tài khoản
   demo riêng**: một tài khoản thật được chọn làm demo là đủ, và đó là cách
   project này làm.

   Hai điều nên tránh khi chọn tài khoản ấy: đừng dùng tài khoản cá nhân —
   reviewer đăng nhập sẽ thấy bạn bè và trips thật; và đừng đặt mật khẩu
   trùng với mật khẩu đang dùng ở nơi khác — giá trị này nằm dạng chữ
   thường trong App Store Connect.

   Kiểm tra trước khi dán — query phải trả về đúng 1 dòng với địa chỉ đã
   chọn, và bạn phải tự đăng nhập được bằng nó trên bản TestFlight:

   ```sql
   select email, created_at from auth.users
   where email = '<địa chỉ demo>' and encrypted_password is not null;
   ```

2. **Đăng nhập phải vẫn là email + mật khẩu.** Nếu có ngày chuyển sang OTP
   không mật khẩu thì cả đoạn SIGN-IN lẫn `privacy.html` phải đổi *trước*
   bản build đó — chiều ngược lại đã xảy ra một lần và sống sót nhiều tháng.

## Notes (dán nguyên văn)

```
Thank you for reviewing City Crew. Free app: no in-app purchases,
subscriptions or paid content (confirmed in our 2.1(b) reply on 1.0 (6)).

SIGN-IN: Every content screen (Explore, Collections, place pages, Search,
the map) works signed out. An account adds saving, collections, trip plans
and friends. Accounts are an email address and a password; the credentials
in the Sign-In Information fields above are a working account with saved
places, collections and a trip. Sign-up creates the account at the end of
a short form; addresses are auto-confirmed, so no emailed code is needed.
If the account gives you any trouble: anhlt1983@gmail.com.

LOCATION: Requested once, used on the device to open the nearest supported
city, to sort places by distance ("nearest first"), to centre the map and
to pick a trip's start point. Denying it is fine — the app falls back to
Ho Chi Minh City, and the city is changed by hand at Profile > Current
city. Coordinates are never transmitted to us or stored.

MAPS: Google Maps SDK draws the maps (Explore map mode, place pages, the
trip start sheet). Google Places search and Geocoding are called from our
own server for the start-point search only; a pin's coordinates are sent,
never the user's location.

PRICES: Places carry a typical spend for information (what the venue
charges, not us). In this build the price row is hidden by default behind
a server-side flag, so you may not see one.

AI: Plan titles and the one-line note under each stop are written by a
language model (Anthropic's Claude) from our own server. The model never
chooses a place: it receives the stops our algorithm already selected from
the editor-approved catalog, and its output is restricted to exactly those
places. No personal data is sent — no name, email, account id or location.
Disclosed in our privacy policy.

USER-GENERATED CONTENT (guideline 1.2): Every catalog place is approved by
our editorial desk before publication. Some place descriptions quote a
sentence or two from a public post about that place; the author's name and
a link to the post are shown with the quote. "Local guides" — accounts our
desk has individually granted the role, per city — can add photos to
places they submitted, and only to those; the desk can hide any photo and
the guide cannot unhide it. User-published collections and profiles carry
in-app Report actions; users can block other users; reports go to our
moderation desk, which can unpublish content and action accounts. Account
deletion is in-app at Profile > Delete account; the same screen offers
Download your data (a JSON file handed to the system share sheet).

The app is available in English, Vietnamese and Japanese; it opens in
English and the language is changed at Profile > Language.
```

## Vì sao từng đoạn tồn tại (nội bộ, không dán)

- **SIGN-IN**: app đăng nhập bằng **email + mật khẩu**. Đoạn này từng viết
  ngược lại — "passwordless, không có demo username/password để đưa" — từ
  thời chưa có màn hình mật khẩu, và đã sai suốt từ đó. Vì có mật khẩu thật
  nên **phải điền tài khoản demo** vào ô Sign-In Information; thiếu nó là
  một trong những lý do bị từ chối phổ biến nhất. Tạo tài khoản bằng email
  bạn kiểm soát, đăng nhập thử một lần trên bản TestFlight, rồi điền đúng
  cặp email/mật khẩu đó.

  Mã một lần vẫn còn, nhưng ở hai chỗ khác: xác nhận email lúc đăng ký (chỉ
  chạy khi bật "Confirm email" trong Supabase — hiện **đang tắt**, nên đăng
  ký xong là vào thẳng) và khôi phục mật khẩu. Cả hai gửi **mã số** chứ
  không phải link, vì link không deep-link ngược vào app được.
- **LOCATION**: chặn trước câu hỏi "xin quyền để làm gì" — nêu rõ on-device,
  từ chối vẫn dùng được (đúng hành vi thật: fallback + switcher).
- **UGC**: guideline 1.2 là lý do từ chối phổ biến với app có nội dung người
  dùng; đoạn này chỉ thẳng vào bốn yêu cầu (lọc, report, block, cách liên hệ)
  và nơi mỗi thứ nằm trong app. Từ 1.0.4 có thêm hai thứ reviewer sẽ thấy và
  phải được nói trước: **trích dẫn có ghi nguồn** trong mô tả địa điểm
  (#650/#651 — tên tác giả + link về bài Threads; nói rõ là trích dẫn để
  không bị đọc thành nội dung sao chép, guideline 5.2.1) và **local guide**
  upload ảnh (#614/#616/#646 — desk cấp quyền từng người, từng thành phố;
  chỉ ảnh cho place họ tự đưa vào; desk ẩn được, guide không bỏ ẩn được).
  Câu "only to those" và "cannot unhide" là hai ranh giới reviewer cần để
  không hỏi thêm về kiểm duyệt.
- **MAPS / PRICES**: hai đoạn mới. MAPS thay câu "No Google Maps SDK is
  bundled" của thư 2.1 cũ — đã sai từ #525. PRICES tồn tại vì lần 2.1(b)
  reviewer đọc dòng giá thành paid content; giờ giá **ẩn sau cờ
  `app_flags.place_price`** (#597, mặc định tắt) nên nói trước để reviewer
  không thắc mắc vì sao Notes cũ nhắc giá mà app không có.
- **LOCATION**: bản 1.0.3 chỉ nói "nearest city"; giờ location còn dùng cho
  sort nearest-first, căn giữa map và điểm bắt đầu trip — kể đủ, vì reviewer
  thấy prompt xin quyền ở nhiều màn hơn.
- **AI**: nêu trước để reviewer không phải tự phát hiện app có gọi model — và
  để nói rõ ngay hai điều họ sẽ hỏi: model không tự bịa địa điểm, và không có
  dữ liệu cá nhân nào được gửi đi. Cùng nội dung với mục AI trong privacy
  policy; hai chỗ phải luôn khớp nhau.
- **Ngôn ngữ**: để reviewer (thường dùng máy tiếng Anh) không bối rối khi
  screenshots tiếng Việt. Đoạn này từng viết app "follows the device
  language" — **sai**. Không có `expo-localization` ở đâu trong repo;
  `lib/i18n.tsx` khởi tạo `useState<Lang>('en')` rồi chỉ đọc lựa chọn đã lưu
  trong AsyncStorage. App luôn mở bằng tiếng Anh cho tới khi người dùng tự
  đổi ở Cá nhân → Ngôn ngữ. Nói với reviewer rằng app theo ngôn ngữ máy là
  hứa một hành vi không tồn tại, và là loại câu họ kiểm được trong ba giây.
- **Vì sao hai câu sai cùng lúc**: cả hai đều mô tả hành vi *chưa từng được
  kiểm lại sau khi viết*. Mục "Điều kiện bắt buộc" ở đầu file tồn tại vì
  thế: khối Notes là khối duy nhất trong repo khẳng định điều gì đó về thế
  giới bên ngoài mã nguồn, nên nó cần một bước kiểm trước khi dán.

## Checklist trước khi bấm Submit

1. **Tài khoản demo đã tồn tại** (câu truy vấn ở đầu file trả về 1 dòng) và
   đã tự đăng nhập được bằng đúng cặp email/mật khẩu đó trên bản TestFlight,
   rồi điền vào Sign-In Information. Không có nó thì đừng dán khối Notes.
2. Bản build production đã lên TestFlight và tự chạy thử ít nhất một vòng:
   mở app, browse, đăng nhập, lưu, tạo collection, report thử, xoá tài khoản
   bằng một tài khoản nháp. Từ 1.0.4 thêm: mở city sheet và bấm vào **từng**
   thành phố — một thành phố active mà trống (Hải Phòng lúc viết) là thứ
   reviewer bấm đầu tiên; tắt `is_active` trước khi nộp.
2b. Số thành phố trong Description (ba bản), Keywords và Notes khớp với câu
   SQL ở `listing.md` → "Phạm vi phủ". Bản 1.0.3 đã nộp với "five Vietnamese
   cities" trong khi DB có tám — guideline 2.3, và may là chưa bị hỏi.
3. Privacy Policy URL, Terms URL và Support URL (GitHub Pages) mở được từ trình
   duyệt ẩn danh — reviewer mở chúng từ listing, không phải từ app: hai văn bản
   đầu giờ **đọc được ngay trong app** (dưới nút Đăng ký, và Cá nhân → Tuỳ chọn),
   dựng từ cùng một nguồn với hai trang web nên không thể lệch nhau.
4. Bảng App Privacy đã điền đúng theo `app-privacy-labels.md` — kể cả mục
   **Google Maps SDK** ở cuối file đó, và mục dịch vụ bên thứ ba trong Notes
   không còn nói "No Google Maps SDK is bundled" hay nhắc Photon/Nominatim.
5. Screenshots đủ cỡ 6.9" cho ít nhất locale en-US.
6. Hai cờ trace không cần đụng — cả `STARTUP_TRACE` (log console) lẫn
   `STARTUP_TRACE_UPLOAD` (gửi lên `startup_traces`) đều tự tắt trên channel
   `production`, nên bản App Store không log và không gửi gì.
