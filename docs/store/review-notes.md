# Notes for App Review — dán vào App Store Connect → App Review Information

Phần "Notes" này viết cho reviewer của Apple đọc (tiếng Anh). Kèm giải thích
tiếng Việt bên dưới về vì sao từng đoạn tồn tại.

## Notes (dán nguyên văn)

```
Thank you for reviewing City Crew.

SIGN-IN: The app is fully browsable without an account — every screen of
content (Explore, Collections, place details, Search) works signed out.
Signing in adds saving, collections and trip plans. Accounts are an email
address and a password, and demo credentials are provided in the Sign-In
Information fields above. Signing up asks for a display name, a username,
an email address and a password, then offers an optional list of interests
which can be skipped. Password recovery emails a numeric code rather than
a link. If the demo account does not work for any reason, please contact
us at anhlt1983@gmail.com and we will replace it immediately.

LOCATION: Requested once at launch, used on-device only to open the app on
the nearest supported city (Ho Chi Minh City, Hanoi, Da Nang, Da Lat or
Hue). Denying it is fine —
the app falls back to a default city and a manual city switcher. Coordinates
are never transmitted or stored.

AI: Plan titles and the one-line note under each stop are written by a
language model (Anthropic's Claude), called from our own server rather than
from the device. The model never chooses a place: it receives the stops our
own algorithm already selected from our editor-approved catalog, and the
output schema restricts it to exactly those places, so it cannot invent a
venue. A free-text request ("somewhere with live jazz on Saturday") is
parsed the same constrained way, into the same wizard answers the chips
produce. No personal data is sent with either call — no name, email,
account id or location. This is disclosed in our privacy policy.

USER-GENERATED CONTENT (guideline 1.2): All catalog places are approved by
our editorial desk before publication. User-published collections and
profiles carry in-app Report actions; users can block other users; reports
are reviewed by our moderation desk, which can unpublish content and action
accounts. Account deletion is available in-app at Profile → Delete account. The same
screen offers Download your data, which writes the account's data to a JSON
file and passes it to the system share sheet; nothing is uploaded.

The app's content is available in English, Vietnamese, and Japanese and
follows the device language.
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
  và nơi mỗi thứ nằm trong app.
- **AI**: nêu trước để reviewer không phải tự phát hiện app có gọi model — và
  để nói rõ ngay hai điều họ sẽ hỏi: model không tự bịa địa điểm, và không có
  dữ liệu cá nhân nào được gửi đi. Cùng nội dung với mục AI trong privacy
  policy; hai chỗ phải luôn khớp nhau.
- **Ngôn ngữ**: để reviewer (thường dùng máy tiếng Anh) không bối rối khi
  screenshots tiếng Việt.

## Checklist trước khi bấm Submit

1. Bản build production đã lên TestFlight và tự chạy thử ít nhất một vòng:
   mở app, browse, đăng nhập, lưu, tạo collection, report thử, xoá tài khoản
   bằng một tài khoản nháp.
2. Privacy Policy URL, Terms URL và Support URL (GitHub Pages) mở được từ trình
   duyệt ẩn danh — reviewer mở chúng từ listing, không phải từ app: hai văn bản
   đầu giờ **đọc được ngay trong app** (dưới nút Đăng ký, và Cá nhân → Tuỳ chọn),
   dựng từ cùng một nguồn với hai trang web nên không thể lệch nhau.
3. Bảng App Privacy đã điền đúng theo `app-privacy-labels.md`.
4. Screenshots đủ cỡ 6.9" cho ít nhất locale en-US.
5. Hai cờ trace không cần đụng — cả `STARTUP_TRACE` (log console) lẫn
   `STARTUP_TRACE_UPLOAD` (gửi lên `startup_traces`) đều tự tắt trên channel
   `production`, nên bản App Store không log và không gửi gì.
