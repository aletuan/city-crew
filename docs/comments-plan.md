# Kế hoạch: bình luận trên bộ sưu tập

Soạn 18/11/2026, chủ dự án duyệt cùng ngày. Là một phần của
`docs/collection-feed-plan.md`. Tài liệu này ghi quyết định, thiết kế và
danh sách việc phải làm. Mỗi việc xong thì đánh dấu ở mục 3, trong chính
PR làm việc đó.

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
| 6 | Thông báo | Chủ bộ và người đã tham gia luồng được báo trong màn Hoạt động sẵn có. Chưa có thông báo đẩy. | Letterboxd |
| 7 | Giới hạn | 500 ký tự; 30 bình luận mỗi người mỗi ngày. | |
| 8 | An toàn (Apple 1.2) | Bộ lọc từ cấm lúc đăng; báo cáo từng bình luận; hai người chặn nhau không thấy bình luận của nhau. | App Review Guidelines 1.2 |
| 9 | Phát hành | Làm sau cờ `comments` (tắt sẵn), merge dần; bật trong một bản nộp duyệt kèm ghi chú cho App Review. | Điều 2.5.2 |
| 11 | Tim | Mỗi bình luận và mỗi trả lời có **một trái tim**, cạnh bong bóng trả lời (thêm ngày 18/11/2026, chủ dự án yêu cầu; trước đó nằm ở mục Hoãn). Ai đã đăng nhập cũng thả được, kể cả lên bình luận của mình. Chỉ hiện con số, không hiện danh sách ai đã thả. | Threads, Instagram |
| 10 | Thứ tự | Bình luận gốc: **mới nhất trước**. Trả lời trong một nhánh: cũ trước. Thứ tự là một tham số của hàm đọc luồng, không viết cứng. | Xem dưới |

### Về thứ tự (quyết định 10)

Bình luận gốc là bình luận viết thẳng vào đối tượng, không trả lời ai.

Đã cân nhắc và chưa chọn cho bản đầu:

- **Nhiều vote nhất** (YouTube, Reddit). Tín hiệu chất lượng tốt nhất,
  nhưng app chưa có vote trên bình luận, và với luồng 0 đến 10 bình luận
  thì phần lớn hoà nhau ở 0, nên thứ tự thật vẫn do thời gian quyết định.
- **Được trả lời nhiều nhất.** Làm được ngay, nhưng nhiều trả lời không
  có nghĩa là hay: bình luận gây tranh cãi hoặc khiếm nhã kéo nhiều trả
  lời nhất, và cách xếp này đưa đúng nó lên đầu.

Về sau: khi làm tim trên bình luận, thêm kiểu xếp **"Nổi bật"** (số tim
là chính, số trả lời là phụ). Chỉ đổi mặc định sang "Nổi bật" khi các
luồng thường xuyên vượt khoảng 20 bình luận.

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

### Hoãn, sẽ làm sau

- Kiểu xếp "Nổi bật" theo số tim. Tim đã có (quyết định 11); thứ tự vẫn
  là mới nhất trước.
- Báo cho người viết khi bình luận của họ được thả tim. Xem lại ở C7.
- Ảnh trong bình luận (trùng với Moment, bước 5 của kế hoạch feed).

## 2. Thiết kế để mở rộng

Ý chính: bình luận không biết gì về "bộ sưu tập". Nó gắn vào một **đối
tượng** (`Subject`), và hôm nay chỉ có một loại đối tượng.

### 2.1 Cơ sở dữ liệu

**Bảng `comments`**

- `id`, `author` (tài khoản; khi tài khoản bị xoá thì thành rỗng), `body`
  (1 đến 500 ký tự; rỗng khi đã xoá), `created_at`, `deleted_at`.
- `parent_id` (bình luận cha), `root_id` (bình luận gốc của nhánh),
  `depth` (độ sâu thật, do trigger tính).
- **Cột đối tượng**: `collection_id` (khoá ngoại thật tới `collections`,
  xoá bộ thì xoá luồng). Ràng buộc: đúng một cột đối tượng có giá trị.

Vì sao chọn "mỗi loại đối tượng một cột khoá ngoại" thay cho cặp
`subject_type` + `subject_id`: cặp chung chung không có khoá ngoại, nên
xoá một bộ sưu tập sẽ để lại bình luận mồ côi, và mọi kiểm tra quyền phải
tự viết tay. Cột khoá ngoại thật giữ được toàn vẹn dữ liệu, và thêm loại
mới chỉ là thêm một cột.

**Bảng `comment_mentions`**: `comment_id`, vị trí bắt đầu và độ dài trong
`body`, rồi `person_id` hoặc `place_id` (khoá ngoại thật). Tag lưu dạng
liên kết, không phải chữ: người hoặc địa điểm bị xoá thì dòng tag tự mất,
đoạn chữ còn lại là chữ thường.

**Một hàm quyết định "ai thấy đối tượng này"**:
`comment_subject_visible(...)`. Hôm nay: bộ sưu tập công khai, và chỉ
thế. Bộ chia sẻ riêng cho bạn bè không có luồng; bộ chuyển về riêng tư thì
luồng bị ẩn (không mất) cho tới khi công khai lại. Mọi quyền đọc và ghi
bình luận đều gọi hàm này, cộng với kiểm tra chặn nhau
(`is_blocked_pair`, đã có).

**Hai bảng không có policy nào.** Bật RLS và không cấp quyền gì cho ứng
dụng: đọc cũng qua hàm (`comment_thread`, `comment_previews`), ghi cũng
qua hàm. Lý do: luật "ai chặn ai, bộ nào công khai, bình luận đã xoá còn
hiện gì" chỉ viết một chỗ; viết lại lần nữa bằng policy thì hai bản sẽ
lệch nhau.

**Đọc**: `comment_thread(bộ, thứ tự)` trả cả luồng dạng phẳng, đúng thứ
tự vẽ (gốc mới nhất trước, trả lời cũ nhất trước). Khách chưa đăng nhập
đọc được, vì luồng công khai như chính bộ sưu tập. Bình luận của người bị
chặn (hoặc đã chặn mình) trả về y như bình luận đã xoá, để ứng dụng không
phân biệt được hai trường hợp.

**Ghi chỉ qua hàm phía máy chủ**, không cho chèn thẳng vào bảng:

- `post_comment(đối tượng, cha, nội dung, danh sách tag)`: kiểm tra quyền
  thấy, bình luận có đang tắt không, giới hạn ngày, bộ lọc từ cấm, cha có
  cùng đối tượng không, từng tag có hợp lệ không; rồi ghi bình luận và tag
  trong một giao dịch.
- `delete_comment(id)`: tác giả hoặc chủ đối tượng. Còn con thì xoá mềm
  (rỗng nội dung), hết con thì xoá hẳn và dọn ngược lên các dòng giữ chỗ
  không còn con.

**Phần đi kèm**

- `collections.comments_off` (công tắc của chủ bộ): tắt là không nhận
  bình luận mới, bình luận cũ vẫn đọc được.
- `comment_previews(danh sách đối tượng)`: trả **số đếm** và 2 bình luận
  mới nhất cho mỗi thẻ, một lần gọi cho cả lứa thẻ.
- Đã bỏ: cột `collections.comment_count` đếm sẵn bằng trigger (bản đầu của
  kế hoạch). Bảng `collections` đã có trigger và policy cho chủ bộ sửa;
  thêm một cột đếm là thêm một thứ ứng dụng có thể ghi và trigger phải
  canh. Với khoảng sáu chục bộ công khai, đếm lúc hỏi là một lần quét
  index. Khi nào chậm thì mới thành cột.
- `banned_words`: danh sách từ cấm, sửa được từ Data Desk.
- `reports.kind` thêm giá trị `comment` (bảng báo cáo đã có).
- Hoạt động: thêm hai loại dòng "trả lời bạn" và "nhắc tới bạn" vào nguồn
  dữ liệu của màn Hoạt động.
- Xoá tài khoản: bình luận của người đó mất nội dung ngay; dòng chỉ còn
  lại làm chỗ giữ nếu có người khác trả lời bên dưới.

### 2.2 Ứng dụng

- Kiểu `Subject = { kind: 'collection', id }`. Mọi hàm đọc, ghi và mọi
  thành phần giao diện nhận `Subject`, không nhận "bộ sưu tập".
- `lib/comments.ts` (thuần, kiểm thử 100%): dựng cây từ danh sách phẳng,
  ép độ sâu hiển thị về 2, cắt nội dung thành đoạn chữ và đoạn tag, quy
  tắc dòng "đã xoá".
- `lib/data/comments.ts`: gọi các hàm máy chủ.
- `components/CommentThread`, `CommentRow`, `CommentComposer`: nhận
  `subject`, danh sách địa điểm tag được, và hai hàm mở Trang cá nhân / mở
  địa điểm. Không tự biết đối tượng là gì.
- `ActivityCard`: thêm số bình luận, 2 bình luận xem trước, và nút mở
  luồng.
- Màn `Comments` (tham số là `subject`): luồng đầy đủ, mở từ thẻ và từ
  trang chi tiết bộ sưu tập.
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
- Chưa làm ở đây, thuộc C7: hai loại dòng "trả lời bạn" và "nhắc tới
  bạn" trong nguồn dữ liệu của màn Hoạt động.
- Kiểm thử trong `supabase/tests`: người lạ không thấy bình luận trên bộ
  riêng tư; hai người chặn nhau không thấy nhau; quá 30 một ngày bị từ
  chối; từ cấm bị từ chối; cha khác đối tượng bị từ chối; tag người không
  hợp lệ bị từ chối; xoá có con để lại chỗ giữ, xoá hết con thì dọn sạch;
  xoá tài khoản làm rỗng nội dung.
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
- Màn `Comments` (tham số là `subject`): cây thụt 2 mức, dòng "đã xoá",
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
  `ScrollView` nào là cha. Chưa xác nhận lại trên máy.
- Chỉ bật tại chỗ khi **đã biết chắc** luồng trống: đã đăng nhập, con số
  đã về và không đang được hỏi lại. Chưa biết thì mở luồng, để không che
  mất bình luận đang có. Khách cũng mở luồng, nơi họ được mời đăng nhập.
- "Trả lời" dưới mỗi bình luận nay là **biểu tượng bong bóng**, không phải
  chữ, để dành chỗ cho trái tim cạnh nó khi bình luận có lượt thích.

*C4b — xong:*
- Nút ⋯ ở cuối mỗi bình luận (chỉ khi đã đăng nhập).
- Bình luận của mình: "Xoá bình luận", hỏi lại một lần và nói trước rằng
  các trả lời bên dưới cũng bị xoá. Xoá xong thì luồng và các con số tự
  tải lại; lỗi thì báo và không đổi gì.
- Bình luận của người khác: "Báo cáo bình luận", đi qua đúng luồng báo
  cáo sẵn có (bốn lý do, cùng hàng chờ của Data Desk) với loại `comment`.
- Chủ bộ xoá bình luận của người khác vẫn là C6, chưa có ở đây dù máy chủ
  đã cho phép.

**C5. Tag**
- Cần trước: tag địa điểm hiện chỉ mang `id`, mà trang địa điểm mở bằng
  `slug`. Hoặc cho `comment_thread` trả thêm `slug` trong mỗi tag địa
  điểm (một migration nhỏ), hoặc tra `id` trong danh sách địa điểm của
  bộ. Từ C3a tag địa điểm đã được tô màu nhưng chưa bấm được.
- Gõ "@" mở danh sách người tag được; nút địa điểm mở danh sách địa điểm
  của bộ.
- Tag hiện thành liên kết; bấm mở Trang cá nhân hoặc trang địa điểm.

**C6. Quyền của chủ bộ**
- Công tắc tắt bình luận trong màn sửa bộ sưu tập.
- Chủ bộ xoá bình luận của người khác trên bộ của mình.

**C7. Hoạt động**
- Dòng "trả lời bạn" và "nhắc tới bạn" trong màn Hoạt động, bấm mở đúng
  luồng.

**C8. Data Desk**
- Hàng chờ báo cáo hiện loại `comment` kèm nội dung; nút gỡ bình luận.
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
   luận, mà màn riêng thì có sẵn địa chỉ; và nhu cầu "liếc nhanh" đã có 2
   bình luận xem trước ngay trên thẻ. Threads cũng mở bài thành màn riêng;
   không lấy kiểu "mỗi trả lời là một màn" của Threads vì luồng ở đây
   ngắn.
2. **Danh sách từ cấm ban đầu**: cần cả tiếng Việt và tiếng Anh. Ai soạn
   bản đầu. Chốt trước C10; C1 tạo bảng rỗng.

## 5. Rủi ro

- **Khối lượng**: đây là thay đổi lớn nhất từ trước tới giờ ở tầng dữ
  liệu (2 bảng, khoảng 6 hàm, trigger). C1 quyết định chất lượng của cả
  phần còn lại.
- **Mật độ**: 126 hồ sơ. Luồng trống là trạng thái thường gặp, nên thẻ
  không hiện gì về bình luận khi chưa có cái nào, ngoài nút mở luồng.
- **Kiểm duyệt**: báo cáo về bàn biên tập trong 24 giờ là cam kết đã có
  trong điều khoản; bình luận làm tăng số báo cáo.
