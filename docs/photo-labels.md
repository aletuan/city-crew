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

## 3. Bộ nhãn v12

Mỗi ảnh có **một loại** và **sáu thuộc tính**. Bộ nhãn bám theo tiêu chí chọn
ảnh bìa trong skill Threads, để nhãn dùng được ngay cho điểm "hợp làm bìa"
(bước 5 của `photo-critic.md`).

**Loại ảnh** (`kind`): xét theo **chủ thể**, tức là thứ chiếm phần lớn khung
và được lấy nét, không xét theo việc ảnh *có* trời hay cây.

| Giá trị | Nghĩa | Ở các vòng chấm tay |
|---|---|---|
| `food` | Đồ ăn hoặc đồ uống là chủ thể, kể cả khi phía sau có view. Đồ ăn trên bàn vẫn là Đồ ăn dù thấy một phần không gian | F |
| `interior` | Không gian bên trong: bàn ghế, quầy, kiến trúc trong nhà, không có đồ ăn làm chủ thể. Quầy trong nhà là Nội thất, kể cả khi biển tên quán sáng trên tường phía sau. Chỉ khi chụp từ trong phòng: cùng căn phòng đó nhìn từ ngoài qua kính hay cửa sổ là Mặt tiền | P |
| `exterior` | Toà nhà, mặt tiền, lối vào hay biển hiệu chiếm phần lớn khung. Quầy hay ki-ốt có biển tên, nhìn từ ngoài đường, là Mặt tiền. Thư viện, bảo tàng, trung tâm thương mại là Mặt tiền; đền chùa, nhà thờ, tượng đài là Văn hóa. Căn phòng nhìn từ ngoài qua kính hay cửa sổ là Mặt tiền, kể cả khi phòng chiếm cả khung. Bàn ghế của quán ở vỉa hè hay dọc mặt nhà nhìn ra đường là Mặt tiền, có mái hay không. Cổng, lối vào hay mặt nhà chiếm phần lớn khung là Mặt tiền, kể cả thấy sân hay bàn ghế phía sau | P |
| `garden` | Chỗ ngồi ngoài trời của chính quán là chủ thể: bàn, ghế, sofa, ghế dài, ghế nằm ở sân trong, vườn, sân thượng, ban công, sàn gỗ hay bên hồ bơi. Lối đi, bậc đá, cầu, sàn gỗ hay bãi cỏ không có ghế, hoặc vài ghế ở mép một khung mà cảnh chiếm phần lớn, là Phong cảnh. Công viên, bờ hồ, khuôn viên công cộng là Phong cảnh, kể cả có ghế đá. Cổng của quán chỉ là Sân vườn khi cây che gần hết cổng và thấy bàn ghế trong sân phía sau, như Bold Brew. Sân vườn là chỗ ngồi bên trong khuôn viên quán: sân trong, vườn, hiên hay sân quay vào chúng, sân thượng. Hiên, hè hay giàn có mái ở đó, mở ra ngoài ít nhất một phía, là Sân vườn. Bàn ghế ở vỉa hè hay dọc mặt nhà nhìn ra đường là Mặt tiền, có mái hay không; kín tường hay kính mọi phía thì là Nội thất | (từ v5, thu hẹp ở v6, thêm ở v9 và v10, chỉnh ở v11) |
| `heritage` | Công trình văn hóa là chủ thể, nhìn từ ngoài: đền, chùa, miếu, nhà thờ, lăng mộ, thành quách, cung điện, cổng hay tháp cổ, tượng, đài tưởng niệm. Vẫn là Văn hóa khi đứng giữa khuôn viên, miễn là ảnh chụp chính nó. Bên trong công trình là Nội thất. Công viên, vườn, bãi cỏ, hồ không có công trình làm chủ thể là Phong cảnh, kể cả trong khu di tích | (từ v7) |
| `view` | Cảnh vật chiếm phần lớn khung: trời, nước, cây, bãi cỏ, công viên, khuôn viên, lối đi hay cây cầu xuyên qua chúng, toàn cảnh thành phố. Nhà hay công trình nhỏ giữa cảnh chiếm phần lớn khung vẫn là Phong cảnh. Sân thượng mà bàn ghế là chủ thể là Sân vườn; cùng sân thượng đó mà toàn cảnh chiếm khung, ghế chỉ ở mép, là Phong cảnh. Bàn ghế của quán trước bãi biển, sông, toàn cảnh thành phố hay khu vườn cảnh chiếm phần lớn khung là Phong cảnh | S |
| `text` | Menu, bảng chữ, poster, hoặc biển hay logo chiếm cả khung. Poster hay banner mà chữ là ý chính vẫn là Chữ, kể cả có ảnh trong đó | U |
| `collage` | Hai ảnh trở lên ghép thành một: lưới, chia đôi, xếp tầng, dù mỗi khung chụp gì. Một ảnh có chữ hay logo in đè không phải ảnh ghép. Là ảnh bìa hợp lệ | (từ v8) |
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

**v5 (18/10/2026)** thêm loại `garden` (Sân vườn), theo quyết định của chủ
sản phẩm: sân vườn là một ảnh bìa hợp lệ. Lý do và kết quả ở mục 13.

**v6 (18/10/2026)** thu hẹp Sân vườn: chỉ khi chỗ ngồi của quán là chủ thể.
Lối đi, sàn gỗ không ghế, công viên công cộng là Phong cảnh (mục 13).

**v7 (18/10/2026)** thêm loại `heritage` (Văn hóa): công trình văn hóa là chủ
thể của ảnh (mục 13).

**v8 (18/10/2026)** thêm loại `collage` (Ảnh ghép), là ảnh bìa hợp lệ (mục
13).

**v9 (18/10/2026)** thêm vào Sân vườn: cổng hay lối vào của chính quán, nhìn
vào sân có cây xanh và bàn ghế của quán, là Sân vườn (mục 13). Nhãn chủ sản
phẩm sửa tay (`"by": "owner"`) không bao giờ bị gán lại.

**v10 (18/10/2026)** chốt hai ranh giới mà phần lớn nhãn `unsure` còn lại
vướng phải, theo quyết định của chủ sản phẩm: hiên có mái che, mở ra ngoài,
có chỗ ngồi của quán là Sân vườn; căn phòng chụp từ ngoài qua kính là Mặt
tiền (mục 13).

**v11 (18/10/2026)** sửa ranh giới mà v10 làm mờ, theo xác nhận của chủ sản
phẩm: Sân vườn là chỗ ngồi bên trong khuôn viên quán; bàn ghế ở vỉa hè hay
dọc mặt nhà nhìn ra đường là Mặt tiền, kể cả có mái (mục 13).

**v12 (18/10/2026)** thêm hai ranh giới chủ sản phẩm xác nhận: cổng hay mặt
nhà chiếm phần lớn khung là Mặt tiền, kể cả thấy sân phía sau; bàn ghế trước
cảnh chiếm phần lớn khung là Phong cảnh (mục 13).

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
| `scorer_version` | `VERSION` trong `photoLabels.ts`, hiện là `9` (luật 3 ở mục 4) |
| `aesthetic`, `is_utility` | `null`: bộ chấm này không chấm điểm đẹp |
| `scored_by` | `null`: skill ghi nhãn qua Supabase MCP, không qua tài khoản người dùng |
| `signals` | `{ "v": 9, "kind": …, "brand": …, … }` |

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
| 6 | App đọc nhãn: loại ảnh và điểm "hợp làm bìa" (đề xuất ở mục 11) | ◐ 17/10: phần A xong. Data Desk có trang `#/covers` (Cover review), câu trả lời lưu ở `cover_reviews`. 18/10: chủ sản phẩm duyệt 61 nơi, nhận 9 gợi ý (15%); luật ảnh bìa hiện tại không đủ để làm phần B (mục 11); chủ sản phẩm chờ thêm dữ liệu rồi mới tìm luật mới. Phần C làm 18/10: sheet ảnh trong app hiện loại ảnh và so điểm trong cùng loại |

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

**Chủ sản phẩm duyệt (17/10/2026):**
- Làm **phần A** trước.
- **Ảnh đồ ăn được làm ảnh bìa** ở quán cà phê và chỗ ăn uống (category
  `cafes` hoặc `eats`). Với luật này, catalog còn **60 nơi** cần xem lại,
  thay vì 199 nơi như trên.
- **Chính sách quyền riêng tư** đã thêm đoạn về ảnh gửi tới Claude (PR
  #1026).
- **Ảnh mới:** gán nhãn bằng một job `pg_cron` chạy mỗi giờ
  (`supabase/functions/label-photos/cron.sql`), theo mẫu của
  `shrink-photos`. Dùng job thay cho trigger vì ảnh phải có trong bucket
  trước, và một lần gọi lỗi sẽ tự được thử lại ở giờ sau.

**Phần A đã làm:**
- `dashboard/src/coverReview.js` chứa luật: ảnh nào đủ điều kiện, ảnh nào
  được gợi ý, nơi nào cần hỏi.
- Trang `#/covers` đặt ảnh bìa hiện tại cạnh ảnh gợi ý, kèm lý do. Người
  duyệt chọn "Use the suggestion" hoặc "Keep the cover".
- Câu trả lời được lưu ở bảng `cover_reviews`, mỗi nơi một dòng, chỉ
  editor đọc và ghi được. Nơi nào đã chọn giữ ảnh bìa sẽ không hiện lại,
  trừ khi ảnh bìa đổi.
- Pill "N of M suggestions taken" là con số để đo.

### Phần A: kết quả (18/10/2026)

Chủ sản phẩm trả lời cả **61 nơi** trên trang, từ 23:59 ngày 17/10 đến
00:03 ngày 18/10 (UTC), trung bình khoảng 4 giây mỗi nơi. Đó cũng là cách
một ảnh bìa thật sự được nhìn: như một thumbnail.

**Nhận gợi ý 9/61 (15%), giữ ảnh bìa 52/61 (85%).** Chín nơi đổi ảnh bìa:
80plus Coffee Roastery, TapTap Brunch, The Old Well Tiki Bar, Vườn Khói,
Maiden Cocktail Bar, nonê pasta, Rehab Station, The Deck Saigon, La Poste.

| Nhóm | Số nơi | Đổi |
|---|---|---|
| Ảnh bìa là nội thất, chỉ một góc | 22 | 3 |
| Ảnh bìa là mặt tiền, chỉ một phần | 15 | 2 |
| Ảnh bìa là đồ ăn, đồ uống (phần lớn ở quán bar) | 10 | 2 |
| Ảnh bìa là "khác" | 5 | 2 |
| Ảnh bìa là chữ, logo | 4 | 0 |
| Ảnh bìa là cảnh | 4 | 0 |
| Ảnh bìa chưa có nhãn | 1 | 0 |
| Ảnh bìa do guide tải lên | 21 | 5 |
| Ảnh bìa từ Google | 40 | 4 |
| Gợi ý có ánh sáng ngày | 29 | 3 |
| Gợi ý không có ánh sáng ngày | 22 | 5 |
| Gợi ý đạt cả 3 tiêu chí (biển, ánh sáng ngày, không người) | 10 | 1 |

**Đọc kết quả:**
- **Nhãn đúng, luật sai.** Nhãn "thấy cả không gian" trùng với chủ sản
  phẩm 92–100% ở vòng 3c. Cái không khớp là giả định của luật: ảnh bìa
  phải thấy trọn nơi chốn (tiêu chí 1 của skill Threads). Với chủ sản
  phẩm, một góc quán, một phần mặt tiền hay một ly cocktail ở quán bar
  vẫn là ảnh bìa tốt.
- **Ba tiêu chí xếp hạng không giúp chọn ảnh.** Gợi ý có ánh sáng ngày được
  nhận ít hơn gợi ý không có (10% so với 23%): quán bar và nhà hàng hợp
  với ảnh tối. Gợi ý đạt cả ba tiêu chí chỉ được nhận 1/10.
- **Quán bar dùng ảnh đồ uống làm bìa là đúng:** 8/10 ảnh bìa đồ ăn, đồ uống
  được giữ. Luật "đồ ăn làm bìa" lẽ ra nên tính cả `nightlife`.
- Hai nhóm có tỷ lệ đổi cao hơn là ảnh bìa model gọi là "khác" (2/5) và
  ảnh bìa do guide tải lên (5/21, so với 4/40 ảnh Google). Ảnh guide tải
  lên tự thành ảnh bìa (`guide_upload_becomes_cover`). Cả hai nhóm quá
  nhỏ để dựng thành luật.
- **Giới hạn:** một người chấm, một lần. Chỉ những nơi luật đã gắn cờ mới
  được hỏi, nên số liệu này đo độ chính xác của cờ "ảnh bìa chưa đạt",
  không đo được những ảnh bìa tệ mà luật bỏ sót.

**Phần B** là gợi ý ảnh bìa ngay trong app: một dấu "Gợi ý bìa" trên ảnh
điểm cao nhất ở thư viện ảnh của guide. Với tỷ lệ nhận 15%, cứ 6 gợi ý thì
5 sai, nên phần B **chưa làm** với luật hiện tại. Có làm lại hay không,
bằng luật nào, là việc chủ sản phẩm quyết sau.

Trang Cover review vẫn chạy. Job gán nhãn mỗi giờ đưa ảnh mới vào, nên
những nơi mới bị gắn cờ sẽ hiện ở đó. Những nơi đã chọn giữ ảnh bìa không
hiện lại.

### Phần C (18/10/2026)

Chủ sản phẩm duyệt phần C ở mức "nhãn loại và so sánh trong cùng loại".
Lý do: một nhãn đơn thuần chỉ nhắc lại điều guide đã thấy trong ảnh, còn
phép so sánh thì cho biết điều mà nhìn ảnh không thấy được.

**Trong sheet ảnh của app:**
- **Nhãn loại ảnh** nằm dưới câu nhận xét, kèm icon: Đồ ăn & uống, Nội
  thất, Mặt tiền, Sân vườn (từ v5, mục 13), Cảnh, Chữ, menu. Không hiện
  nhãn khi model đánh dấu `unsure` (11% số ảnh theo v4, 6% sau v5), khi
  loại là `other`, hoặc khi ảnh chưa có nhãn (ảnh guide vừa tải lên phải
  chờ tối đa một giờ).
- **"Điểm cao hơn X%"** so ảnh với các ảnh cùng loại trong catalog. Thang
  so sánh đo trên 434 ảnh vừa có điểm Apple Vision vừa có nhãn (18/10).
  - Apple Vision chấm ảnh đồ ăn cao hơn ảnh nội thất: trung bình 0,568 so
    với 0,481. So với cả catalog, một ảnh cà phê bình thường vì thế trông
    như một ảnh kém.
  - Chỉ ba loại đủ ảnh để có thang riêng: đồ ăn & uống (154), nội thất
    (172), mặt tiền (81). Cảnh (19) và chữ (6) vẫn so với cả catalog.
  - Các thang này nằm ở `KIND_SPREAD` trong
    `app/src/lib/photoScoreVision.ts`. Đo lại khi catalog lớn gấp đôi.
- **Dòng nguồn** đổi thành "Phân tích ảnh bằng Apple Vision và Claude."
  khi ảnh có nhãn loại, theo câu chữ chủ sản phẩm chọn. Ảnh không có nhãn
  vẫn ghi "Phân tích trên máy bằng Apple Vision."
- **Chưa hiện thuộc tính.** Ngay ở một quán (Backyard, Hải Phòng) đã có
  hai lỗi mà guide sẽ thấy: một bàn tay bị tính là "có người", vài cây
  ngoài đường bị tính là "cây xanh".

**Rủi ro:** chủ sản phẩm xác nhận đã cân nhắc và chấp nhận (18/10), gồm
cả điều khoản Google (C1). Chính sách quyền riêng tư đã nói việc ảnh được
gửi tới Claude (PR #1026).

**Kỹ thuật:**
- Chỉ sửa JavaScript, lên bằng EAS Update.
- Thư viện ảnh đọc nhãn trong cùng truy vấn với điểm Apple Vision, dưới tên
  embed `labels`.
- Code ở `app/src/lib/photoKind.ts`.

## 12. Vòng 4: ảnh nào đẹp hơn, trong cùng một loại (đề xuất, 18/10/2026)

Đề xuất này viết trước khi có code (nguyên tắc 8 của `photo-critic.md`).
Chủ sản phẩm duyệt bộ tiêu chí trước khi chạy.

**Vì sao.** Ở phần A, chọn **loại** ảnh nào làm bìa hoá ra là khẩu vị của
editor, và mỗi kiểu quán một khác:

| Loại địa điểm | Bìa đồ ăn & uống | Bìa nội thất | Bìa mặt tiền |
|---|---|---|---|
| Quán cà phê (536) | 11% | 44% | 40% |
| Nhà hàng (318) | 37% | 40% | 20% |
| Quán bar (75) | 12% | 67% | 16% |

Câu hỏi máy có thể giúp là câu hỏi khác: **trong một loại, ảnh nào đẹp
nhất?** Editor chọn loại ("quán này dùng ảnh nội thất"), máy chỉ ra ảnh
nội thất đẹp nhất của quán. Ý tưởng của chủ sản phẩm, 18/10.

**Chưa biết:**
- Điểm Apple Vision có hiểu "đẹp" giống chủ sản phẩm không? Phép đo trước
  chỉ cho thấy nó không đoán được ảnh bìa, chưa đo nó có chọn được ảnh
  đẹp không.
- Apple Vision mới chấm 434 trong 6.473 ảnh, vì nó chỉ chạy trên điện
  thoại.
- Claude chấm được cả catalog ở phía máy chủ, theo tiêu chí riêng cho
  từng loại ảnh.

**Tiêu chí "đẹp" (bản nháp, chủ sản phẩm duyệt):**

*Chung cho mọi loại:*
- Ảnh nét ở chủ thể, không rung, không nhoè.
- Đủ sáng: không tối om, không cháy trắng mất chi tiết.
- Màu tự nhiên, không ám màu nặng, không filter quá tay.
- Không có chữ hay watermark đè lên ảnh.

*Đồ ăn & uống:*
- Món là chủ thể rõ ràng và chiếm phần lớn khung.
- Trông ngon: màu tươi, có độ bóng hay độ tươi, không nhão, không tàn.
- Bố cục gọn, nền không bừa (khăn giấy vò, đĩa bẩn, đồ thừa).
- Ánh sáng mềm, không có bóng gắt che món.
- Góc chụp hợp với món: ngang tầm hoặc từ trên xuống.

*Nội thất:*
- Đường thẳng đứng (cột, tường, khung cửa) không nghiêng, không méo.
- Có chiều sâu, thấy được cảm giác không gian.
- Ánh sáng đẹp: tự nhiên, hoặc đèn ấm có chủ ý. Không tối om, cửa sổ
  không cháy trắng.
- Gọn gàng, không bừa bộn, không có người che phần lớn khung.
- Có một điểm nhấn: quầy, cây, chi tiết thiết kế.

*Mặt tiền:*
- Thấy rõ lối vào và biển tên quán.
- Thẳng, không nghiêng.
- Không bị xe, người hay dây điện che phần lớn.
- Ánh sáng tốt, ban ngày hoặc đèn buổi tối đẹp.
- Thể hiện được không khí của quán, không chỉ là một bức tường.

**Cách đo (Data Desk, trang `#/photo-pairs-4`):**
- **60 cặp**, mỗi cặp là hai ảnh **cùng quán, cùng loại**, cả hai đều có
  nhãn chắc chắn và đều đã có điểm Apple Vision. Gồm khoảng 20 cặp đồ ăn,
  20 nội thất và 19 mặt tiền; mỗi cặp ở một quán khác nhau.
- Chọn cặp theo thứ tự md5, như các vòng trước. Không dùng ảnh nào đã có
  mặt ở vòng trước.
- **Chủ sản phẩm chọn ảnh đẹp hơn**, hoặc "ngang nhau". Trang không cho
  biết máy đã chọn gì.
- **Khoá trước bằng sha256**, trước khi chủ sản phẩm thấy ảnh:
  - Lựa chọn của Apple Vision: ảnh có điểm cao hơn.
  - Lựa chọn của Claude. Claude chấm **từng ảnh riêng lẻ** theo tiêu chí
    của loại ảnh đó, với điểm tổng 1–10, rồi so hai điểm. Chấm từng ảnh
    chứ không cho xem cả cặp, vì cách này mới chạy được cho cả catalog.
- **Thước đo:** tỷ lệ trùng với chủ sản phẩm, không tính các cặp "ngang
  nhau". Chọn bừa được 50%. Đạt từ **75%** trở lên thì đủ tin để dùng.

**Nếu đạt:** Data Desk, và có thể cả app, chỉ ra "ảnh đẹp nhất của loại X"
ở mỗi quán. Editor vẫn là người chọn loại.


**Chủ sản phẩm duyệt tiêu chí, 18/10/2026**, đúng như bản nháp ở trên. Ảnh
quán bar chụp buổi tối không bị trừ điểm: tiêu chí nội thất đã cho "đèn ấm
có chủ ý", tiêu chí mặt tiền đã cho "đèn buổi tối đẹp".

**Đã chuẩn bị (18/10/2026):**

- **Cặp ảnh.** Có 60 cặp ở 60 quán: 15 mặt tiền (lấy hết số có), 23 nội
  thất và 22 đồ ăn (cũng lấy hết số có). Luật chọn và danh sách cặp nằm ở
  `data/review/photo-types/round4.json`.
- **Khác với đề xuất, và vì sao.**
  - Đề xuất là mỗi loại khoảng 20 cặp và không dùng ảnh của các vòng
    trước. Nhưng ảnh có điểm Apple Vision lại chính là những ảnh các vòng
    1–3c đã chọn, nên bỏ chúng đi thì chỉ còn 5 cặp mặt tiền.
  - Các vòng đó chỉ hỏi loại ảnh và các tiêu chí bìa, chưa từng hỏi ảnh nào
    đẹp hơn, nên vòng này dùng lại được.
  - Ảnh từ trang "Cover review" thì vẫn bỏ ra, vì trang đó có hỏi nên dùng
    ảnh nào trong hai ảnh.
- **Claude chấm.**
  - Hàm `rate-photos` chấm ảnh, theo tiêu chí ở
    `supabase/functions/_shared/photoBeauty.ts`, là bản tiếng Anh của tiêu
    chí đã duyệt, dịch từng ý.
  - Mỗi ảnh được chấm riêng, theo loại mà nhãn ảnh đã xác định. Hàm không
    ghi gì vào cơ sở dữ liệu.
  - Đã chấm cả 120 ảnh hai lần, bằng Haiku 5.5 và Opus 5.5, lúc 01:38 UTC.
    Không ảnh nào lỗi. Mỗi lần tốn khoảng 254 nghìn token đầu vào.
- **Khoá kết quả.** Có ba dòng kết quả: Apple Vision, Haiku và Opus. Mỗi dòng
  khoá bằng sha256 trong `round4.json`, cùng với điểm từng ảnh.
- **Hoà điểm.** Điểm của Claude là số nguyên từ 1 đến 10, nên hai ảnh trong
  cặp có thể bằng điểm: Haiku hoà 16 cặp, Opus hoà 14. Apple Vision không
  hoà cặp nào.
- **Cách tính điểm, viết trước khi chủ sản phẩm trả lời.**
  - Mỗi bên được tính độ trùng với chủ sản phẩm theo hai cách:
    - **nghiêm:** cặp bên đó hoà điểm tính là sai;
    - **chỉ tính cặp bên đó chọn:** bỏ các cặp hoà.
  - Đạt khi trùng từ 75% trở lên trên những cặp bên đó chọn, và bên đó phải
    chọn ít nhất 2/3 số cặp chủ sản phẩm đã chọn.
- **Trước khi chủ sản phẩm trả lời, giữa các máy với nhau:**
  - Haiku và Opus chọn giống nhau 35/36 cặp, ở những cặp cả hai cùng chọn.
  - Apple Vision chỉ trùng với Haiku 28/44 cặp và với Opus 31/46 cặp.
  - Như vậy hai mô hình Claude đồng ý với nhau, còn Apple Vision thì khác
    hẳn. Vòng này sẽ cho biết bên nào gần với mắt chủ sản phẩm hơn.
- **Trang chấm:** Data Desk, `#/photo-pairs-4`. Trang không cho biết máy đã
  chọn ảnh nào.

**Kết quả vòng 4 (18/10/2026).** Chủ sản phẩm trả lời đủ 60 cặp, sau khi
ba dòng kết quả của máy đã khoá. Trước khi tính điểm, tôi đã kiểm tra lại
sha256 của cả ba dòng. Chủ sản phẩm chọn hẳn một ảnh ở 47 cặp (18 A, 29 B)
và cho "ngang nhau" ở 13 cặp. 11 trong 13 cặp "ngang nhau" là ảnh đồ ăn,
tức là một nửa số cặp đồ ăn.

Bảng dưới tính trên 47 cặp chủ sản phẩm có chọn. Cột "Có chọn" là số cặp
bên đó không hoà điểm.

| Bên chấm | Có chọn | Trùng khi có chọn | Tính chặt (hoà là sai) | Đạt? |
|---|---|---|---|---|
| Apple Vision | 47/47 | **31/47 (66%)**, CI 95% 52–78% | 66% | Không |
| Haiku 5.5 | 36/47 (77%) | **26/36 (72%)**, CI 56–84% | 55% | Không, thiếu 3 điểm phần trăm |
| Opus 5.5 | 35/47 (74%) | **23/35 (66%)**, CI 49–79% | 49% | Không |

Theo từng loại, ở những cặp bên đó có chọn:

| Bên chấm | Mặt tiền | Nội thất | Đồ ăn |
|---|---|---|---|
| Apple Vision | 8/14 | 15/22 | 8/11 |
| Haiku | 8/10 | 13/16 | 5/10 |
| Opus | 7/11 | 12/15 | 4/9 |

**Đọc kết quả:**
- **Không bên nào qua mốc 75% đã đặt trước.** Cả ba đều hơn chọn bừa:
  khả năng đạt được mức đó nếu chỉ chọn bừa là 0,02 với Vision, 0,006
  với Haiku và 0,04 với Opus. Nhưng chưa bên nào đủ tốt để tự chọn ảnh
  thay editor.
- **Haiku gần mốc nhất**, và ở nội thất đạt 13/16. Phần kéo cả ba xuống
  là đồ ăn: chủ sản phẩm thấy một nửa số cặp đồ ăn là ngang nhau, còn ở
  những cặp có chọn thì Claude chỉ trùng khoảng một nửa.
- **Opus không hơn Haiku.** Hai mô hình đồng ý với nhau 35/36 cặp, nên mô
  hình lớn hơn không mua được gì ở câu hỏi này.

**Một gợi ý, tìm ra sau khi đã xem câu trả lời.** Vì tìm sau nên nó chỉ là
manh mối cho vòng sau, chưa phải kết quả:
- **Vision đúng khi hai điểm cách xa nhau.** Ở 23 cặp mà hai điểm Vision
  lệch nhau từ 0,1 trở lên, Vision trùng với chủ sản phẩm 20 cặp (87%).
  Ở 24 cặp lệch nhau dưới 0,1, Vision chỉ trùng 11 cặp (46%), ngang chọn
  bừa.
- **Claude cũng vậy.** Khi hai điểm cách nhau từ 3 trở lên, Haiku trùng 5/6
  cặp, Opus trùng 7/7 cặp.
- Nghĩa là các bên chấm đáng tin khi một ảnh rõ ràng hơn hẳn ảnh kia, và
  không đáng tin khi hai ảnh gần nhau. Muốn biết luật "chỉ chọn khi cách
  biệt lớn" có thật hay không thì phải đo trên những cặp mới.

**Chủ sản phẩm quyết định (18/10/2026): dừng ở đây.** Editor vẫn tự chọn ảnh
bìa như hiện nay. Hàm `rate-photos` giữ nguyên như đã triển khai, không ghi
gì vào cơ sở dữ liệu và không chạy định kỳ. Nếu sau này muốn kiểm chứng luật
"cách biệt lớn" ở trên, các bước là:
1. Cho Haiku chấm cả catalog. Chi phí khoảng vài đô.
2. Làm vòng 5 chỉ với những cặp mới có điểm cách nhau từ 3 trở lên.
3. Đặt trước mốc đạt, như vòng này.

## 13. Sân vườn: định nghĩa v5 (18/10/2026)

**Vì sao.** Sau khi gán cả catalog theo v4, 725 ảnh (11%) bị đánh `unsure`
về loại. Đọc lời ghi chú của model thì 367 ảnh trong số đó nhắc tới sân
trong, vườn, sân thượng, hiên hay ban công có bàn ghế của quán. Không có
loại nào cho chúng: Mặt tiền là nhìn từ đường, Nội thất là có mái và tường,
Phong cảnh là không có chỗ ngồi của quán. Riêng loại Phong cảnh thì 59% số
ảnh bị đánh `unsure`.

**Chủ sản phẩm quyết định:** thêm loại Sân vườn, và tính nó là một ảnh bìa
hợp lệ như Mặt tiền, Nội thất và Phong cảnh (khi thấy cả không gian,
`wide`).

**Đã làm:**
- `DEFINITIONS` trong `photoLabels.ts` thêm `garden`, và câu về Phong cảnh
  nói rõ: sân thượng có bàn ghế là Sân vườn. `VERSION` lên 5. `label-photos`
  triển khai lại (bản 6).
- Gán lại 736 ảnh bằng Haiku 5.5: mọi ảnh v4 bị `unsure`, cộng 11 ảnh
  `other`. Không gán lại khoảng 5.800 ảnh v4 đã chắc chắn: v5 không đổi
  loại của chúng. Vì vậy lượt chạy mỗi giờ (`label-photos/cron.sql`) vẫn chỉ
  tìm ảnh chưa có nhãn từ v4 trở lên.
- App hiện nhãn "Sân vườn" (icon lá). Sân vườn chưa có thang so sánh riêng,
  nên "cao hơn X%" so với cả catalog. Data Desk tính Sân vườn là ảnh bìa
  hợp lệ ở trang "Ảnh bìa nên xem lại".

**Kết quả trên 736 ảnh:**

| Loại v5 | Chắc | `unsure` |
|---|---|---|
| Sân vườn | 240 | 94 |
| Nội thất | 32 | 88 |
| Mặt tiền | 14 | 82 |
| Phong cảnh | 9 | 57 |
| Đồ ăn & uống | 18 | 30 |
| Chữ | 12 | 11 |
| Khác | 8 | 41 |

- 333 ảnh nay đã chắc chắn về loại, trong đó 240 là Sân vườn. Số ảnh
  `unsure` trên cả catalog giảm từ 725 (11%) còn 403 (6%).
- Sân vườn đến từ cả ba loại cũ: 85 ảnh trước là Nội thất, 85 ảnh là
  Phong cảnh, 69 ảnh là Mặt tiền.
- Xem bằng mắt 11 ảnh Sân vườn chắc chắn, chọn ngẫu nhiên: cả 11 đều là
  sân thượng, sân trong hay hiên có bàn ghế của quán.

**403 ảnh vẫn chưa chắc.** Đọc ghi chú thì phần lớn là ca ở ranh giới hai
loại, không phải loại mới:
- hiên có mái che, nằm giữa Sân vườn và Nội thất (khoảng 65 ảnh);
- sân thượng có toàn cảnh thành phố phía sau, giữa Sân vườn và Phong cảnh;
- ảnh chụp qua cửa kính (khoảng 20 ảnh).

Những nhóm ảnh không thuộc loại nào hiện có, đếm thô theo từ khoá trong ghi
chú (một ảnh có thể rơi vào hai nhóm). Chưa nhóm nào được thêm thành loại;
chờ chủ sản phẩm quyết định:

| Nhóm | Khoảng | Ví dụ |
|---|---|---|
| Ảnh ghép nhiều khung | 30 | ảnh ghép bốn khung: mặt tiền, đồ ăn, nội thất |
| Di tích, đền chùa, tượng đài, cổng | 50 | lăng, chùa, tượng trong công viên, cổng đá |
| Đồ vật, hàng trưng bày, chi tiết trang trí | 55 | kệ sô-cô-la, tượng mèo, đèn chùm, chai rượu |
| Quầy pha chế, máy móc, người đang làm | 55 | máy espresso cận cảnh, lò pizza, barista |
| Đường phố, hẻm graffiti, đám đông | 30 | phố đi bộ, hẻm vẽ tranh tường |
| Ảnh đồ hoạ: banner, poster, chữ in đè, tranh vẽ, ảnh chụp màn hình | 25 | banner khuyến mãi, ảnh render |
| Người là chủ thể: tạo dáng, selfie, nhóm, cưới | 17 | người mẫu, ảnh nhóm nhân viên |
| Bàn tiệc trang trí: sinh nhật, cầu hôn | 9 | bóng bay, chữ đèn |
| Động vật | 9 | mèo của quán, hổ, hươu cao cổ ở sở thú |
| Hồ bơi | 9 | hồ bơi resort; phần lớn đã thành Sân vườn |

### Định nghĩa v6: Sân vườn chỉ khi chỗ ngồi là chủ thể (18/10/2026)

**Vì sao.** Chủ sản phẩm hỏi về 139 ảnh v4 chắc chắn là Phong cảnh. Đọc lại
từng ảnh theo chữ của v5 thì 21 ảnh thành Sân vườn. Nhưng xem ảnh, chủ sản
phẩm thấy 12 trong số đó là phong cảnh: lối mòn trong rừng, sàn gỗ bên hồ,
cổng cưới, sân thượng mà hồ chiếm cả khung và ghế chỉ ở mép. v5 tính cả
"lối đi" và nói "cây phủ nhiều khung không đổi loại", nên đã gọi những ảnh
đó là Sân vườn. Ảnh công viên có ghế đá cũng vướng đúng câu đó.

**Chủ sản phẩm duyệt:** Sân vườn chỉ khi bàn ghế, ghế nằm hay chỗ ngồi của
quán là chủ thể. Lối đi, cầu, sàn gỗ không ghế, hay vài ghế ở mép khung mà
cảnh chiếm phần lớn, là Phong cảnh. Công viên, bờ hồ, khuôn viên công cộng
là Phong cảnh. `VERSION` lên 6, `label-photos` bản 7.

**Đo trước khi ghi**, Haiku, trên 21 ảnh chủ sản phẩm đã chia:
- 6/9 ảnh "chỗ ngồi là chủ thể" ra Sân vườn (4 ảnh `unsure`). Ba ảnh
  trượt là hai sân hiên của A Dopo và vườn của Memory Station: ghế chiếm
  nửa dưới nhưng đồi và thành phố chiếm phần còn lại.
- 11/12 ảnh "cảnh chiếm phần lớn" ra Phong cảnh. Ảnh còn lại là lối sân
  trong của The Collective, có ghế ở góc.

**Gán lại 540 ảnh** (mọi ảnh Sân vườn của v5 và mọi ảnh Phong cảnh trước v6),
không lỗi:

| Trước | Sau v6 |
|---|---|
| 240 Sân vườn chắc | 174 vẫn Sân vườn chắc, 48 Sân vườn `unsure`, 11 Phong cảnh `unsure`, 7 sang loại khác `unsure` |
| 95 Sân vườn `unsure` | 8 Sân vườn chắc, 35 vẫn `unsure`, 33 Phong cảnh, 19 sang loại khác |
| 139 Phong cảnh chắc (v4) | 116 vẫn Phong cảnh chắc, 14 Phong cảnh `unsure`, 9 Sân vườn |
| 66 Phong cảnh (v5) | 58 vẫn Phong cảnh, 3 sang loại khác |

- Sân vườn chắc chắn còn 183 ảnh (từ 240). Xem bằng mắt 15 ảnh chọn ngẫu
  nhiên: cả 15 đều có bàn ghế của quán làm chủ thể.
- Số ảnh `unsure` trên cả catalog tăng từ 403 lên 475 (7%). Ranh giới
  hẹp hơn thì nhiều ảnh nằm sát ranh giới hơn; ứng dụng không hiện nhãn
  cho những ảnh này, như trước.
- Những ảnh mà chính mình đọc là Mặt tiền (cổng lăng Minh Mạng, Thiệu Trị,
  tượng ở Huyền Không, Nhà thờ Đức Bà, Cầu Ánh Sao) thì Haiku vẫn gọi là
  Phong cảnh, đúng theo câu "cổng, tượng đứng giữa khuôn viên". Đó là câu
  hỏi về nhóm Di tích ở trên, chưa quyết.

### Định nghĩa v7: Văn hóa (18/10/2026)

**Vì sao.** Cổng lăng, tượng Phật ở chùa, nhà thờ sau tượng Đức Mẹ: khi
công trình chiếm khung thì là Mặt tiền, khi khuôn viên chiếm khung thì là
Phong cảnh. Di tích của catalog vì thế bị chia đôi giữa mặt tiền quán cà phê
và cảnh hồ. Chủ sản phẩm đề xuất nhãn "Văn hóa", và còn phân vân công viên
có phải là công trình văn hóa không.

**Quyết định:** nhãn xét theo **thứ ảnh chụp**, không theo địa điểm. Ảnh có
chủ thể là đền, chùa, nhà thờ, lăng mộ, thành quách, cung điện, cổng hay
tháp cổ, tượng, đài tưởng niệm thì là Văn hóa, kể cả khi đứng giữa khuôn
viên. Bãi cỏ hay hồ trong công viên là Phong cảnh; tháp Chăm trong cùng
công viên đó là Văn hóa. Vì vậy câu hỏi "công viên có phải công trình văn
hóa" không cần trả lời. Thư viện, bảo tàng, trung tâm thương mại vẫn là
Mặt tiền. Chữ và icon lấy theo nhóm Culture / Văn hóa / 文化 sẵn có của
app (`categories.ts`). Văn hóa là ảnh bìa hợp lệ khi thấy cả công trình.
`VERSION` lên 7, `label-photos` bản 8.

**Đo trước khi ghi** (Haiku, không ghi), trên 24 ảnh mình đã đọc trong 139
ảnh Phong cảnh: 8/9 ảnh công trình ra Văn hóa (ảnh trượt là lăng Bác nhỏ
giữa bãi cỏ, `unsure`), 15/15 ảnh cảnh vẫn là Phong cảnh.

**Gán lại 1.564 ảnh**: mọi ảnh Mặt tiền, Phong cảnh, Khác, và mọi nhãn
`unsure`. Nhãn chắc chắn Đồ ăn, Nội thất, Sân vườn, Chữ được giữ. Không lỗi.

- Văn hóa: **119 ảnh chắc chắn**, 19 `unsure`. Phần lớn đến từ Mặt tiền (91)
  và Phong cảnh (23). Xem ngẫu nhiên 16 ảnh: cả 16 đều là công trình văn
  hóa. Một ảnh là Nhà hát Thành phố nhìn từ OKKIO Tự Do: nhãn đúng với thứ
  ảnh chụp, nhưng ảnh không cho thấy chính quán.
- Mặt tiền chắc chắn giảm từ 943 xuống 715: 79 sang Văn hóa, 37 sang Sân
  vườn (quán có bàn ghế ngoài vỉa hè), 78 thành `unsure`.
- Số ảnh `unsure` trên cả catalog gần như không đổi: 481 (7%).

### Định nghĩa v8: Ảnh ghép (18/10/2026)

**Vì sao.** Ảnh ghép (lưới mặt tiền, ly cà phê và phòng) được gán theo khung
nổi bật nhất, nên nhãn nói sai thứ ảnh chụp. Trong ghi chú, model đã
tự nói "collage", "panel" hay "stacked" ở 106 ảnh. Chủ sản phẩm duyệt thêm
loại Ảnh ghép.

**Quyết định:** `collage` là hai ảnh trở lên ghép thành một, dù mỗi khung
chụp gì. Một ảnh có chữ hay logo in đè không phải ảnh ghép; poster hay
banner mà chữ là ý chính vẫn là Chữ. Chủ sản phẩm cho ảnh ghép là ảnh bìa
hợp lệ, dù có thấy cả không gian hay không: có quán chọn lưới ảnh để giới
thiệu mình, và `wide` chỉ trả lời cho một khung của nó.
`VERSION` lên 8, `label-photos` bản 9.

**Đo trước khi ghi** (Haiku, không ghi): 16 ảnh có ghi chú nhắc "collage"
hay "panel", cộng 8 ảnh thường. Mình xem cả 16: 8 ảnh là ảnh ghép thật và
Haiku gọi đúng cả 8; 8 ảnh còn lại là một ảnh đơn (vách gỗ *panel*, một
poster) và Haiku không gọi là ảnh ghép. 8 ảnh thường cũng không thành ảnh
ghép. 24/24.

**Gán lại 1.527 ảnh**: mọi nhãn `unsure`, mọi nhãn không có ghi chú, và mọi
ghi chú có các chữ trên. Không lỗi.

- Ảnh ghép: **41 ảnh chắc chắn**, 3 `unsure`. 27 đến từ nhãn `unsure`, 14
  từ ghi chú có chữ "collage".
- 971 nhãn không có ghi chú: không ảnh nào thành ảnh ghép. Model gần như
  luôn ghi chú khi gặp ảnh ghép, nên không cần hỏi lại 5.000 ảnh còn lại.
- Số ảnh `unsure` trên cả catalog giảm từ 481 xuống 368 (6%).
- 12 nơi đang dùng ảnh ghép làm ảnh bìa, ví dụ Cam Coffee, Pin & Rest,
  Tulpa Cocktails Bar, Rosie Posie 2. Data Desk không đưa chúng lên trang
  "Ảnh bìa nên xem lại".

### Định nghĩa v9: cổng nhìn vào sân vườn (18/10/2026)

**Vì sao.** Ảnh cổng đỏ của Bold Brew Cafe, tán cây che gần hết, bàn ghế
trong sân phía sau, bị gán Phong cảnh `unsure`. Chủ sản phẩm sửa thành Sân
vườn "vì thấy cổng nhà", và thêm: sân vườn thường có cả cây xanh. Nhãn đó
được ghi tay với `"by": "owner"`; `label-photos` (bản 10) và skill không
bao giờ hỏi lại một nhãn như vậy.

**Quy tắc:** cổng hay lối vào của chính quán, nhìn từ ngoài vào sân hoặc
vườn có cây xanh và bàn ghế của quán, là Sân vườn, kể cả khi cây che phần
lớn khung. Không đủ những điều đó thì vẫn là Mặt tiền. `VERSION` lên 9.

**Đo trước khi ghi** (Haiku, không ghi), trên 39 ảnh có ghi chú nhắc cổng
hay lối vào cùng sân hoặc bàn ghế, và ảnh Bold Brew: Bold Brew ra Sân vườn
chắc chắn; 5 ảnh Sân vườn chắc, 6 ảnh Sân vườn `unsure`; còn lại là Mặt
tiền, chủ yếu mặt tiền có bàn ngoài vỉa hè hay cổng không thấy chỗ ngồi.
Chờ chủ sản phẩm duyệt tấm ảnh ghép trước khi gán lại các ảnh Mặt tiền,
Phong cảnh và `unsure`.


### Định nghĩa v10: hiên có mái và chụp qua kính (18/10/2026)

**Vì sao.** Sau v9 còn 367 nhãn `unsure`, nên app không hiện loại cho những
ảnh đó. Đọc ghi chú của chúng, hai nhóm lớn vướng cùng một chỗ: 72 ghi chú
nhắc mái che (hiên, hè, giàn, mái hiên), 50 nhắc kính hay cửa sổ. Chủ sản
phẩm quyết định:
- **Hiên có mái che là Sân vườn**, nếu mở ra ngoài ít nhất một phía và có
  chỗ ngồi của quán. Kín tường hay kính mọi phía thì vẫn là Nội thất.
- **Chụp từ ngoài qua kính vào phòng là Mặt tiền**, kể cả khi căn phòng
  chiếm cả khung. Nội thất chỉ khi chụp từ bên trong.

Câu v2 "hành lang có mái nhìn ra sân trong là Nội thất" được bỏ, vì nó nói
ngược lại quy tắc thứ nhất. `VERSION` lên 10; `label-photos` bản 11.

**Đo trước khi ghi** (Haiku, không ghi), trên 398 ảnh: cả 367 nhãn `unsure`
và 38 ảnh cổng của v9 (một ảnh cổng là nhãn của chủ sản phẩm, không hỏi lại):
- **89 trong 367 nhãn `unsure` nay đã chắc**: 49 Sân vườn, 14 Mặt tiền,
  8 Phong cảnh, 7 Văn hóa, 5 Nội thất, 3 Đồ ăn, 3 Ảnh ghép.
- Ở hai nhóm mà v10 nhắm tới, 41 trong 122 ảnh nay đã chắc. Phần còn lại
  vẫn `unsure`, chủ yếu là sân thượng mà toàn cảnh chiếm nửa khung, và
  mặt tiền có vài bàn ngoài vỉa hè.
- 31 ảnh cổng trước đây là Mặt tiền chắc chắn: 15 vẫn vậy, 6 thành Mặt tiền
  `unsure`, 7 thành Sân vườn chắc, 3 thành Sân vườn `unsure`.
- Haiku không trả lời giống hệt nhau giữa hai lần chạy, nên một phần thay
  đổi ở những ảnh mà v10 không chạm tới là dao động của mô hình, không phải
  của định nghĩa.

126 ảnh (38 ảnh cổng và 88 ảnh khác nay đã chắc) được đưa lên một trang để
chủ sản phẩm duyệt. Chưa gán lại catalog cho đến khi có câu trả lời.

**Kết quả duyệt v10 (18/10/2026).** Chủ sản phẩm duyệt cả 126 ảnh trên
trang và sửa 24 ảnh. Những ảnh không bị sửa được coi là Claude đúng. Cả 126
ảnh được ghi với `"by": "owner"`; ảnh bị sửa có ghi chú nói loại mà mô hình
đã chọn. Ảnh 10 (Chà Mơ) và 12 (Déglacer) trên tờ ảnh cổng của v9 đã được chủ
sản phẩm chốt là Mặt tiền và khoá từ trước. Sau đợt này còn 281 nhãn
`unsure`, trước đó là 367.

| Claude v10 nói | Ảnh | Giữ nguyên | Chủ sản phẩm sửa thành |
|---|---|---|---|
| Sân vườn | 62 | 42 | 15 Mặt tiền, 4 Phong cảnh, 1 Nội thất |
| Mặt tiền | 37 | 36 | 1 Phong cảnh |
| Phong cảnh | 9 | 8 | 1 Sân vườn |
| Văn hóa | 7 | 7 | |
| Nội thất | 5 | 3 | 1 Phong cảnh, 1 Sân vườn |
| Đồ ăn | 3 | 3 | |
| Ảnh ghép | 3 | 2 | 1 Đồ ăn |

Trùng tổng cộng 101/126 (80%). Trừ Sân vườn thì các loại khác trùng 59/64
(92%); riêng Sân vườn chỉ trùng 42/62 (68%).

**Đọc kết quả.** Gần như mọi lần sửa Sân vườn thành Mặt tiền rơi vào cùng
một kiểu ảnh: bàn ghế đặt ở vỉa hè hoặc ngay trước mặt nhà, nhìn ra đường.
Ví dụ là Saveur, Mlem, Antico Fornaio, MONO Hồ Xuân Hương và TAN. corner. Ở
đó mặt tiền là chủ thể, kể cả khi có mái hiên. Luật v10 "hiên có mái là Sân
vườn" đã kéo những ảnh này sang Sân vườn. Đề xuất cho v11 (chờ chủ sản phẩm
xác nhận): Sân vườn là chỗ ngồi bên trong khuôn viên quán (sân trong, vườn,
hiên quay vào sân, sân thượng); chỗ ngồi ở vỉa hè hay dọc mặt nhà nhìn ra
đường là Mặt tiền, kể cả có mái. Chưa gán lại các nhãn chắc chắn khác theo v10
cho đến khi có v11, vì v10 sẽ kéo thêm các mặt tiền có bàn vỉa hè sang Sân
vườn.

### Định nghĩa v11: chỗ ngồi nhìn ra đường là Mặt tiền (18/10/2026)

**Quy tắc** (chủ sản phẩm xác nhận): Sân vườn là chỗ ngồi bên trong khuôn
viên quán. Bàn ghế ở vỉa hè hay dọc mặt nhà nhìn ra đường là Mặt tiền, có
mái hay không. `VERSION` lên 11, `label-photos` bản 12. Chủ sản phẩm cũng
xác nhận: ảnh nào trên trang duyệt không bị bấm sửa thì nghĩa là Claude
đúng.

**Đo trước khi ghi**, không ghi, trên 126 ảnh chủ sản phẩm đã duyệt ở v10:

| Bên chấm | 24 ảnh chủ sản phẩm sửa | 100 ảnh chủ sản phẩm giữ | Tổng | Trùng và chắc chắn |
|---|---|---|---|---|
| Haiku, v11 | 4 | 90 | 96/126 | 62 |
| Opus, v11 | 12 | 85 | 98/126 | 36 |

Hai ảnh còn lại là ảnh 10 và 12, chủ sản phẩm đã khoá từ trước.

**Đọc kết quả.**
- **v11 chưa đủ.** Haiku bắt được các ảnh bàn ghế vỉa hè rõ ràng, nhưng mất
  10 ảnh mà chủ sản phẩm đã giữ. Opus sửa được nhiều hơn, nhưng gần như
  không dám chắc ảnh nào. Không gán lại catalog theo v11.
- **Những ảnh sửa mà cả hai mô hình còn sai có chung một kiểu.** Cổng, mặt
  nhà hay lối vào chiếm phần lớn khung, sân và bàn ghế chỉ thấy phía sau. Ví
  dụ là TRINH, Ngụm 2, Người Thương Ơi, và hai ảnh 10, 12. Chủ sản phẩm gọi
  những ảnh này là Mặt tiền. Ảnh Bold Brew thì khác: cây che gần hết cổng,
  nên chủ sản phẩm gọi là Sân vườn.
- **Bàn ghế nhìn ra cảnh cũng có chung một kiểu.** Bãi biển, sông, toàn cảnh
  thành phố hay khu vườn kiểu Nhật chiếm phần lớn khung, và chủ sản phẩm gọi
  những ảnh này là Phong cảnh, không phải Sân vườn.
- Hai ranh giới này đang chờ chủ sản phẩm xác nhận trước khi viết v12.

### Định nghĩa v12: cổng chiếm khung là Mặt tiền, bàn ghế trước cảnh là Phong cảnh (18/10/2026)

**Quy tắc** (chủ sản phẩm xác nhận):
- Cổng, lối vào hay mặt nhà chiếm phần lớn khung là Mặt tiền, kể cả thấy sân
  hay bàn ghế phía sau (TRINH, Ngụm 2, Người Thương Ơi, ảnh 10 và 12). Cổng
  chỉ là Sân vườn khi cây che gần hết cổng, như ảnh Bold Brew.
- Bàn ghế của quán trước bãi biển, sông, toàn cảnh thành phố hay khu vườn
  cảnh chiếm phần lớn khung là Phong cảnh.

`VERSION` lên 12, `label-photos` bản 13.

**Đo trước khi ghi**, không ghi, trên cùng 126 ảnh chủ sản phẩm đã duyệt:

| Bên chấm | 24 ảnh sửa | 100 ảnh giữ | Tổng | Trùng và chắc | Chắc mà sai |
|---|---|---|---|---|---|
| Haiku, v11 | 4 | 90 | 96/126 | 62 | |
| Haiku, v12 | 11 | 85 | 98/126 | 63 | 12 |
| Opus, v11 | 12 | 85 | 98/126 | 36 | |
| Opus, v12 | 15 | 80 | 97/126 | 36 | 7 |

Hai ảnh còn lại (10 và 12) cả hai mô hình đều trả lời đúng.

**Đọc kết quả.**
- v12 sửa được gần gấp ba số ảnh sửa so với v11 (Haiku 11 so với 4), nhưng
  mất thêm 5 ảnh mà chủ sản phẩm đã giữ.
- Đây là 126 ảnh khó nhất của catalog: trước đây chúng đều là nhãn `unsure`
  hoặc ảnh cổng. Trên những ảnh này, một mô hình chạy lại cùng định nghĩa
  cũng đổi ý ở không ít ảnh. Vì thế gán lại catalog vẫn qua bước chủ sản
  phẩm duyệt, như v10.
- **Chưa đo được phần còn lại của catalog.** Lần đo không ghi trên 1.430 ảnh
  có thể bị v12 đổi loại (Mặt tiền, Sân vườn, Phong cảnh, cùng mọi nhãn
  `unsure` chưa phải của chủ sản phẩm) dừng ở nửa đầu: cả 720 ảnh đều bị API
  từ chối với lỗi "credit balance is too low". Phải nạp thêm tín dụng mới
  đo tiếp được. Trong lúc đó, lượt gán tự động mỗi giờ cho ảnh mới cũng bị
  từ chối. Lượt đó tự chạy lại ở giờ sau, nên không mất gì.

**Đo trên phần còn lại của catalog, và kết quả duyệt v12 (18/10/2026).**
Sau khi nạp thêm tín dụng, Haiku gán v12 cho cả 1.430 ảnh nói ở trên, không
ghi gì vào catalog và không ảnh nào lỗi.
- Phần lớn nhãn không đổi: 670 Mặt tiền, 218 Sân vườn và 130 Phong cảnh giữ
  nguyên, đều chắc chắn.
- Chỉ **65 ảnh** có nhãn v12 chắc chắn mà khác nhãn đang có. 28 ảnh đổi
  loại, phần lớn là Sân vườn thành Mặt tiền vì bàn ghế ở vỉa hè. 37 ảnh giữ
  loại cũ nhưng trước đây là `unsure`.
- 120 ảnh trước đây chắc chắn thì v12 lại `unsure`. Những ảnh này giữ nguyên
  nhãn cũ, không ghi.

Chủ sản phẩm duyệt 65 ảnh đó và sửa 7:
- 28 ảnh đổi loại: đúng 25. Ba ảnh sửa là Quán Đương thành Sân vườn (không
  phải Đồ ăn), Miền Du Mục thành Phong cảnh, và một ảnh người cầm cốc ở
  Nerd.society thành Khác.
- 37 ảnh nay đã chắc: đúng 33. Bảo tàng Mỹ thuật, cổng Làng lụa và nhà thờ
  Scots' được sửa thành Văn hóa. Ảnh hồ bơi trên đồi ở Dalat Flower Plateau
  được sửa thành Phong cảnh.

Cả 65 ảnh được ghi với `"by": "owner"`; ảnh bị sửa có ghi chú nói loại mà
mô hình đã chọn. Đến đây có 192 nhãn của chủ sản phẩm và còn 234 nhãn
`unsure`.

**Còn mở:** ba lần sửa Mặt tiền thành Văn hóa cho thấy bảo tàng, nhà thờ và
cổng làng nghề vẫn là ranh giới Claude chưa nắm. Theo §3, thư viện, bảo tàng
và trung tâm thương mại là Mặt tiền, nhưng chủ sản phẩm vừa xếp Bảo tàng Mỹ
thuật là Văn hóa. Cần chủ sản phẩm chốt trước khi viết v13.
