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
  ngay trên máy" chỉ được đổi khi có quyết định rõ ràng (mục 10, câu hỏi Q1).
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
| **B** | **MobileCLIP trên máy**: so ảnh với câu mô tả của từng category | **Có, ở mức cảnh** | Build mới, app nặng thêm vài chục MB (cần đo), kiểm giấy phép trọng số |
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

## 8. Ràng buộc pháp lý và giấy phép (⚠️ = chưa đối chiếu nguyên văn)

- ⚠️ **Ảnh Google không được dùng để huấn luyện mô hình.** Hiểu biết hiện tại
  là điều khoản Google Maps Platform cấm dùng nội dung để huấn luyện hoặc cải
  thiện mô hình máy học. Phải trích nguyên văn trước khi làm D.
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
  - ⚠️ **MobileCLIP**: phải đọc giấy phép trọng số, việc đầu tiên của B1.
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
| D5 | 16/10 | Thử phương án B (MobileCLIP) bằng đánh giá ngoài app trước khi tích hợp | Đo trước rồi mới tốn công build |

## 10. Câu hỏi đang mở

- **Q1.** Có giữ nguyên tắc "phân tích ngay trên máy" không? Nếu không giữ thì
  phương án C mới dùng được.
- **Q2.** Có chấp nhận build mới và app nặng thêm (B: vài chục MB) không?
- **Q3.** Chạy đánh giá B bằng GitHub Action bấm tay (đề xuất) hay trên Mac
  của chủ sản phẩm?
- **Q4.** Ai chụp và chụp khi nào khoảng 10 ảnh thử cho mỗi category khó:
  người làm việc với laptop, cửa hàng hoặc trung tâm mua sắm, chỗ giải trí?
- **Q5.** Ngưỡng nào thì B được coi là đạt? Đề xuất ở B7.
- **Q6.** Category Văn hóa, Mua sắm, Giải trí, Học tập: nếu B vẫn yếu thì chỉ
  dùng hai mức "Hợp" và "Chưa rõ", không bao giờ báo lạc đề?

## 11. Tiến độ

### Phương án B — Giai đoạn 1: đánh giá ngoài app (không build)

- [ ] **B1. Giấy phép.** Đọc nguyên văn giấy phép trọng số MobileCLIP và điều
  khoản Google về phân tích hoặc huấn luyện. Ghi kết luận vào mục 8 (bỏ dấu ⚠️).
  Nếu MobileCLIP không cho dùng thương mại → chọn mô hình khác cùng loại có
  giấy phép mở, rồi ghi lại.
- [ ] **B2. Câu mô tả theo category.** 3–5 câu tiếng Anh cho mỗi category,
  theo bối cảnh Việt Nam, cộng một nhóm câu "không thuộc category nào"
  (menu, đường phố, bầu trời). Lưu thành file dữ liệu trong `data/photo-eval/`.
- [ ] **B3. Script đánh giá** `data/photo-eval/`:
  - lấy danh sách ảnh đã chấm kèm category và việc có phải ảnh bìa (bằng key
    công khai);
  - tải ảnh, chạy mô hình;
  - xuất CSV và một trang HTML dạng lưới ảnh: category đoán, category thật,
    đánh dấu chỗ lệch.
- [ ] **B4. Chạy.** Bằng GitHub Action `workflow_dispatch`, xuất kết quả thành
  file tải về (hoặc trên Mac, tuỳ Q3).
- [ ] **B5. Đo:**
  - tỉ lệ đoán đúng category của địa điểm ở top 1 và top 3, so với nhãn
    Vision hiện tại;
  - bảng nhầm lẫn giữa các category;
  - xem lại 7 ca ở mục 4: Sam Saigon phải bị bắt, mặt tiền Memento phải
    được tha.
- [ ] **B6. Ảnh thử cho category khó** (Q4): khoảng 10 ảnh mỗi loại, là ảnh
  của mình.
- [ ] **B7. Chốt có làm tiếp hay không.** Ngưỡng đề xuất, chờ chủ sản phẩm
  duyệt:
  - top 3 khớp ≥ 85% trên toàn catalog;
  - **0 ảnh bìa** bị báo "lạc đề";
  - Sam Saigon bị báo lạc đề;
  - ≥ 7/10 ảnh thử của mỗi category khó được đoán đúng.

  Chốt luôn ngưỡng cho ba mức Hợp / Chưa rõ / Lạc đề. Ghi kết quả vào mục 4
  và quyết định vào mục 9.

### Phương án B — Giai đoạn 2: tích hợp (chỉ khi B7 đạt)

- [ ] **B8. Native.** Đưa phần xử lý ảnh của mô hình (bản Core ML) vào
  `modules/photo-score`. Module trả "dấu vân tay" của ảnh (dãy khoảng 512 số,
  cần xác nhận) vào `signals`.
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
| 16/10/2026 | Thiết kế bước 2 và các phương án A–D. Chọn đánh giá B trước. Tài liệu này ra đời |

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
- **Huấn luyện bằng ảnh Google hoặc ảnh Threads:** điều khoản và bản quyền
  (mục 8).
