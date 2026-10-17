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

## 3. Bộ nhãn v1

Mỗi ảnh có **một loại** và **sáu thuộc tính**. Bộ nhãn bám theo tiêu chí chọn
ảnh bìa trong skill Threads, để nhãn dùng được ngay cho điểm "hợp làm bìa"
(bước 5 của `photo-critic.md`).

**Loại ảnh** (`kind`): xét theo **chủ thể**, tức là thứ chiếm phần lớn khung
và được lấy nét, không xét theo việc ảnh *có* trời hay cây.

| Giá trị | Nghĩa | Ở các vòng chấm tay |
|---|---|---|
| `food` | Đồ ăn hoặc đồ uống là chủ thể, kể cả khi phía sau có view | F |
| `interior` | Không gian bên trong: bàn ghế, quầy, kiến trúc trong nhà | P |
| `exterior` | Mặt tiền, lối vào, biển hiệu nhìn từ ngoài | P |
| `view` | Cảnh vật là chủ thể (trời, nước, cây, toàn cảnh thành phố); công trình nếu có chỉ là khung viền | S |
| `text` | Menu, bảng chữ, ảnh quảng cáo nhiều chữ | U |
| `other` | Không thuộc loại nào ở trên | U |

Người có mặt trong quán **không đổi loại ảnh**. Vòng 2 cho thấy chủ sản phẩm
xếp ảnh barista hay khách đứng ở quầy vào Địa điểm. Việc có người được ghi
bằng thuộc tính `people`.

**Thuộc tính**: mỗi thuộc tính là `true`, `false`, hoặc `null` khi không đánh
giá được.

| Khoá | Câu hỏi | Liên quan ảnh bìa |
|---|---|---|
| `brand` | Thấy biển hiệu, logo hay tên quán đọc được? | Tiêu chí 2 |
| `wide` | Góc rộng, thấy được toàn cảnh nơi chốn (không phải cận một món, một góc)? | Tiêu chí 1 |
| `green` | Cây xanh chiếm một phần đáng kể của khung? | Tiêu chí 3 |
| `daylight` | Ánh sáng tự nhiên ban ngày? | Tiêu chí 4 |
| `people` | Người là chủ thể hoặc chiếm phần lớn khung? | Tiêu chí 5 |
| `staged` | Trông như ảnh quảng cáo dàn dựng: có người mẫu tạo dáng, hoặc chữ in đè lên ảnh? | Tiêu chí 5 |

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
4. **Định nghĩa chỉ nằm ở một chỗ:** file
   `.claude/skills/photo-labels/SKILL.md`. Bảng ở mục 3 là bản sao để đọc.
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
| `scorer_version` | `1` (luật 3 ở mục 4) |
| `aesthetic`, `is_utility` | `null`: bộ chấm này không chấm điểm đẹp |
| `scored_by` | `null`: skill ghi nhãn qua Supabase MCP, không qua tài khoản người dùng |
| `signals` | `{ "v": 1, "kind": …, "brand": …, … }` |

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
| 2b | Edge Function gán nhãn ảnh mới, cùng định nghĩa với skill (mục 10) | ☐ |
| 3 | Đoạn cập nhật cho skill Threads, chủ sản phẩm dán vào tài khoản | ☐ |
| 4 | **Vòng chấm 3:** chủ sản phẩm chấm các thuộc tính trên 100 ảnh mới, Claude chấm trước và khoá câu trả lời. 137 ảnh của bước 2 đã được khoá sẵn (mục 9) | ☐ |
| 5 | Gán nhãn toàn bộ catalog, theo từng thành phố | ☐ |
| 6 | App đọc nhãn: loại ảnh và điểm "hợp làm bìa" (có đề xuất riêng) | ☐ |

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

