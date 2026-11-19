# Kế hoạch: bình luận trên bộ sưu tập

Soạn 18/11/2026, chủ dự án duyệt cùng ngày. Là một phần của
`docs/collection-feed-plan.md`. Tài liệu này ghi quyết định, thiết kế và
danh sách việc phải làm. Mỗi việc xong thì đánh dấu ở mục 3, trong chính
PR làm việc đó.

**File này là bản duy nhất** (chủ dự án, 19/11/2026). Trước đó có một bản
chép tay trong Project CityCrew trên Claude và nó đã lệch ba lần; nay ở
đó chỉ còn một dòng trỏ về đây. Sửa kế hoạch là sửa file này, qua PR.

Đọc nhanh: mục 3 nói việc gì đã xong và còn gì; mục 1 nói đã quyết gì và
vì sao; mục 2 tả thứ đang chạy (dọn lại ngày 19/11/2026 cho khớp code).

Yêu cầu xuyên suốt: mọi thứ làm cho bình luận trên bộ sưu tập phải dùng
lại được cho các hoạt động khác về sau (trước hết là check-in) mà không
phải viết lại.

## 1. Quyết định đã chốt

| # | Vấn đề | Quyết định | Tham chiếu |
|---|---|---|---|
| 1 | Bình luận thuộc về đâu | Thuộc về **đối tượng** được bình luận (hôm nay: bộ sưu tập công khai), không thuộc về Trang cá nhân. Mỗi đối tượng một luồng, hiện ở mọi nơi nó xuất hiện. | Nguyên tắc 1 và 2 của kế hoạch feed |
| 2 | Lồng nhau | **Có lồng** (chủ dự án chọn; đề nghị ban đầu là một cấp). Dữ liệu lồng tự do; màn hình thụt tối đa 2 cấp, sâu hơn thì nằm ở cấp 2 kèm "@tên". | Facebook |
| 3 | Ai được bình luận | Mọi người đã đăng nhập, trên bộ sưu tập công khai. Chủ bộ có công tắc **tắt bình luận** cho từng bộ. | Instagram |
| 4 | Tag | Tag người mở Trang cá nhân; tag địa điểm (chỉ địa điểm trong chính bộ đó) mở trang chi tiết địa điểm. Tag được: bạn bè của người viết, chủ bộ, người đã bình luận trong luồng. | Instagram (mức "người mình theo dõi") |
| 5 | Xoá | Xoá của mình; chủ bộ xoá được bình luận trên bộ của họ. **Xoá một bình luận là xoá luôn các trả lời bên dưới** (đổi ngày 18/11/2026, xem dưới). Không cho sửa. | Instagram, Facebook |
| 6 | Thông báo | Bốn việc được báo trong màn Hoạt động: có người bình luận vào bộ của bạn, trả lời bình luận của bạn, tag bạn, thả tim bình luận của bạn. Mỗi việc báo cho **đúng một người có liên quan trực tiếp**, không báo cả luồng (viết lại ngày 19/11/2026, xem dưới). Thông báo đẩy là bước riêng (C11). | Instagram, Threads |
| 7 | Giới hạn | 500 ký tự; 30 bình luận mỗi người mỗi ngày. | |
| 8 | An toàn (Apple 1.2) | Bộ lọc từ cấm lúc đăng; báo cáo từng bình luận; hai người chặn nhau không thấy bình luận của nhau. | App Review Guidelines 1.2 |
| 9 | Phát hành | Làm sau cờ `comments` (tắt sẵn), merge dần; bật trong một bản nộp duyệt kèm ghi chú cho App Review. | Điều 2.5.2 |
| 10 | Thứ tự | Bình luận gốc: **mới nhất trước**. Trả lời trong một nhánh: cũ trước. Thứ tự là một tham số của hàm đọc luồng, không viết cứng. | Xem dưới |
| 11 | Tim | Mỗi bình luận và mỗi trả lời có **một trái tim**, cạnh bong bóng trả lời (thêm ngày 18/11/2026, chủ dự án yêu cầu; trước đó nằm ở mục Hoãn). Ai đã đăng nhập cũng thả được, kể cả lên bình luận của mình. Chỉ hiện con số, không hiện danh sách ai đã thả. | Threads, Instagram |

### Về thứ tự (quyết định 10)

Bình luận gốc là bình luận viết thẳng vào đối tượng, không trả lời ai.

Đã cân nhắc và chưa chọn cho bản đầu:

- **Nhiều vote nhất** (YouTube, Reddit). Tín hiệu chất lượng tốt nhất,
  nhưng app chưa có vote trên bình luận, và với luồng 0 đến 10 bình luận
  thì phần lớn hoà nhau ở 0, nên thứ tự thật vẫn do thời gian quyết định.
- **Được trả lời nhiều nhất.** Làm được ngay, nhưng nhiều trả lời không
  có nghĩa là hay: bình luận gây tranh cãi hoặc khiếm nhã kéo nhiều trả
  lời nhất, và cách xếp này đưa đúng nó lên đầu.

Về sau: thêm kiểu xếp **"Nổi bật"** (số tim là chính, số trả lời là
phụ); tim đã có từ C4d. Chỉ đổi mặc định sang "Nổi bật" khi các luồng
thường xuyên vượt khoảng 20 bình luận.

### Về việc xoá (quyết định 5, đổi ngày 18/11/2026)

Bản đầu theo Tildes: bình luận đã có người trả lời thì khi xoá để lại dòng
"Bình luận đã bị xoá" cho các trả lời bám vào, để một người không xoá được
lời của người khác. Trên máy thật nó thành hai dòng "đã bị xoá" chồng nhau
và một chữ "Thanks" không biết trả lời cái gì. Cách của Tildes hợp với
diễn đàn, nơi một trả lời tự nó là một lập luận; ở đây bình luận là một
dòng dưới một danh sách quán, và trả lời mất nghĩa khi câu gốc mất.

Nay (`20261118150000_comments_cascade.sql`, đã áp lên cơ sở dữ liệu thật
ngày 18/11/2026; ba bình luận thử đang có lúc đó đã bị xoá theo luật mới):

- Xoá bình luận là xoá cả nhánh bên dưới. Cái giá: bạn có thể mất trả lời
  của mình vì người khác xoá bình luận của họ. App nói điều này với người
  bấm xoá, không nói được với người bị mất.
- Xoá tài khoản thì bình luận của người đó và các trả lời bên dưới mất.
- Bình luận của người bị chặn (hoặc đã chặn mình) và mọi thứ bên dưới nó
  không được trả về cho người đọc đó; dữ liệu vẫn nguyên.
- Không còn dòng "đã bị xoá", không còn cột `deleted_at`, nội dung không
  bao giờ rỗng.

### Về thông báo (quyết định 6, viết lại ngày 19/11/2026)

Bản đầu chỉ có một câu: "chủ bộ và người đã tham gia luồng được báo".
Chủ dự án yêu cầu nghĩ kỹ hơn. Phần này là thiết kế; việc phải làm ở C7
và C11.

**Báo việc gì, cho ai**

| Việc xảy ra | Người được báo | Dòng trong Hoạt động |
|---|---|---|
| Có người bình luận vào bộ của bạn | Chủ bộ | "trang đã bình luận về *Cà phê Hội An*" + trích bình luận |
| Có người trả lời bình luận của bạn | Người viết bình luận được trả lời | "trang đã trả lời bạn" + trích trả lời |
| Có người tag bạn | Người được tag | "trang đã nhắc tới bạn" + trích bình luận |
| Có người thả tim bình luận của bạn | Người viết bình luận | "trang và 2 người khác thích bình luận của bạn" |

**Luật**

1. **Một bình luận, một người nhận, một dòng.** Một trả lời có thể vừa
   nằm trên bộ của bạn, vừa trả lời bạn, vừa tag bạn. Bạn chỉ thấy một
   dòng, theo lý do mạnh nhất: tag, rồi trả lời, rồi "trên bộ của bạn".
2. **Chỉ báo người được trả lời trực tiếp**, không báo mọi người đã viết
   trong luồng. Đây là chỗ đổi so với bản đầu. Báo cả luồng là cách
   Facebook làm và là lý do người ta tắt thông báo: bạn viết một câu, rồi
   nhận mười dòng về chuyện của người khác. Muốn gọi ai vào thì tag.
3. **Tim gộp theo bình luận**: một dòng cho mỗi bình luận được thả tim,
   mang tên người mới nhất và số người còn lại, đứng ở thời điểm của tim
   mới nhất. Mười tim là một dòng, không phải mười.
4. **Không báo việc của chính mình**, và không báo gì giữa hai người đã
   chặn nhau.
5. **Dòng còn khi việc còn**, như phần còn lại của Hoạt động: bình luận
   bị xoá thì dòng mất, tim rút lại thì mất, bộ chuyển về riêng tư thì
   dòng ẩn cho tới khi công khai lại. Vì vậy **không có bảng thông báo
   riêng**: các dòng được tính lúc đọc từ chính bảng bình luận, tag và
   tim. Lợi: không bao giờ có dòng trỏ vào thứ đã mất, và không có dữ
   liệu thứ hai phải giữ khớp. Giá: không có "đã đọc" cho từng dòng (xem
   "Cái gì là mới").
6. **Hai tuần**, cùng cửa sổ với Hoạt động hôm nay.
7. **Bấm vào dòng** thì mở màn Bình luận của bộ đó, cuộn tới đúng bình
   luận và làm nó nổi lên một nhịp. Màn Bình luận nhận thêm một tham số
   cho việc này.
8. **Người thả tim được nêu tên với người viết bình luận** (và chỉ với
   người đó), như lượt thích bộ sưu tập đang nêu tên với chủ bộ. Trong
   luồng vẫn chỉ hiện con số (quyết định 11). Chủ dự án chốt ngày
   19/11/2026.

**Cái gì là mới**

Một câu trả lời là thứ người ta cần biết *vừa có*. Màn Hoạt động chỉ là
một danh sách: không mở nó ra thì không biết có gì.

Chủ dự án chốt ngày 19/11/2026, làm ở C7c:

- Một mốc "lần cuối mở Hoạt động", lưu trên máy. Dòng mới hơn mốc có một
  chấm.
- **Một chấm trên tab cuối và trên cái chuông** ở Trang cá nhân khi có trả
  lời, tag hoặc bình luận mới hơn mốc. Tim không bật chấm: tim là tin
  vui, không phải việc cần đáp.

Mốc lưu trên máy nghĩa là đổi máy thì mọi thứ trong hai tuần lại "mới"
một lần. Chấp nhận được; lưu trên máy chủ thì thêm một bảng cho một cái
chấm.

**Thông báo đẩy (C11)**

Không có thông báo đẩy thì bình luận chỉ sống với người đang mở app. Đó
là giới hạn thật của bản đầu, không phải chi tiết: người được trả lời
không biết mình được trả lời cho tới lần mở app sau.

Nhưng thông báo đẩy là một tính năng riêng, lớn ngang C1:

- App chưa từng gửi thông báo từ máy chủ; nhắc lịch chuyến đi hôm nay là
  thông báo đặt sẵn trên máy (`lib/reminders.ts`).
- Cần: bảng lưu mã thiết bị, lời xin quyền đúng lúc (sau bình luận đầu
  tiên, không phải lúc mở app), một Edge Function gửi đi, gộp để mười tim
  không thành mười lần rung, công tắc theo từng loại trong Cài đặt.
- Chính sách quyền riêng tư phải nói về mã thiết bị
  (`app/src/lib/legal.ts`), và có thể cần một bản binary mới (phải kiểm
  tra quyền push của bản đang phát hành).

Vì vậy tách thành C11, làm sau khi bình luận đã phát hành và đã có người
dùng thật. Lúc đó chỉ đẩy ba loại cần đáp (trả lời, tag, bình luận trên
bộ của bạn); tim chỉ nằm trong Hoạt động.

**Đã cân nhắc và không chọn**

- *Bảng `notifications` ghi lúc việc xảy ra* (cách thông thường). Cho
  "đã đọc" từng dòng và đọc nhanh hơn. Không chọn cho bản đầu vì luật 5:
  mỗi lần xoá, rút tim, chặn, đổi công khai đều phải dọn bảng đó, và sót
  một chỗ là có dòng trỏ vào thứ không còn. Khi làm C11 sẽ xét lại, vì
  gửi đẩy cần biết "đã gửi cái gì".
- *Báo cho người theo dõi luồng* (nút "theo dõi bình luận"). Luồng ở đây
  ngắn; chưa có nhu cầu.
- *Email.* Không.

### Hoãn, sẽ làm sau

- Kiểu xếp "Nổi bật" theo số tim. Tim đã có (quyết định 11); thứ tự vẫn
  là mới nhất trước.
- Ảnh trong bình luận (trùng với Moment, bước 5 của kế hoạch feed).

## 2. Thiết kế để mở rộng

Ý chính: bình luận không biết gì về "bộ sưu tập". Nó gắn vào một **đối
tượng** (`Subject`), và hôm nay chỉ có một loại đối tượng.

### 2.1 Cơ sở dữ liệu

Bảy migration, theo thứ tự, đều đã áp lên cơ sở dữ liệu thật:
`20261118050000_comments`, `…120000_app_flag_testers`,
`…150000_comments_cascade`, `…190000_comment_likes`,
`20261119050000_comment_tags`, `…070000_comment_owner`,
`…080000_comment_news`.

**Bảng `comments`**

- `id`, `author` (bắt buộc; xoá tài khoản thì bình luận đi theo), `body`
  (1 đến 500 ký tự, không bao giờ rỗng), `created_at`.
- `parent_id` (bình luận cha), `root_id` (bình luận gốc của nhánh),
  `depth` (độ sâu thật, do trigger tính).
- **Cột đối tượng**: `collection_id` (khoá ngoại thật tới `collections`,
  xoá bộ thì xoá luồng). Ràng buộc: đúng một cột đối tượng có giá trị.
- Xoá một bình luận là xoá cả nhánh bên dưới (khoá ngoại `parent_id` xoá
  dây chuyền). Không có xoá mềm, không có dòng giữ chỗ.

Vì sao chọn "mỗi loại đối tượng một cột khoá ngoại" thay cho cặp
`subject_type` + `subject_id`: cặp chung chung không có khoá ngoại, nên
xoá một bộ sưu tập sẽ để lại bình luận mồ côi, và mọi kiểm tra quyền phải
tự viết tay. Cột khoá ngoại thật giữ được toàn vẹn dữ liệu, và thêm loại
mới chỉ là thêm một cột.

**Bảng `comment_mentions`**: `comment_id`, vị trí bắt đầu và độ dài trong
`body` (tính theo ký tự), rồi `person_id` hoặc `place_id` (khoá ngoại
thật). Tag lưu dạng liên kết, không phải chữ: người hoặc địa điểm bị xoá
thì dòng tag tự mất, đoạn chữ còn lại là chữ thường.

**Bảng `comment_likes`**: một dòng cho mỗi cặp (bình luận, người). Xoá
bình luận hoặc tài khoản thì tim đi theo.

**Một hàm quyết định "ai thấy đối tượng này"**:
`comment_subject_visible(...)`. Hôm nay: bộ sưu tập công khai, và chỉ
thế. Bộ chia sẻ riêng cho bạn bè không có luồng; bộ chuyển về riêng tư thì
luồng bị ẩn (không mất) cho tới khi công khai lại. Mọi quyền đọc và ghi
bình luận đều gọi hàm này, cộng với kiểm tra chặn nhau
(`is_blocked_pair`, đã có).

**Ba bảng không có policy nào.** Bật RLS và không cấp quyền gì cho ứng
dụng: đọc và ghi đều qua hàm. Lý do: luật "ai chặn ai, bộ nào công khai"
chỉ viết một chỗ; viết lại lần nữa bằng policy thì hai bản sẽ lệch nhau.
Ngoại lệ duy nhất là công tắc `collections.comments_off`, chủ bộ tự ghi
vào dòng của mình như với `is_public`.

**Các hàm đọc**

- `comments_seen(danh sách bộ)`: những bình luận người gọi được thấy. Bình
  luận của người bị chặn (hoặc đã chặn mình) **và mọi thứ bên dưới nó**
  không được trả về. Các hàm đọc khác đều đi qua hàm này.
- `comment_thread(bộ, thứ tự)`: cả luồng dạng phẳng, đúng thứ tự vẽ (gốc
  mới nhất trước, trả lời cũ nhất trước), kèm tag (tag địa điểm có `slug`)
  và tim (`likes`, `liked`). Khách chưa đăng nhập đọc được.
- `comment_previews(danh sách bộ)`: một dòng cho mỗi bộ người đọc thấy
  được, kể cả bộ chưa có bình luận: số đếm, `off`, và 2 bình luận mới
  nhất (ứng dụng hiện không dùng phần này). Một lần gọi cho cả lứa thẻ.
- `comment_taggable(bộ)`: ô soạn hỏi khi mở. Trả người và địa điểm tag
  được, cùng `off` (luồng đã tắt) và `mine` (người gọi là chủ bộ).
- `comment_news(từ lúc nào)`: các dòng thông báo của người gọi (xem "Về
  thông báo"). Tính lúc đọc; không có bảng thông báo.

**Các hàm ghi** (không cho chèn thẳng vào bảng)

- `post_comment(đối tượng, cha, nội dung, danh sách tag)`: kiểm tra quyền
  thấy, bình luận có đang tắt không, giới hạn ngày, bộ lọc từ cấm, cha có
  cùng đối tượng không, từng tag có hợp lệ không; rồi ghi bình luận và tag
  trong một giao dịch.
- `delete_comment(id)`: tác giả hoặc chủ đối tượng.
- `like_comment(id, bật/tắt)`: gọi lặp lại cũng không sao.

**Phần đi kèm**

- `collections.comments_off`: tắt là không nhận bình luận mới, bình luận
  cũ vẫn đọc được.
- `banned_words`: danh sách từ cấm. **Đang trống**; Data Desk chưa có
  trang sửa (C8).
- `reports.kind` có giá trị `comment`. Data Desk **chưa hiện đúng** loại
  này (C8).
- `app_flag_testers`: bật một cờ riêng cho vài tài khoản (mục 3b).
- Đã bỏ: cột `collections.comment_count` đếm sẵn bằng trigger (bản đầu của
  kế hoạch). Bảng `collections` đã có trigger và policy cho chủ bộ sửa;
  thêm một cột đếm là thêm một thứ ứng dụng có thể ghi và trigger phải
  canh. Với khoảng sáu chục bộ công khai, đếm lúc hỏi là một lần quét
  index. Khi nào chậm thì mới thành cột.

### 2.2 Ứng dụng

Mọi hàm và thành phần nhận `Subject = { kind: 'collection', id }`, không
nhận "bộ sưu tập".

- **Thuần, kiểm thử 100%** (`app/src/lib`): `comments.ts` (dựng cây, ép
  độ sâu hiển thị về 2, cắt nội dung thành đoạn chữ và đoạn tag, tim),
  `commentTags.ts` (tag trong lúc soạn), `commentNews.ts` (dòng thông báo
  và hai nhóm của Hoạt động), `commentWords.ts` (câu từ chối),
  `commentsChanged.ts` (báo cả app hỏi lại sau khi viết hoặc xoá).
- **Gọi máy chủ**: `lib/data/comments.ts`, và các hook trong
  `lib/data/hooks.ts`.
- **Thành phần** (`app/src/components`): `CommentRow`, `CommentComposer`,
  `CommentTagOffers`, `CommentQuick` (ô gõ tại chỗ, gắn một lần ở
  `App.tsx`), và bong bóng trên `ActivityCard`.
- **Màn Bình luận**: `screens/CommentsScreen.tsx`, với các phần của nó
  trong `screens/comments/`: `useThreadWriting` (viết, trả lời),
  `useCommentHearts` (tim), `useCommentMenu` (xoá, báo cáo),
  `useThreadOwner` (tắt bình luận), `useThreadFocus` (mở đúng một bình
  luận).
- **Lối vào**: `screens/collectionDetail/CommentsDoor` (trang bộ sưu tập)
  và `screens/person/useCardComments` (các thẻ).
- **Hoạt động**: `screens/activity/ActivityRows`.
- Cờ `comments` trong `app_flags`, mặc định tắt (`app/src/lib/flags.ts`).

### 2.3 Thêm check-in về sau cần những gì

Đây là phép thử cho thiết kế. Khi làm bước check-in:

1. Một migration: thêm cột `checkin_id` vào `comments` và nới ràng buộc
   "đúng một cột".
2. Thêm một nhánh vào `comment_subject_visible`: chỉ bạn bè của người
   check-in thấy.
3. Thêm tham số check-in cho `comment_thread`, `comment_previews` và
   `post_comment` (không cần cột đếm, xem 2.1).
4. Ứng dụng: thêm `{ kind: 'checkin', id }` vào `Subject`; địa điểm tag
   được là chính địa điểm của check-in.

Không đổi: bảng tag, hàm đăng và xoá, bộ lọc, báo cáo, chặn, giới hạn,
toàn bộ giao diện luồng và ô soạn.

Lượt thích check-in (bước 3 của kế hoạch feed) không thuộc tài liệu này,
nhưng nên theo đúng cách "mỗi loại đối tượng một cột" để hai phần giống
nhau.

## 3. Việc cần làm

Mỗi mục là một PR, merge sau cờ tắt, theo thứ tự.

**C0. Nền** — xong
- Tài liệu này vào repo, thêm dòng vào `CLAUDE.md`.
- Khoá cờ `comments`, mặc định tắt.

**C1. Cơ sở dữ liệu** — xong (`20261118050000_comments.sql`; đã áp lên
cơ sở dữ liệu thật ngày 18/11/2026, kiểu dữ liệu đã sinh lại)
- Migration: hai bảng, các hàm ở 2.1, quyền truy cập, trigger độ sâu,
  `banned_words`, `reports.kind`.
- Kiểm thử trong `supabase/tests`: người lạ không thấy bình luận trên bộ
  riêng tư; hai người chặn nhau không thấy nhau; quá 30 một ngày bị từ
  chối; từ cấm bị từ chối; cha khác đối tượng bị từ chối; tag người không
  hợp lệ bị từ chối. (Luật xoá của bản này, để lại dòng giữ chỗ, đã được
  thay ở `…150000_comments_cascade`.)
- Áp migration lên cơ sở dữ liệu thật, sinh lại kiểu dữ liệu.

**C2. Lõi ứng dụng** — xong
- `Subject`, `lib/comments.ts`, `lib/data/comments.ts`, kèm kiểm thử.
- Vị trí tag và độ dài nội dung tính theo **ký tự**, như Postgres, không
  theo đơn vị UTF-16 của JavaScript: một emoji đứng trước tag sẽ làm lệch
  một chữ nếu cắt chuỗi thẳng. Ô soạn (C4, C5) phải dùng `bodyLength` và
  tính vị trí tag theo cùng cách.
- Thứ tự vẽ: dưới một bình luận gốc, mỗi trả lời trực tiếp đi kèm ngay
  sau nó mọi thứ nói bên dưới, cũ trước, ở mức thụt thứ 2 (mức sâu nhất
  được vẽ); bình luận sâu hơn mức đó kèm tên người được trả lời.

**C3. Đọc** — chia hai PR

*C3a — xong:*
- Màn `Comments` (tham số là `subject`): cây thụt 2 mức,
  "Xem thêm N trả lời" sau 2 trả lời đầu của mỗi nhánh, 10 bình luận gốc
  mỗi lứa và tự thêm khi cuộn gần cuối (dùng lại `lib/feed`), kéo để tải
  lại, ba trạng thái (đang tải, trống, lỗi kèm Thử lại).
- Trang chi tiết bộ sưu tập: nút bong bóng cạnh nút Chia sẻ, chỉ hiện khi
  cờ bật và bộ đang công khai.
- Khách chưa đăng nhập đọc được.
- Luồng không lưu đệm giữa các lần mở: bình luận vừa bị xoá hoặc của
  người vừa bị chặn không được vẽ lại từ bản cũ.

*C3b — xong, rồi gọn lại ngày 18/11/2026 sau khi xem trên máy:*
- `ActivityCard`: nút bong bóng cạnh tim, kèm số khi có bình luận. Thẻ của
  bộ chưa có bình luận chỉ có nút, không có số.
- **Đã bỏ** hai dòng bình luận xem trước và "Xem tất cả N bình luận" dưới
  chân thẻ. Trên máy chúng đọc như hai mẩu chữ rời ("trang Thanks"), làm
  thẻ cao thấp không đều và không nói thêm gì ngoài con số. Hàm
  `comment_previews` vẫn trả 2 bình luận mới nhất; app chỉ dùng số đếm.
- Một lần hỏi cho mọi thẻ đang vẽ trên Trang cá nhân; thêm thẻ thì hỏi lại
  một lần. Cờ tắt thì không hỏi gì.
- Nút ở trang chi tiết bộ sưu tập mang cùng con số, từ cùng hàm.

**C4. Viết** — chia hai PR

*C4a — xong, rồi làm lại ngày 18/11/2026 sau khi xem trên máy:*
- Bản đầu của C4a là một **màn soạn riêng** (`CommentForm`). Trên máy thật
  nó thành ba lần bấm để nói một câu (bong bóng, "Viết bình luận…", rồi
  màn soạn), trong khi Threads chỉ cần một. Chủ dự án yêu cầu đổi.
- Nay: **ô soạn ghim dưới chân màn Bình luận** (`CommentComposer`), và màn
  này **ẩn thanh tab** khi đang ở trước (`useTabBarAway`); mở Trang cá
  nhân từ một bình luận thì thanh tab trở lại. Màn soạn riêng và dòng
  "Viết bình luận…" ở đầu trang đã bỏ.
- "Trả lời" không mở gì: nó đặt bình luận đó làm thứ được trả lời, hiện
  dòng "Đang trả lời …" (có ✕ để thôi) phía trên ô và đưa con trỏ vào ô.
- Bộ đếm ký tự chỉ hiện trong 50 ký tự cuối trước giới hạn. Nút gửi chỉ
  sáng khi có gì để gửi. Bị từ chối thì câu lý do hiện trên ô, chữ đã gõ
  và người đang được trả lời đều giữ nguyên.
- Khách chưa đăng nhập: ô là một nút mời đăng nhập, "Trả lời" cũng vậy.
- Không tự chèn "@tên" vào nội dung khi trả lời sâu: màn luồng đã tự hiện
  tên người được trả lời từ quan hệ cha con.
- Sau khi đăng, luồng, số trên thẻ và số trên nút đều tự hỏi lại
  (`lib/commentsChanged`). Không vẽ trước bình luận khi máy chủ chưa nhận.
- Chưa kiểm được bằng kiểm thử tự động: ô có trượt lên đúng theo bàn phím
  không. Phải xem trên máy.
- **Gửi xong thì bàn phím hạ xuống** (19/11/2026, sau khi xem trên máy:
  bàn phím ở lại che nửa trang, đúng chỗ bình luận vừa viết hiện ra).
  Luồng bình luận không phải khung chat. Bị máy chủ từ chối thì bàn phím
  ở lại để sửa chữ.

*C4d — xong: tim trên bình luận (chủ dự án yêu cầu 18/11/2026;
migration đã áp lên cơ sở dữ liệu thật ngày 19/11/2026, kiểu dữ liệu đã
sinh lại):*
- Máy chủ (`20261118190000_comment_likes.sql`): bảng `comment_likes`
  (một dòng cho mỗi cặp bình luận và người; xoá bình luận hoặc xoá tài
  khoản thì tim đi theo), hàm `like_comment(id, bật/tắt)` gọi lặp lại
  cũng không sao, và `comment_thread` trả thêm `likes`, `liked`. Bảng
  không có policy nào: chỉ đọc và ghi qua hai hàm đó. Không thả được lên
  bình luận mình không được thấy (bộ riêng tư, hai người chặn nhau).
- Ứng dụng: trái tim (`LikeHeart`, cùng một trái tim với bộ sưu tập) đứng
  trước bong bóng. Bấm là **vẽ ngay**, rồi mới báo máy chủ
  (`useCommentHearts`); máy chủ từ chối thì trái tim lặng lẽ trở lại như
  cũ, không báo lỗi. Thả tim không tải lại luồng. Khách bấm thì được mời
  đăng nhập.
- Ứng dụng đọc `likes`, `liked` như dữ liệu chưa tin: thiếu thì coi là 0
  và chưa thả, nên bản app này chạy được cả khi migration chưa lên live.
- Số tim **không** tính những người đã bị chặn riêng ra: con số là của
  mọi người. Tên người thả thì không hiện ở đâu.

*C4c — xong (chủ dự án yêu cầu 18/11/2026):*
- Bộ **chưa có bình luận nào**: bấm bong bóng (trên trang bộ sưu tập hoặc
  trên thẻ) thì ô soạn và bàn phím bật lên ngay tại chỗ, phía trên ô ghi
  tên bộ, không chuyển trang (`CommentQuick`, dùng lại đúng
  `CommentComposer`). Gửi xong thì ô đóng và số trên bong bóng thành 1.
- Bộ đã có bình luận thì vẫn sang màn Bình luận.
- **Lỗi đã sửa (18/11/2026)**: trên máy thật, nút gửi của ô bật tại chỗ
  phải bấm hai lần; lần đầu chỉ làm bàn phím hạ xuống. Nguyên nhân: ô (một
  `Modal`) được vẽ ngay cạnh nút bong bóng, tức là nằm trong `ScrollView`
  của trang; `ScrollView` của React Native nuốt cú chạm đầu tiên khi bàn
  phím đang mở, và nó xét "nằm trong" theo cây React chứ không theo chỗ
  vẽ (facebook/react-native#28871). Nay cả app chỉ có **một** ô, gắn phía
  trên bộ điều hướng (`CommentQuickProvider` trong `App.tsx`), không có
  `ScrollView` nào là cha. Chủ dự án xác nhận trên máy ngày 19/11/2026:
  bấm một lần là gửi.
- Chỉ bật tại chỗ khi **đã biết chắc** luồng trống: đã đăng nhập, con số
  đã về và không đang được hỏi lại. Chưa biết thì mở luồng, để không che
  mất bình luận đang có. Khách cũng mở luồng, nơi họ được mời đăng nhập.
- "Trả lời" dưới mỗi bình luận nay là **biểu tượng bong bóng**, không phải
  chữ, để dành chỗ cho trái tim cạnh nó khi bình luận có lượt thích.
- **Số cạnh bong bóng** (chủ dự án, 19/11/2026, theo Threads): số bình
  luận nằm dưới bình luận đó, đếm **cả nhánh** chứ không chỉ trả lời trực
  tiếp, vì màn hình dồn các cấp sâu về cấp ba và người đọc đếm dòng chứ
  không đếm cây. Bằng 0 thì không hiện. Bong bóng không tô đầy. Tính ở
  app từ chính luồng máy chủ trả về (`threadOf`), nên không cần migration
  và tự khớp với những gì người đọc được thấy.

*C4b — xong:*
- Nút ⋯ ở cuối mỗi bình luận (chỉ khi đã đăng nhập).
- Bình luận của mình: "Xoá bình luận", hỏi lại một lần và nói trước rằng
  các trả lời bên dưới cũng bị xoá. Xoá xong thì luồng và các con số tự
  tải lại; lỗi thì báo và không đổi gì.
- Bình luận của người khác: "Báo cáo bình luận", đi qua đúng luồng báo
  cáo sẵn có (bốn lý do, cùng hàng chờ của Data Desk) với loại `comment`.
- Chủ bộ xoá bình luận của người khác: làm ở C6.

**C5. Tag** — xong (`20261119050000_comment_tags.sql`; đã áp lên cơ sở
dữ liệu thật ngày 19/11/2026, kiểu dữ liệu đã sinh lại)
- Máy chủ: hàm `comment_taggable(bộ)` trả một lần cả **người** được tag
  (chủ bộ, rồi người đã viết trong luồng theo bình luận mới nhất, rồi bạn
  bè; không có chính mình, không có người chặn nhau) và **địa điểm** của
  bộ (chỉ địa điểm đã duyệt, theo thứ tự của bộ). Danh sách người khớp
  đúng với luật của `post_comment`; kiểm thử giữ hai bên với nhau bằng
  cách đăng thử một tag cho từng người được trả về.
- Mỗi tag địa điểm trong `comment_thread` nay mang thêm `slug`, nên bấm
  vào là mở trang địa điểm. Địa điểm bị gỡ khỏi bộ sau khi bình luận đã
  viết thì tag vẫn mở được.
- Ô soạn: gõ **"@"** thì hiện tối đa 5 dòng phía trên ô, người trước rồi
  địa điểm (giữ 2 dòng cho địa điểm khi cả hai đều nhiều), gõ thêm chữ
  thì lọc theo đầu handle, đầu tên, hoặc đầu một từ trong tên, không
  phân biệt dấu. Bấm một dòng thì "@…" đang gõ thành "@handle" hoặc
  "@Tên quán" kèm một dấu cách. Dùng được ở cả màn Bình luận và ô gõ tại
  chỗ.
- **Khác với bản kế hoạch đầu: không có nút địa điểm riêng.** Địa điểm
  cũng vào từ "@". Lý do: tên quán chèn từ một nút là chữ thường, không
  có gì cho thấy nó là tag (sửa một chữ là mất tag mà không ai biết);
  viết thành "@Tên quán" thì nhìn là biết. Và viên ô soạn đã có ảnh, bộ
  đếm, nút gửi; thêm một nút nữa là chật.
- Sửa vào chữ của một tag thì tag đó thành chữ thường (không xoá cả cụm
  bằng một lần lùi như Instagram, vì việc đó đòi đặt con trỏ từ phía app,
  thứ React Native làm không ổn định trên iOS).
- Trong ô soạn, tag chưa được tô màu; đăng xong mới thấy màu. Tối đa 10
  tag một bình luận: tới đó "@" thôi gợi ý.
- Vị trí tag tính theo ký tự và theo nội dung đã cắt khoảng trắng hai đầu
  (`lib/commentTags.outgoing`), khớp với cách máy chủ đo.
- Chưa kiểm được bằng kiểm thử tự động: con trỏ và bàn phím trên máy thật
  khi chọn một dòng gợi ý ở giữa câu.

**C6. Quyền của chủ bộ** — xong (`20261119070000_comment_owner.sql`; đã
áp lên cơ sở dữ liệu thật ngày 19/11/2026, kiểu dữ liệu đã sinh lại)
- **Công tắc tắt bình luận nằm trên chính màn Bình luận**, sau nút ⋯ ở
  đầu trang mà chỉ chủ bộ thấy, không nằm trong màn sửa bộ sưu tập như
  bản kế hoạch đầu. Lý do: Instagram và Threads đặt nó trên bài, không
  trong màn sửa; màn sửa lưu bằng nút Lưu còn công tắc này phải có hiệu
  lực ngay; và hàm của màn sửa đã chạm trần độ dài.
- Bấm ⋯ thì hiện **tấm trượt của app** với hai dòng "Bật bình luận" và
  "Tắt bình luận", dòng đang đúng có dấu tích, mỗi dòng nói rõ nghĩa của
  nó; cùng kiểu với tấm "Ai xem được bộ sưu tập". Bản đầu dùng hộp hỏi của
  hệ điều hành; chủ dự án yêu cầu đổi ngày 19/11/2026 vì mọi nút ⋯ khác
  trong app đều mở tấm trượt. Không hỏi lại lần hai: tắt bình luận không
  xoá gì và bật lại được ngay.
- Luồng đã tắt: chỗ ô soạn là một dòng "Chủ bộ sưu tập đã tắt bình luận"
  (chủ bộ đọc "Bạn đã tắt…"), bong bóng trả lời **mờ đi và không bấm
  được**, tim vẫn thả được.
- Bong bóng trên thẻ và trên trang bộ sưu tập: luồng đã tắt mà chưa có
  bình luận nào thì **mờ đi và không mở gì** (không có gì để đọc, không
  viết được). Riêng chủ bộ, bong bóng trên trang bộ của mình vẫn sáng và
  luôn mở màn Bình luận (không bật ô gõ tại chỗ), vì công tắc nằm ở đó.
- Mờ, không ẩn (chủ dự án, 19/11/2026, sau khi xem trên máy): bản đầu
  của C6 cho các bong bóng biến mất; biểu tượng mất đi làm hàng nút xô
  lệch và người xem không hiểu vì sao.
- Chủ bộ xoá được bình luận của người khác trên bộ của mình: ⋯ của bình
  luận có cả "Báo cáo bình luận" và "Xoá bình luận".
- Máy chủ: `comment_previews` nay trả một dòng cho mọi bộ được hỏi mà
  người đọc thấy được (kể cả bộ chưa có bình luận), kèm `off`;
  `comment_taggable` trả thêm `off` và `mine`. Không luật nào đổi: tắt
  bình luận và quyền xoá của chủ bộ đã có ở máy chủ từ C1.

**C7. Hoạt động** — thiết kế ở "Về thông báo"; chia ba PR

*C7a — máy chủ — xong (`20261119080000_comment_news.sql`; đã áp lên cơ
sở dữ liệu thật ngày 19/11/2026, kiểu dữ liệu đã sinh lại):*
- Hàm `comment_news(từ lúc nào)` trả các dòng của người gọi: loại (`tag`,
  `reply`, `on_list`, `heart`), bình luận nào, bộ nào (id, slug, tên theo
  từng ngôn ngữ), ai làm, nội dung bình luận, lúc nào, và với tim là số
  người còn lại. Đã áp luật 1 đến 5. Mới nhất trước, tối đa 200 dòng; cửa
  sổ do app gửi, máy chủ không cho quá 31 ngày.
- Kiểm thử: mỗi loại tới đúng người; một bình luận chỉ ra một dòng cho
  một người; không có dòng cho việc của chính mình; chặn nhau thì không
  có; xoá bình luận, rút tim, bộ về riêng tư thì dòng mất, công khai lại
  thì dòng trở lại.
- Chủ bộ cũng nhận dòng cho **trả lời** viết trên bộ của mình (không chỉ
  bình luận gốc): mọi thứ viết trên bộ là việc của chủ bộ, người có quyền
  xoá nó.

*C7b — ứng dụng — xong:*
- Màn Hoạt động nay có **hai nhóm** (chủ dự án chốt ngày 19/11/2026):
  **"Dành cho bạn"** ở trên, gồm mọi việc người khác làm (thích hoặc sao
  chép bộ của bạn, chấp nhận lời mời kết bạn của bạn, và bốn loại dòng
  bình luận), rồi **"Việc bạn đã làm"** ở dưới (lượt thích, bản sao của
  bạn, lời mời bạn đã chấp nhận). Mỗi nhóm mới nhất trước; nhóm nào trống
  thì không có tiêu đề.
- Vì sao tách: trước đó là một dòng thời gian trộn cả hai, và sau
  `docs/profile-home-plan.md` màn này mở từ cái chuông. Bấm chuông mà phải
  dò một câu trả lời giữa chín dòng "Bạn đã thích…" là sai với điều cái
  chuông hứa. Đã cân nhắc và bỏ: giữ một dòng thời gian (câu trả lời bị
  chìm), và hai trang hay hai tab (thêm một chỗ phải tìm).
- Dòng bình luận: mặt người làm, dấu nhỏ ở góc theo loại, một câu ("trang
  đã trả lời bạn"), rồi **trích một dòng** chính bình luận đó. Với tim thì
  trích bình luận được thả tim, và đếm người còn lại ("và 2 người khác").
- Bấm một dòng thì mở màn Bình luận của bộ đó **đúng tại bình luận ấy**
  (C7b-2, `useThreadFocus`): gốc chứa nó được vẽ ra dù nằm ngoài 10 gốc
  đầu, nhánh được mở nếu nó là một trả lời đang bị gập, trang cuộn tới nó
  một lần, và nó sáng lên khoảng một giây rưỡi rồi tắt. Bình luận đã bị
  xoá thì luồng mở ở đầu trang như thường, không báo gì.
- Chưa kiểm được bằng kiểm thử tự động: cuộn có mượt và dừng đúng chỗ
  trên máy thật không, và một giây rưỡi sáng có vừa không.
- **Bỏ khỏi C7b:** "con số trên dòng Hoạt động ở Tài khoản tính thêm bình
  luận". Theo `profile-home-plan.md` dòng đó sẽ bị bỏ, thay bằng chuông.
- Dòng bình luận được hỏi bằng một hook riêng, không nằm trong ba nguồn
  sẵn có của màn. Hệ quả: nếu riêng phần này lỗi thì màn không báo lỗi,
  chỉ không có dòng bình luận.

*C7c — cái gì là mới — xong, do phiên làm Trang cá nhân làm (chủ dự án,
19/11/2026); khớp `docs/profile-home-plan.md`, mục 3 và 8:*
- **Một bản tin bình luận cho cả app** (`lib/freshNews`): màn Hoạt động,
  chấm trên tab cuối và chấm trên chuông đọc cùng một bản, cùng một con
  số (`fresh`). Chuông tự đọc hook đó, không nhận số từ ngoài vào.
- **Chấm trên tab cuối và trên chuông** khi có trả lời, tag hoặc bình
  luận mới hơn mốc. Tim không bật chấm. VoiceOver đọc kèm con số.
- **Mốc lưu trên máy, theo từng tài khoản**, và là *thời điểm của dòng
  mới nhất mà Hoạt động đã hiện*, không phải giờ của máy lúc mở màn. Đây
  là chỗ khác với câu chữ ban đầu ("lần cuối mở Hoạt động"). Lý do: so
  dòng với dòng thì đồng hồ máy sai hay đổi múi giờ không làm gì "mới"
  hay "cũ" oan. Đã cân nhắc và bỏ: giờ của máy lúc mở màn (máy chạy
  nhanh 5 phút thì mọi trả lời trong 5 phút tới bị coi là đã xem).
- **Mở Hoạt động là đã xem:** màn hỏi lại bản tin lúc mở, đợi câu trả
  lời đó rồi mới dời mốc (bản đang giữ có thể cũ vài phút; dời mốc trước
  thì có thể vượt qua một trả lời máy chưa biết). Hỏi lỗi thì mốc đứng
  yên, chấm còn đó cho lần sau.
- **Chấm trên dòng:** mọi dòng trong "Dành cho bạn" mới hơn mốc lúc mở
  màn có một chấm ở cuối dòng, kể cả tim và lượt thích; chấm ở lại suốt
  lần xem đó. "Việc bạn đã làm" không bao giờ có chấm.
- **Hỏi lại khi nào** (chưa có thông báo đẩy nên chấm chỉ mới bằng lần
  hỏi gần nhất): lúc mở app, sau khi có bình luận được viết trong app,
  khi quay lại app và khi đổi tab (hai cái sau chỉ khi câu trả lời đã cũ
  hơn 2 phút), và mỗi lần mở Hoạt động.
- Giới hạn đã biết: máy mới thì mọi dòng trong hai tuần là "mới" một
  lần; chưa xem trên máy thật.

**C8. Data Desk** — việc kế tiếp của phiên bình luận
- Hàng chờ báo cáo hiện loại `comment` kèm nội dung; nút gỡ bình luận.
  Hiện Data Desk coi mọi báo cáo không phải bộ sưu tập là "profile", nên
  báo cáo bình luận hiện sai loại và không có nội dung. Trên cơ sở dữ
  liệu thật đã có 1 báo cáo như vậy (từ tài khoản thử).
- Trang sửa danh sách từ cấm.

**C9. Pháp lý và cửa hàng**
- Điều khoản: thêm bình luận vào danh sách nội dung do người dùng viết và
  vào câu "mọi thứ đều báo cáo được".
- Chính sách quyền riêng tư: bình luận hiện cho ai, tag, và bình luận có
  trong "bản sao dữ liệu của bạn".
- Bản sao dữ liệu: thêm bình luận của người dùng.
- Ghi chú cho App Review và khai báo nội dung do người dùng tạo trên App
  Store Connect.
- Một luồng Maestro: mở luồng, đăng, trả lời, xoá.

**C10. Phát hành**
- Bật cờ, nộp bản mới, theo dõi kết quả duyệt.

**C11. Thông báo đẩy** — sau khi phát hành; xem "Về thông báo"
- Bắt đầu bằng một trang đề xuất riêng: bảng mã thiết bị, lúc xin quyền,
  Edge Function gửi, gộp, công tắc theo loại, phần chính sách quyền riêng
  tư, và có cần bản binary mới không.

## 3b. Xem thử trước khi bật cho mọi người

Cờ `comments` là một dòng cho mọi máy. Để xem trên máy thật mà không bật
cho tất cả, có bảng `app_flag_testers` (18/11/2026): một dòng (khoá, tài
khoản) bật cờ đó riêng cho tài khoản ấy. Chỉ bật thêm được, không tắt
bớt; chỉ sửa được trong SQL editor; mỗi người chỉ đọc được dòng của mình.

Đang bật `comments` cho: **@trang**, **@tuananh**.

Thêm một người:

```sql
insert into public.app_flag_testers (key, user_id)
select 'comments', id from public.profiles where handle = '<handle>';
```

Bỏ một người: `delete` dòng tương ứng. App đọc lại khi mở và mỗi lần đăng
nhập, đăng xuất. Trước C10 nên xoá hết các dòng này, vì lúc đó cờ chung
đã bật.

## 4. Còn mở

1. ~~Luồng đầy đủ mở ở đâu~~ — **đã chốt 18/11/2026: màn riêng**, không
   phải tấm trượt từ dưới lên kiểu Instagram. Lý do: cây lồng cộng bàn
   phím cần đủ chiều cao (trong tấm trượt, bật bàn phím là không còn thấy
   bình luận đang trả lời); màn Hoạt động (C7) cần mở thẳng vào một bình
   luận, mà màn riêng thì có sẵn địa chỉ. Threads cũng mở bài thành màn riêng;
   không lấy kiểu "mỗi trả lời là một màn" của Threads vì luồng ở đây
   ngắn.
2. **Danh sách từ cấm ban đầu**: cần cả tiếng Việt và tiếng Anh. Ai soạn
   bản đầu. Chốt trước C10; C1 tạo bảng rỗng.

## 5. Rủi ro

- **Khối lượng**: đây là thay đổi lớn nhất từ trước tới giờ ở tầng dữ
  liệu (3 bảng, 12 hàm, trigger).
- **Mật độ**: 126 hồ sơ. Luồng trống là trạng thái thường gặp, nên thẻ
  không hiện gì về bình luận khi chưa có cái nào, ngoài nút mở luồng.
- **Kiểm duyệt**: báo cáo về bàn biên tập trong 24 giờ là cam kết đã có
  trong điều khoản; bình luận làm tăng số báo cáo.
