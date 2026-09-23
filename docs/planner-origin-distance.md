# Điểm xuất phát và khoảng cách trong planner

Ghi chú này chép lại một lỗi về *cảm nhận* — không có gì crash, không test
nào đỏ — cùng phép đo đã chỉ ra nguyên nhân, ba hướng sửa đã cân nhắc, và
hướng đã chọn. Viết ra vì con số ở đây tốn công đo, và lần sau ai đó chỉnh
`ORIGIN_KM_PENALTY` sẽ muốn biết vì sao nó có hình dạng hiện tại.

## Triệu chứng

Người dùng đứng ở Thanh Xuân, chọn điểm xuất phát ở **Trần Thủ Độ** (Hoàng
Mai), và quán đầu tiên trong kế hoạch nằm ở **Long Biên** — bên kia sông
Hồng.

## Điểm xuất phát có được đọc không? Có.

Điều đầu tiên phải loại trừ, vì nó từng là một lỗi thật (xem `startPoint`
trong `lib/trip.ts`). Chuỗi này chạy đúng:

| Bước | Ở đâu | Làm gì |
|---|---|---|
| Người dùng thả ghim / chọn khu vực / không chọn gì | `StartSheet` | ghi `draft.at` / `draft.district` |
| `startPoint(draft, me)` | `lib/trip.ts` | ghim thắng → khu vực trả `null` → không chọn gì mới dùng vị trí thiết bị |
| Đóng băng vào route params | `IdeasScreen` | `atLat` / `atLng` tại thời điểm bấm |
| `draftFrom(params)` | `lib/trip.ts` | dựng lại `draft.at` |
| `originOf(draft, places)` | `lib/planner.ts` | `draft.at ?? areaCentre(district)` |

Thứ tự ưu tiên là **nơi người dùng chọn trước, vị trí hiện tại chỉ là dự
phòng**. Chọn khu vực *chặn* vị trí thiết bị một cách cố ý: nếu không, người
ngồi ở Thanh Hoá chọn "Hà Đông" sẽ được lên kế hoạch quanh ghế sofa của họ.

## Nguyên nhân: cái trần 5 km

Ghim tới nơi. Vấn đề là số hạng khoảng cách ngừng phân biệt quá sớm:

```ts
const ORIGIN_KM_PENALTY = 1.0;
const ORIGIN_KM_PENALTY_MAX = 5;   // trần chạm ở đúng 5 km
```

Đo trên catalog Hà Nội thật, gốc đặt tại Trần Thủ Độ (≈ `20.973, 105.841`):

| Quán | Khoảng cách | Phạt (trần cũ) |
|---|---|---|
| Déglacer – Modern Riverside Bistro (Bồ Đề) | **9.71 km** | **5.00** ← chạm trần |
| Cafe Domo – Nguyễn Sơn (Bồ Đề) | 8.99 km | **5.00** ← chạm trần |
| Pizza 4P's – Hoàng Thành Tower (Hai Bà Trưng) | 4.40 km | 4.40 |
| MONO Coffee Lab – Vân Hồ (Hai Bà Trưng) | 4.20 km | 4.20 |
| Yen So Park (Hoàng Mai) | 1.69 km | 1.69 |

Xa hơn 5,5 km chỉ đắt thêm **0,8 điểm**. Trong khi đó số lượt đánh giá đáng
tới `lens.popularity × min(3, log10(1 + rating_count))` — **tối đa 7,2 điểm**
ở lens `iconic`, lớn hơn cả toàn bộ ngân sách khoảng cách. Hà Nội rộng
khoảng 15 km, nên với hai phần ba thành phố, số hạng khoảng cách là một hằng
số phẳng.

Lưu ý: đây **không phải lỗi cài đặt**. Trần 5 km là lựa chọn có chủ ý, và
comment cũ nói rõ: *"The cap keeps it a nudge: past five kilometres nothing
further is charged, so a genuinely better place across town is still allowed
to win."* Nó làm đúng điều nó tuyên bố — chỉ là với một thành phố cỡ này,
"nudge" đó nhẹ hơn kỳ vọng "xuất phát từ chỗ tôi chọn".

## Ba hướng đã cân nhắc

1. **Nâng trần**, giữ tuyến tính. Đơn giản nhất. Nhược điểm: vẫn coi 1 km và
   2 km khác nhau đúng bằng 8 km và 9 km, trong khi cảm nhận không thế.
2. **Phi tuyến** — rẻ ở gần, dốc dần ở xa. ← **đã chọn**
3. **Lọc cứng** cho riêng chặng đầu: bỏ hẳn ứng viên quá N km. Dứt khoát
   nhất, nhưng biến một nudge thành một cổng, và sẽ trả về màn hình rỗng cho
   người xuất phát từ vùng catalog còn mỏng.

## Đã chọn: phi tuyến, gãy khúc tại 5 km

```ts
const ORIGIN_KM_PENALTY = 1.0;      // tới đầu gối, giữ nguyên giá trị đã đo
const ORIGIN_KNEE_KM = 5;
const ORIGIN_KM_PENALTY_FAR = 2.0;  // mỗi km sau đầu gối
const ORIGIN_KM_PENALTY_MAX = 15;   // chạm ở 10 km
```

| km | Cũ | Mới |
|---|---|---|
| 2 | 2.00 | 2.00 |
| 4.20 | 4.20 | 4.20 |
| 5 | 5.00 | 5.00 |
| 6 | 5.00 | 7.00 |
| 8 | 5.00 | 11.00 |
| 9.71 | 5.00 | **14.42** |
| ≥ 10 | 5.00 | 15.00 |

Khoảng cách giữa Bồ Đề (9.71 km) và Hai Bà Trưng (4.20 km) đi từ **0,8 điểm
lên 10,2 điểm** — không lợi thế nào về độ nổi tiếng mua lại được.

Vẫn còn trần, đặt ở 15 và chạm tại 10 km, nên hai nơi *đều* thực sự ở bên
kia thành phố vẫn được phân định bằng chính chúng chứ không bằng phép làm
tròn khoảng cách.

## Cái bẫy gặp khi làm — đáng nhớ

Bản đầu tiên dùng **bán kính miễn phí 2 km rồi bình phương phần vượt**:
`min(10, (km − 2)² × 0.25)`. Nghe hợp lý, và nó **hỏng**.

Test có sẵn `opens near the pin rather than across town` bắt được ngay. "Qua
phố" trong test đó là **4,0 km** — và đường cong bình phương tính chỗ đó chỉ
**1,0 điểm**, trong khi đường cũ tính **4,03**. Nghĩa là nó làm dải 2–5 km
*rẻ đi*, mà đó chính là dải chứa phần lớn lựa chọn thật trong một thành phố.
Mạnh ở xa, yếu ở tầm trung.

Bài học đã đóng thành test: **đường cong mới không được rẻ hơn đường cũ ở
bất kỳ khoảng cách nào** — nó chỉ được phép cộng thêm. `is never cheaper
than the flat-capped curve it replaces` quét từ 0 đến 20 km để giữ điều đó.

## Còn để ngỏ

- Chỉ **chặng đầu** được đo từ điểm xuất phát; các chặng sau đo từ chặng
  trước (`KM_PENALTY = 0.4`, trần 4). Chưa có gì chặn một kế hoạch mở gần
  ghim rồi trôi dần ra rìa thành phố.
- Số hạng này không biết tới giao thông hay giờ cao điểm: 9 km lúc 10h sáng
  và 9 km lúc 18h được tính như nhau.
- Trần 15 và đầu gối 5 km hợp với Hà Nội và TP.HCM. Melbourne và Sydney
  trong catalog trải rộng hơn; nếu có ai phàn nàn tương tự ở đó, chỗ cần
  chỉnh là đầu gối chứ không phải tỷ lệ.
