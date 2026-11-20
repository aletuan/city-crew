# Kế hoạch Maestro: trang cá nhân, Tài khoản và bình luận

Đây là kế hoạch cho các flow **chưa viết**. Kết quả các lượt đã chạy nằm ở [e2e-latest.md](e2e-latest.md); file này tách riêng để một báo cáo mới không ghi đè kế hoạch (20/11/2026: phần kế hoạch đặt trong `e2e-latest.md` đã mất khi báo cáo được viết lại).

Mọi selector dưới đây đã đối chiếu với `main` tại `18589b5` (20/11/2026, sau #1485, #1487, #1490, #1491, #1492). Nếu một PR đổi testID mà plan nhắc tới, sửa plan trong cùng PR. Khi một ca đã có flow, đánh dấu nó ở đây kèm tên flow và run ID của lượt đạt đầu tiên.

Quy tắc viết flow vẫn là [GUIDELINES](../../app/.maestro/GUIDELINES.md): mỗi flow chạy được riêng, tự dọn dữ liệu nó tạo, và chọn dòng trong thẻ của Tài khoản theo chữ (mọi dòng ở đó đều mang chung id `feature-row`, xem `common/open-crew.yaml`).

## Nền

Baseline 22/22 đạt trong một lượt trên `d0c9cd07` (lượt `20261120-142328`, #1492). Một flow mới chỉ nên vào `config.yaml` khi nó đạt hai lượt liền và cả suite vẫn xanh.

## P1. Trang cá nhân và Tài khoản (làm trước; không cần dữ liệu mới)

Tài khoản A = `TEST_EMAIL` (`@maestro`).

| Ca | Bước và assertion | Bảo vệ điều gì |
| --- | --- | --- |
| PA-1 tab cuối là trang của bạn | `tab-profile` → thấy `person-own-face`, `person-handle` chứa `@maestro`, `person-own-tools` với `person-search`, `person-bell`, `person-settings`; **không** thấy `account-back` | P1 của `docs/profile-home-plan.md` và #1485: tab mở trang của bạn, công cụ ở đầu trang |
| PA-2 vào và ra Tài khoản | `person-settings` → `account-back`, `profile-email` khớp `TEST_EMAIL` → `account-back` → lại thấy `person-handle` | lối vào Tài khoản bằng bánh răng và đường quay về |
| PA-3 Hoạt động từ hai lối | `person-bell` → `activity-tab-for-you` và `activity-tab-yours` hiện → back. Rồi `person-settings` → cuộn tới dòng chữ `.*Activity.*What's new.*` → cùng màn Hoạt động | #1463 và #1478: hai lối vào một trang, hai tab |
| PA-4 tìm trên trang | `person-search` → gõ vào `person-find-input` tên một bộ của A → bộ đó hiện → `person-find-cancel` → trang trở lại như cũ | #1491 |
| PA-5 khách không có nút quay lại | `ensure-signed-out` → `tab-profile` → `profile-sign-in` và `profile-sign-up` hiện; **không** thấy `account-back` | lỗi `canGoBack()` đã sửa ở #1479: trang khách từng có chevron quay về Explore |
| PA-6 đăng xuất không hiện màn đỏ | `person-settings` → cuộn tới `profile-sign-out` → xác nhận → `profile-sign-in` hiện; `notVisible: text ".*POP_TO_TOP.*"` | lỗi `POP_TO_TOP` khi đăng xuất (#1479; chỉ hiện ở bản dev) |

PA-1, PA-2, PA-5 và PA-6 có thể là một flow. PA-3 và PA-4 có thể thêm vào flow đó hoặc tách riêng, tuỳ thời gian chạy.

## P2. Bạn bè và chấm thông báo (cần hai tài khoản)

B = `TEST_EMAIL_2` (`@usera8b792a2`).

| Ca | Bước và assertion |
| --- | --- |
| PA-7 lời mời hiện trên trang đầu | B gửi lời mời cho A (`common/open-crew.yaml`). A mở tab cuối → `person-requests` hiện, `dot-profile` trên tab bar, `friends-dot` trong Tài khoản → bấm `person-requests` → màn Kết nối bạn bè. Dọn: A từ chối. Bảo vệ luật "mọi lý do có chấm đều thấy ở trang đầu" của `docs/profile-home-plan.md`. |
| PA-8 mặt người mở trang cá nhân (#1480) | Kết nối bạn bè → tab Lời mời → bấm `crew-request-who-0` → trang của người gửi (`person-handle`); tương tự `crew-sent-who-0`, `crew-suggestion-who-<id>`. Bấm `crew-accept-0` chỉ đồng ý, không mở trang. |

PA-7 và PA-8 cần A và B **chưa** là bạn, mà `17-unfriend` để họ là bạn khi kết thúc. Hoặc flow tự huỷ kết bạn ở đầu và kết bạn lại ở cuối, hoặc dùng cặp tài khoản tạm của `maestro-trip-fixtures.mjs` (hai ca này không cần cờ `comments`).

## P3. Bình luận (sau cờ `comments`)

### Điều kiện trước khi viết

1. **Cờ `comments` đang tắt cho mọi người.** Chỉ năm tài khoản có dòng trong `app_flag_testers`: `@maestro` (A), `@usera8b792a2` (B), `@trang`, `@tuananh`, `@xitrum`. Tài khoản tạm do `maestro-trip-fixtures.mjs` tạo **không có cờ**, và script không có quyền thêm (không dùng service-role). Vì vậy các flow bình luận dùng A và B. Nếu cờ biến mất, flow phải fail rõ ở bước "không thấy `collection-comments`", không được bỏ qua.
2. **Bình luận chỉ có trên bộ công khai.** Bộ mới mặc định là Công khai từ #1483, và `common/choose-private-collection.yaml` chọn Riêng tư. Flow bình luận thì cố ý để Công khai, tạo bộ trong flow và xoá ở cuối (`common/delete-open-collection.yaml`). Xoá bộ là xoá luôn bình luận, tim và tag trên đó. Không giữ một bộ công khai cố định, vì nó sẽ hiện trong Cộng đồng cho người dùng thật.
3. **Giới hạn 30 bình luận mỗi người mỗi 24 giờ** (`own_comments_today`, chỉ đếm các dòng còn tồn tại). Mỗi flow đăng tối đa khoảng 3 bình luận. Một lượt fail giữa chừng để lại bình luận cho tới khi bộ bị xoá, nên phần dọn phải chạy cả khi flow fail, hoặc lượt sau phải dọn trước.
4. **Ba việc chờ chủ dự án quyết**, đừng viết trước khi có câu trả lời:
   - **Từ cấm:** bảng `banned_words` đang trống. CM-10 cần một từ thử trong bảng thật, mà bảng đó chặn cả người dùng thật. Cần duyệt một từ vô nghĩa (ví dụ `zzmaestroban`).
   - **Báo cáo:** một báo cáo rơi vào hàng chờ Data Desk thật.
   - **Chặn:** chặn sẽ cắt tình bạn A–B, mà `17-unfriend` đang dùng cặp đó.

### Một tài khoản (A, trên bộ công khai A tạo trong flow)

| Ca | Bước và assertion |
| --- | --- |
| CM-1 mở luồng trống | Bộ vừa tạo → `collection-comments` → `comments-empty`, `composer-field` |
| CM-2 đăng | gõ vào `composer-field` → `composer-send` → một `comment-row`, `comment-words` đúng nội dung; quay lại bộ → `collection-comments-count` = 1 |
| CM-3 trả lời | `comment-reply` trên dòng đầu → `composer-replying` hiện → gửi → `comment-replies` hoặc `comment-branch` hiện; `composer-cancel-reply` thoát được chế độ trả lời |
| CM-4 giới hạn độ dài | gõ 501 ký tự → `composer-count` hiện (nó chỉ hiện trong 40 ký tự cuối trước trần), `composer-send` bị tắt; bấm vẫn không thêm `comment-row` nào |
| CM-5 chủ bộ tắt bình luận | `comments-owner` → `sheet-action-off` → `composer-closed` hiện; bong bóng trên thẻ mờ đi nhưng vẫn còn (#1453) → `comments-owner` → `sheet-action-on` bật lại |
| CM-6 xoá kéo theo câu trả lời | `comment-more` trên bình luận gốc → `sheet-action-delete` → xác nhận → không còn `comment-row` nào (câu trả lời mất theo), `comments-empty` |

### Hai tài khoản (A là chủ bộ, B viết)

| Ca | Bước và assertion |
| --- | --- |
| CM-7 tag và thông báo | B mở bộ của A (qua tìm kiếm hoặc trang cá nhân của A), gõ `@` → `composer-offers` có A (chủ bộ tag được) → chọn → gửi. A đăng nhập: `dot-profile` trên tab bar, `person-bell-figure` trên chuông → `person-bell` → `activity-tab-for-you` có một dòng với `news-quote` chứa nội dung → bấm → màn bình luận, bình luận của B hiện (`useThreadFocus` cuộn tới) → quay lại: số trên chuông đã hết |
| CM-8 trả lời báo cho người được trả lời | A trả lời bình luận của B; B thấy dòng trả lời trong "Dành cho bạn" |
| CM-9 tim | B thả `comment-heart` vào bình luận của A; A thấy số tim; Hoạt động của A có dòng tim nhưng **không** làm chuông hiện số (luật của C7c) |
| CM-10 từ cấm | chỉ sau khi chủ dự án duyệt từ thử: gửi câu chứa từ đó → `composer-error`, không có `comment-row` mới |

Dọn dẹp: A xoá bộ ở cuối flow. Sau lượt đầu, kiểm tra bằng SQL rằng không còn bình luận nào của A hay B trên bộ đã xoá.

Không đưa vào Maestro (đã có unit test, hoặc kiểm tay): ánh sáng 1,5 giây của dòng được mở (`useThreadFocus`), bàn phím đóng sau khi gửi, màu của tag trong composer, xuất dữ liệu (bản sao dữ liệu định dạng 4).

## Thứ tự

1. **P1:** PA-1, PA-2, PA-5, PA-6 trong một flow; rồi PA-3, PA-4.
2. **P3, một tài khoản:** CM-1 tới CM-6.
3. **P3, hai tài khoản:** CM-7 tới CM-9, sau khi CM-1…6 đạt hai lượt liền.
4. **P2:** PA-7, PA-8, sau khi chốt cách giữ trạng thái kết bạn của cặp A–B.
5. **Chờ chủ dự án:** CM-10, báo cáo, chặn.

Mỗi flow mới thêm vào `config.yaml` và vào bảng của `docs/testing/e2e-simulator.md`; kết quả chạy ghi vào `e2e-latest.md` (SHA, run ID, phạm vi thật).
