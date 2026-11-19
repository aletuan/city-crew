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

Trang của mình giống nhau ở mọi nơi nó mở (chủ dự án, 19/11, sau P2: "đều
là Trang cá nhân của người dùng hiện tại"). Khác nhau duy nhất: mở từ tab
khác thì có tiêu đề và nút quay lại, vì có trang phía dưới để về. Trong
P1–P2 phần chỉ chủ trang thấy chỉ có ở gốc tab; đã bỏ giới hạn đó.

1. **Đầu trang:** không có tiêu đề (chủ dự án bỏ ngày 19/11: tab đã nói
   đây là trang của ai) và không có nút quay lại. **Chuông** (Hoạt động)
   nổi ở góc trên bên phải ảnh bìa, cách A trong hai cách vẽ cho chủ dự án
   ngày 19/11 (cách B là cạnh "Tài khoản ›"). Chấm trên chuông chờ C7c.
2. **Ảnh bìa, ảnh đại diện, tên, handle, tiểu sử** như hôm nay. Ảnh đại
   diện có vòng cấp độ, và nhãn "Lv" **ngay dưới ảnh, ở giữa** (chủ dự án,
   19/11), bấm mở Thành tích. Chỉ chủ trang thấy.
3. **Bốn con số:** Bộ sưu tập, Check-in, Bạn bè, Chuyến đi. Mỗi số là một
   cửa, như ở Tài khoản hôm nay (`StatTile`, cùng đích đến).
4. **Thẻ lời mời kết bạn**, chỉ khi có lời mời.
5. **Hoạt động** (các bộ sưu tập), với **"Tài khoản ›"** bên phải tiêu đề.
   Đây là lối vào Tài khoản: #1451 đã đặt nó ở đó ngày 19/11, trước khi kế
   hoạch này viết xong, nên câu hỏi "bánh răng hay ⋯" không còn.

Nút "Sửa hồ sơ" **ở lại Tài khoản**, ở đầu trang (chủ dự án, 19/11). Trên
Trang cá nhân, bấm vào tiểu sử (hoặc "Viết vài dòng về bạn") đã mở Sửa
hồ sơ.

## 5. Tài khoản sau khi đổi

Giữ: Về tôi (tiểu sử, email, thành viên từ), Sở thích, dòng Check-in,
dòng Bạn bè, Tuỳ chọn, Ứng dụng, Đăng xuất, Xoá tài khoản.

Bỏ (vì đã lên Trang cá nhân): ảnh đại diện có vòng cấp độ, tên và handle,
bốn con số, dòng Hoạt động. Nút Sửa hồ sơ ở lại, đứng đầu trang.

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
- **Trang của mình trong tab khác** (Khám phá, Bộ sưu tập) có đủ bốn con
  số, thẻ lời mời và "Tài khoản ›". `Account`, `Crew`, `Visited` chỉ có ở
  `ProfileStack`, nên các cửa đó đi qua `toProfileRoom` (`nav.ts`): trong
  stack đó thì đẩy trang lên; ở tab khác thì chuyển sang tab cuối, mở
  phòng đó đè lên trang của mình (`initial: false`).
- **Bấm vào mặt mình bên trong tab cuối** thì quay về gốc tab, không đẩy
  thêm một bản thứ hai của chính trang đó. Làm ở P2 bằng `toPerson`
  (`nav.ts`), ở hai nơi mặt mình bấm được: đầu một bộ sưu tập của mình,
  và bình luận của mình.
- `MeScreen` chỉ báo cho trang biết nó là gốc tab (`home`): không nút quay
  lại, không tiêu đề. Từ P1 tới sau P2 nó còn trao phần chỉ chủ trang
  thấy; giờ trang tự vẽ phần đó cho chính chủ ở mọi stack.
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
- [x] **P2. Bốn con số** lên Trang cá nhân (chỉ ở gốc tab, `Counts`), trên
  thẻ lời mời; bỏ khỏi Tài khoản; bấm vào mặt mình trong tab cuối thì về
  gốc (`toPerson`); bỏ tiêu đề "Trang cá nhân" ở gốc tab (chủ dự án,
  19/11). `MeScreen` trao cho trang phần chỉ chủ trang thấy
  (`Home.owner`), vì các cửa của nó mở những trang chỉ có trong stack
  của tab cuối.
- [x] **Sau P2: một trang của mình ở mọi nơi** (chủ dự án, 19/11). Bốn con
  số, thẻ lời mời và "Tài khoản ›" có cả khi trang mở từ tab khác, qua
  `toProfileRoom`.
- [x] **P3. Thông báo, và dọn Tài khoản** (chủ dự án gộp P4 vào). Chuông
  nổi trên ảnh bìa (`person/Bell`), mở Hoạt động qua `toProfileRoom`;
  vòng cấp độ và Thành tích lên ảnh đại diện (`person/OwnFace`, dùng lại
  `HeroFace`), nhãn "Lv" ngay dưới ảnh; Tài khoản bỏ ảnh, vòng, tên, role
  và dòng Hoạt động, giữ Sửa hồ sơ ở đầu; con số của dòng Hoạt động
  (`useActivityCount`) bỏ theo. Test cho luật ở mục 3 nằm ở
  `PersonScreen.ui.test.tsx` ("has a place on the page for every reason the
  tab wears a dot").
- [ ] **Còn lại:** chấm trên chuông khi C7c xong (phiên bình luận); xem lại
  dòng Check-in và Bạn bè trên Tài khoản, vốn trùng đích với hai con số.

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
