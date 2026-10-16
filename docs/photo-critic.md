# AI photo critic — giải pháp, quyết định và tiến độ

Việc dài hạn: biến tính năng chấm ảnh trong Gallery (hiện là "Apple Vision
cho một con số") thành một **nhà phê bình ảnh**. Nó phải hiểu ảnh chụp gì,
ảnh có hợp với địa điểm không, chấm theo đúng tiêu chí của loại ảnh, và nói
được vì sao.

**Cách giữ file này đúng.** Đến 26/09/2026, `tech-eval-app-store.md` vẫn ghi
là chưa làm ba việc đã làm từ lâu, vì không ai quay lại gạch đi.
File này có mục [Tiến độ](#11-tiến-độ) và [Nhật ký](#12-nhật-ký) nên phải
theo hai quy tắc:

- PR nào làm một bước ở đây thì **sửa luôn checklist và thêm một dòng nhật ký
  trong cùng PR đó**. Một bước chỉ được tính là xong khi đã merge.
- Câu hỏi đã có câu trả lời thì chuyển từ mục 10 sang
  [Quyết định](#9-quyết-định-đã-chốt). Không xoá câu hỏi khi chưa ghi lại
  câu trả lời.

---

## 1. Mục tiêu

Giao diện không chỉ báo "máy nói ảnh này 9.4". Nó phải cho cảm giác
**một người chụp ảnh có nghề đã xem ảnh, hiểu mình định chụp gì, chỉ ra chỗ
được và chỗ nên sửa**. Thứ tự là: hiểu → đánh giá → giải thích → hướng dẫn.

Với City Crew còn một mục tiêu riêng: ảnh phải **đại diện được cho địa
điểm**. Một ảnh đẹp mà lạc đề không làm được ảnh bìa.

## 2. Nguyên tắc

- **Vision là "mắt", City Crew là "nhiếp ảnh gia".**
  - Module Swift (`app/modules/photo-score`) chỉ đo rồi trả số thô. Mọi
    ngưỡng, luật và câu chữ nằm ở JS (`app/src/lib/photoScore*.ts`).
  - Lý do: sửa JS chỉ cần EAS Update; sửa Swift phải build lại và qua
    TestFlight.
  - Vì database lưu số đo thô, đổi luật không bắt chấm lại ảnh.
- **Chỉ nói điều đã đo được.** Mỗi lời khen hay chê phải lần ngược ra được
  một số đo. Không có "Bố cục 9.1": không bộ chấm nào hiện có đo được bố cục.
- **Con số là số đo, không phải số tự chọn.** Mỗi ngưỡng ghi kèm nguồn đo và
  ngày đo, như các hằng số trong `photoScoreVision.ts`.
- **Mặc định phân tích trên máy.** Lời hứa trong `legal.ts` và câu "Phân tích
  ngay trên máy" được giữ (quyết định D6).
- **Không giả vờ chính xác.** Phần trăm làm tròn tới 5, không bao giờ ghi 0%
  hay 100%. Điểm hiện một chữ số thập phân.

## 3. Hiện trạng (đã merge)

| PR | Nội dung |
|---|---|
| #958 | Bảng `photo_scores`: `aesthetic` (−1…1), `is_utility`, `signals` (jsonb), RLS |
| #959 | Module Vision: điểm thẩm mỹ iOS 18, nhãn, người, chữ, đường chân trời, vùng chủ thể, độ sáng/tối/cháy, độ nét. Kèm nút "Chấm ảnh" trong Gallery |
| #965, #967 | Lời giải thích dựa trên bằng chứng. Ngưỡng nét SOFT 430 / SHARP 2000. "Nhiều chữ" tính theo số dòng (≥10). Chỉ nói chuyện nghiêng khi ảnh là khung cảnh |
| #969 | Tách theo bộ chấm: khoá `(photo_id, scorer)`, sổ đăng ký `Interpreter`. Tạm giữ ràng buộc `unique (photo_id)` |
| #970–#972 | Sheet ảnh: ảnh to trong khung vuông, vuốt chuyển ảnh, xem toàn màn hình, nền mờ |
| #973 | Phân tích chi tiết: các dòng số đo thật, vị trí so với catalog (`lib/standing.ts`), gợi ý cải thiện |
| #974 | Ảnh bìa nằm ô đầu lưới |

## 4. Số liệu nền (đo trên live, 16/10/2026)

- **277 ảnh** đã chấm bằng `apple-vision` v1.
- **Điểm Apple không biết chọn ảnh bìa.**
  - Ở 42 địa điểm có ≥3 ảnh đã chấm, ảnh bìa do người chọn là ảnh điểm cao
    nhất **6/42 lần (14%)**. Chọn ngẫu nhiên đã được khoảng 16%, vì trung
    bình mỗi nơi có 6,3 ảnh.
  - Ảnh bìa lọt top 3 ở 26/42 nơi (62%).
  - Điểm trung bình của ảnh bìa là 0,542, ảnh còn lại 0,520.

  → "Đẹp" và "hợp làm bìa" là hai trục khác nhau.
- **Nhãn Vision thô và bị nhãn cha lấn chỗ.**
  - `structure` có trong 235/277 ảnh, `wood_processed` 116, `furniture` 79.
  - App chỉ lưu 5 nhãn mạnh nhất (≥0,1), nên nhãn cụ thể hay bị rơi mất.
  - Những nhãn liên quan đã từng xuất hiện: `consumer_electronics` (2),
    `bookshelf` (2), `library` (1), `storefront` (2), `clothing` (1),
    `museum` (2), `statue` (3), `bar` (4).
  - Chưa thấy nhãn nào cho Giải trí.
- **Thử phân loại độ phù hợp bằng nhãn Vision** (bước 2, xem mục 6):
  - 270/277 ảnh khớp với category của địa điểm, 7 ảnh không khớp.
  - Trong 7 ảnh đó: 1 ảnh lạc đề thật (Sam Saigon, ảnh trời và đường phố).
    3 ảnh là lối vào hoặc mặt tiền hợp lệ nhưng bị báo nhầm (Hội Quán,
    Bold Brew, và Memento đang là **ảnh bìa**). 1 ảnh bảng menu. 2 ảnh có
    nhãn quá yếu.
- **Phân bố của catalog** (min, mỗi 10%, max): độ nét và điểm Apple, ghi
  trong `SHARPNESS_SPREAD` / `AESTHETIC_SPREAD`. Đo lại khi số ảnh đã chấm
  tăng gấp đôi.
- **Catalog có 2.303 ảnh, trong đó 2.159 ảnh từ Google.** Chỉ khoảng 144 ảnh
  do guide tự tải lên (ảnh hưởng tới mục 8).
- **Đo lại lúc chạy B4 (16/10, chiều): 6.211 ảnh của 996 địa điểm đã xuất
  bản, mới 351 ảnh có điểm `apple-vision`.** Con số 277 ở đầu mục này là số
  ảnh *đã chấm* lúc đó, không phải cả catalog. Hệ quả cho B4–B5:
  - so với Vision chỉ làm được trên khoảng 6% ảnh (`vision_scored`);
  - chạy cả catalog trên Mac mất khoảng 2,5 giờ (đo: 20 ảnh trong 29 giây,
    tính cả tải ảnh), lần chạy sau nhanh hơn nhờ `out/cache/`;
  - `--limit N` lấy N ảnh đầu theo `id`, là uuid, nên coi như mẫu ngẫu nhiên.
- **B4, lần chạy đầy đủ (16/10, trên Mac, 1 giờ 28 phút cho cả hai mô hình).**
  Câu mô tả B2, luật cũ (lạc đề = category khác hơn category của địa điểm
  ≥ 0,02):

  | | SigLIP 2 | CLIP |
  |---|---|---|
  | category đúng ở top 1 | **75,0%** | 70,0% |
  | category đúng trong top 3 | **94,7%** | 92,9% |
  | hợp / chưa rõ / lạc đề | 4.504 / 916 / 791 | 4.184 / 1.093 / 934 |
  | ảnh bìa bị coi là lạc đề | 132 | 152 |
  | "hợp" trên 351 ảnh Vision đã chấm (luật Vision: 338) | 268 | 243 |

  Top 1 theo category, chỉ địa điểm một category (SigLIP 2 / CLIP): cafes
  74% / 65% (2.534 ảnh), eats 76% / 75% (1.756), heritage 80% / 74% (187),
  nightlife 65% / 60% (363), markets 68% / 62% (78), nature 53% / 45% (77),
  views 54% / 61% (57), fun 5/6 / 2/6. **Focus: không có địa điểm nào chỉ
  có focus**, nên catalog không đo được category này; chỉ ảnh thử B6 đo được.
  Nhầm nhiều nhất: cafes → eats 269, eats → cafes 242, cafes → markets 102,
  cafes → focus 102, nightlife → eats 56, nature → heritage 20.

  Đọc kết quả:
  - **Luật lạc đề sai, không phải mô hình.** Chỉ 327 ảnh có category của
    địa điểm nằm ngoài top 3, nhưng 791 ảnh bị coi là lạc đề. Vậy ít nhất
    464 ảnh bị gọi lạc đề trong khi category đúng vẫn ở hạng 2 hoặc 3, như
    ảnh bánh của quán cà phê được chấm `eats` cao hơn `cafes` một chút.
    Luật mới (B5): ngoài top 3 mới có thể là lạc đề.
  - **Câu mô tả gần như không có mặt tiền.** Ảnh bìa là ảnh toàn cảnh (mặt
    tiền, lối vào), mà chỉ `cafes` có một câu tả lối vào. B5 thêm câu mặt
    tiền cho các category còn lại.
  - **So với Vision không phải là so độ chính xác.** Luật nhãn Vision gần như
    cho mọi ảnh là hợp, và không có đáp án đúng để so.
- **B5, lần chạy thứ hai (16/10, 6.239 ảnh, luật top 3 và câu tả mặt tiền,
  #980).** SigLIP 2:

  | | lần đầu (6.230 ảnh, luật cũ) | lần hai |
  |---|---|---|
  | top 1 / top 3 | 75,3% / 94,9% | 75,1% / **96,2%** |
  | hợp / chưa rõ / lạc đề | 4.537 / 908 / 785 | 4.548 / 1.480 / **211** |
  | ảnh bìa bị coi là lạc đề | 130 | **26 / 998** |

  Câu tả quán ăn vỉa hè và mặt tiền nhà hàng kéo ảnh quán cà phê sang
  `eats` (cafes → eats 265 → 356), đổi lại eats → cafes giảm 242 → 163.
- **Chủ sản phẩm chấm 106 ảnh** trên trang mẫu (`--sample 30`), theo định
  nghĩa D12. Chủ sản phẩm chỉ chọn Hợp hoặc Lạc đề, không ảnh nào Chưa rõ:

  | mô hình nói | số ảnh | chủ: hợp | chủ: lạc đề |
  |---|---|---|---|
  | hợp | 22 | 17 | 5 |
  | chưa rõ | 65 | 23 | **42** |
  | lạc đề | 19 | 5 | 14 |

  - Khi mô hình nói chắc, nó khớp khoảng 3/4: hợp 77%, lạc đề 74%.
  - Luật top 3 quá dễ dãi: nó chỉ bắt 14 trên 61 ảnh chủ sản phẩm gọi
    là lạc đề (23%). Gọi cả nhóm chưa rõ là lạc đề thì bắt được 56/61,
    nhưng 1/3 số ảnh bị gọi là lạc đề sẽ là ảnh chủ sản phẩm thấy hợp. Chọn
    điểm giữa là việc của `--marks` (B7).
  - **Ảnh bìa: 6 trong 9 ảnh bìa mô hình gọi là lạc đề, chủ sản phẩm cũng
    gọi là lạc đề** (sidney-myer-music-bowl, memory-station, kakinoki-2,
    1-2-circle-coffee, maze-bar, lavic-coffee-tea). Đó là ảnh bìa sai thật
    trong catalog, không phải lỗi của mô hình. 3 ca mô hình sai:
    a-little-coffee-in-bed-go-vap, hanoi-old-quarter, still-cafe (D13).
  - Mặt tiền Memento (ảnh bìa): cả mô hình và chủ sản phẩm đều chấm hợp.

## 5. Quy trình 6 bước

| # | Bước | Làm gì | Trạng thái |
|---|---|---|---|
| 1 | Quan sát | Ảnh có gì: các số đo thô | ✅ có (v1) |
| 2 | **Độ phù hợp với địa điểm** | Ảnh có hợp với category của địa điểm không | 🔄 đang thiết kế, xem mục 6–7 |
| 3 | Lọc lỗi kỹ thuật | Mờ nặng, tối hoặc cháy nặng, độ phân giải thấp → chặn trần điểm | ⚠️ đã đo, chưa chặn trần |
| 4 | Tiêu chí theo bối cảnh | Lỗi nào nặng tuỳ category và kiểu ảnh. Ví dụ quán **Về đêm** thì nới tay với ảnh tối | ⚠️ mới có luật nghiêng-chỉ-với-khung-cảnh |
| 5 | Điểm "hợp làm bìa" | Một con số riêng, không gộp vào điểm đẹp | ❌ |
| 6 | Giải thích và hướng dẫn | Giọng văn theo bối cảnh, gợi ý cụ thể | ✅ đã có bản đầu (#973), chưa theo bối cảnh |

## 6. Bước 2 — độ phù hợp với category của địa điểm

**Câu hỏi:** ảnh này có thể hiện đúng thứ mà category của địa điểm hứa không?
Quán *Cà phê*: ảnh đồ uống, không gian quán, người trong quán đều hợp; ảnh
trời hay đường phố thì lạc đề. Quán *Học tập*: phải nhận ra được người làm
việc với laptop.

**Dùng lại category có sẵn, không tạo bộ nhãn mới** (quyết định D3). Mỗi
category khai báo nó "mong đợi" thấy gì trong ảnh, đặt cạnh `terms` sẵn có
trong `CATEGORIES`. Địa điểm có nhiều category thì chỉ cần hợp với một.

**Ba mức, nghiêng về khoan dung** (thiết kế, chưa chốt):

- **Hợp với [category]**: thấy thứ category đó mong đợi.
- **Chưa rõ**: không có bằng chứng rõ, hoặc thấy dấu hiệu của chính quán như
  cửa, tường, mặt tiền.
- **Có vẻ không liên quan tới [category]**: chỉ khi thấy rõ nội dung của nơi
  khác và không có dấu hiệu nào của quán.

**Giao diện:**
- Một dòng ở đầu "Phân tích chi tiết", ví dụ "Hợp với Cà phê: thấy đồ uống,
  không gian quán".
- Khi ảnh lạc đề, thêm một gợi ý "cân nhắc không dùng làm ảnh bìa".
- Chưa đổi điểm số; việc đó thuộc bước 4–5.

**Giới hạn đã biết của nhãn Vision.**
- Nhãn Vision gắn cho cả bức ảnh, không chỉ ra vị trí của vật nào ngoài
  người, khuôn mặt, chữ và động vật. Vì vậy Vision không hiểu được cảnh kiểu
  "nhiều người mở laptop học bài".
- Học tập, Mua sắm, Văn hóa và Giải trí gần như không nhận ra được với
  5 nhãn đang lưu.

→ Phải **mở rộng bộ phân tích** (mục 7) thì bước 2 mới làm được cho mọi
category.

## 7. Các phương án mở rộng bộ phân tích

| | Cách làm | Hiểu cảnh? | Chi phí / ràng buộc |
|---|---|---|---|
| **A** | Lưu ~20 nhãn thay vì 5 | Một phần: thấy vật, không hiểu cảnh | Build mới, chấm lại ảnh |
| **B** | **Mô hình ảnh–chữ trên máy** (SigLIP 2, hoặc CLIP): so ảnh với câu mô tả của từng category | **Có, ở mức cảnh** | Build mới. Phần đọc ảnh nặng khoảng 90–170 MB (ước tính, đo ở B11); có thể tải về khi cần thay vì đóng sẵn trong app. MobileCLIP bị loại vì giấy phép (mục 8) |
| **C** | AI có thị giác chạy trên server, hỏi thẳng | Có, giải thích được bằng lời | Ảnh rời máy (gửi cho bên thứ ba), tốn tiền theo ảnh, phải sửa `legal.ts`. Không cần build vì server chấm ảnh có sẵn trong catalog |
| **D** | Tự huấn luyện Core ML bằng Create ML | Có, trong các category đã dạy | Cần ~30–50 ảnh có nhãn mỗi category (học chuyển giao); hiện **chưa có dữ liệu hợp lệ** (mục 8) |

**C và D khác nhau thế nào:**
- C có ngay khả năng hiểu ảnh mà không cần dữ liệu, đổi cách hỏi là xong.
- D chạy trên máy, gần như không tốn tiền khi chạy, kết quả ổn định, nhưng
  phụ thuộc hoàn toàn vào dữ liệu mình dạy.

Có thể đi theo lộ trình C → D: câu trả lời của C, sau khi người sửa chỗ sai,
thành nhãn để huấn luyện D.

**Hướng đang theo: B trước, đo rồi mới quyết** (quyết định D5). B dùng chính
category làm câu mô tả nên không cần tự gom dữ liệu, và ảnh không rời máy.
Mô hình chính là **SigLIP 2 base** (Apache 2.0); **CLIP B/32** (MIT) chạy cùng
để so sánh (quyết định D9).

## 8. Ràng buộc pháp lý và giấy phép (⚠️ = chưa đối chiếu nguyên văn)

- ⚠️ **Ảnh Google không được dùng để huấn luyện mô hình.**
  - Đã tìm thấy điều khoản (B1, 16/10): mục "No Unfair Exploitation" trong
    *Google Maps Platform Analytics Service Specific Terms* cấm đưa nội dung
    Maps vào huấn luyện AI/ML; điều khoản này giữ nguyên qua các bản ngày
    30/09/2025, 04/12/2025 và 30/06/2026.
  - Chưa đọc được văn bản ToS chính của Maps Platform (trang bị cắt khi tải),
    nên chưa biết nó có cùng điều khoản đó không. Coi như cấm cho tới khi đọc
    được.
  - Phương án B không huấn luyện gì, chỉ chạy một mô hình có sẵn.
  - Chỉ **đánh giá** (chạy mô hình có sẵn lên ảnh để đo) thì khác với huấn
    luyện, nhưng cũng nên đối chiếu.
  - Liên quan C1 trong `tech-eval-app-store.md`.
- **Ảnh lấy từ bài đăng Threads** là ảnh của người khác: không dùng để huấn
  luyện.
- **Ảnh guide tự tải lên** (~144) là dữ liệu dùng được.
- Bộ dữ liệu mở:
  - ⚠️ **Places365**: chỉ cho nghiên cứu phi thương mại → loại.
  - ⚠️ **Open Images**: nhãn CC BY 4.0, ảnh phần lớn CC BY 2.0 → dùng được,
    phải ghi nguồn.
  - ⚠️ **COCO**: nhãn CC BY 4.0, ảnh Flickr với nhiều loại giấy phép.
  - ⚠️ **Food-101**: phải kiểm.
- Mô hình:
  - ❌ **MobileCLIP / MobileCLIP 2** (Apple): giấy phép trọng số (`apple-amlr`
    trên Hugging Face) **chỉ cho nghiên cứu**, cấm dùng trong sản phẩm hay
    dịch vụ, và mô hình phái sinh cũng bị ràng buộc như vậy (B1, 16/10). Bị loại.
  - ✅ **SigLIP 2** (Google): Apache 2.0, theo các bản Core ML trên Hugging Face
    ghi lại giấy phép của mô hình gốc. ⚠️ Vẫn phải đọc model card của chính
    Google trước B8.
  - ✅ **CLIP** (OpenAI): MIT.
  - ⚠️ **TinyCLIP** (Microsoft, nhỏ hơn nhiều): giấy phép chưa rõ nguồn gốc;
    chưa dùng.
  - ⚠️ **YOLO của Ultralytics**: AGPL → không hợp với app đóng mã.
- Nếu chọn C: sửa `app/src/lib/legal.ts` cùng câu "Phân tích ngay trên máy"
  trong `ScoringDialog`, và cân nhắc danh sách bên thứ ba xử lý dữ liệu trong
  chính sách quyền riêng tư.

## 9. Quyết định đã chốt

| # | Ngày | Quyết định | Lý do |
|---|---|---|---|
| D1 | 15/10 | Lưu số đo thô, diễn giải ở JS | Sửa luật qua EAS Update, không phải chấm lại |
| D2 | 16/10 | Không có điểm thành phần trên thang 10 (bố cục, màu sắc) | Không đo được, viết ra là bịa (#973) |
| D3 | 16/10 | Bước 2 dùng category sẵn có, không tạo bộ nhãn ảnh mới | Chủ sản phẩm: tránh thêm một bộ nhãn song song |
| D4 | 16/10 | "Hợp làm bìa" là trục riêng, không gộp vào điểm đẹp | 6/42, xem mục 4 |
| D5 | 16/10 | Thử phương án B bằng đánh giá ngoài app trước khi tích hợp | Đo trước rồi mới tốn công build |
| D6 | 16/10 | Giữ nguyên tắc phân tích ngay trên máy "nếu có thể" → loại C cho lúc này | Chủ sản phẩm |
| D7 | 16/10 | Chạy đánh giá trên Mac của chủ sản phẩm | Chủ sản phẩm; container không kết nối được kho ảnh |
| D8 | 16/10 | Chủ sản phẩm chụp hoặc cung cấp ảnh thử cho các category khó | Chủ sản phẩm |
| D9 | 16/10 | Mô hình cho B: SigLIP 2 base, so với CLIP B/32. Loại MobileCLIP | Giấy phép: MobileCLIP chỉ cho nghiên cứu (mục 8) |
| D10 | 16/10 | Thử câu mô tả tiếng Việt và tiếng Nhật trên SigLIP 2 (B6b). Chỉ khi không đủ tốt mới thử bản đa ngôn ngữ của SigLIP đời đầu | Chủ sản phẩm. SigLIP 2 đã học trên dữ liệu nhiều ngôn ngữ; CLIP gần như chỉ biết tiếng Anh nên không tham gia phép thử này |
| D11 | 16/10 | Dùng SigLIP 2 cho các bước tiếp theo; CLIP chỉ để đối chiếu | B4: hơn CLIP ở top 1 (75,0% so với 70,0%), top 3 (94,7% so với 92,9%) và số ảnh bìa bị coi là lạc đề (132 so với 152) |
| D12 | 16/10 | "Lạc đề" nghĩa là nội dung ảnh không khớp với category của địa điểm. Ảnh xấu, cận một món hay không đại diện được cho quán thuộc bước 4 và 5 | Chủ sản phẩm. Mô hình so ảnh với category không đo được chất lượng ảnh |
| D13 | 16/10 | Tiêu chí ảnh bìa ở B7: **0 ảnh bìa mà chủ sản phẩm chấm Hợp bị báo lạc đề**, thay cho 0 ảnh bìa bị báo lạc đề | 6/9 ảnh bìa mô hình gọi là lạc đề, chủ sản phẩm cũng gọi như vậy: ảnh bìa không mặc nhiên đúng |

## 10. Câu hỏi đang mở

- **Q2.** Có chấp nhận build mới, và phần đọc ảnh nặng khoảng 90–170 MB không?
  Đóng sẵn trong app, hay tải về lần đầu khi guide bấm "Chấm ảnh"? Đề xuất:
  tải về khi cần, để người không chấm ảnh không phải gánh thêm dung lượng.
- **Q5.** Ngưỡng nào thì B được coi là đạt? Đề xuất ở B7.
- **Q6.** Category Văn hóa, Mua sắm, Giải trí, Học tập: nếu B vẫn yếu thì chỉ
  dùng hai mức "Hợp" và "Chưa rõ", không bao giờ báo lạc đề?
- **Q7.** Có định cho người dùng **gõ chữ để tìm ảnh** (tiếng Việt, tiếng
  Nhật) không? Nếu có thì phần đọc chữ cũng phải nằm trên máy, và nặng hơn
  phần đọc ảnh nhiều (bộ từ vựng 256 nghìn token của SigLIP 2) → câu trả lời
  đổi con số ở Q2. Nếu không thì câu mô tả cố định được tính sẵn, ngôn ngữ chỉ
  là chuyện câu nào cho kết quả tốt nhất (B6b).

## 11. Tiến độ

### Phương án B — Giai đoạn 1: đánh giá ngoài app (không build)

- [x] **B1. Giấy phép.** MobileCLIP chỉ cho nghiên cứu → loại. Chọn SigLIP 2
  (Apache 2.0), so với CLIP (MIT). Đã tìm thấy điều khoản cấm huấn luyện của
  Google trong Analytics terms; ToS chính chưa đọc được. Chi tiết ở mục 8;
  ⚠️ còn lại: đọc model card SigLIP 2 của Google trước B8.
- [x] **B2. Câu mô tả theo category.** 3–5 câu tiếng Anh cho mỗi category,
  theo bối cảnh Việt Nam, cộng một nhóm câu "không thuộc category nào"
  (menu, đường phố, bầu trời). Lưu thành file dữ liệu trong `data/photo-eval/`.
- [x] **B3. Script đánh giá** `data/photo-eval/` (`eval.py`, `prompts.json`,
  hướng dẫn trong `README.md`; khoá category được test giữ khớp với app):
  - lấy danh sách ảnh đã chấm kèm category và việc có phải ảnh bìa (bằng key
    công khai);
  - tải ảnh, chạy mô hình;
  - xuất CSV và một trang HTML dạng lưới ảnh: category đoán, category thật,
    đánh dấu chỗ lệch.
- [x] **B4. Chạy** trên Mac của chủ sản phẩm (D7): `python eval.py`, rồi
  `--model clip`, theo `data/photo-eval/README.md`. Kết quả ở mục 4:
  SigLIP 2 hơn CLIP ở mọi chỉ số (D11).
- [ ] **B5. Đo.** Đã làm (#980 và PR này): luật lạc đề mới (ngoài top 3
  mới có thể lạc đề), câu tả mặt tiền, cache vector, trang mẫu có nút chấm,
  lần chạy thứ hai và 106 ảnh chủ sản phẩm chấm (mục 4), `--marks` để so
  từng cặp ngưỡng với phần chấm. Còn lại: tra Sam Saigon, Hội Quán và Bold
  Brew trong CSV.
  - tỉ lệ đoán đúng category của địa điểm ở top 1 và top 3, so với nhãn
    Vision hiện tại;
  - bảng nhầm lẫn giữa các category;
  - xem lại 7 ca ở mục 4: Sam Saigon phải bị bắt, mặt tiền Memento phải
    được tha.
- [ ] **B6. Ảnh thử cho category khó** (D8): khoảng 10 ảnh mỗi loại, là ảnh
  của mình, xếp vào thư mục theo khoá category và chạy với `--extra`.
- [ ] **B6b. Câu mô tả tiếng Việt và tiếng Nhật** (D10). Chạy sau B5, trên
  cùng tập ảnh (catalog và ảnh thử B6), chỉ với SigLIP 2.
  - **Vì sao.** Ảnh không có ngôn ngữ; ngôn ngữ chỉ nằm ở câu mô tả. Câu
    tiếng Việt có thể bắt sát hơn những thứ tiếng Anh tả không trúng ("cà phê
    sữa đá", "quán nhậu", "chợ"). Phép thử cũng cho biết mô hình hiểu tiếng
    Việt và tiếng Nhật tới đâu, nếu sau này có tìm ảnh bằng chữ (Q7).
  - **Cần làm trước:** `prompts.vi.json` và `prompts.ja.json`, cùng khoá và
    cùng ý với `prompts.json`, viết lại cho tự nhiên chứ không dịch từng chữ;
    cờ `--prompts` trong `eval.py`; test đồng bộ khoá mở rộng cho cả hai
    file. (Tiếng Nhật cần người đọc được tiếng Nhật duyệt câu.)
  - **Bốn lần chạy:** chỉ tiếng Anh (= B4), chỉ tiếng Việt, chỉ tiếng Nhật,
    và tiếng Anh + tiếng Việt gộp (category lấy câu khớp nhất trong cả hai).
  - **So sánh:** top 1, top 3, `covers_off`, bảng nhầm lẫn và
    `extra_by_category`, từng category một.
  - **Đề xuất ngưỡng, chờ chủ sản phẩm duyệt:**
    - tiếng Việt / tiếng Nhật được coi là "đủ tốt" khi top 3 đạt ≥ 95% mức của
      tiếng Anh và không làm ảnh bìa nào thành lạc đề;
    - bản gộp chỉ được dùng nếu nó tăng top 3 hoặc giảm số ảnh lạc đề sai,
      mà không làm hỏng ảnh bìa nào.
  - **Nếu không đủ tốt:** chạy lại với `google/siglip-base-patch16-256-multilingual`
    (SigLIP đời đầu, bản huấn luyện riêng cho nhiều ngôn ngữ; ⚠️ đối chiếu
    giấy phép trên model card trước khi dùng). Đổi mô hình là đổi cả phần đọc
    ảnh, nên phải chạy lại toàn bộ B4–B6 với mô hình đó, không chỉ phần chữ.
- [ ] **B7. Chốt có làm tiếp hay không.** Ngưỡng đề xuất, chờ chủ sản phẩm
  duyệt:
  - top 3 khớp ≥ 85% trên toàn catalog;
  - **0 ảnh bìa mà chủ sản phẩm chấm Hợp** bị báo "lạc đề" (D13; cột
    `covers_fit_called_off` của `--marks`);
  - trong các cặp ngưỡng đạt điều trên, chọn cặp có `off_precision` và
    `off_recall` cân bằng nhất trên phần chấm của chủ sản phẩm;
  - Sam Saigon bị báo lạc đề;
  - ≥ 7/10 ảnh thử của mỗi category khó được đoán đúng.

  Chốt luôn ngưỡng cho ba mức Hợp / Chưa rõ / Lạc đề. Ghi kết quả vào mục 4
  và quyết định vào mục 9.

### Phương án B — Giai đoạn 2: tích hợp (chỉ khi B7 đạt)

- [ ] **B8. Native.** Đưa phần xử lý ảnh của mô hình (bản Core ML) vào
  `modules/photo-score`. Module trả "dấu vân tay" của ảnh (768 số với
  SigLIP 2 base, 512 với CLIP B/32) vào `signals`.
- [ ] **B9. JS.** So dấu vân tay với các câu mô tả đã tính sẵn (lưu thành JSON
  trong JS). Sửa câu mô tả hay ngưỡng chỉ cần EAS Update. Thêm `fit` vào
  `Interpreter`.
- [ ] **B10. Phiên bản.** Nâng `appleVision.version` lên 2 để app đề nghị
  chấm lại. Thêm dòng "Hợp với [category]" và gợi ý ảnh bìa vào phân tích
  chi tiết.
- [ ] **B11. Phát hành.** Build TestFlight, tăng `version` trong `app.json`,
  đo app nặng thêm bao nhiêu và chấm mỗi ảnh mất bao lâu. Ghi các số này vào
  mục 4.

### Các bước sau (chưa lên kế hoạch chi tiết)

- [ ] Bước 3: chặn trần điểm khi có lỗi kỹ thuật nặng.
- [ ] Bước 4: tiêu chí theo bối cảnh (category và kiểu ảnh).
- [ ] Bước 5: điểm "hợp làm bìa". Kiểm chứng bằng việc ảnh bìa thật có lọt
  top 3 thường hơn mức 62% hiện nay không.
- [ ] Bước 6: giọng văn theo bối cảnh.
- [ ] Nút "sửa loại / độ phù hợp" cho guide: thành nguồn dữ liệu có nhãn của
  City Crew.
- [ ] Gỡ ràng buộc tạm `photo_scores_one_per_photo` khi có bộ chấm thứ hai.

## 12. Nhật ký

| Ngày | Việc |
|---|---|
| 15/10/2026 | #958–#968: chấm ảnh bằng Vision, lời giải thích dựa trên bằng chứng |
| 16/10/2026 | #969: tách theo bộ chấm. #970–#974: sheet ảnh, xem toàn màn hình, phân tích chi tiết, ảnh bìa lên đầu |
| 16/10/2026 | Thiết kế bước 2 và các phương án A–D. Chọn đánh giá B trước. Tài liệu này ra đời (#975) |
| 16/10/2026 | B1: MobileCLIP chỉ cho nghiên cứu → chọn SigLIP 2 / CLIP. B2–B3: `data/photo-eval/` (câu mô tả, script, hướng dẫn). Quyết định D6–D9 |
| 16/10/2026 | B4, lần chạy đầu trên Mac: tải được mô hình và catalog, rồi lỗi vì transformers 5 trả embedding trong `pooler_output`. Script giờ nhận cả hai phiên bản, và dừng nếu véc-tơ ảnh và véc-tơ chữ khác độ dài |
| 16/10/2026 | B4 chạy được với `--limit 20` (29 giây). Catalog thật là 6.211 ảnh, 351 ảnh có điểm Vision (mục 4). Thêm B6b và D10: thử câu mô tả tiếng Việt và tiếng Nhật trên SigLIP 2; Q7 về tìm ảnh bằng chữ |
| 16/10/2026 | B4 xong: SigLIP 2 75,0% top 1 / 94,7% top 3, CLIP 70,0% / 92,9% (mục 4, D11). B5 phần đầu: luật lạc đề mới, câu tả mặt tiền, cache vector, trang mẫu có nút chấm, test cho `eval.py` chạy trong CI |
| 16/10/2026 | B5: lần chạy hai (lạc đề 785 → 211, ảnh bìa lạc đề 130 → 26). Chủ sản phẩm chấm 106 ảnh: top 3 quá dễ dãi (chỉ bắt 23% ảnh lạc đề), 6/9 ảnh bìa bị báo là sai thật. D12, D13. `--marks` và `--off-rank` trong `eval.py` |

## 13. Phương án đã loại

- **Bảy thanh điểm trên thang 10** (bố cục, màu sắc…) như bản thiết kế ngày
  16/10: Vision không đo được các thứ đó → hiện số đo bằng lời (#973).
- **Một bộ nhãn "loại ảnh" mới, có màu** (Đồ ăn, Bên trong, Bên ngoài…):
  chủ sản phẩm không muốn thêm bộ nhãn song song. Ngoài ra nhãn có màu trong
  app mang nghĩa category của địa điểm, nên gắn lên ảnh sẽ gây hiểu nhầm.
- **Nightlife là một loại ảnh riêng:** Vision không phân biệt được quán bar
  tối với một phòng tối. Dùng category **Về đêm** của địa điểm làm bối cảnh
  thay vào đó.
- **Places365 để huấn luyện:** giấy phép phi thương mại.
- **MobileCLIP** cho phương án B: trọng số chỉ cho nghiên cứu (B1). Đây là ứng
  viên đầu tiên vì nhỏ và Apple có sẵn bản Core ML.
- **Huấn luyện bằng ảnh Google hoặc ảnh Threads:** điều khoản và bản quyền
  (mục 8).
- **Lạc đề chỉ theo độ chênh** (category khác hơn ≥ 0,02): gọi 791 ảnh và
  132 ảnh bìa là lạc đề, trong khi chỉ 327 ảnh có category nằm ngoài top 3
  (B4, #980).
- **Coi ảnh bìa luôn đúng** (ngưỡng cũ "0 ảnh bìa bị báo lạc đề"): chủ sản
  phẩm gọi 6 trong 9 ảnh bìa bị báo là lạc đề thật (D13).
