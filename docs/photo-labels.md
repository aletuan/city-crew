# Gán nhãn ảnh bằng Claude: đề xuất

Đề xuất cho bước "hiểu ảnh" mà Apple Vision không làm được. Theo nguyên tắc 8
của `docs/photo-critic.md`, tài liệu này viết trước khi có code. Mỗi bước ở
mục 8 được đánh dấu xong trong chính PR làm bước đó.

## 1. Vì sao

Hai vòng chấm tay ngày 17/10/2026 (Q4 trong `photo-critic.md`) cho thấy:

- **Nhãn Apple Vision** chỉ nhận ra khoảng một nửa số ảnh món ăn (16/33), và
  không phân biệt được "toà nhà dưới trời" với "khung cảnh" (Phong cảnh đúng
  9/30).
- **Claude**, chỉ nhìn ảnh và chấm trước khi chủ sản phẩm chấm, trùng với chủ
  sản phẩm **96/100**, kappa **0,92**.

Hiểu ảnh là việc của một mô hình hiểu ảnh. Apple Vision vẫn giữ việc của nó:
**đo** độ sáng và độ nét ngay trên máy.

## 2. Quyết định của chủ sản phẩm (17/10/2026)

| # | Quyết định |
|---|---|
| 1 | Gán nhãn **tất cả** ảnh, kể cả ảnh Google và ảnh lấy từ Threads (rủi ro ở mục 7) |
| 2 | Làm **cách A** trước: một skill chạy trong phiên Claude. Edge Function gọi Claude API tự động (cách B) để sau |
| 3 | Dùng bộ nhãn ở mục 3, thiết kế sao cho mở rộng được về sau (mục 4) |
| 4 | Ghi đề xuất này thành tài liệu trước khi làm |

## 3. Bộ nhãn v4

Mỗi ảnh có **một loại** và **sáu thuộc tính**. Bộ nhãn bám theo tiêu chí chọn
ảnh bìa trong skill Threads, để nhãn dùng được ngay cho điểm "hợp làm bìa"
(bước 5 của `photo-critic.md`).

**Loại ảnh** (`kind`): xét theo **chủ thể**, tức là thứ chiếm phần lớn khung
và được lấy nét, không xét theo việc ảnh *có* trời hay cây.

| Giá trị | Nghĩa | Ở các vòng chấm tay |
|---|---|---|
| `food` | Đồ ăn hoặc đồ uống là chủ thể, kể cả khi phía sau có view. Đồ ăn trên bàn vẫn là Đồ ăn dù thấy một phần không gian | F |
| `interior` | Không gian bên trong: bàn ghế, quầy, kiến trúc trong nhà, không có đồ ăn làm chủ thể. Quầy trong nhà là Nội thất, kể cả khi biển tên quán sáng trên tường phía sau. Hành lang có mái nhìn ra sân trong là Nội thất | P |
| `exterior` | Toà nhà, mặt tiền, lối vào hay biển hiệu chiếm phần lớn khung. Quầy hay ki-ốt có biển tên, nhìn từ ngoài đường, là Mặt tiền | P |
| `view` | Cảnh vật chiếm phần lớn khung: trời, nước, cây, vườn, bãi cỏ, khuôn viên, toàn cảnh thành phố. Nhà, hiên, cổng, tượng đứng giữa khuôn viên chiếm phần lớn khung vẫn là Phong cảnh | S |
| `text` | Menu, bảng chữ, poster, hoặc biển hay logo chiếm cả khung | U |
| `other` | Không thuộc loại nào ở trên | U |

**v2 (17/10/2026)** thêm bốn quyết định của chủ sản phẩm sau vòng 3 (mục 10):
- ảnh ngoài trời có cả công trình và cây cỏ thì xét cái nào chiếm phần lớn
  khung;
- quầy có biển tên là Mặt tiền;
- bàn có đồ ăn là Đồ ăn;
- biển logo là Chữ.

Ba ca "chưa quyết" của v1 nay đã có đáp án: tượng, đài phun nước hay vườn
thì theo cái chiếm khung; hành lang có mái là Nội thất.

**v3 (17/10/2026)** sửa định nghĩa thuộc tính theo vòng 3b (mục 10):
- biển hiệu chỉ là biển hay tên của quán;
- cây xanh không tính hoa và chậu nhỏ;
- có người trong ảnh là "Có";
- dàn dựng chỉ là người mẫu tạo dáng, không tính chữ in đè;
- trên trang chấm, "Toàn cảnh" đổi tên thành "Thấy cả không gian".

**v4 (17/10/2026)** thu hẹp luật quầy của v2 sau vòng 3c (mục 10): chỉ quầy
hay ki-ốt nhìn từ ngoài đường mới là Mặt tiền; quầy trong nhà là Nội thất.

Người có mặt trong quán **không đổi loại ảnh**. Vòng 2 cho thấy chủ sản phẩm
xếp ảnh barista hay khách đứng ở quầy vào Địa điểm. Việc có người được ghi
bằng thuộc tính `people`.

**Thuộc tính**: mỗi thuộc tính là `true`, `false`, hoặc `null` khi không đánh
giá được.

| Khoá | Câu hỏi | Liên quan ảnh bìa |
|---|---|---|
| `brand` | Thấy biển hay tên của chính quán đọc được? Logo in trên cốc, phin, đĩa hay latte art không tính | Tiêu chí 2 |
| `wide` | Thấy cả không gian: cả phòng, cả mặt tiền, cả sân (không phải cận một món, một góc)? | Tiêu chí 1 |
| `green` | Cây hay cây lá chiếm một phần đáng kể của khung? Hoa, bình hoa, vài chậu nhỏ không tính | Tiêu chí 3 |
| `daylight` | Ánh sáng tự nhiên ban ngày? | Tiêu chí 4 |
| `people` | Thấy bất kỳ người nào trong ảnh (khách, barista, người qua đường)? Chỉ một bàn tay thì không tính | Tiêu chí 5 |
| `staged` | Có người mẫu tạo dáng cho ảnh? Chữ in đè lên ảnh không tính | Tiêu chí 5 |

Mỗi ảnh còn có thể có thêm:
- `unsure: true`: nhãn có nhưng người gán không chắc. App bỏ qua những nhãn
  này.
- `note`: một câu ngắn, chỉ dùng khi cần giải thích một ca khó.

## 4. Mở rộng về sau

Nhãn được lưu dạng JSON, nên thêm nhãn mới không cần migration. Muốn mở rộng
mà không làm hỏng nhãn cũ thì phải giữ bốn luật:

1. **Không bao giờ dùng lại một khoá cho nghĩa khác.** Muốn đổi nghĩa thì tạo
   khoá mới.
2. **Thêm khoá là thay đổi cộng thêm.** Ảnh gán nhãn trước đó thiếu khoá mới,
   và thiếu nghĩa là *chưa hỏi*, không phải `false`. Skill chỉ gán bổ sung
   khoá còn thiếu.
3. **Thêm giá trị cho `kind`** (ví dụ tách `food` thành `food` và `drink`)
   hoặc đổi định nghĩa một khoá đang có: tăng `scorer_version`. Các dòng cũ
   khi đó tính là "chưa đọc" (`needsScore`), và skill gán nhãn lại.
4. **Định nghĩa chỉ nằm ở một chỗ:** `DEFINITIONS` trong
   `supabase/functions/_shared/photoLabels.ts`, từ bước 2b (17/10). Edge
   Function gửi đúng đoạn này cho model; skill đọc nó trước mỗi đợt. Bảng ở
   mục 3 là bản sao để đọc. Một test giữ `write.py` của skill khớp với danh
   sách loại, thuộc tính và `VERSION` trong file đó.
   Mỗi dòng ghi `v` (phiên bản bộ nhãn) trong `signals`, để biết nhãn được
   gán theo định nghĩa nào.

Ví dụ những thứ có thể thêm sau mà không phá gì: `angle` (góc chụp từ trên
xuống, ngang tầm mắt hay từ dưới lên), `season_decor` (trang trí theo mùa làm
ảnh nhanh cũ), `night` (ảnh ban đêm có chủ ý), `dish` (tên món nhìn thấy).

## 5. Lưu ở đâu

Bảng `photo_scores` đã được thiết kế để có bộ chấm thứ hai (migration
`20261016090000_photo_scores_per_scorer.sql`). Nhãn lưu thành một dòng riêng:

| Cột | Giá trị |
|---|---|
| `scorer` | `claude-labels` |
| `scorer_version` | `VERSION` trong `photoLabels.ts`, hiện là `4` (luật 3 ở mục 4) |
| `aesthetic`, `is_utility` | `null`: bộ chấm này không chấm điểm đẹp |
| `scored_by` | `null`: skill ghi nhãn qua Supabase MCP, không qua tài khoản người dùng |
| `signals` | `{ "v": 4, "kind": …, "brand": …, … }` |

**Migration cần có:** bỏ ràng buộc `photo_scores_one_per_photo`.

- Migration ngày 16/10 giữ ràng buộc này vì app cũ upsert theo `photo_id`.
  App hiện tại đã upsert theo `(photo_id, scorer)` qua EAS Update từ 16/10.
- Gallery đã lọc theo `photo_scores.scorer` nên vẫn chỉ đọc điểm Apple
  Vision.
- RLS không phải đổi. Skill ghi bằng quyền của MCP, còn app không ghi dòng
  `claude-labels`.

## 6. Skill `photo-labels`

Đặt trong repo, ở `.claude/skills/photo-labels/`, để mọi phiên làm việc
trên repo đều dùng được. Gồm `SKILL.md` (định nghĩa và các bước),
`sheets.py` (bảng 3×3) và `write.py` (biến nhãn viết tắt thành một câu
lệnh ghi). `.gitignore` bỏ qua `.claude/` trừ thư mục `skills/`.

- **Đầu vào:** slug một địa điểm, một thành phố, hoặc "mọi ảnh chưa có nhãn".
- **Các bước:**
  1. Truy vấn các ảnh đang hiện mà chưa có dòng `claude-labels` ở phiên bản
     hiện tại, hoặc còn thiếu khoá.
  2. Tải ảnh thu nhỏ 448px, ghép thành bảng 3×3 có đánh số.
  3. Xem ảnh và gán nhãn theo định nghĩa trong skill.
  4. Ghi vào database bằng
     `insert … on conflict (photo_id, scorer) do update`.
  5. Báo lại số ảnh đã gán nhãn và các ca `unsure`.
- **Không đọc nhãn Apple Vision hay luật v0 trước khi gán,** để hai nguồn độc
  lập với nhau.
- **Điều kiện chạy:**
  - Môi trường phải cho phép tải từ `amdvitzpogaejzzqroco.supabase.co`.
  - Phiên phải có Supabase MCP. Lệnh ghi được thử một lần nhỏ trước, vì MCP
    từng treo khi chạy lệnh DDL.
- **Khối lượng:** catalog có khoảng 6.300 ảnh đang hiện, tức khoảng 700 bảng
  3×3. Chạy theo từng thành phố, mỗi lần vài trăm ảnh.

**Skill Threads** (`threads-to-datadesk`) là skill trong tài khoản của chủ
sản phẩm, không nằm trong repo. Thêm một bước sau bước chọn ảnh bìa:

> Nếu đã thêm ảnh mới cho địa điểm, chạy skill `photo-labels` cho slug đó.
> Bước này không đổi luật chọn ảnh bìa ở trên cho tới khi nhãn đã được kiểm
> chứng (mục 8, bước 4).

## 7. Pháp lý

- ⚠️ **Ảnh Google (86% catalog).** Chủ sản phẩm chấp nhận gán nhãn cả ảnh
  Google (17/10). Việc cho một mô hình AI phân tích nội dung Google Maps chưa
  được đối chiếu với điều khoản Maps Platform, giống câu hỏi C1 trong
  `tech-eval-app-store.md`. Nếu điều khoản cấm, phải xoá được các dòng
  `claude-labels` của ảnh Google bằng một câu lệnh. Ảnh nào là ảnh Google xác
  định được qua `place_photos.source = 'google'`.
- **Ảnh từ Threads** là ảnh của người khác: được gán nhãn, nhưng **không bao
  giờ** dùng để huấn luyện mô hình.
- **Ảnh guide tự tải lên** được phân tích phía City Crew bằng một dịch vụ AI
  (Anthropic). Đây khác với lời hứa "phân tích ngay trên máy" của tính năng
  chấm điểm trong app. Trước khi app hiện nhãn, chính sách quyền riêng tư
  (`app/src/lib/legal.ts`) nên có một câu nói ảnh trong catalog có thể được
  phân tích bằng dịch vụ AI. Phần chữ này cần chủ sản phẩm duyệt.

## 8. Các bước

| # | Bước | Trạng thái |
|---|---|---|
| 1 | Migration: bỏ `photo_scores_one_per_photo`, kèm test SQL | ✅ 17/10: `20261017120000_photo_scores_second_scorer.sql`, đã chạy trên live (lịch sử `20261017101738`) |
| 2 | Skill `photo-labels` trong repo; chạy thử trên 3–5 địa điểm | ✅ 17/10: 21 địa điểm, 137 ảnh (mục 9) |
| 2b | Edge Function gán nhãn ảnh mới, cùng định nghĩa với skill (mục 10) | ◐ 17/10: `label-photos` đã triển khai (định nghĩa v4, bản 5) và đo ở vòng 2, 3, 3b, 3c. App chưa gọi |
| 3 | Đoạn cập nhật cho skill Threads, chủ sản phẩm dán vào tài khoản | ☐ |
| 4 | **Vòng chấm 3:** chủ sản phẩm chấm các thuộc tính trên 100 ảnh mới, Claude chấm trước và khoá câu trả lời. 137 ảnh của bước 2 đã được khoá sẵn (mục 9). Trang chấm: Data Desk `#/photo-types-3`; câu trả lời của Claude và mã sha256 ở `data/review/photo-types/round3.json` | ✅ 17/10: vòng 3 (loại ảnh), 3b (sáu thuộc tính), 3c (24 ảnh mới: loại ảnh, thấy cả không gian, người). Kết quả ở mục 10. Dàn dựng chưa đo được vì chưa có ảnh nào chủ sản phẩm chọn "Có" |
| 5 | Gán nhãn toàn bộ catalog, theo từng thành phố | ✅ 17/10: 6.467 ảnh, Haiku 5.5, định nghĩa v4 (mục 10). Ảnh thêm sau đó chưa được gán tự động: app và Data Desk chưa gọi `label-photos` |
| 6 | App đọc nhãn: loại ảnh và điểm "hợp làm bìa" (đề xuất ở mục 11) | ☐ đề xuất 17/10, chờ chủ sản phẩm duyệt |

**Tiêu chí để một nhãn được hiện trong app (bước 6):**
- `kind` trùng với chủ sản phẩm từ **90%** trở lên.
- Mỗi thuộc tính trùng từ **85%** trở lên, đo ở vòng 3.
- Thuộc tính nào không đạt thì vẫn được lưu, nhưng không hiện trong app.

## 9. Chạy thử (bước 2, 17/10/2026)

Chủ sản phẩm yêu cầu chạy trên nhiều hơn 5 địa điểm. Hai đợt:

- **Đợt 1:** 5 địa điểm chọn tay, 39 ảnh. Có quán cà phê, nhà hàng, di
  tích và công viên.
- **Đợt 2:** 16 địa điểm chọn ngẫu nhiên. Chia theo thành phố, mỗi nơi có
  từ 5 đến 10 ảnh đang hiện, tổng 98 ảnh. Có đủ HCM, Hà Nội, Melbourne, Đà
  Lạt, Đà Nẵng, Huế và Hội An.

Tổng cộng 137 ảnh: 119 ảnh Google và 18 ảnh tải lên. Không ảnh nào lỗi tải.

| Loại | Số ảnh |
|---|---|
| `food` | 57 |
| `interior` | 36 |
| `exterior` | 34 |
| `view` | 7 |
| `text` | 3 |

**`unsure`: 8 ảnh.** Bảy ảnh rơi vào ba ca mà định nghĩa v1 chưa phân xử.
Skill ghi ba ca này là "chưa quyết" và để vòng 3 quyết:
- vật trưng bày giữa khuôn viên (3 ảnh): đài phun nước, tượng, xe tăng;
- vườn là chính, nhà chỉ lấp ló (3 ảnh): bậc đá qua vườn, vườn hoa có ghế,
  chòi giữa cây;
- hành lang có mái nhìn ra sân trong (1 ảnh).

Ảnh còn lại là bảng menu treo trên tủ bánh: nửa chữ, nửa trưng bày.

**Thuộc tính:**
- `daylight` để `null` ở 31/137 ảnh. Phần lớn là ảnh cận món ăn, trong
  khung không có cửa sổ hay bầu trời nên không xác định được nguồn sáng.
  Đây là thuộc tính yếu nhất, và vòng 3 cần đo riêng.
- `brand` chỉ `null` ở 1 ảnh: chữ Hán trên cổng chùa mà người gán nhãn
  không đọc chắc được.

**Ảnh bìa:**
- Cả 21 địa điểm đều có ít nhất một ảnh `exterior` hoặc `wide`.
- Có 4 địa điểm đang dùng ảnh món ăn làm bìa, dù đều có sẵn ảnh rộng:
  - `briques` và `fefe-roastery` có cả ảnh mặt tiền thấy rõ tên quán;
  - `salmon-kat` có ảnh mặt tiền;
  - `3-con-muc` có ảnh nội thất rộng.
- Có 2 địa điểm dùng ảnh nội thất chụp hẹp làm bìa, dù có ảnh rộng hơn:
  `il-grillo` và `the-hummingbird-cafe-roastery`.

Đây là việc bước 5 của `photo-critic.md` sẽ làm tự động. Skill này không
đổi ảnh bìa.

**Độ chính xác chưa đo được ở bước này.** Nhãn chỉ có một nguồn là chính
skill, chưa có câu trả lời của chủ sản phẩm để so. Tuy vậy cả 137 nhãn đã
được ghi vào database (`scored_at` 17/10) trước khi chủ sản phẩm xem ảnh,
tức là đã được khoá. Vòng 3 có thể dùng ngay 137 ảnh này thay cho 100 ảnh
mới, để đo cả `kind` lẫn sáu thuộc tính.

**Bài học khi chạy, đã ghi vào skill:**
- Kết quả MCP không ghi được ra file. Danh sách ảnh của các địa điểm đã
  duyệt lấy qua REST bằng khoá công khai.
- Tên file ảnh lấy từ Threads có mô tả nội dung ảnh, nên không được đọc
  trước khi gán nhãn.
- `write.py` ghi cả đợt bằng một mảng `jsonb`: 15 KB cho 98 dòng, so với
  21 KB nếu viết `VALUES`.

## 10. Edge Function (bước 2b): đề xuất

Chủ sản phẩm chọn **kết hợp** hai cách (17/10). Skill vẫn dùng cho ảnh cũ,
cho vòng chấm và cho việc gán lại khi tăng version. Còn Edge Function lo
cho **ảnh mới**: khi chấm ảnh một địa điểm trong app mà còn ảnh chưa có
nhãn, app gọi function.

**Những gì đã có sẵn:**
- Secret `ANTHROPIC_API_KEY`.
- `write-blurb` đã gửi ảnh catalog, kể cả ảnh Google, tới Claude qua URL.
- `legal.ts` đã nêu tên Anthropic là nhà cung cấp dịch vụ.

**Năm điều phải giữ:**
1. **Một nguồn định nghĩa.** Định nghĩa chuyển từ `SKILL.md` sang
   `supabase/functions/_shared/photoLabels.ts`, gồm prompt, danh sách khoá,
   `VERSION` và hàm kiểm tra JSON. Skill đọc file đó. Luật 4 ở mục 4 đổi
   theo, trong cùng PR.
2. **Ghi rõ ai gán nhãn:** `"by": "fn"` hoặc `"by": "skill"` trong
   `signals`. Con số 96/100 là của Claude trong phiên làm việc, nhìn bảng
   3×3. Model của function chưa được đo, nên phải lọc riêng được nhãn của
   nó.
3. **Đo trước khi bật.** Cho function chạy lại 100 ảnh vòng 2 và so với
   câu trả lời của chủ sản phẩm. Ngưỡng như mục 8: `kind` từ 90% trở lên.
   Chưa đạt thì function không ghi.
4. **App chỉ gửi id ảnh.**
   - Function tự đọc URL từ database và kiểm tra quyền bằng
     `_shared/gate.ts`.
   - Ảnh đã có nhãn thì bỏ qua, nên gọi hai lần không tốn thêm.
   - App gọi xong đi tiếp, không chờ kết quả.
5. **Phủ test 100%** bằng `*.fn.test.ts`, như mọi Edge Function khác.

Chủ sản phẩm quyết định không đổi chữ hiển thị trong app ở bước này
(17/10).

### Đo lần đầu (17/10/2026)

Function đã triển khai, chạy ở chế độ `write: false` (không ghi gì vào
catalog), `effort: low`, với hai model: Opus 5.5, model mặc định, và Haiku
5.5, model mà `plan-assist` và `write-blurb` đang dùng. Định nghĩa được
khoá trong `photoLabels.ts` trước khi chạy và không sửa sau khi xem kết
quả.

**Vòng 2: 100 ảnh, chỉ so loại ảnh với chủ sản phẩm.** Sáu loại được gộp về
bốn chữ của vòng 2: `food` là F, `interior` và `exterior` là P, `view` là
S, `text` và `other` là U.

| Ai gán | Trùng chủ sản phẩm | Kappa |
|---|---|---|
| Skill (Claude trong phiên, bảng 3×3) | 96/100 | 0,92 |
| Function, Opus 5.5 | 95/100 | 0,90 |
| Function, Haiku 5.5 | 94/100 | 0,88 |

Cả hai model đều vượt ngưỡng 90%.
- Hai model sai gần như cùng một chỗ: bảng phấn trước mặt tiền, đồ uống
  trước view ban đêm, menu có ảnh món.
- Chỗ sai của function chỉ trùng skill ở một ảnh: ảnh 25, đồ uống trước view
  ban đêm. Skill sai ở 25, 27, 69 và 87; Opus sai ở 4, 23, 25, 48 và 65.
- Vì lỗi của hai nguồn phần lớn không trùng nhau, một ảnh mà cả hai đồng ý
  thì đáng tin hơn ảnh chỉ một nguồn gán.

Thuộc tính chưa đo được ở vòng 2, vì vòng đó không hỏi thuộc tính.

**Vòng 3: 137 ảnh.**
- Câu trả lời của cả hai model đã được khoá trong
  `data/review/photo-types/round3.json` (khoá `function`, kèm sha256),
  trước khi chủ sản phẩm chấm.
- Khi chủ sản phẩm chấm xong sẽ có ba cặp để so: chủ sản phẩm với skill,
  chủ sản phẩm với function (từng model), và skill với function. Mỗi cặp so
  cả loại ảnh lẫn sáu thuộc tính, bằng kappa.

**Chi phí và thời gian, đo từ `usage` của 237 lần gọi:**

| | Opus 5.5 | Haiku 5.5 |
|---|---|---|
| Token vào mỗi ảnh | ~2.840 | ~2.840 |
| Token ra mỗi ảnh | ~82 | ~132 |
| Giá mỗi ảnh | ~1,3 cent | ~0,035 cent |
| Ước tính toàn catalog (~6.300 ảnh) | ~82 USD | ~2,2 USD |
| 137 ảnh, 4 ảnh song song | 102 giây | 100 giây |

Toàn bộ lần đo này tốn khoảng 3,2 USD.

Chọn model nào cho catalog là quyết định của chủ sản phẩm, sau khi có kết
quả vòng 3. Ở vòng 2, khoảng cách về loại ảnh giữa hai model là một ảnh,
trong khi giá chênh khoảng 37 lần.

### Vòng 3: kết quả (17/10/2026)

Chủ sản phẩm chấm xong 137 ảnh sau khi cả ba bộ nhãn đã được khoá. Mã băm
của cả ba vẫn khớp.

**Chỉ đo được loại ảnh.** Cả 137 ảnh đều để sáu thuộc tính ở "Không", tức là
chủ sản phẩm chỉ chọn loại ảnh. Vì vậy vòng này chưa đo được thuộc tính
nào.

**Loại ảnh, so với chủ sản phẩm:**

| Ai gán | Trùng | Kappa | Bỏ các ảnh tự đánh dấu `unsure` |
|---|---|---|---|
| Skill | 117/137 (85%) | 0,79 | 112/129 (87%) |
| Function, Opus 5.5 | 118/137 (86%) | 0,80 | 101/106 (95%) |
| Function, Haiku 5.5 | 114/137 (83%) | 0,76 | 103/111 (93%) |

**Ba nguồn của Claude gần như đồng ý với nhau:**
- skill và Opus: 94%, kappa 0,92;
- Opus và Haiku: 91%, kappa 0,86;
- skill và Haiku: 88%, kappa 0,82.

Vì vậy phần lệch với chủ sản phẩm không phải nhiễu ngẫu nhiên của từng
model, mà là chỗ định nghĩa v1 khác cách chủ sản phẩm phân loại. Phần lớn
nằm ở bốn nhóm:

1. **Ngoài trời có cây cỏ, khuôn viên chiếm phần lớn khung, có nhà hay
   công trình** (11 ảnh với skill, 11 với Opus): hiên dưới ô giữa vườn, nhà trên bãi cỏ,
   sàn gỗ dưới tán cây, cổng chùa, tượng trong vườn, mái dinh nhìn ra rừng
   cây, biển tên trước Royal Exhibition Building.
   - Chủ sản phẩm chọn **Phong cảnh**.
   - Định nghĩa v1 nói "hiên như một phần toà nhà" và "bảo tàng dưới trời
     xanh" là **Mặt tiền**, nên cả ba nguồn chọn Mặt tiền.
2. **Quầy hay ki-ốt có biển tên, nhìn từ phía khách** (3 ảnh): chủ sản
   phẩm chọn **Mặt tiền**, cả ba nguồn chọn Nội thất.
3. **Bàn hay quầy có đồ ăn, đồ uống nhưng thấy cả không gian** (3 ảnh): chủ
   sản phẩm chọn **Đồ ăn**, cả ba nguồn chọn Nội thất.
4. **Biển logo phát sáng** (1 ảnh): chủ sản phẩm chọn **Chữ**.

Ngưỡng 90% ở mục 8 chưa đạt với cả ba nguồn. Bước tiếp theo là chủ sản
phẩm quyết cách phân loại bốn nhóm này. Đổi định nghĩa là đổi nghĩa, nên
`VERSION` lên 2 theo luật 3 ở mục 4. Sau đó đo lại:
- chạy function trên chính 137 ảnh này;
- và trên 100 ảnh vòng 2, để thấy định nghĩa mới không làm hỏng chỗ vòng 2
  đã đúng.

### Định nghĩa v2: đo lại (17/10/2026)

Chủ sản phẩm quyết bốn nhóm (mục 3). Function chạy lại với v2 trên cả hai
vòng, `write: false`. Lần chạy tốn khoảng 3,2 USD.

| | Vòng 3, v1 | Vòng 3, v2 | Vòng 2, v1 | Vòng 2, v2 |
|---|---|---|---|---|
| Opus 5.5 | 118/137, κ 0,80 | **127/137 (93%), κ 0,90** | 95/100, κ 0,90 | 96/100, κ 0,92 |
| Haiku 5.5 | 114/137, κ 0,76 | **125/137 (91%), κ 0,88** | 94/100, κ 0,88 | 96/100, κ 0,92 |

- Với v2, Opus đúng **105/105** ảnh mà nó không đánh dấu `unsure`. Mười
  ảnh lệch còn lại đều nằm trong 32 ảnh nó tự nói là không chắc.
- Vòng 2 không tệ đi mà còn nhích lên. Như vậy v2 không đổi điều vòng 2
  đã đúng.
- **Lưu ý:** con số vòng 3 với v2 là đo trên chính những ảnh đã dùng để
  viết v2, nên dễ đẹp hơn thực tế. Một vòng nhỏ trên ảnh mới sẽ cho con
  số sạch. Vòng 3b (thuộc tính) không đo được việc này, vì nó lấy ảnh từ
  137 ảnh cũ.

**Vòng 3b: thuộc tính (trang `#/photo-types-3b`).** Chủ sản phẩm chọn chấm
sáu thuộc tính trên 40 ảnh lấy từ 137 ảnh của vòng 3, thay vì chấm lại cả
137 ảnh (17/10).
- Cách lấy 40 ảnh được viết thành luật, và một test tính lại để mẫu không
  lệch khỏi luật:
  - lấy mọi ảnh mà ít nhất một trong năm bộ câu trả lời của Claude nói có
    người hoặc dàn dựng (27 ảnh): skill, cùng hai model với v1 và với v2;
  - thêm cho đủ 40 những ảnh mà các bộ đó lệch nhau ở ít nhất một thuộc
    tính, theo thứ tự md5.
- Trang chỉ hỏi thuộc tính, và mỗi ô có kèm định nghĩa của nó. Vòng 3 cho
  thấy khi để chung với loại ảnh thì thuộc tính bị bỏ qua.

### Vòng 3b: kết quả, và định nghĩa v3 (17/10/2026)

Chủ sản phẩm chấm xong 40 ảnh. Câu trả lời được lưu ở
`data/review/photo-types/round3b.json`.

**So với v1 và v2:** lệch nhiều nhất ở nghĩa của từ, không phải ở việc
model nhìn sai:
- Biển hiệu: chủ sản phẩm không tính logo in trên cốc, phin, đĩa hay latte
  art.
- Cây xanh: chủ sản phẩm không tính hoa hay vài chậu cây nhỏ.
- Người: chủ sản phẩm tính mọi người thấy trong ảnh. v1 và v2 chỉ tính khi
  người là chủ thể.
- Dàn dựng: chủ sản phẩm không tính chữ in đè. Chủ sản phẩm không chọn
  "Có" ở ảnh nào.
- Toàn cảnh: chủ sản phẩm chỉ chọn "Có" 2/40, vì đọc "Toàn cảnh" thành ảnh
  panorama. Câu trả lời này đo một câu hỏi khác, nên không tính điểm.

Chủ sản phẩm xác nhận cách hiểu cho người, dàn dựng và toàn cảnh. Cách hiểu
cho biển hiệu và cây xanh lấy theo chính câu trả lời của chủ sản phẩm. Tất
cả được ghi vào **v3** (mục 3). Trên trang chấm, ô "Toàn cảnh" đổi tên
thành "Thấy cả không gian".

**Đo lại với v3:** chỉ tính các cặp trả lời mà không bên nào chọn "Không
rõ".

| Thuộc tính | Opus 5.5, v2 | **Opus 5.5, v3** | Haiku 5.5, v3 |
|---|---|---|---|
| Biển hiệu | 81%, κ 0,54 | **92%, κ 0,77** | 89%, κ 0,71 |
| Cây xanh | 85%, κ 0,63 | **98%, κ 0,93** | 84%, κ 0,63 |
| Ánh sáng ngày | 87%, κ 0,74 | 84%, κ 0,69 | **91%, κ 0,81** |
| Người | 75%, κ 0,34 | 77%, κ 0,56 | 80%, κ 0,61 |
| Dàn dựng | 88% | 93% (chủ sản phẩm 0 "Có") | 97% |
| Toàn cảnh | chưa đo | chưa đo | chưa đo |

- Đạt ngưỡng 85% của mục 8:
  - Opus: biển hiệu, cây xanh;
  - Haiku: biển hiệu, ánh sáng ngày;
  - Ánh sáng ngày của Opus (84%) và cây xanh của Haiku (84%) chỉ thiếu
    một điểm.
- **Người** chưa đạt. Với v3, các model chọn "Có" ở 8–9 ảnh mà chủ sản phẩm
  chọn "Không", tức là giờ lệch theo chiều ngược lại.
- **Dàn dựng** không đo được bằng kappa vì chủ sản phẩm không chọn "Có" ảnh
  nào. 93–97% là tỷ lệ cùng chọn "Không".
- **Toàn cảnh** cần một lần chấm lại dưới tên mới.
- Số đo v3 là in-sample: định nghĩa được viết sau khi đã thấy câu trả lời
  của chủ sản phẩm.
- Lần đo tốn khoảng 0,6 USD cho cả hai model.

**Vòng 3c (trang `#/photo-types-3c`): ảnh mới, đo sạch.** Chủ sản phẩm đồng
ý làm thêm một vòng (17/10).
- **Ảnh:** 24 ảnh chưa dùng ở vòng nào. Lấy từ 60 ảnh đã duyệt, đã lưu
  trong bucket và chưa có điểm nào, theo thứ tự md5. Trong đó 12 ảnh có ít
  nhất một model nói có người, và 12 ảnh không model nào nói vậy.
- **Câu hỏi:** loại ảnh, "Thấy cả không gian" và "Người".
- **Khoá trước:** câu trả lời v3 của cả hai model đã được ghi vào
  `data/review/photo-types/round3c.json`, kèm sha256, trước khi có trang
  chấm. Vì vậy vòng này đo được cả loại ảnh v2 lẫn hai thuộc tính v3 trên
  ảnh chưa ai dùng để viết định nghĩa.
- **Không đặt sẵn câu trả lời:** mỗi thuộc tính là một hàng ba nút Có,
  Không, Không rõ, không nút nào được chọn trước. Nút Tiếp chỉ mở khi đã
  trả lời đủ ba câu.
- Gán nhãn 60 ảnh tốn khoảng 0,8 USD.

- Câu trả lời v2 của cả hai model được lưu ở khoá `function_v2` trong
  `round3.json` và `round2.json`.

### Vòng 3c: kết quả, và định nghĩa v4 (17/10/2026)

Chủ sản phẩm chấm xong 24 ảnh. Hai dòng câu trả lời của model được kiểm
tra lại sha256 trước khi chấm điểm, và khớp. Câu trả lời của chủ sản phẩm
được lưu ở `data/review/photo-types/round3c.json`, khoá `owner`.

**Đính chính.** Claude mở lại những ảnh mà chủ sản phẩm và cả hai model
trả lời khác nhau, và hỏi lại chủ sản phẩm (khoá `owner_corrected`):
- Ảnh 2 (sảnh bảo tàng), 4 (khán phòng nhà hát) và 22 (góc ngồi trong
  nhà): bấm nhầm Mặt tiền, đúng là Nội thất.
- Ảnh 8: quầy T Roaster trong nhà, biển chữ sáng trên tường. Chủ sản phẩm
  chọn Mặt tiền theo luật quầy của v2, nhưng lại chọn Nội thất cho ảnh 23,
  một quầy tương tự. Chủ sản phẩm quyết định quầy trong nhà là Nội thất;
  luật này thành **v4** (mục 3).
- Ảnh 15: có khách ngồi ở bàn phía sau lớp kính; bị bỏ sót, đúng là "Có".

Vì chỉ những ảnh lệch được đem hỏi lại, bản đính chính chỉ có thể nghiêng
về phía model. Cả hai cột được ghi dưới đây. Chỉ tính các cặp trả lời mà
không bên nào chọn "Không rõ".

| | Opus 5.5, gốc | Haiku 5.5, gốc | **Opus 5.5, đính chính** | **Haiku 5.5, đính chính** |
|---|---|---|---|---|
| Loại ảnh | 20/24 (83%), κ 0,76 | 20/24 (83%), κ 0,76 | **24/24** | **24/24** |
| Thấy cả không gian | 22/24 (92%), κ 0,81 | 24/24 | 22/24 (92%), κ 0,81 | **24/24** |
| Người | 20/23 (87%), κ 0,74 | 22/24 (92%), κ 0,83 | 21/23 (91%), κ 0,83 | **23/24 (96%), κ 0,92** |

- Đây là lần đo đầu tiên trên ảnh chưa ai dùng để viết định nghĩa. Mọi
  thuộc tính được hỏi đều đạt ngưỡng 85% của mục 8, kể cả trên câu trả
  lời gốc. Loại ảnh chỉ đạt ngưỡng 90% sau khi đính chính.
- Hai model trùng nhau 24/24 về loại ảnh.
- **Người:** ảnh duy nhất cả hai model vẫn lệch là ảnh 23, nơi chỉ thấy
  một phần đầu người sau máy pha cà phê. Opus còn nói "Có" ở ảnh 1, có tay
  và một phần thân người phía sau bát ăn; Haiku và chủ sản phẩm nói "Không".
  Ở vòng 3b, model chọn "Có" nhiều hơn chủ sản phẩm 8–9 ảnh; ở đây chỉ còn
  1–2.
- **Thấy cả không gian:** Opus nói "Không" ở ảnh 8 (quầy) và 14 (góc bar
  với tường đĩa than), còn chủ sản phẩm và Haiku nói "Có".
- **v4** chỉ đổi luật quầy, và cả hai model đã trả lời đúng theo luật mới
  ngay từ v3. Vì vậy v4 không được đo lại. Các dòng v1 của skill (137 ảnh)
  sẽ được gán lại theo v4.

### Gán nhãn toàn catalog (bước 5, 17/10/2026)

Chủ sản phẩm chọn **Haiku 5.5**, sau vòng 3c. Ở vòng đó Haiku ngang hoặc
hơn Opus ở cả loại ảnh, "Thấy cả không gian" và "Người", với giá bằng
khoảng 1/37.

**Cách chạy:**
- Database gọi `label-photos` qua `pg_net`, mỗi yêu cầu 24 ảnh, với một
  ops token tạo ngay trong database. Token không ra khỏi database và được
  cho hết hạn ngay sau đợt chạy.
- Chạy từng đợt 15–80 yêu cầu song song, theo thứ tự thành phố rồi địa
  điểm. Mỗi đợt bỏ qua các ảnh đã có nhãn v4 và các ảnh đang chờ trong hàng
  đợi, nên ảnh lỗi tự được thử lại ở đợt sau.
- 80 yêu cầu cùng lúc làm 2 yêu cầu bị 503. 60 yêu cầu chỉ bị 1. Hai ảnh
  lỗi vì API tải ảnh quá lâu. Tất cả đều xong ở đợt sau.

**Kết quả:**
- 6.467 ảnh đã lưu trong bucket, ở 9 thành phố, có nhãn v4
  (`"by": "fn"`, `"model": "claude-haiku-5-5"`). Chạy trong khoảng 15
  phút.
- 137 dòng v1 của skill đã được thay bằng nhãn của function. Bản v1 vẫn
  còn trong `round3.json`.
- Token: khoảng 19,4 triệu vào và 0,78 triệu ra, tức khoảng 3.000 vào và
  120 ra mỗi ảnh. Theo giá mỗi ảnh đo ở trên, tổng chi phí khoảng 2,3 USD.

| Loại ảnh | Số ảnh | Biển hiệu | Thấy cả không gian | Cây xanh | Ánh sáng ngày | Người |
|---|---|---|---|---|---|---|
| Đồ ăn | 2.647 | 7% | 7% | 11% | 26% | 19% |
| Nội thất | 2.228 | 22% | 90% | 46% | 30% | 46% |
| Mặt tiền | 1.085 | 76% | 94% | 78% | 66% | 52% |
| Phong cảnh | 325 | 7% | 95% | 92% | 80% | 47% |
| Chữ | 110 | 57% | 7% | 14% | 23% | 12% |
| Khác | 60 | 15% | 28% | 32% | 36% | 46% |

Bảng tính trên 6.455 ảnh, trước 12 ảnh cuối. Tỷ lệ phần trăm chỉ tính trên các ảnh có câu trả lời Có hoặc Không.

**Cần lưu ý:**
- Haiku chọn **dàn dựng** cho 185 ảnh, trong đó 127 là ảnh đồ ăn.
  Thuộc tính này chưa được đo, vì chủ sản phẩm chưa chọn "Có" ở ảnh nào.
  Theo ngưỡng ở mục 8, nó chưa được hiện trong app.
- Khoảng 11% ảnh (694) được đánh `unsure` về loại. Tỷ lệ này cao nhất ở
  ảnh phong cảnh (187/325) và mặt tiền (182/1.085).

## 11. Bước 6: đề xuất (17/10/2026)

Đề xuất này viết trước khi có code (nguyên tắc 8 của `photo-critic.md`).
Chủ sản phẩm duyệt xong mới làm.

**Mục đích.** Giúp người chọn ảnh bìa, bằng cách **gợi ý** chứ không tự đổi
ảnh bìa. Đây là bước 5 của `photo-critic.md`: điểm "hợp làm bìa" là một
trục riêng, không gộp vào điểm đẹp (D4).

**Điểm "hợp làm bìa"**, lấy theo tiêu chí ảnh bìa của skill Threads và chốt
trước khi đo:
- **Điều kiện:** loại ảnh là Mặt tiền, Nội thất hoặc Phong cảnh, và có
  "Thấy cả không gian" (tiêu chí 1).
- **Cộng 1 điểm** cho mỗi tiêu chí: có biển hiệu (tiêu chí 2), ánh sáng
  ngày (tiêu chí 4), không có người (tiêu chí 5).
- **Không tính** cây xanh (Haiku đạt 84%, dưới ngưỡng 85%) và dàn dựng
  (chưa đo được). Thêm hai thuộc tính này vào thì kết quả đo bên dưới gần
  như không đổi (74% so với 73%).
- Ảnh có nhãn `unsure` vẫn được tính. Đây là một câu hỏi để chủ sản phẩm
  quyết.

**Đã đo trên catalog**, ở 1.000 địa điểm có từ 3 ảnh hiện trở lên và đúng
một ảnh bìa (trung bình 6,4 ảnh mỗi nơi; ảnh cùng điểm thì chia đều thứ
hạng):

| | Ảnh bìa đứng đầu | Ảnh bìa trong top 3 |
|---|---|---|
| **Điểm hợp làm bìa** | **34%** | **73%** |
| Chọn ngẫu nhiên | 17% | 52% |
| Điểm đẹp của Apple Vision (42 nơi, mục 5.1 của `photo-critic.md`) | 14% | 62% |

- Theo loại của ảnh bìa hiện tại, tỷ lệ lọt top 3 là: Mặt tiền 88%, Nội
  thất 80%, Phong cảnh 73%, Đồ ăn 39%.
- **185 ảnh bìa là ảnh đồ ăn.** Ở **199 nơi**, ảnh bìa không phải ảnh
  thấy cả không gian, trong khi nơi đó có ảnh khác đạt điều kiện. Đây là
  những nơi gợi ý có ích nhất.
- **Cần thận trọng khi đọc kết quả:**
  - Một phần ảnh bìa do chính skill Threads chọn theo những tiêu chí này,
    nên kết quả hơi vòng tròn.
  - Ảnh guide tải lên tự thành ảnh bìa (trigger
    `guide_upload_becomes_cover`), nên ở ảnh tải lên tỷ lệ chỉ còn 61%.
  - Lần đo sạch là ở phần A bên dưới: người duyệt nhận hay bỏ từng gợi ý.

**Hiện gì.** Ba phần, làm theo thứ tự. Chủ sản phẩm chọn làm đến đâu:

| | Ở đâu | Hiện gì | Cần trước |
|---|---|---|---|
| **A** | Data Desk | Danh sách "Ảnh bìa nên xem lại": 199 nơi kể trên, mỗi nơi có ảnh bìa hiện tại cạnh ảnh được gợi ý, kèm lý do (thấy cả mặt tiền, có biển, ánh sáng ngày). Người duyệt bấm Đổi hoặc Giữ, và câu trả lời được lưu lại để đo | Không có |
| **B** | Gallery trong app (guide và editor) | Dấu "Gợi ý bìa" trên ảnh có điểm cao nhất khi ảnh đó chưa phải ảnh bìa, cùng một dòng lý do. Bấm vào là hành động "Đặt làm ảnh bìa" đã có | Chính sách quyền riêng tư, và kết quả đo ở A |
| **C** | Sheet ảnh | Một icon trung tính cho loại ảnh, ẩn khi `unsure`. Ghi "Nhãn do Claude gán", tách khỏi dòng "Phân tích trên máy bằng Apple Vision" | Chính sách quyền riêng tư |

**Không làm ở bước này:** tự đổi ảnh bìa; xếp hạng danh sách công khai theo
nhãn; hiện cây xanh hay dàn dựng.

**Điều kiện trước khi app hiện nhãn:**
1. **Chính sách quyền riêng tư.** 950 ảnh do guide tải lên đã được gửi tới
   Anthropic để gán nhãn ở bước 5. Trong khi đó `legal.ts` viết rằng ngoài
   Supabase, phần viết kế hoạch và các dịch vụ được liệt kê thì "không chia
   sẻ dữ liệu với bất kỳ ai". Cần thêm một đoạn, chủ sản phẩm duyệt câu chữ.
   Bản nháp:
   - *vi:* "Ảnh trong danh mục, kể cả ảnh bạn thêm cho một địa điểm, cũng
     được gửi qua máy chủ của chúng tôi tới model Claude của Anthropic, để
     ghi nhận ảnh chụp gì (món ăn, bên trong, bên ngoài, cảnh) và có hợp làm
     ảnh bìa không. Chỉ ảnh được gửi, không kèm gì nhận dạng bạn. Anthropic
     xử lý với vai trò nhà cung cấp dịch vụ và không dùng để huấn luyện
     model."
   - *en:* bản dịch tương ứng.
2. **Ảnh mới.** Hiện chưa có gì gọi `label-photos` khi ảnh được thêm. Ảnh
   guide tải lên lại tự thành ảnh bìa, nên phải có nhãn. Đề xuất: một
   trigger trên `place_photos` gọi function qua `pg_net` khi ảnh đã lưu vào
   bucket, dùng một ops token có sẵn như `shrink-photos`. Việc này cần một
   migration riêng.
3. **Điều khoản Google (C1)** vẫn mở (mục 7).

**Tiêu chí thành công:** ở phần A, ghi tỷ lệ người duyệt nhận gợi ý trên 50
nơi đầu tiên. Có làm phần B hay không, chủ sản phẩm quyết dựa trên con số
đó.
