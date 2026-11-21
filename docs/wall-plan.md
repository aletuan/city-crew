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
2. **Bố cục**: ô xem trước lớn ở trên (tỉ lệ thật của ảnh bìa, có mặt
   người đè lên như trên trang), rồi **mỗi nguồn một hàng cuộn ngang**, ô
   2,4:1, ô cuối hở một nửa ở mép. Grid chỉ hợp cho một màn "Xem tất cả"
   nếu sau này cần. Lý do: số ảnh mỗi nguồn chênh nhau (vài thành phố,
   15+ bộ); grid 2 cột đẩy nút tải ảnh xuống đáy và ép ô quá thấp.
3. **Mở tấm chọn**: icon máy ảnh trên hàng icon trên cùng (cạnh tìm kiếm,
   chuông, cài đặt), **và** bấm vào chính ảnh bìa. Chỉ trên trang của mình;
   trang người khác không có icon, bấm ảnh bìa không làm gì.
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
- [ ] **W3. Tải ảnh lên**: hàng thứ ba của tấm chọn, cắt 2,4:1, thu nhỏ và
  tải như `setAvatar`, ô ảnh đã tải đứng cạnh nút.
- [ ] **W4. Data Desk**: báo cáo hồ sơ hiện ảnh bìa đang dùng và nút *Gỡ ảnh
  bìa* (`clear_wall`).

W3 và W4 đi cùng bản phát hành: một ảnh tải lên công khai không được có
mặt trước khi gỡ được nó.
