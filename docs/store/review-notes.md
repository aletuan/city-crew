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
Thank you for reviewing City Crew. Free app: no in-app purchases, subscriptions or paid content.

SIGN-IN: Every content screen (Places, Collections, place pages, Search, the map) works signed out. An account adds saving, collections, trip plans, check-ins and friends. Accounts are an email address and a password; the credentials in the Sign-In Information fields above are a working account with saved places, collections and a trip. Sign-up creates the account at the end of a short form; addresses are auto-confirmed, so no emailed code is needed. If the account gives you any trouble: anhlt1983@gmail.com.

CHECK-IN: The Check in button on a place page records a visit to the signed-in account: which place, and when. It is a tap, not a location check; the device's position is never read or sent for it. The history is at Profile > Account > Check-ins, where any visit can be removed; check-ins are in Download your data and are deleted with the account.

LOCATION: Requested once. On the device it opens the nearest supported city, sorts places by distance ("nearest first") and centres the maps. On the trip start sheet, when no pin has been dropped, the position is sent through our own server to Google Geocoding and Places, to name the street and rank search results near the user; our server relays it and stores nothing. Denying it is fine — the app falls back to Ho Chi Minh City, and the city is changed by hand at Profile > Account > Current city. The position is never stored, by us or with a saved trip.

MAPS: Google Maps SDK draws the maps and shows the user's position on them. Google Places and Geocoding are called from our own server, for the trip start sheet only (see LOCATION).

AI: Plan titles and the one-line note under each stop are written by a language model (Anthropic's Claude) from our own server. The model never chooses a place: it receives the stops our algorithm already selected from the editor-approved catalog, and its output is restricted to exactly those places. No personal data is sent — no name, email, account id or location. Disclosed in our privacy policy.

USER-GENERATED CONTENT (guideline 1.2): Every catalog place is approved by our editorial desk before publication. Some place descriptions quote a sentence or two from a public post about that place; the author's name and a link to the post are shown with the quote. "Local guides" — accounts our desk has individually granted the role, per city — can add photos to places they submitted, and only to those; the desk can hide any photo and the guide cannot unhide it. User-published collections and profiles carry in-app Report actions; users can block other users; any user may upload a photo as their profile cover, which our desk can remove from a profile report; reports go to our moderation desk, which can unpublish content and action accounts. Account deletion is in-app at Profile > Account > Delete account; the same screen offers Download your data (a JSON file handed to the system share sheet).

COMMENTS (guideline 1.2): signed-in users can comment on public collections, reply, tag friends and places, and like a comment; open any public collection and tap the speech bubble. (1) Filter: each comment is checked on our server against a banned-word list and refused if it matches; 500 characters max, 30 per user per day. (2) Report: every comment's "..." menu has Report, with a reason. (3) Block: users block each other from a profile; across a block neither sees the other's comments. (4) Action: reports reach our moderation desk, which aims to act within 24 hours and can remove the comment and suspend the account. A collection's owner can delete any comment on it and turn comments off. Our Terms and Privacy Policy cover all of this.

The app is available in English, Vietnamese and Japanese; it opens in English and the language is changed at Profile > Account > Language.
```

## Đoạn bình luận: chỉ dán vào bản nộp bật cờ `comments` (C10)

**Đã gộp vào khối Notes ở trên từ 1.0.18** (bản rút gọn, vì ô Notes của App
Store Connect giới hạn 4000 ký tự — cũng vì thế mà đoạn PRICES đã bỏ). Phần
dưới giữ lại làm lịch sử và điều kiện.

Bình luận làm sau cờ `comments` (`docs/comments-plan.md`). Đoạn dưới đây
**khẳng định bốn thứ của guideline 1.2 cho bình luận**, nên chỉ dán khi cả
ba điều sau đã đúng; dán sớm hơn là nói với reviewer về một tính năng họ
không tìm thấy, hoặc về một bộ lọc chưa lọc gì:

1. Cờ `comments` đã bật cho mọi người (không chỉ `app_flag_testers`), và
   tài khoản demo mở được luồng bình luận của một bộ sưu tập công khai.
2. Bảng `banned_words` có **từ thật**. Câu "filtered against a list of
   banned words" là sai khi danh sách chưa có từ nào. Từ `zzmaestroban`
   (từ thử của Maestro, có từ 20/11/2026) không tính:

   ```sql
   select count(*) from public.banned_words where word <> 'zzmaestroban';   -- phải > 0
   ```

3. Trên Data Desk, một báo cáo bình luận thử hiện đúng nội dung và gỡ được
   (trang Reports), để câu "our desk can remove a comment" đã được tự tay
   kiểm.

Dán ngay sau đoạn USER-GENERATED CONTENT, trước câu về ngôn ngữ:

```
COMMENTS (new in this version, guideline 1.2): signed-in users can comment
on public collections, reply to a comment, tag friends and places from
that collection, and like a comment. To see it: open any public collection
and tap the speech bubble. All four requirements are met for comments:
(1) Filter: a comment is checked on our server against a list of banned
words as it is posted and refused if it contains one; comments are capped
at 500 characters and 30 per user per day. (2) Report: every comment has a
Report action in its "..." menu, with a reason and an optional note.
(3) Block: users can block each other from a profile; across a block
neither sees the other's comments or the replies under them. (4) Action:
reports reach our moderation desk, which aims to act within 24 hours and
can remove the comment and suspend the account behind it. The owner of a
collection can also delete any comment on it and turn comments off. Our
Terms of Service and Privacy Policy describe all of this.
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
- **LOCATION**: chặn trước câu hỏi "xin quyền để làm gì" — nêu rõ phần nào
  on-device và **đường duy nhất vị trí rời máy** (màn Bắt đầu từ đâu? khi
  chưa có ghim, qua `fetch-place` tới Google); từ chối vẫn dùng được (đúng
  hành vi thật: fallback + switcher). Trước 26/09 đoạn này và đoạn MAPS nói
  vị trí "never transmitted" / "never the user's location" — sai từ khi chú
  thích dưới bản đồ đặt tên theo vị trí người dùng (`StartSheet`:
  `near = pinned ?? me`). Đổi hành vi đó thì đổi hai đoạn này, privacy
  policy và `app-privacy-labels.md` cùng lúc.
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

- **COMMENTS**: bình luận là nội dung người dùng đầu tiên của app hiện ra
  ngay lúc đăng, không qua duyệt, nên reviewer sẽ thử đúng bốn thứ của 1.2
  trên nó. Đoạn này nêu từng thứ theo số và chỉ chỗ bấm. Con số (500 ký tự,
  30 mỗi ngày, 24 giờ) lấy từ `docs/comments-plan.md` và `legal.ts`; đổi ở
  đó thì đổi ở đây. Trên App Store Connect, câu hỏi về nội dung do người
  dùng tạo (Age Rating → "User-Generated Content") vẫn trả lời **Yes** như
  hiện tại; bình luận không đổi câu trả lời, chỉ thêm lý do.

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
7. **Nếu bản này bật bình luận:** ba điều kiện ở mục "Đoạn bình luận" đã
   đúng, đoạn COMMENTS đã dán, và nhãn App Privacy `Other User Content` đã
   ghi thêm bình luận (`app-privacy-labels.md`).
