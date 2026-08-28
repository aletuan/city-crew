# Notes for App Review — dán vào App Store Connect → App Review Information

Phần "Notes" này viết cho reviewer của Apple đọc (tiếng Anh). Kèm giải thích
tiếng Việt bên dưới về vì sao từng đoạn tồn tại.

## Notes (dán nguyên văn)

```
Thank you for reviewing cityCrew.

SIGN-IN: The app is fully browsable without an account — every screen of
content (Explore, Collections, place details, Search) works signed out.
Sign-in uses a one-time code emailed to the user (passwordless), so there is
no demo username/password to provide. To test signed-in features (saving
places, creating collections, plans), please sign in with any email address
you control; the code arrives within a few seconds. If you need a
pre-provisioned account instead, contact us at anhlt1983@gmail.com and we
will set one up immediately.

LOCATION: Requested once at launch, used on-device only to open the app on
the nearest supported city (Ho Chi Minh City or Hanoi). Denying it is fine —
the app falls back to a default city and a manual city switcher. Coordinates
are never transmitted or stored.

USER-GENERATED CONTENT (guideline 1.2): All catalog places are approved by
our editorial desk before publication. User-published collections and
profiles carry in-app Report actions; users can block other users; reports
are reviewed by our moderation desk, which can unpublish content and action
accounts. Account deletion is available in-app at Profile → Delete account.

The app's content is available in English, Vietnamese, and Japanese and
follows the device language.
```

## Vì sao từng đoạn tồn tại (nội bộ, không dán)

- **SIGN-IN**: app đăng nhập bằng OTP qua email nên không thể đưa
  username/password demo như Apple thường yêu cầu. Cách thoát chuẩn: nói rõ
  app dùng được đầy đủ khi chưa đăng nhập, reviewer tự dùng email của họ, và
  chừa đường liên hệ khẩn. Nếu reviewer vẫn yêu cầu tài khoản demo, phương án
  dự phòng là tạo một tài khoản test với email bạn kiểm soát và cấp mã qua
  App Review message.
- **LOCATION**: chặn trước câu hỏi "xin quyền để làm gì" — nêu rõ on-device,
  từ chối vẫn dùng được (đúng hành vi thật: fallback + switcher).
- **UGC**: guideline 1.2 là lý do từ chối phổ biến với app có nội dung người
  dùng; đoạn này chỉ thẳng vào bốn yêu cầu (lọc, report, block, cách liên hệ)
  và nơi mỗi thứ nằm trong app.
- **Ngôn ngữ**: để reviewer (thường dùng máy tiếng Anh) không bối rối khi
  screenshots tiếng Việt.

## Checklist trước khi bấm Submit

1. Bản build production đã lên TestFlight và tự chạy thử ít nhất một vòng:
   mở app, browse, đăng nhập, lưu, tạo collection, report thử, xoá tài khoản
   bằng một tài khoản nháp.
2. Privacy Policy URL và Support URL (GitHub Pages) mở được từ trình duyệt ẩn danh.
3. Bảng App Privacy đã điền đúng theo `app-privacy-labels.md`.
4. Screenshots đủ cỡ 6.9" cho ít nhất locale en-US.
5. `STARTUP_TRACE_UPLOAD` không cần đụng — tự tắt trên channel production.
