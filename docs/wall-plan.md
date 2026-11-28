# Ảnh bìa trang cá nhân do người dùng chọn

Chủ dự án, 21/11/2026. Ảnh bìa trên trang cá nhân (`PersonScreen`, khối
`Head`) hiện **tự chọn**: ảnh của bộ công khai mới nhất, không có thì ảnh
thành phố (`usePageCover`). Hệ quả thấy được trên máy thật: ảnh bìa trùng
y ảnh thẻ bộ sưu tập đứng ngay dưới nó.

Từ nay người dùng tự chọn ảnh bìa của mình. Một PR làm một bước dưới đây
thì đánh dấu bước đó ở đây, trong cùng PR.

## Quyết định

1. **Bốn lựa chọn**, trong một tấm chọn (bottom sheet):
   - *Tự động*: như hiện nay, nhưng bỏ qua bộ đang đứng ngay dưới ảnh bìa
     (bộ đầu tiên của trang), để hết cảnh hai ảnh giống nhau chồng nhau.
   - *Thành phố*: ảnh hero của **mọi** thành phố (`cityCoverUri`), không
     chỉ thành phố người dùng có bộ.
   - *Bộ sưu tập*: **chỉ ảnh đại diện** của bộ (`coverUriOf`: ảnh đã chọn,
     không có thì ảnh địa điểm đầu — đúng ảnh trên thẻ bộ). Gồm bộ tự tạo và
     bộ đã sao chép; **không gồm bộ riêng tư**, vì ảnh bìa ai cũng thấy.
   - *Ảnh tải lên*: **một ảnh tại một thời điểm**; tải ảnh mới thay ảnh cũ.
2. **Bố cục** (sửa ngày 21/11/2026 sau khi chủ dự án thử trên máy): **trang
   cá nhân chính là ô xem trước**. Bấm một ô thì ảnh bìa phía trên tấm chọn
   đổi ngay, góc ảnh ghi "Đang xem thử"; *Lưu* mới ghi, đóng tấm chọn thì ảnh
   bìa trở lại như cũ. Tấm chọn cao tối đa 60% màn hình để không che ảnh bìa,
   nền không làm tối trang. Ô **vuông 92pt**, mỗi nguồn một hàng cuộn ngang,
   ô cuối hở một nửa; *Tự động* là ô đầu của hàng thành phố. Bản đầu có ô xem
   trước 2,4:1 trong tấm chọn và ô 2,4:1 cao 58pt: trên điện thoại, hai hàng
   cuối bị khuất dưới nút Lưu.
3. **Mở tấm chọn**: bấm vào ảnh bìa, có **nút máy ảnh nhỏ ở góc dưới phải
   ảnh bìa** để thấy đó là chỗ bấm được (như huy hiệu máy ảnh trên ảnh đại
   diện). Chỉ trên trang của mình; trang người khác không có nút, bấm ảnh bìa
   không làm gì. Máy ảnh từng đứng đầu hàng icon trên cùng (21/11/2026, một
   buổi tối) rồi chuyển xuống ảnh bìa: việc ít làm nhất chiếm chỗ đầu, và đẩy
   kính lúp khỏi vị trí nó đứng trên trang người khác. Hàng icon là *tìm kiếm ·
   chuông · cài đặt*.
4. **Bộ đã chọn mất đi** (xoá, chuyển riêng tư, chủ bỏ sao chép): ảnh bìa
   về *Tự động*. Bộ đổi ảnh đại diện: ảnh bìa đổi theo. Không bao giờ ô
   trống.
5. **Ảnh Google**: tên người chụp theo cờ `photo_attribution`, như mọi nơi
   khác. Cờ đang tắt (quyết định có chủ ý, `app_flags`); ảnh bìa từ bộ sưu
   tập làm ảnh Google xuất hiện nhiều hơn — cùng rủi ro C1 của
   `docs/tech-eval-app-store.md`, không phải rủi ro mới.
6. **Ảnh tải lên là nội dung người dùng, công khai**: báo cáo được (báo cáo
   hồ sơ đã có, `kind = 'profile'`), gỡ được trên Data Desk, nằm trong
   chính sách quyền riêng tư và nhãn App Privacy, bị xoá khi xoá tài khoản,
   có trong file xuất dữ liệu.

7. **Tràn viền** (chủ dự án, 22/11/2026): ảnh bìa chạy hết hai mép và lên
   dưới đồng hồ; mép trên có dải tối mờ. Nút quay lại (trang người khác)
   và cụm công cụ nằm trong kính tối mờ như nút máy ảnh; cuộn qua ảnh thì
   nền trang và tên người hiện dần, icon và đồng hồ chuyển sang mực của
   trang (`person/Bar`). Khi tìm kiếm trong trang, trang trở lại header
   thường.

   **Phần đầu trang nằm trên ảnh** (chủ dự án, 28/11/2026, theo ảnh tham
   khảo): ảnh đại diện (giữ vòng cấp độ và huy hiệu), tên, @handle, bio và
   — ở trang của chính mình — bốn con số đều đứng trên ảnh bìa, mực sáng
   `onPhoto`, không đổi theo giao diện sáng/tối. Ảnh cao 272pt dưới đồng
   hồ. Trang nổi lên trên chân ảnh như một tấm sheet: đè 18pt, bo 22pt hai
   góc trên.

   Sửa sau video quay máy thật của chủ dự án (28/11/2026, bản 232pt):
   - **232 → 272.** Ở 232 thanh công cụ kết thúc ở 109pt và ảnh đại diện
     bắt đầu ở 107pt: không còn điểm ảnh nào trống, ảnh bìa đọc như nền
     của header. 40pt thêm là dải ảnh giữa thanh công cụ và phần đầu.
     Không hơn: trên máy 667pt ảnh đã chiếm khoảng 44% màn hình (số tính).
   - **Phần đầu mờ dần khi cuộn tới thanh công cụ** (`useHeadFade`), theo
     đúng quy tắc của chữ trên hero Explore: trước đó ảnh đại diện chui
     dưới đồng hồ và tên bị cụm công cụ cắt ngang.
   - **Dải tối** chạy từ chân thanh công cụ tới chân ảnh, đạt 0,54 ở 1/5
     quãng — chỗ phần đầu bắt đầu — và 0,66 ở chân. Bản trước đạt 0,5 ở
     45% quãng, nên tên chỉ đứng trên khoảng 16% và @handle gần mất trên
     ảnh sáng. Chữ trắng trên ảnh trắng tinh cần 0,54 để đạt 4,5:1 (số
     tính, chưa đo trên máy thật). @handle dùng mực sáng đầy đủ.
   - **Nút máy ảnh** đứng 4pt dưới thanh công cụ, trong dải trống; dòng
     tên ở trang của mình chừa 44pt cuối dòng cho nó. Huy hiệu vai trò
     trên ảnh có nền sáng (nền nhạt gốc của nó chìm vào ảnh).
   - Hàng ảnh đại diện cách hàng số 18pt (trước 12): nhãn cấp độ chạm số.

   Bong bóng bio bỏ hẳn: bio là một dòng nghiêng trên ảnh, tối đa ba dòng
   (chiều cao ảnh cố định; dòng thứ tư sẽ đẩy tên lên dưới thanh công cụ).
   Một ô kính trên ảnh là một tấm ảnh thứ hai. Đã cân nhắc và loại: giữ
   ảnh đại diện đè nửa trong nửa ngoài (tên phải nằm dưới ảnh, bốn con số
   lại rời xuống trang); ảnh cao bằng hero của Explore (trang cá nhân là
   nơi đọc danh sách, nội dung đầu tiên bị đẩy khỏi màn hình đầu).

   Hero của Explore kết thúc cùng một kiểu (28/11/2026): tấm sheet dùng
   chung `photoSheet` trong `theme.ts` (18/22), dải tối ở chân hero giảm
   từ 0,97 xuống 0,82. Kính tối của ô ngày và nút tìm (0,55) **không** gộp
   với kính của thanh công cụ trang cá nhân (0,42): ô ngày mang chữ, và
   với 0,42 cộng dải tối phía trên, nền dưới chữ chỉ đạt khoảng 0,52 —
   dưới mức 0,54 cần cho 4,5:1 trên ảnh trắng (số tính).

## Dữ liệu

`profiles` thêm hai cột:

| cột | nghĩa |
|---|---|
| `wall_kind` | `null` = tự động; `'city'`, `'collection'`, `'upload'` |
| `wall_ref` | id thành phố; id bộ; hoặc URL ảnh tải lên (có `?v=` như `avatar_url`) |

Ảnh tải lên nằm trong bucket `avatars` có sẵn, ở `${uid}/wall.jpg`: chính
sách của bucket đã giới hạn ghi vào thư mục của chính mình, nên không cần
bucket hay policy mới. Ảnh bìa không phải ảnh đại diện, nhưng một bucket
"ảnh của người dùng" với một thư mục mỗi người là đúng nghĩa của nó.

Bộ và thành phố được **giải ở máy**, không ở server: trang đã tải các bộ
công khai của người đó và danh sách thành phố; `wall_ref` của một bộ không
còn trong danh sách đó thì là *Tự động* (quyết định 4).

## Các bước

- [x] **W1. Dữ liệu và nghĩa vụ** (migration `20261121120000_profile_wall.sql`):
  - hai cột, check trên `wall_kind`, `wall_ref` bắt buộc khi có `wall_kind`;
  - `moderate_profile` thêm `clear_wall` (về tự động, ghi `moderation_log`);
  - `delete-account` xoá `${uid}/wall.jpg`;
  - `legal.ts`: chính sách nói tới ảnh bìa (hiệu lực 21/11/2026); `app-privacy-labels.md`.
  - Check trên hai cột bọc `coalesce`: một check trả về null là *đạt*, nên
    `wall_kind = 'city'` với `wall_ref` null đã lọt qua trước khi bench bắt được.
- [x] **W2. Tấm chọn, không có tải ảnh** (`screens/person/Wall.tsx`): `Profile` đọc hai cột, file xuất dữ liệu có chúng (cùng lúc, vì cả hai đọc `Profile`); `lib/wall.ts` (giải ảnh bìa, danh
  sách ứng viên — thuần, 100% coverage), `WallSheet`, hai lối vào, *Tự động*
  bỏ qua bộ đầu.
- [x] **W3. Tải ảnh lên**: hàng thứ ba của tấm chọn, thu nhỏ rộng 1200px và
  tải như `setAvatar` (một hàm chung, `uploadOwnPhoto`), ô ảnh đã tải đứng
  cạnh nút khi đang dùng. **Không cắt 2,4:1**: trình sửa ảnh của thư viện
  iOS luôn cắt vuông, mà khung vuông là sai khung cho ảnh bìa; ảnh bìa lấy
  phần giữa (`contentFit="cover"`). Ảnh mới thay ảnh cũ, giới hạn một lần
  một phút của bucket áp dụng riêng cho `wall.jpg`.
- [x] **W4. Data Desk** (migration `20261121130000_reports_queue_wall.sql`):
  `reports_queue` trả thêm `wall_kind`, `wall_ref` của hồ sơ bị báo cáo; thẻ
  báo cáo vẽ ảnh tải lên, ghi tên thành phố/bộ nếu là ảnh có sẵn, và có nút
  *Take the cover down* (`clear_wall`) khi trang không ở chế độ tự động.

W3 và W4 đi cùng bản phát hành: một ảnh tải lên công khai không được có
mặt trước khi gỡ được nó.
