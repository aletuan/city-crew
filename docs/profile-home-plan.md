# Kế hoạch: Trang cá nhân là trang chính của tab cuối

Chủ dự án chốt hướng này ngày 19/11/2026. Tài liệu này ghi các quyết định,
luật cho cái chấm trên tab, cách điều hướng đổi, và bốn PR P1–P4. PR nào
làm một bước thì đánh dấu bước đó ở đây trong cùng PR.

## 1. Vì sao

Hôm nay tab cuối mở **Tài khoản**: ảnh đại diện có vòng cấp độ, bốn con số
(Bộ sưu tập, Check-in, Bạn bè, Chuyến đi), Về tôi, Sở thích, các dòng
Check-in, Bạn bè, Hoạt động, Tuỳ chọn, Ứng dụng. **Trang cá nhân** của
chính mình là một trang khác, chỉ tới được bằng cách bấm vào mặt mình
trên một thẻ. Hai trang "của tôi", mỗi trang giữ một nửa.

Mô hình chủ dự án chọn là của Instagram và Threads: tab cuối *chính là*
trang cá nhân của mình. Cài đặt là một trang con mở từ đầu trang.

Đã cân nhắc và bỏ:

- **Chỉ chuyển bốn con số sang Trang cá nhân**, giữ tab mở Tài khoản. Số
  sẽ nằm trên một trang gần như không ai tới được, và vẫn là hai trang
  "của tôi".
- **Hiện bốn con số ở cả hai trang.** Hai chỗ phải giữ khớp cho cùng một
  câu trả lời; code của Tài khoản đã ghi luật "một con số nói hai lần thì
  một lần là thừa".

## 2. Quyết định đã chốt

1. **Tab cuối mở Trang cá nhân của chính mình** khi đã đăng nhập. Chưa
   đăng nhập thì vẫn là trang mời đăng nhập (`GuestHub`) như hôm nay.
2. **Tài khoản là trang con**, mở từ đầu Trang cá nhân.
3. **Mọi thông báo xử lý được từ Trang cá nhân**, và tab có chấm khi có
   việc cần làm (luật ở mục 3).
4. **Bốn con số và lời mời kết bạn chỉ chủ trang thấy.** Người khác xem
   trang này thấy đúng như hôm nay. Vì vậy không phải đổi chính sách quyền
   riêng tư.
5. **Không chép những gì không hợp từ ảnh tham khảo:** trên trang của
   mình không có "Nhắn tin" hay "Kết bạn"; City Crew có bạn bè hai chiều,
   không có "Đang theo dõi" và "Người theo dõi".

## 3. Luật cho cái chấm

> Mỗi lý do làm tab cuối có chấm phải **thấy được ngay ở màn đầu của
> Trang cá nhân**, và **hết khi việc đó được xử lý**.

Một chấm mà bấm vào tab không tìm ra lý do là một chấm dạy người ta bỏ
qua chấm.

| Lý do | Có từ | Hiện ở đâu trên Trang cá nhân | Hết khi |
|---|---|---|---|
| Lời mời kết bạn | Hôm nay | Thẻ "2 lời mời kết bạn" dưới bốn con số, có mặt người gửi; bấm mở Bạn bè | Chấp nhận hoặc từ chối hết |
| Huy hiệu mới | Hôm nay | Vòng cấp độ quanh ảnh đại diện sáng lên; bấm mở Thành tích | Mở bảng Thành tích |
| Trả lời, tag, bình luận mới | C7c (phiên bình luận) | Chấm trên chuông ở đầu trang; chuông mở Hoạt động | Mở Hoạt động |

Lời mời chuyến đi và chuyến đi hôm nay vẫn là chấm của tab Chuyến đi,
không đổi.

Tim (bộ sưu tập hay bình luận) không bật chấm, như `comments-plan.md` đã
chốt: tim là tin vui, không phải việc cần đáp.

Luật này có một test: mỗi lý do mà `spokenTab` đọc cho tab Hồ sơ phải có
một phần tử tương ứng trên Trang cá nhân ở cùng trạng thái. Thêm lý do
mới cho chấm mà không thêm chỗ hiện thì test đỏ.

## 4. Trang cá nhân của mình, từ trên xuống

Chỉ khi nó là gốc của tab. Trang của mình mở từ một thẻ ở tab khác (bấm
vào mặt mình) giữ nguyên như hôm nay: là trang người khác thấy, có nút
quay lại. Lý do ở mục 6.

1. **Đầu trang:** "Trang cá nhân", không có nút quay lại. Bên phải:
   chuông (Hoạt động, có chấm theo mục 3).
2. **Ảnh bìa, ảnh đại diện, tên, handle, tiểu sử** như hôm nay. Ảnh đại
   diện thêm vòng cấp độ và nhãn "Lv", bấm mở Thành tích, như ở Tài khoản
   hôm nay.
3. **Bốn con số:** Bộ sưu tập, Check-in, Bạn bè, Chuyến đi. Mỗi số là một
   cửa, như ở Tài khoản hôm nay (`StatTile`, cùng đích đến).
4. **Thẻ lời mời kết bạn**, chỉ khi có lời mời.
5. **Hoạt động** (các bộ sưu tập), với **"Tài khoản ›"** bên phải tiêu đề.
   Đây là lối vào Tài khoản: #1451 đã đặt nó ở đó ngày 19/11, trước khi kế
   hoạch này viết xong, nên câu hỏi "bánh răng hay ⋯" không còn.

Nút "Sửa hồ sơ" trên trang: xem lại ở P2. Hôm nay bấm vào tiểu sử (hoặc
"Viết vài dòng về bạn") đã mở Sửa hồ sơ, và Tài khoản có nút riêng.

## 5. Tài khoản sau khi đổi

Giữ: Về tôi (tiểu sử, email, thành viên từ), Sở thích, dòng Check-in,
dòng Bạn bè, Tuỳ chọn, Ứng dụng, Đăng xuất, Xoá tài khoản.

Bỏ (vì đã lên Trang cá nhân): ảnh đại diện có vòng cấp độ, tên và handle,
nút Sửa hồ sơ, bốn con số, dòng Hoạt động.

Dòng Check-in và Bạn bè trùng đích với hai con số trên Trang cá nhân,
nhưng ở trang khác, nên giữ. Xem lại ở P4.

## 6. Điều hướng

- **Tên route `ProfileHome` giữ nguyên.** Nó vẽ màn mới: Trang cá nhân
  của mình khi đã đăng nhập, `GuestHub` khi chưa. `leaveAuth`, nút trên
  thông báo huy hiệu (`RewardBanner`) và màn Xoá tài khoản đều đang trỏ
  tới `ProfileHome`; giữ tên thì chúng không phải đổi.
- **Route mới `Account`**, chỉ trong `ProfileStack`, vẽ `AccountProfile`
  như hôm nay.
- **Bẫy: mở lại sau khi đổi giao diện.** Đổi giao diện khởi động lại app
  và mở lại bảng Giao diện ở đúng chỗ (`claimResume`, `ProfileReturn`).
  Hôm nay nó mở lại trên `ProfileHome`; sau khi đổi phải mở lại trên
  `Account`, nếu không người dùng đổi giao diện xong thì rơi về Trang cá
  nhân và bảng mở trên trang sai.
- **Trang của mình trong tab khác** (Khám phá, Bộ sưu tập) không có chuông,
  bốn con số hay lối vào Tài khoản. Một màn nằm trong nhiều stack chỉ đi
  được tới màn mà mọi stack đều có, và `Account`, `Activity`, `Crew` chỉ
  có ở `ProfileStack`.
- **Bấm vào mặt mình bên trong tab cuối** thì quay về gốc tab, không đẩy
  thêm một bản thứ hai của chính trang đó. *Chưa làm ở P1:* mỗi nơi mở
  trang một người tự gọi `navigate('Person')`, và biết đó là mình cần
  phiên đăng nhập ở từng nơi. Bản thứ hai hôm nay là trang như người khác
  thấy, có nút quay lại; không hỏng gì. Để P2.
- **Lối vào Friends và Account do `MeScreen` trao cho trang** (`home`), không
  do `PersonScreen` tự gọi: `PersonScreen` có trong ba stack, và
  `nav.test.ts` giữ luật một màn chỉ đi tới màn mà cả ba stack đều có.
- **Tên tab cho VoiceOver:** "Tài khoản" thành "Trang cá nhân". Thanh tab
  không có chữ, nên chỉ VoiceOver đọc tên này.
- **Kích thước file:** `PersonScreen.tsx` đã dài 669 dòng. Phần chỉ chủ
  trang thấy là component riêng trong `screens/person/`, không viết thêm
  vào màn.

## 7. Bốn PR

Mỗi PR một commit, revert là về như trước.

- [x] **P1. Đổi gốc tab, và thẻ lời mời kết bạn.** `ProfileHome` vẽ
  Trang cá nhân của mình (`MeScreen`); route `Account`; "Tài khoản ›" mở
  nó; mở lại sau khi đổi giao diện rơi đúng `Account` (`Return.stack`);
  đăng xuất ở Tài khoản thì về trang khách; tên tab. Thẻ lời mời kết bạn
  đi cùng P1 chứ không đợi P2: đó là lý do thường gặp nhất của chấm, và
  một chấm dẫn tới trang không có gì vi phạm mục 3 ngay từ bản đầu. Nội
  dung Tài khoản chưa đổi, nên bốn con số tạm thời vẫn ở đó, và huy hiệu
  mới vẫn chỉ thấy ở Tài khoản cho tới P3.
- [ ] **P2. Bốn con số** lên Trang cá nhân (chỉ ở gốc tab); bỏ khỏi Tài
  khoản; bấm vào mặt mình trong tab cuối thì về gốc; xem lại nút Sửa hồ
  sơ.
- [ ] **P3. Thông báo.** Chuông vào Hoạt động; vòng cấp độ và Thành tích
  lên ảnh đại diện; bỏ ảnh, tên và dòng Hoạt động khỏi Tài khoản; test
  cho luật ở mục 3.
- [ ] **P4. Dọn Tài khoản**, sau khi chủ dự án xem P1–P3 trên máy.

## 8. Phối hợp với phiên bình luận

C7b (các dòng bình luận trong Hoạt động) và C7c (mốc "đã xem", chấm trên
tab Hồ sơ) do phiên khác làm, cùng lúc. Chúng sửa màn Hoạt động và chấm
trên tab; P3 sửa *lối vào* Hoạt động. Để hai bên không giẫm lên nhau:

- Chấm của C7c đọc từ một hook. Chuông trên Trang cá nhân đọc **cùng
  hook đó**, không tự tính lại, để chấm trên tab và chấm trên chuông
  không bao giờ nói hai điều khác nhau.
- Nếu P3 xong trước C7c, chuông chưa có chấm cho bình luận; C7c thêm vào
  sau.
- PR nào merge sau thì cập nhật nhánh và chạy lại năm gate trước khi
  merge.

## 9. Còn mở

1. ~~Lối vào Tài khoản: bánh răng hay ⋯?~~ Đã có: "Tài khoản ›" (#1451).
2. **Vòng cấp độ và "Lv": chỉ chủ trang thấy, hay ai cũng thấy?** Cấp độ
   tính từ số địa điểm đã lưu, tức là nói ra mức hoạt động. Đề xuất: chỉ
   chủ trang, cho tới khi có lý do khác.
3. **Về tôi và Sở thích** có nên lên Trang cá nhân không. Tiểu sử đã ở
   đó; email và ngày tham gia là của riêng tài khoản. Để sau P4.
