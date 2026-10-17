# AI photo critic: mục đích, nguyên tắc và những gì đã học

Tính năng chấm ảnh trong Gallery hiện dùng **Apple Vision** chạy ngay trên
điện thoại. File này ghi lại bốn thứ: tính năng muốn đi tới đâu, những
nguyên tắc không đổi, những gì đã đo được, và những hướng đã thử rồi bỏ.

Ngày 16/10/2026 có thử thêm một mô hình hiểu cả ảnh lẫn chữ (SigLIP 2 /
CLIP) để biết ảnh có hợp với category của địa điểm không. Phép thử dừng lại
theo quyết định của chủ sản phẩm (D9), và code của nó đã được gỡ. Mục 5.2
giữ lại phần đáng giá nhất của phép thử: kết quả và bài học.

**Cách giữ file này đúng.** PR nào làm một bước ở mục 4 thì sửa trạng thái
của bước đó trong cùng PR. Câu hỏi ở mục 9 khi đã có câu trả lời thì chuyển
sang mục 8, không xoá đi.

---

## 1. Mục đích

Ứng dụng không chỉ báo "máy nói ảnh này 9.4". Nó phải cho guide cảm giác
**một người chụp ảnh có nghề đã xem ảnh**: hiểu mình định chụp gì, chỉ ra
chỗ được và chỗ nên sửa. Thứ tự luôn là: **hiểu → đánh giá → giải thích →
hướng dẫn**.

Riêng với City Crew, ảnh còn phải **đại diện được cho địa điểm**. Một ảnh
đẹp mà không cho thấy quán trông thế nào thì không làm được ảnh bìa.

## 2. Nguyên tắc

1. **Vision là "mắt", City Crew là "nhiếp ảnh gia".** Module Swift
   (`app/modules/photo-score`) chỉ đo rồi trả số thô. Mọi ngưỡng, luật và câu
   chữ nằm ở JS (`app/src/lib/photoScore*.ts`). Lý do: sửa JS chỉ cần EAS
   Update, còn sửa Swift phải build lại và qua TestFlight. Database lưu số đo
   thô, nên đổi luật không bắt chấm lại ảnh.
2. **Chỉ nói điều đã đo được.** Mỗi lời khen hay chê phải lần ngược ra được
   một số đo. Không có "Bố cục 9.1", vì không bộ chấm nào hiện có đo được bố
   cục.
3. **Con số là số đo, không phải số tự chọn.** Mỗi ngưỡng ghi kèm nguồn đo và
   ngày đo, như các hằng số trong `photoScoreVision.ts`.
4. **Phân tích ngay trên máy.** Ảnh không rời điện thoại. Đây là lời hứa
   trong `legal.ts` và câu "Phân tích ngay trên máy". Muốn đổi thì phải sửa
   lời hứa trước.
5. **Không giả vờ chính xác.** Phần trăm làm tròn tới 5, không bao giờ ghi 0%
   hay 100%. Điểm hiện một chữ số thập phân.
6. **Chỉ nói điều mình chắc.** Một nhận xét sai làm guide mất lòng tin vào
   mọi nhận xét khác. Khi không chắc thì im lặng, không đoán.
7. **Đo trên ảnh mới trước khi tin một ngưỡng.** Ngưỡng chọn trên chính tập
   ảnh dùng để đo luôn trông tốt hơn thực tế (mục 5.2). Luôn để riêng một
   phần ảnh chưa dùng để kiểm lại.
8. **Viết đề xuất trước, code sau.** Mỗi bước mới bắt đầu bằng một đề xuất
   ngắn: mục đích, cách đo, tiêu chí thành công. Chủ sản phẩm duyệt rồi mới
   viết code. Phép thử 16/10 làm gần 10 PR trong một ngày trước khi kịp hỏi
   "kết luận này có dùng được trong app không".

## 3. Hiện trạng trong app

| PR | Nội dung |
|---|---|
| #958, #969 | Bảng `photo_scores`: `aesthetic` (−1…1), `is_utility`, `signals` (jsonb), khoá `(photo_id, scorer)`, RLS |
| #959 | Module Vision: điểm thẩm mỹ của iOS 18, nhãn, người, chữ, đường chân trời, vùng chủ thể, độ sáng/tối/cháy, độ nét. Nút "Chấm ảnh" trong Gallery |
| #960 | Binary **1.0.9** mang module Vision (build qua "Release app to TestFlight" ngày 15/10) |
| #965, #967 | Lời giải thích dựa trên bằng chứng: ngưỡng nét SOFT 430 / SHARP 2000; "nhiều chữ" tính theo số dòng (≥10); chỉ nói chuyện nghiêng khi ảnh là khung cảnh |
| #970–#972 | Sheet ảnh: ảnh to trong khung vuông, vuốt chuyển ảnh, xem toàn màn hình, nền mờ |
| #973 | Phân tích chi tiết: các dòng số đo thật, vị trí so với catalog (`lib/standing.ts`), gợi ý cải thiện |
| #974 | Ảnh bìa nằm ô đầu lưới |
| #987 | Sheet ảnh mở đầu bằng câu nhận xét; "Đo trên máy bằng Apple Vision" chuyển vào phân tích chi tiết |
| 17/10 | Bảng "Photo Rating – Refined UI", phần làm được ngay (D10): mỗi dòng phân tích có icon riêng của tiêu chí; chữ đánh giá tô xanh `okInk` / cam `warnInk` theo kết quả; nhãn cạnh điểm cùng hai màu đó; ô gợi ý nền kính, bóng đèn cam; dòng nguồn có ⓘ, "Phân tích trên máy bằng Apple Vision." |

Đến 16/10/2026 có **428 ảnh** đã chấm, tất cả do một người.

## 4. Các bước của nhà phê bình ảnh

| # | Bước | Làm gì | Trạng thái |
|---|---|---|---|
| 1 | Quan sát | Ảnh có gì: các số đo thô | ✅ có (Vision v1) |
| 2 | Độ phù hợp với địa điểm | Ảnh có hợp với category của địa điểm không | ⏸ đã thử, tạm dừng (mục 5.2) |
| 3 | Lọc lỗi kỹ thuật | Mờ nặng, tối hoặc cháy nặng, độ phân giải thấp → chặn trần điểm | ⚠️ đã đo, chưa chặn trần |
| 4 | Tiêu chí theo bối cảnh | Lỗi nào nặng tuỳ category và kiểu ảnh. Ví dụ quán **Về đêm** thì nới tay với ảnh tối | ⚠️ mới có luật "chỉ nói nghiêng khi là khung cảnh" |
| 5 | Điểm "hợp làm bìa" | Một con số riêng, không gộp vào điểm đẹp (D4) | ❌ chưa làm |
| 6 | Giải thích và hướng dẫn | Giọng văn theo bối cảnh, gợi ý cụ thể | ✅ bản đầu (#973), chưa theo bối cảnh |

Bước 3 và bước 5 không cần mô hình mới, nên là những bước nên làm tiếp
(mục 10).

## 5. Những gì đã học

### 5.1 Về Apple Vision (đo trên live, 15–16/10/2026)

- **Điểm đẹp của Apple không biết chọn ảnh bìa.** Ở 42 địa điểm có ít nhất 3
  ảnh đã chấm, ảnh bìa do người chọn là ảnh điểm cao nhất **6/42 lần (14%)**.
  Chọn ngẫu nhiên đã được khoảng 16%, vì trung bình mỗi nơi có 6,3 ảnh. Ảnh
  bìa lọt top 3 ở 26/42 nơi (62%). Điểm trung bình của ảnh bìa là 0,542, ảnh
  còn lại 0,520. → **"Đẹp" và "hợp làm bìa" là hai trục khác nhau** (D4).
- **Nhãn Vision thô, và bị nhãn chung chung lấn chỗ.** Trong 277 ảnh,
  `structure` có ở 235 ảnh, `wood_processed` 116, `furniture` 79. App chỉ lưu
  5 nhãn mạnh nhất (≥ 0,1), nên nhãn cụ thể hay bị rơi mất. Nhãn liên quan
  hiếm khi xuất hiện: `bookshelf` 2, `storefront` 2, `museum` 2, `statue` 3,
  `bar` 4. Chưa thấy nhãn nào cho Giải trí.
- **Nhãn Vision không hiểu cảnh.** Nhãn gắn cho cả bức ảnh và không chỉ ra
  vị trí vật, trừ người, khuôn mặt, chữ và động vật. Vì vậy Vision không nhận
  ra cảnh kiểu "nhiều người mở laptop học bài". Các category Học tập, Mua sắm,
  Văn hóa và Giải trí gần như không nhận ra được.
- **Luật "hợp category" dựa trên nhãn Vision quá dễ dãi.** Nó cho 270/277 ảnh
  là hợp. Trong 7 ảnh còn lại chỉ 1 ảnh lạc đề thật (Sam Saigon: trời và đường
  phố). 3 ảnh là mặt tiền hay lối vào hợp lệ nhưng bị báo nhầm (Hội Quán, Bold
  Brew, và Memento, ảnh bìa).
- **Vùng chủ thể của Vision không phân biệt được ảnh** (434 ảnh, 17/10): diện
  tích 10% ảnh dưới 0,40, trung vị 0,58, 10% ảnh trên 0,73; không ảnh nào có
  chủ thể sát mép hay quá nhỏ. Lời khen "chủ thể rõ ràng" vì thế đúng với mọi
  ảnh và đã bỏ (D12). Bố cục chỉ còn dựa vào độ nghiêng, người và chữ: 52/434
  ảnh trượt một phép kiểm (35 cảnh nghiêng, 13 ảnh người chiếm khung, 4 ảnh
  nhiều chữ).
- **Độ phơi sáng phân hoá tốt** (434 ảnh, 17/10): 10% ảnh dưới 0,39, trung vị
  0,76, 10% ảnh trên 0,94.
- **Phân bố của catalog** (min, mỗi 10%, max) về độ nét và điểm Apple nằm
  trong `SHARPNESS_SPREAD` / `AESTHETIC_SPREAD`. Đo lại khi số ảnh đã chấm
  tăng gấp đôi.
- **Catalog (16/10):** 6.278 ảnh đang hiện của các địa điểm đã xuất bản.
  **5.409 ảnh (86%) lấy từ Google**, 869 ảnh do guide tự tải lên. Có 1.005 ảnh
  bìa, trong đó 859 ảnh từ Google. Điều này giới hạn việc huấn luyện (mục 6).

### 5.2 Phép thử mô hình ảnh–chữ (SigLIP 2 / CLIP), 16/10/2026, đã dừng

**Cách làm.** Không huấn luyện gì. Mỗi category có 4–7 câu mô tả tiếng Anh
(ví dụ "người làm việc với laptop trong quán cà phê"). Mô hình so từng ảnh với
các câu đó rồi xếp hạng category. Phép thử chạy ngoài app, trên Mac của chủ
sản phẩm, với toàn bộ catalog (6.239 ảnh). Chủ sản phẩm chấm tay 229 ảnh
thành Hợp hoặc Lạc đề. **Lạc đề** nghĩa là *nội dung ảnh không khớp với
category*. Ảnh xấu hay ảnh không đại diện được cho quán không tính là lạc đề
(D7).

**Kết quả đáng giữ:**

| | Kết quả |
|---|---|
| SigLIP 2 so với CLIP | SigLIP 2 hơn ở mọi chỉ số: category đúng ở top 1 **75%** so với 70%, trong top 3 **95%** so với 93% |
| Mô hình nói **"Hợp"** | Chủ sản phẩm đồng ý **34/37 (92%)**; trên ảnh mới chưa dùng để chọn ngưỡng, đúng 15/15 |
| Mô hình nói **"Lạc đề"** | Trên ảnh mới chỉ đúng **33%** (13/39). Chọn bừa đã đúng 20%, vì 25/123 ảnh mới là lạc đề. Trong 18 cặp ngưỡng đã thử, cao nhất 40%, và khi đó chỉ bắt được 2 ảnh |
| Ngưỡng chọn trên chính tập chấm | Đúng 79% trên 106 ảnh đã chấm, rồi rơi còn 33% trên ảnh mới → nguyên tắc 7 |

**Những điều học được:**

1. **Mô hình nhận ra category khá tốt, nhưng không phán được "lạc đề".**
   Ranh giới giữa hợp và lạc đề vốn mơ hồ: món tráng miệng ở quán cà phê, một
   góc phố trước cửa quán. Chủ sản phẩm chấm lại 106 ảnh cũ thì đổi ý 7 ảnh,
   6 trong số đó từ lạc đề sang hợp. Khi chính người chấm còn phân vân, mô
   hình không thể chắc hơn.
2. **Nếu làm lại bước 2, chỉ dùng tín hiệu tích cực.** App hiện "Hợp với
   [category]" khi mô hình chắc, còn lại thì im lặng. Không bao giờ hiện chữ
   "lạc đề" (nguyên tắc 6).
3. **Ảnh bìa là ảnh toàn cảnh.** Câu mô tả phải có mặt tiền và lối vào. Khi
   thêm những câu này, số ảnh bìa bị gọi là lạc đề giảm từ 130 xuống 26.
4. **Ảnh bìa không mặc nhiên đúng.** Trong lần chấm cuối, chủ sản phẩm gọi
   **16 ảnh bìa** là không khớp với category: 1-2-circle-coffee,
   about-life-coffee-brewers-hcm, arata-pasta, boss-coffee-and-kitchen,
   bourke-street-mall, ca-phe-linh, kakinoki-2, lavic-coffee-tea, maze-bar,
   memory-station, nanaimo-bistro-oyster-bar, okkio-caffe-bao-tang-my-thuat,
   still-cafe, the-long-times-square, this-that-cafe, thisthat-bakery-cafe.
   Danh sách mô hình gọi là lạc đề hữu ích làm **hàng chờ "nên xem lại"** cho
   người duyệt catalog, nhưng không dùng được để báo cho guide.
5. **Nhầm lẫn giữa category phần lớn là tự nhiên.** cafes ↔ eats (quán cà phê
   có bánh, quán ăn có đồ uống), nature → heritage (chùa trong công viên),
   nightlife → eats. Đó là đặc điểm của địa điểm, không phải lỗi của mô hình.
6. **Catalog không đo được Học tập và Giải trí.** Không có địa điểm nào chỉ
   có category Học tập, và chỉ 6 ảnh thuộc địa điểm chỉ có Giải trí. Muốn đo
   hai category này phải có ảnh thử riêng do chủ sản phẩm chụp.
7. **Kích thước và chi phí, chưa đo trong app:** phần đọc ảnh của SigLIP 2
   base khoảng 90–170 MB (ước tính). Trên Mac, đọc 6.239 ảnh mất khoảng 1,5
   giờ; khi đã lưu vector của từng ảnh, đổi câu mô tả hay ngưỡng chỉ mất vài
   giây.

**Vì sao dừng.** Phép thử đi nhanh hơn khả năng kiểm soát, và trả lời một câu
hỏi hẹp hơn mục đích ở mục 1. Kết quả cũng cho thấy phần muốn có nhất, báo
ảnh lạc đề, chưa làm được. Code (`data/photo-eval/`, PR #976–#985) đã gỡ;
commit cuối còn giữ nó là `d73d6efed23b90379c252e107012a03dde28e361`.

## 6. Pháp lý và giấy phép

⚠️ = chưa đối chiếu nguyên văn.

- ⚠️ **Ảnh Google không được dùng để huấn luyện mô hình.** Mục "No Unfair
  Exploitation" trong *Google Maps Platform Analytics Service Specific Terms*
  cấm đưa nội dung Maps vào huấn luyện AI/ML (các bản ngày 30/09/2025,
  04/12/2025, 30/06/2026). Chưa đọc được ToS chính của Maps Platform, nên coi
  như cấm. Chạy một mô hình có sẵn lên ảnh để đo thì khác với huấn luyện,
  nhưng cũng nên đối chiếu. Liên quan C1 trong `tech-eval-app-store.md`.
- **Ảnh lấy từ bài đăng Threads** là ảnh của người khác: không dùng để huấn
  luyện.
- **Ảnh guide tự tải lên** (869) là dữ liệu dùng được.
- Bộ dữ liệu mở:
  - ⚠️ **Places365**: chỉ cho nghiên cứu phi thương mại → loại.
  - ⚠️ **Open Images**: nhãn CC BY 4.0, ảnh phần lớn CC BY 2.0 → dùng được,
    phải ghi nguồn.
  - ⚠️ **COCO**: nhãn CC BY 4.0, ảnh Flickr với nhiều loại giấy phép.
  - ⚠️ **Food-101**: phải kiểm.
- Mô hình:
  - ❌ **MobileCLIP / MobileCLIP 2** (Apple): giấy phép trọng số `apple-amlr`
    chỉ cho nghiên cứu, cấm dùng trong sản phẩm, và mô hình phái sinh cũng
    vậy.
  - ✅ **SigLIP 2** (Google): Apache 2.0. ⚠️ Phải đọc model card của chính
    Google trước khi đưa vào app.
  - ✅ **CLIP** (OpenAI): MIT.
  - ⚠️ **TinyCLIP** (Microsoft): giấy phép chưa rõ nguồn gốc.
  - ❌ **YOLO của Ultralytics**: AGPL, không hợp với app đóng mã.
- Nếu gửi ảnh lên server để phân tích: phải sửa `app/src/lib/legal.ts`, câu
  "Phân tích ngay trên máy", và danh sách bên thứ ba trong chính sách quyền
  riêng tư.

## 7. Các cách để máy hiểu nội dung ảnh

Đây là bước 2, và một phần của bước 4–5.

| | Cách làm | Hiểu cảnh? | Chi phí / ràng buộc | Đã biết gì |
|---|---|---|---|---|
| **A** | Lưu ~20 nhãn Vision thay vì 5 | Một phần: thấy vật, không hiểu cảnh | Build mới, chấm lại ảnh | Nhãn cụ thể xuất hiện quá ít (mục 5.1) |
| **B** | Mô hình ảnh–chữ trên máy (SigLIP 2) | Có, ở mức cảnh | Build mới, +90–170 MB | "Hợp" đáng tin, "lạc đề" không (mục 5.2) |
| **C** | AI có thị giác chạy trên server | Có, giải thích được bằng lời | Ảnh rời máy (trái nguyên tắc 4), tốn tiền theo ảnh | Chưa thử |
| **D** | Tự huấn luyện Core ML bằng Create ML | Có, trong các category đã dạy | ~30–50 ảnh có nhãn mỗi category; chỉ dùng được ảnh guide tải lên (mục 6) | Chưa thử; 229 ảnh chủ sản phẩm chấm có thể là khởi đầu |

C cho ngay khả năng hiểu ảnh mà không cần dữ liệu. D chạy trên máy, gần như
không tốn tiền, nhưng phụ thuộc hoàn toàn vào dữ liệu mình dạy. Có thể đi từ C
sang D: câu trả lời của C, sau khi người sửa chỗ sai, thành nhãn để huấn luyện
D. Nhưng C trái nguyên tắc 4.

## 8. Quyết định đã chốt

| # | Ngày | Quyết định | Lý do |
|---|---|---|---|
| D1 | 15/10 | Lưu số đo thô, diễn giải ở JS | Sửa luật qua EAS Update, không phải chấm lại |
| D2 | 16/10 | Không có điểm thành phần trên thang 10 (bố cục, màu sắc) | Không đo được; viết ra là bịa (#973) |
| D3 | 16/10 | Độ phù hợp dùng category sẵn có, không tạo bộ nhãn ảnh mới | Chủ sản phẩm: tránh một bộ nhãn song song |
| D4 | 16/10 | "Hợp làm bìa" là trục riêng, không gộp vào điểm đẹp | 6/42 (mục 5.1) |
| D5 | 16/10 | Phân tích ngay trên máy "nếu có thể"; chưa dùng AI trên server | Chủ sản phẩm |
| D6 | 16/10 | Mô hình ảnh–chữ, nếu dùng: SigLIP 2, không dùng MobileCLIP | Giấy phép (mục 6); SigLIP 2 hơn CLIP (mục 5.2) |
| D7 | 16/10 | "Lạc đề" = nội dung ảnh không khớp category. Ảnh xấu hay không đại diện được thuộc bước 4–5 | Chủ sản phẩm |
| D8 | 16/10 | App không bao giờ hiện "lạc đề"; nếu có, chỉ hiện "Hợp với [category]" | Trên ảnh mới, "lạc đề" chỉ đúng 33%, "hợp" đúng 92% (mục 5.2) |
| D9 | 16/10 | Dừng phép thử SigLIP 2 / CLIP và gỡ code của nó; giữ Apple Vision | Chủ sản phẩm: hướng đi chệch và thiếu kiểm soát |
| D10 | 17/10 | Làm bảng "Refined UI" theo hai bước: (1) giao diện, chỉ với các tiêu chí đo được; (2) nhận biết loại ảnh (Món ăn / Địa điểm / Phong cảnh), bắt đầu bằng đề xuất một trang | Chủ sản phẩm. Thanh điểm cho bố cục, màu sắc, không gian, nhiễu trên bảng đó là D2 lần nữa |
| D11 | 17/10 | Màu đánh giá theo nghĩa, không theo màu chủ đạo: tốt = `okInk`, cần chú ý = `warnInk`, đổi sắc theo theme nhưng giữ nghĩa. Thanh xếp hạng vẫn là màu chủ đạo, vì nó là vị trí trong catalog chứ không phải lời khen | Chủ sản phẩm. Ở theme mặc định màu chủ đạo là đỏ san hô: dấu "tốt" màu đỏ đọc thành cảnh báo |
| D12 | 17/10 | Phân tích chi tiết còn ba dòng có thanh: **Ánh sáng** (độ phơi sáng: khoảng cách của độ sáng trung bình tới giữa thang, nhân tỷ lệ điểm ảnh không bị tối đen hay cháy trắng), **Độ nét** (vị trí trong catalog), **Bố cục** (tỷ lệ các phép kiểm khung hình đạt: chủ thể không sát mép, đường chân trời của cảnh không nghiêng, người và chữ không chiếm khung). Màu sắc và Không gian chưa có dòng, vì không có số đo; Màu sắc cần thêm phép đo vào module Swift (bản build mới). Cây xanh bỏ khỏi phần này, thuộc bước 5. Thanh tô theo kết quả, thay cho thanh màu chủ đạo của D11: xanh `okInk` khi đo được điều tốt, cam `warnInk` khi có lỗi, xám khi không khen không chê. Bố cục ghi "Không thấy lỗi" chứ không ghi "Tốt": các phép kiểm chỉ tìm lỗi, và 88% ảnh qua hết, nên một thanh đầy màu xanh sẽ nói quá | Chủ sản phẩm chọn "làm ngay ba dòng có thật" |

## 9. Câu hỏi đang mở

- **Q1.** Có quay lại bước 2 không, và bằng cách nào (mục 7)? Nếu có, bắt đầu
  bằng một đề xuất một trang (nguyên tắc 8). Đề xuất phải nói kết luận sẽ hiện
  gì trong app, và đo trên tập ảnh nào chưa dùng để chọn ngưỡng.
- **Q2.** Nếu đưa một mô hình vào app thì đóng sẵn, hay tải về khi guide bấm
  "Chấm ảnh" lần đầu? Đề xuất: tải về khi cần, để người không chấm ảnh không
  phải gánh thêm dung lượng.
- **Q3.** Có xem lại 16 ảnh bìa ở mục 5.2 (điểm 4) trong Data Desk không?
- **Q4.** Nhận biết loại ảnh (bước 2 của D10). Category của địa điểm không
  nói được nội dung ảnh: cùng một quán có ảnh món, mặt tiền và view. Hướng
  đang xét: "Phong cảnh" theo luật khung cảnh đã có (`scene()`), "Món ăn"
  theo nhãn đồ ăn của Vision cộng chủ thể chiếm phần lớn khung, còn lại là
  "Địa điểm"; không chắc thì không hiện. Đo trên các ảnh đã chấm trước khi
  viết code (nguyên tắc 7, 8). Nếu có, là icon trung tính, không phải nhãn
  có màu (mục 11).
  **Vòng 1 (17/10):** luật v0 (`data/review/photo-types/rule_v0.py`) chốt
  trước khi có nhãn tay, đoán trên 434 ảnh: 84 Món ăn, 30 Phong cảnh, 310
  Địa điểm, 10 Không chắc. Mẫu 100 ảnh (30 mỗi loại luật đoán, 10 Không
  chắc, xáo trộn) chấm tay ở Data Desk `#/photo-types`, trang không hiện
  lời đoán. Lời đoán của luật theo đúng thứ tự trang nằm ở
  `data/review/photo-types/round1.json`, cùng câu trả lời của chủ sản phẩm.
  **Kết quả vòng 1:** luật nói Món ăn đúng **30/30**; Địa điểm đúng 21/30
  (sót 6 ảnh món ăn mà Vision chỉ gắn nhãn bát đĩa, dao dĩa, ly); Phong cảnh
  đúng **10/30** (17 ảnh là mặt tiền, nhà thờ, thư viện dưới trời xanh, chủ
  sản phẩm gọi là Địa điểm). Vòng 1 chưa có định nghĩa cho hai loại này, nên
  **vòng 1b** (`#/photo-types-1b`) hỏi lại 57 ảnh chủ sản phẩm gọi là Địa
  điểm hoặc Phong cảnh, với định nghĩa theo chủ thể của ảnh hiện trên trang.
  **Kết quả vòng 1b:** Phong cảnh vẫn chỉ đúng **9/30**; chủ sản phẩm đổi ý
  9/57 ảnh so với vòng 1. Định nghĩa làm câu trả lời nhất quán hơn, nhưng
  nhãn Vision không tách được "toà nhà dưới trời" khỏi "khung cảnh".
  **Vòng 2 (`#/photo-types-2`, 100 ảnh mới, ngẫu nhiên):** Claude chấm trước,
  chỉ nhìn ảnh, câu trả lời commit kèm sha256 trước khi chủ sản phẩm chấm
  (`data/review/photo-types/round2.json`). Claude và chủ sản phẩm trùng
  **96/100**, kappa **0,92**; khác nhau ở 2 ảnh đồ uống trước view hay trên
  quầy bar, và 2 ảnh có người (Claude chọn Không rõ, chủ sản phẩm chọn Địa
  điểm). Luật v0 trên ảnh mới: nói Món ăn **16/16 đúng**, nhưng chỉ bắt được
  16/33 ảnh món ăn (48%); không gọi ảnh nào là Phong cảnh.
  → Phân loại ảnh là việc mô hình hiểu ảnh làm tốt gần như người (cách C,
  mục 7), còn nhãn Vision chỉ làm được nửa phần Món ăn. Cách C trái nguyên
  tắc 4; 200 nhãn tay của hai vòng là dữ liệu khởi đầu cho cách D.

## 10. Việc tiếp theo

- [ ] **Bước 3: chặn trần điểm khi có lỗi kỹ thuật nặng.** Đã có số đo độ nét
  và độ sáng; còn thiếu luật chặn trần và ngưỡng đo trên catalog.
- [ ] **Bước 5: điểm "hợp làm bìa".** Kiểm chứng bằng việc ảnh bìa thật có lọt
  top 3 thường hơn mức 62% hiện nay không.
- [ ] **Bước 4: tiêu chí theo bối cảnh** (category và kiểu ảnh).
- [ ] **Bước 6: giọng văn theo bối cảnh.**
- [ ] Nút để guide "sửa loại / độ phù hợp": thành nguồn dữ liệu có nhãn của
  City Crew, dùng được cho cách D.
- [ ] Gỡ ràng buộc tạm `photo_scores_one_per_photo` khi có bộ chấm thứ hai.

## 11. Phương án đã loại

- **Bảy thanh điểm trên thang 10** (bố cục, màu sắc…): Vision không đo được
  các thứ đó → hiện số đo bằng lời (#973).
- **Một bộ nhãn "loại ảnh" mới, có màu** (Đồ ăn, Bên trong, Bên ngoài…):
  chủ sản phẩm không muốn bộ nhãn song song. Nhãn có màu trong app đã mang
  nghĩa category của địa điểm, gắn lên ảnh sẽ gây hiểu nhầm.
- **Nightlife là một loại ảnh riêng:** Vision không phân biệt được quán bar
  tối với một phòng tối. Dùng category **Về đêm** của địa điểm làm bối cảnh.
- **MobileCLIP:** trọng số chỉ cho nghiên cứu (mục 6).
- **Places365 để huấn luyện:** giấy phép phi thương mại.
- **Huấn luyện bằng ảnh Google hoặc ảnh Threads:** điều khoản và bản quyền
  (mục 6).
- **Báo "lạc đề" bằng ngưỡng trên mô hình ảnh–chữ:** đã thử 18 cặp ngưỡng
  (hạng của category × độ chênh); trên ảnh mới, cặp tốt nhất chỉ đúng 40%
  (mục 5.2).
- **Coi ảnh bìa luôn đúng:** chủ sản phẩm gọi 16 ảnh bìa là không khớp
  category (mục 5.2).
- Từ bảng "Refined UI" (17/10):
  - **Thang nhãn 5 mức** (Xuất sắc … Cần cải thiện, cắt ở 9 / 7 / 5 / 3):
    ảnh trong catalog nằm trong khoảng 5,4–9,4 (`AESTHETIC_SPREAD`), nên hai
    mức dưới 5 gần như không bao giờ hiện. Giữ 4 mức của `band()`.
  - **"Tái tạo ảnh đẹp hơn (AI)":** cần mô hình tạo ảnh trên server, tức là
    ảnh rời máy (nguyên tắc 4), và ảnh một quán có thật bị AI vẽ lại có thể
    không còn giống quán.
  - **"Chia sẻ ảnh", "Tải xuống":** 86% ảnh là của Google, phần khác có ảnh
    Threads của người khác (mục 6). Nếu làm, chỉ cho ảnh guide tự tải lên.
  - **Menu thao tác riêng có nút Huỷ:** các hàng Đặt làm ảnh bìa / Ẩn / Xoá
    đã nằm ngay trong sheet, một lần chạm thay vì hai.

## 12. Lịch sử ngắn

| Ngày | Việc |
|---|---|
| 15/10/2026 | #958–#968: chấm ảnh bằng Apple Vision trên máy, lời giải thích dựa trên số đo. #960: binary 1.0.9 |
| 16/10/2026 | #969–#974: tách theo bộ chấm, sheet ảnh, xem toàn màn hình, phân tích chi tiết, ảnh bìa lên đầu |
| 16/10/2026 | #975–#985: thiết kế bước 2 và phép thử SigLIP 2 / CLIP ngoài app (mục 5.2) |
| 16/10/2026 | #987: sheet ảnh mở đầu bằng câu nhận xét |
| 16/10/2026 | Dừng phép thử, gỡ `data/photo-eval/`, viết lại file này (D9) |
| 17/10/2026 | Bảng "Refined UI": bước 1, giao diện phân tích chi tiết (D10, D11) |
| 17/10/2026 | Ba dòng có thanh: Ánh sáng, Độ nét, Bố cục; gợi ý mang icon của tiêu chí (D12) |
