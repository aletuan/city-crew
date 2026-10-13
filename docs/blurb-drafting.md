# Soạn nháp mô tả bằng model

Một câu hỏi: khi 745 trong 925 địa điểm đang live không có mô tả, làm sao
điền mà không để một câu máy bịa lên màn hình người dùng?

## Số đo ngày 13/10/2026

| | có mô tả | thiếu |
|---|---|---|
| toàn bộ | 180 | 745 (81%) |
| cà phê | 59 | 410 |
| ăn uống | 57 | 318 |
| về đêm | 31 | 108 |
| ngắm cảnh | 17 | 26 |
| di sản | 39 | 10 |
| thiên nhiên | 13 | 7 |

Mô tả đang có đến từ ba nguồn: desk tự viết (`editorial`, 70), Google
editorial summary mà importer chép sang (`google`, 68), và bài Threads do
skill `threads-to-datadesk` đưa vào (`threads`, 40).

## Một function, một cổng

`supabase/functions/write-blurb` nhận `{ slug }` và trả về `{ desc_vi,
desc_en, desc_ja, sources, photos }`. Nó **không ghi gì vào bảng**. Chữ rơi vào ba ô Blurb
của dashboard ở trạng thái chưa lưu, như thể editor vừa gõ, và nút Save
vốn có là cổng duyệt. Không có cột nháp, không có bảng lịch sử: function
chỉ nhận chỗ trống (chỗ đã có mô tả trả 409), nên với mọi dòng "đã đổi
thế nào" luôn là "từ trống thành đoạn này". Muốn thay một mô tả đã có thì
người xoá tay trước, đó là một hành động có chủ ý.

Nguyên liệu đưa cho model: các cột của chính dòng đó (tên, phường, thành
phố, loại, vibe, giờ, website), năm mô tả `editorial` cùng loại làm mẫu
giọng văn, và đoạn mở đầu bài Wikipedia tiếng Việt hoặc tiếng Anh nếu có.
Đoạn Wikipedia chỉ được nhận khi nó nhắc tên thành phố: "Lake Park" có ở
Milwaukee và endpoint summary trả về cái nổi tiếng hơn. Không lấy gì từ
Google ngoài những gì dòng đã giữ; `docs/tech-eval-app-store.md` nói vì
sao không lưu review.

Quy tắc văn là quy tắc bậc 4 của skill Threads, viết vào system prompt:
cụ thể, mọi điều người đến có thể kiểm, không tính từ nào dữ liệu không
đỡ, không nói vị, không năm tháng hay con số ngoài nguyên liệu. Haiku, như
`plan-assist`; chi phí cho cả 745 chỗ dưới một đô la.

## Ba đường vào, hai đường cần cờ

- **Editor bấm "Draft blurb"** cạnh ô Blurb, đọc, Save. Chỗ `approved`
  giữ `approved`: người đã đọc trước khi lưu.
- **Skill Threads ở bậc 4** (không có lời người nào dùng được) gọi cùng
  function thay vì tự soạn, rồi kết thúc ở `flagged` như bước 10 của skill
  đã quy định cho mọi chỗ bị sửa.
- **Chạy hàng loạt** (ops token `write-blurb`, xem `_shared/gate.ts`) ghi
  vào cùng hai cột và đặt `flagged` trong cùng một câu UPDATE, để không có
  dòng nào "đã ghi mà quên cờ".

Quy tắc chung: mô tả chưa qua mắt người thì dòng ở `pending` hoặc
`flagged`; chỉ Save của người duyệt mới giữ hoặc trả về `approved`.

## Thứ tự làm

Công viên trước, không phải vì nhiều mà vì có nguồn công khai để bám
(Wikipedia). Thử một hai công viên, chủ sở hữu đọc, rồi mười di sản và
26 điểm ngắm cảnh. Quán cà phê thì model chỉ có tên và giờ để viết, nên
nguồn tốt hơn vẫn là bài Threads.

## Bản tiếng Nhật máy viết, và dấu `machine`

Từ 13 Oct 2026 function trả thêm `desc_ja`, và desk ghi nó vào
`places.i18n` (`{"ja": {"desc": …, "machine": true}}`), không còn vào cột
`desc_ja` (cột đó được trigger `sync_place_i18n` chép lại từ object cho
tới khi app đọc thẳng object). `machine: true` nghĩa là chữ đúng như model
viết và chưa ai sửa trong ngôn ngữ đó. Desk đặt dấu khi bấm "Draft blurb",
giữ dấu khi Save mà không đụng ô JA, và bỏ dấu khi editor sửa chữ trong ô
JA — xem `foldI18n` trong `dashboard/src/langs.js`. Trên editor, ô Blurb JA
mang nhãn "machine draft" chừng nào dấu còn.

## Chế độ `ja`: dịch blurb đã có

`POST { slug, mode: 'ja' }` là chiều ngược lại: dòng **phải có** EN hoặc VI
và **chưa có** JA (cột hay object), nếu không trả 409 `no_blurb` / `has_ja`.
Không đọc Wikipedia (blurb là chất liệu), ví dụ chỉ lấy dòng có JA, ảnh vẫn
gửi để model thấy chữ trong blurb chỉ cái gì. Trả `{ desc_ja, photos }`.
Trên desk là nút "Draft JA", hiện khi blurb có mà ô JA trống; batch đi qua
ops token và ghi `i18n.ja = {desc, machine: true}`, giữ `approved`: lật
sang `flagged` là app mất dòng đó (RLS đọc công khai đòi `approved`), nên
dấu `machine` là hàng đợi rà soát, không phải trạng thái review.
