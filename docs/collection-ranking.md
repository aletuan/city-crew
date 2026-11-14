# Thứ tự ưu tiên của bộ sưu tập

**Trạng thái: đề xuất, chưa triển khai** (14/11/2026). Ghi lại để làm tham
chiếu trước khi viết code. PR nào làm một bước ở mục "Các bước" thì đánh dấu
bước đó ngay tại đây, trong cùng PR.

Câu hỏi: một người mở app thì thấy bộ sưu tập công khai nào trước? Chủ app
nêu tám tiêu chí. Tài liệu này ghi cách dùng từng tiêu chí, số đo đứng sau
mỗi lựa chọn, và kết quả tính thử trên hai tài khoản thật.

## Hiện trạng

| Nơi hiển thị | Thứ tự hôm nay | Code |
|---|---|---|
| Kệ "Từ cộng đồng" ở Explore | lượt thích (không tính chủ list) → mới nhất | `rankByLikes`, `lib/likes.ts` |
| Ba gợi ý ở Ý tưởng | như trên, bỏ list của chính người xem | `IdeasScreen` |
| Tab Cộng đồng, Mosaic | khối theo thành phố, thành phố của người xem lên đầu; list nhiều lượt thích nhất dẫn khối | `mosaicGroups`, `lib/collectionMosaic.ts` |
| Tab Cộng đồng, lưới | mới nhất trước | thứ tự của catalog |

## Số đo (14/11/2026, 54 list công khai, 14 tác giả)

| Tín hiệu | Số đo | Điều rút ra |
|---|---|---|
| Lượt thích | 51/54 list có; cao nhất 12; 223 lượt từ tối đa 17 người | Một nhóm nhỏ thích gần hết mọi list. Phân biệt yếu hơn con số gợi ý. |
| Dùng cho chuyến đi | 8 list; cao nhất 2 | Ý định mạnh nhất, còn thưa. |
| Bản sao | 5 list; cao nhất 4 | Cùng loại với chuyến đi: một hành động thật. |
| Lượt xem | 67 lượt; cao nhất 9; đếm từ 13/11 | Đếm cả tác giả và mở lặp lại (quyết định 13/11), nên tự đẩy được. |
| Điểm trung bình các địa điểm | 3,90–5,00; độ lệch chuẩn 0,199 | Gần như không tách được list nào với list nào. |
| Số địa điểm | p10 = 4, trung vị 7,5, p90 = 21; 4 list dưới 3 | Có ích đến một mức rồi bão hoà. |
| Có mô tả | 49/54 | Hầu hết đều có, nên không tạo ra thứ hạng. |
| Mới tạo | 9 list trong 7 ngày; 29 trong 30 ngày | Cửa sổ 30 ngày phủ hơn nửa số list; 7 ngày mới có nghĩa. |

## Logic đề xuất

Tám tiêu chí không vào chung một công thức. Hai là bộ lọc, một là mức
phạt, năm là điểm có trọng số, và sở thích là mức cộng có trần.

### 1. Nơi đang dùng app: lọc, không chấm điểm

Giữ như hôm nay. Kệ chỉ hiện list có ít nhất một địa điểm trong thành phố
(`touchesCity`); Mosaic đưa khối thành phố của người xem lên đầu. Một list
hay ở Đà Lạt không nên thắng một list vừa phải ở nơi người xem đang đứng,
nên vị trí không thể là một số hạng cộng vào điểm.

### 2. Thiếu thông tin: phạt

List không có mô tả, hoặc có dưới 3 địa điểm: nhân điểm cuối với **0,85**.
Không phải trọng số vì 49/54 list đã có mô tả: một số hạng mà gần như mọi
list đều đạt tối đa thì không xếp hạng được gì.

### 3. Điểm nền, trong từng thành phố

Mỗi tín hiệu chuẩn hoá về 0–1 *trong tập đang được xếp* (các list của một
thành phố), như `lib/popular.ts` làm với địa điểm.

| Tín hiệu | Trọng số | Cách tính |
|---|---|---|
| Lượt thích | **0,30** | `ln(1+L) / ln(1+L_max)`. `L` không tính lượt của chủ list. Thang log để lượt thứ 12 không nặng bằng lượt đầu. |
| Được dùng | **0,25** | `ln(1+U) / ln(1+max(U_max, 5))`. `U` = số người khác chủ list đã dựng chuyến đi từ list + số người khác đã sao chép nó. Sàn 5: xem "Sàn của được dùng" bên dưới. |
| Nội dung | **0,20** | Một nửa là `min(n, 8) / 8` (`n` = số địa điểm đã xuất bản). Một nửa là điểm đánh giá trung bình của các địa điểm, mỗi điểm kéo về trung bình catalog bằng `bayesRating` (prior 10), rồi chuẩn hoá min–max trong tập. |
| Mới tạo | **0,15** | 1 trong 7 ngày đầu (khớp `NEW_LIST_DAYS`, nhãn "Mới"), giảm tuyến tính về 0 ở ngày 21. List dưới 3 địa điểm: 0. |
| Lượt xem | **0,10** | Tỉ lệ `L / lượt xem`, trần 1, và chỉ khi list có từ 20 lượt xem. Dưới 20 thì bằng 0. |

**Sàn của "được dùng"** (chủ app đồng ý, 14/11/2026). `U_max` hôm nay là
2 ở Hà Nội và 4 ở TP.HCM. Chuẩn hoá theo đúng `U_max` thì một lượt dùng
đáng 0,16 điểm ở Hà Nội và 0,11 ở TP.HCM, trong khi hạng 1 và hạng 4 ở
TP.HCM chỉ cách nhau 0,13: một người dựng một chuyến đi là đảo được cả
đầu bảng. Với sàn 5, một lượt dùng đáng 0,10 điểm ở mọi thành phố cho đến
khi có list được dùng quá 5 lần.

**List dưới 3 địa điểm không có điểm "mới"** (chủ app đồng ý, 14/11/2026).
Trong lần tính đầu, một list 1 địa điểm, tạo hôm trước, lên hạng 5 trong
14 dù đã bị phạt 0,85: điểm "mới" trọn vẹn bù lại gần hết. "Mới" là để một
list hay chưa ai kịp thích không bị chôn, không phải để một list chưa
xong được đưa lên.

Lượt xem không vào dạng số thô vì nó đếm cả tác giả và mở lặp lại: xếp
theo số thô là thưởng cho người tự mở list của mình. Dạng tỉ lệ thì ngược
lại, tự mở nhiều làm tỉ lệ giảm.

### 4. Sở thích người xem: cộng thêm, có trần

`+ 0,10 × a`, với `a` là trung bình `affinity` (`lib/taste.ts`) của các địa
điểm trong list, lấy phần không âm. Cùng nguyên tắc với `TASTE_LIFT` trong
`lib/rank.ts`: đủ để đổi chỗ các list ngang nhau, không đủ để đưa list kém
vượt list tốt. Người chưa đăng nhập hoặc chưa có tín hiệu nào
(`tasteFrom` trả `null`) thì không có số hạng này, và thứ tự của họ là điểm
nền.

### 5. Công thức

```
điểm = phạt × (0,30·thích + 0,25·dùng + 0,20·nội dung + 0,15·mới + 0,10·xem + 0,10·sở thích)
```

Hoà điểm thì giữ các khoá cũ của `rankByLikes`: `created_at` giảm dần,
`sort_order`, rồi `slug`, để hai lần mở cùng một màn không ra hai thứ tự.

### 6. Giãn tác giả

Sau khi xếp: không quá 2 list liên tiếp của cùng một tác giả; list thứ ba
lùi xuống sau list kế tiếp của người khác. 54 list thuộc về 14 tác giả, và
một tác giả đang giữ 22 list.

### 7. List của chính người xem: xếp như mọi list khác

Chủ app quyết, 14/11/2026: giữ như công thức, không phân biệt list của ai.
Phép tính thử cho thấy cái giá: B giữ 22 trong 54 list công khai và thấy
list của chính mình đứng đầu ở Hà Nội. Hai lựa chọn kia đã đưa ra và không
được chọn: loại hẳn list của người xem (Ý tưởng vẫn làm vậy với ba gợi ý
của nó, và giữ nguyên), hoặc giữ nhưng không cho dẫn đầu. Nếu loại, B thấy
"Cà phê Hà Nội" trước, giống hôm nay; A vẫn thấy "Góc học bài Sài Gòn".

## Tính thử trên dữ liệu thật (14/11/2026)

Hai tài khoản thật, mỗi tài khoản ở thành phố họ hoạt động nhiều nhất. Tính
bằng SQL trên database, theo đúng công thức trên; `affinity` dựng lại từ
`saved`, `suggested`, `liked` (không có `passedOver`). Chưa chạy qua code
của app vì code chưa có.

**Người xem A, TP. Hồ Chí Minh** (14 list; A giữ 4 list công khai):

| Hạng mới | Hạng cũ | List | Điểm | Thích | Dùng | Địa điểm | Tuổi (ngày) |
|---|---|---|---|---|---|---|---|
| 1 | 12 | Góc học bài Sài Gòn | 0,610 | 2 | 4 | 23 | 17 |
| 2 | 2 | Saigon Pizza Night | 0,548 | 8 | 1 | 7 | 57 |
| 3 | 4 | Thao Dien Must Visit | 0,518 | 6 | 1 | 11 | 28 |
| 4 | 1 | [HCM][CAFE] BEEN TO (của A, không mô tả) | 0,500 | 12 | 1 | 85 | 57 |
| 5 | 7 | Evening in Tân Định | 0,421 | 5 | 0 | 8 | 57 |

**Người xem B, Hà Nội** (22 list; B giữ 22 list công khai trên cả nước):

| Hạng mới | Hạng cũ | List | Điểm | Thích | Dùng | Địa điểm | Tuổi (ngày) |
|---|---|---|---|---|---|---|---|
| 1 | 10 | The Way to Hanoi Coffee (của B) | 0,604 | 5 | 2 | 16 | 27 |
| 2 | 1 | Cà phê Hà Nội | 0,543 | 11 | 0 | 12 | 79 |
| 3 | 3 | Đồ Nhật ở Hà Nội | 0,541 | 10 | 0 | 9 | 90 |
| 4 | 15 | Vang Hà Nội mùa đông | 0,528 | 2 | 0 | 13 | 3 |
| 5 | 2 | Hồ Gươm lên đèn | 0,511 | 10 | 0 | 10 | 89 |

Hai bảng trên là lần tính thứ hai, sau khi thêm sàn 5 và bỏ điểm "mới" của
list dưới 3 địa điểm. Lần đầu, không có hai điều đó, hạng 1 của cả hai
người vẫn là hai list này (0,635 và 0,701), và hạng 5 của A là list 1 địa
điểm nói ở trên.

## Điều phép tính thử cho thấy, chưa quyết

Ba điều đã quyết: sàn của "được dùng" và điểm "mới" của list dưới 3
địa điểm (mục 3), và list của chính người xem (mục 7). Còn lại:

1. **Sở thích yếu hơn con số 0,10.** Không gì truyền `preferred` vào
   `tasteFrom` hôm nay, nên `affinity` cao nhất là 0,6. Trên cả tập nó chạy
   từ 0,19 đến 0,60 với A và từ 0,22 đến 0,59 với B, tức chênh nhau nhiều
   nhất 0,04 điểm.
2. **Tín hiệu lượt xem đang bằng 0 với mọi list**: list được xem nhiều nhất
   mới có 9 lượt, dưới ngưỡng 20.
3. **Các trọng số là phán đoán** từ bảng số đo, chưa kiểm chứng bằng hành
   vi. Đo lại bảng số đo trước khi chỉnh bất kỳ trọng số nào.

## Các bước

- [ ] **Bước 1, chỉ trong app.** `rankLists` thuần trong `lib/`, thay
  `rankByLikes` ở kệ Explore, Ý tưởng, Mosaic và lưới Cộng đồng. Dùng lượt
  thích, nội dung, mới tạo, sở thích, mức phạt và giãn tác giả; "được
  dùng" và "lượt xem" bằng 0. Trước khi merge: bảng hạng cũ/hạng mới của
  một thành phố, tính bằng chính hàm đó.
- [ ] **Bước 2, cần migration.** `trip_collections` và `collection_views`
  hôm nay chỉ chủ list đọc được (`collection_stats`). Cần một hàm công khai
  trả tổng theo list (không trả ai, không trả ngày), áp lên project thật,
  và đọc lại câu về số lượt mở trong `app/src/lib/legal.ts` trong cùng
  commit.

## Đã cân nhắc và không chọn

- **Một tổng có trọng số cho cả tám tiêu chí.** Vị trí và độ đầy đủ không
  cùng loại với lượt thích: một cái trả lời "có liên quan không", cái kia
  "có tốt không". Cộng chung thì list xa mà nhiều lượt thích thắng list gần.
- **Lượt xem thô, trọng số lớn.** Tự đẩy được, và mới có hai ngày dữ liệu.
- **Điểm đánh giá trung bình làm tín hiệu chính.** Độ lệch chuẩn 0,199:
  xếp theo nó gần như xếp theo ngẫu nhiên, đúng điều `lib/rank.ts` đã đo
  với địa điểm (0,23).
- **Cửa sổ "mới" 30 ngày.** 29/54 list nằm trong đó.
