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
| 5 | Xoá | Xoá của mình; chủ bộ xoá được bình luận trên bộ của họ. Còn trả lời bên dưới thì để lại dòng "Bình luận đã bị xoá"; không còn trả lời thì biến mất hẳn. Không cho sửa. | Tildes, Reddit |
| 6 | Thông báo | Chủ bộ và người đã tham gia luồng được báo trong màn Hoạt động sẵn có. Chưa có thông báo đẩy. | Letterboxd |
| 7 | Giới hạn | 500 ký tự; 30 bình luận mỗi người mỗi ngày. | |
| 8 | An toàn (Apple 1.2) | Bộ lọc từ cấm lúc đăng; báo cáo từng bình luận; hai người chặn nhau không thấy bình luận của nhau. | App Review Guidelines 1.2 |
| 9 | Phát hành | Làm sau cờ `comments` (tắt sẵn), merge dần; bật trong một bản nộp duyệt kèm ghi chú cho App Review. | Điều 2.5.2 |
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

### Hoãn, sẽ làm sau

- Tim trên từng bình luận (kéo theo kiểu xếp "Nổi bật").
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
`comment_subject_visible(...)`. Hôm nay: bộ sưu tập công khai, hoặc của
chính mình. Mọi quyền đọc và ghi bình luận đều gọi hàm này, cộng với kiểm
tra chặn nhau (`blocked_with`, đã có).

**Ghi chỉ qua hàm phía máy chủ**, không cho chèn thẳng vào bảng:

- `post_comment(đối tượng, cha, nội dung, danh sách tag)`: kiểm tra quyền
  thấy, bình luận có đang tắt không, giới hạn ngày, bộ lọc từ cấm, cha có
  cùng đối tượng không, từng tag có hợp lệ không; rồi ghi bình luận và tag
  trong một giao dịch.
- `delete_comment(id)`: tác giả hoặc chủ đối tượng. Còn con thì xoá mềm
  (rỗng nội dung), hết con thì xoá hẳn và dọn ngược lên các dòng giữ chỗ
  không còn con.

**Phần đi kèm**

- `collections.comments_off` (công tắc của chủ bộ) và
  `collections.comment_count` (đếm sẵn, trigger giữ đúng; feed lấy số đếm
  mà không tốn truy vấn riêng).
- `comment_previews(danh sách đối tượng)`: trả 2 bình luận mới nhất cho
  mỗi thẻ, một lần gọi cho cả lứa thẻ.
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
3. Thêm `checkins.comment_count` và cùng trigger.
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

**C1. Cơ sở dữ liệu**
- Migration: hai bảng, các hàm ở 2.1, quyền truy cập, trigger độ sâu và
  số đếm, `banned_words`, `reports.kind`.
- Kiểm thử trong `supabase/tests`: người lạ không thấy bình luận trên bộ
  riêng tư; hai người chặn nhau không thấy nhau; quá 30 một ngày bị từ
  chối; từ cấm bị từ chối; cha khác đối tượng bị từ chối; tag người không
  hợp lệ bị từ chối; xoá có con để lại chỗ giữ, xoá hết con thì dọn sạch;
  xoá tài khoản làm rỗng nội dung.
- Áp migration lên cơ sở dữ liệu thật, sinh lại kiểu dữ liệu.

**C2. Lõi ứng dụng**
- `Subject`, `lib/comments.ts`, `lib/data/comments.ts`, kèm kiểm thử.

**C3. Đọc**
- Màn `Comments`: cây 2 cấp, "Xem thêm N trả lời", dòng "đã xoá", tự nạp
  khi cuộn (dùng lại `lib/feed`).
- `ActivityCard`: số bình luận và 2 bình luận xem trước.
- Trang chi tiết bộ sưu tập: lối vào luồng.
- Khách chưa đăng nhập đọc được, muốn viết thì được mời đăng nhập.

**C4. Viết**
- Ô soạn: bình luận mới, trả lời (tự chèn "@tên" khi trả lời ở cấp 2),
  đếm ký tự, thông báo lỗi cho từng lý do bị từ chối.
- Xoá của mình. Báo cáo một bình luận (dùng lại luồng báo cáo đã có).

**C5. Tag**
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

## 4. Còn mở

1. **Luồng đầy đủ mở ở đâu**: một màn riêng (đề xuất, vì cây lồng cần
   chiều cao và bàn phím) hay một tấm trượt từ dưới lên như Instagram.
   Chốt trước C3.
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
