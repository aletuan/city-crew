# Thứ tự ưu tiên của bộ sưu tập

**Trạng thái: đã triển khai** (14/11/2026), cả hai bước ở mục "Các bước".
Phép tính nằm ở `app/src/lib/listRank.ts`; tài liệu này là lý lẽ của nó.
Đổi một con số ở đó thì đổi ở đây trong cùng commit.

Câu hỏi: một người mở app thì thấy bộ sưu tập công khai nào trước? Chủ app
nêu tám tiêu chí. Tài liệu này ghi cách dùng từng tiêu chí, số đo đứng sau
mỗi lựa chọn, và kết quả tính thử trên hai tài khoản thật.

## Trước ngày 14/11/2026

| Nơi hiển thị | Thứ tự khi đó | Code khi đó |
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
| Được dùng | **0,25** | `ln(1+U) / ln(1+max(U_max, 5))`. `U` = số người khác chủ list đã dựng chuyến đi từ list + số người khác đã sao chép nó. Đếm người, không đếm lượt: một người dựng năm chuyến đi từ một list là một người. Một người vừa dựng chuyến đi vừa sao chép thì được đếm cho cả hai việc. Sàn 5: xem "Sàn của được dùng" bên dưới. |
| Nội dung | **0,20** | Một nửa là `min(n, 8) / 8` (`n` = số địa điểm đã xuất bản). Một nửa là điểm đánh giá trung bình của các địa điểm, mỗi điểm kéo về trung bình catalog bằng `bayesRating` (prior 10), đọc trên thang tuyệt đối: bằng trung bình catalog thì được một nửa, cao hơn hai độ lệch chuẩn (2 × 0,2) thì được trọn, thấp hơn hai thì bằng 0. Xem "Thang của điểm đánh giá". |
| Mới tạo | **0,15** | 1 trong 7 ngày đầu (khớp `NEW_LIST_DAYS`, nhãn "Mới"), giảm tuyến tính về 0 ở ngày 21. List dưới 3 địa điểm: 0. |
| Lượt xem | **0,10** | Tỉ lệ thích trên lượt xem, chia cho tỉ lệ cao nhất trong tập, và chỉ với list có từ 20 lượt xem; dưới 20 thì bằng 0. Lượt thích ở đây chỉ tính từ 13/11/2026, ngày bắt đầu đếm lượt xem. Xem "Tỉ lệ thích trên lượt xem". |

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

**Thang của điểm đánh giá.** Bản nháp đầu chuẩn hoá min–max trong tập,
như `lib/popular.ts` làm với địa điểm. Test đầu tiên viết cho hàm đã bắt
được lỗi: hai list gồm những địa điểm giống hệt nhau, một list 8 địa điểm
và một list 24, chênh nhau đúng một nửa điểm nội dung, vì hai phép tính
trung bình lệch nhau ở chữ số thứ mười sáu và min–max kéo khoảng lệch đó ra
thành 0 và 1. Min–max không biết một khoảng chênh là lớn hay nhỏ; một thành
phố có ba list sẽ bị xếp theo chữ số thập phân thứ ba. Thang tuyệt đối dùng
độ lệch chuẩn đã đo giữa các list (0,199, làm tròn 0,2). Cũng vì thế, điểm
được làm tròn đến chữ số thứ sáu trước khi so, để hai list ngang nhau thật
sự rơi xuống các khoá hoà điểm.

**Tỉ lệ thích trên lượt xem.** Lượt xem không vào dạng số thô vì nó đếm cả
tác giả và mở lặp lại: xếp theo số thô là thưởng cho người tự mở list của
mình. Dạng tỉ lệ thì ngược lại, tự mở nhiều làm tỉ lệ giảm. Đây là chỗ
migration thống kê (`20261113160000`) đã dặn phải xem lại nếu lượt xem có
ngày được dùng để xếp hạng. Ba điều đi kèm:

- Lượt thích có từ tháng 9, lượt xem mới đếm từ 13/11. Chia toàn bộ lượt
  thích cho lượt xem từ 13/11 thì list cũ có tỉ lệ mà list mới không bao
  giờ đạt được. Nên chỉ tính lượt thích từ 13/11, theo lịch Việt Nam.
- Chấp nhận: ai cũng có thể hạ tỉ lệ của list người khác bằng cách mở nó
  nhiều lần mà không thích. Cái giá tối đa là 0,10 điểm, và chặn được thì
  phải biết ai đã mở, điều bảng đếm được thiết kế để không biết.
- Không phải tỉ lệ chuyển đổi thuần: tim bấm được ngay trên thẻ ở kệ mà
  không cần mở list, nên lượt thích có thể nhiều hơn lượt xem. Vì vậy
  chuẩn hoá theo tỉ lệ cao nhất trong tập, không đặt trần 1.

### 4. Sở thích người xem: cộng thêm, có trần

`+ 0,10 × a`, với `a` là trung bình `affinity` (`lib/taste.ts`) của các địa
điểm trong list, lấy phần không âm. Sở thích là của `useBrowseTaste`, cái
Explore dùng để xếp địa điểm: gồm cả các thể loại người dùng đã chọn trong
hồ sơ. Cùng nguyên tắc với `TASTE_LIFT` trong `lib/rank.ts`: đủ để đổi chỗ
các list ngang nhau, không đủ để đưa list kém vượt list tốt. Người chưa
đăng nhập hoặc chưa có tín hiệu nào (`tasteFrom` trả `null`) thì không có
số hạng này, và thứ tự của họ là điểm nền.

### 5. Công thức

```
điểm = phạt × (0,30·thích + 0,25·dùng + 0,20·nội dung + 0,15·mới + 0,10·xem + 0,10·sở thích)
```

Hoà điểm thì giữ các khoá cũ của `rankByLikes`: `created_at` giảm dần,
`sort_order`, rồi `slug`, để hai lần mở cùng một màn không ra hai thứ tự.

### 6. Giãn tác giả

Sau khi xếp: không quá 2 list liên tiếp của cùng một tác giả; list thứ ba
lùi xuống sau list kế tiếp của người khác. 54 list thuộc về 14 tác giả, và
một tác giả đang giữ 22 list. List không có tác giả là của ban biên tập và
không bị giãn.

### 7. List của chính người xem: xếp như mọi list khác

Chủ app quyết, 14/11/2026: giữ như công thức, không phân biệt list của ai.
Phép tính thử cho thấy cái giá: B giữ 22 trong 54 list công khai và thấy
list của chính mình đứng đầu ở Hà Nội. Hai lựa chọn kia đã đưa ra và không
được chọn: loại hẳn list của người xem (Ý tưởng vẫn làm vậy với ba gợi ý
của nó, và giữ nguyên), hoặc giữ nhưng không cho dẫn đầu. Nếu loại, B thấy
"Cà phê Hà Nội" trước, giống hôm nay; A vẫn thấy "Góc học bài Sài Gòn".

### 8. Áp dụng ở đâu, và "tập đang được xếp" là gì

Mọi tín hiệu được đo trong tập list được đưa vào, nên đưa gì vào là một
phần của câu trả lời. Một hook, `useListRank` (`lib/tasteProfile.tsx`), cho
cả bốn nơi:

| Nơi | Tập được xếp |
|---|---|
| Kệ "Từ cộng đồng" ở Explore | các list có địa điểm trong thành phố đang xem |
| Ý tưởng | như trên, bỏ list của chính người xem (quy tắc cũ của màn này, giữ nguyên) |
| Tab Cộng đồng, Mosaic | từng khối thành phố một. List đứng đầu lấy thẻ lớn; phần còn lại vẫn gom theo thể loại (yêu cầu có trước, 5/11), nên việc giãn tác giả chỉ giữ được ở thẻ lớn và đầu mỗi nhóm |
| Tab Cộng đồng, lưới | cả kệ là một tập, vì lưới không chia khối thành phố |

Khi người dùng tìm kiếm hoặc chọn thể loại, thứ tự là của kết quả tìm, không
phải của hàm này. Tab "Của bạn" không đổi.

## Tính thử trên dữ liệu thật (14/11/2026)

Hai tài khoản thật, mỗi tài khoản ở thành phố họ hoạt động nhiều nhất. Dữ
liệu lấy từ database; điểm và thứ tự do chính `rankLists` tính. Riêng số
đo sở thích của mỗi list được dựng lại bằng SQL từ `preferred`, `saved`,
`suggested`, `liked`, theo công thức của `lib/taste.ts`. "Hạng cũ" là thứ
tự trước 14/11: lượt thích rồi mới nhất.

**Người xem A, TP. Hồ Chí Minh** (14 list; A giữ 4 list công khai):

| Hạng mới | Hạng cũ | List | Điểm | Thích | Dùng | Địa điểm | Ngày tạo |
|---|---|---|---|---|---|---|---|
| 1 | 12 | Góc học bài Sài Gòn | 0,649 | 2 | 4 | 23 | 28/10 |
| 2 | 2 | Saigon Pizza Night | 0,590 | 8 | 1 | 7 | 18/9 |
| 3 | 4 | Thao Dien Must Visit | 0,564 | 6 | 1 | 11 | 17/10 |
| 4 | 1 | [HCM][CAFE] BEEN TO (của A, không mô tả) | 0,542 | 12 | 1 | 85 | 17/9 |
| 5 | 13 | Sài Gòn mùa Noel | 0,466 | 1 | 0 | 11 | 7/11 |
| 11 | 10 | [FOOD TOUR] VINHOMES GRAND PARK (1 địa điểm) | 0,370 | 2 | 1 | 1 | 13/11 |

**Người xem B, Hà Nội** (22 list; B giữ 22 list công khai trên cả nước):

| Hạng mới | Hạng cũ | List | Điểm | Thích | Dùng | Địa điểm | Ngày tạo |
|---|---|---|---|---|---|---|---|
| 1 | 10 | The Way to Hanoi Coffee (của B) | 0,621 | 5 | 2 | 16 | 18/10 |
| 2 | 1 | Cà phê Hà Nội | 0,561 | 11 | 0 | 12 | 27/8 |
| 3 | 6 | Work-date space | 0,520 | 9 | 0 | 17 | 27/8 |
| 4 | 3 | Đồ Nhật ở Hà Nội | 0,520 | 10 | 0 | 9 | 16/8 |
| 5 | 15 | Vang Hà Nội mùa đông | 0,519 | 2 | 0 | 13 | 11/11 |
| 9 | 18 | Tản Mạn Tây Hồ | 0,474 | 1 | 0 | 7 | 14/11 |
| 20 | 22 | Hẹn hò ở Hà Nội | 0,376 | 0 | 0 | 23 | 14/11 |

Lần tính đầu, trước khi có code, làm bằng SQL với bản nháp công thức
(min–max cho điểm đánh giá, chưa có sàn 5, chưa có `preferred`): hạng 1 của
cả hai người cũng là hai list này, và list 1 địa điểm của A đứng hạng 5.

## Điều phép tính thử cho thấy, chưa quyết

Ba điều đã quyết: sàn của "được dùng" và điểm "mới" của list dưới 3
địa điểm (mục 3), và list của chính người xem (mục 7). Còn lại, sau lần
tính bằng code:

1. **List mới chưa ai thích vẫn bị chôn.** "Hẹn hò ở Hà Nội": tạo hôm
   nay, 23 địa điểm, có mô tả, 0 lượt thích, đứng hạng 20 trong 22. Điểm
   "mới" trọn vẹn (0,15) không bù nổi khoảng cách với list có 9–11 lượt
   thích (0,28–0,30). Một lượt thích đầu tiên đáng 0,08 và đưa list mới
   khác lên hạng 9; hai lượt đưa lên hạng 5. Nếu muốn list mới được thấy
   trước khi có lượt thích đầu tiên thì phải tăng trọng số "mới", lấy từ
   lượt thích.
2. **Sở thích chênh nhau ít.** Với hai người xem trên, `affinity` trung
   bình của các list chạy từ 0,50 đến 1,00, tức chênh nhau nhiều nhất 0,05
   điểm. Người chưa chọn thể loại nào trong hồ sơ thì trần là 0,6.
3. **Tín hiệu lượt xem đang bằng 0 với mọi list**: list được xem nhiều nhất
   mới có 9 lượt, dưới ngưỡng 20.
4. **Các trọng số là phán đoán** từ bảng số đo, chưa kiểm chứng bằng hành
   vi. Đo lại bảng số đo trước khi chỉnh bất kỳ trọng số nào.
5. **List trải nhiều thành phố** được xếp ở mỗi thành phố theo các địa điểm
   mà catalog ở đó giữ, như thẻ của nó ở đó đếm. Chưa đo xem có bao nhiêu
   list như vậy.

## Các bước

- [x] **Bước 1, chỉ trong app** (14/11/2026). `rankLists` trong
  `lib/listRank.ts`, qua `useListRank`, thay `rankByLikes` ở kệ Explore, Ý
  tưởng, Mosaic và lưới Cộng đồng. `rankByLikes` đã bỏ.
- [x] **Bước 2, cần migration** (14/11/2026).
  `20261114100000_collection_use_counts.sql`: hàm `collection_use_counts()`
  trả ba tổng cho mỗi list công khai, cho mọi người đọc, không trả ai và
  không trả ngày. Chính sách quyền riêng tư (`app/src/lib/legal.ts`) thêm
  câu nói rằng app xếp thứ tự theo các tổng này, ngày hiệu lực 14/11. App
  chạy được khi server chưa có hàm: hai số hạng nó nuôi bằng 0 và kệ được
  xếp theo phần còn lại. **CI không áp migration lên project thật**; xem
  `CLAUDE.md`.

## Đã cân nhắc và không chọn

- **Một tổng có trọng số cho cả tám tiêu chí.** Vị trí và độ đầy đủ không
  cùng loại với lượt thích: một cái trả lời "có liên quan không", cái kia
  "có tốt không". Cộng chung thì list xa mà nhiều lượt thích thắng list gần.
- **Lượt xem thô, trọng số lớn.** Tự đẩy được, và mới có hai ngày dữ liệu.
- **Min–max cho điểm đánh giá.** Xem "Thang của điểm đánh giá" ở mục 3.
- **Điểm đánh giá trung bình làm tín hiệu chính.** Độ lệch chuẩn 0,199:
  xếp theo nó gần như xếp theo ngẫu nhiên, đúng điều `lib/rank.ts` đã đo
  với địa điểm (0,23).
- **Cửa sổ "mới" 30 ngày.** 29/54 list nằm trong đó.
