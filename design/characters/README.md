# Cam & Mun — character reference (model sheets)

Chốt ngày 27/10/2026. Phong cách chuẩn: **`app/assets/ideas-art-light.webp`** — gouache phẳng có hạt giấy, không viền mực, bảng màu kem / cam đất / đỏ gạch / xanh xô thơm, nền trắng, nhiều khoảng trống, không vẽ bầu trời.

## Nhân vật

| | Cam | Mun |
|---|---|---|
| Giống | Mèo tam thể (calico) | Mèo tuxedo đen trắng |
| Lông | Trắng kem; đốm cam ở đầu, lưng, một đốm tròn ở hông; một mảng đen nhỏ trên lưng; đuôi cam sọc, chóp trắng | Đen nâu ở đầu, lưng, chân, đuôi dài dựng cao; mặt nạ đen trên mắt và trán; mõm, má, yếm ngực và bàn chân trắng |
| Mắt | Nhắm cười ^^ (hình chữ U úp) | Nhắm lim dim (cong xuống) |
| Miệng | Chữ "ω" cười | Chữ "ω" hiền |
| Phụ kiện | Khăn đỏ thắt lệch một bên cổ | Khăn xanh rêu (olive) thắt lệch một bên cổ |
| Dáng | Thon, nhanh nhẹn | Tròn, chắc hơn Cam |
| Trên xe đạp | Cầm lái, đạp | Ngồi baga sau |

## Files

Bộ chính thức (thư mục này) — **ChatGPT**, cùng một nét vẽ cho cả hai con:

| File | Nội dung | Kích thước |
|---|---|---|
| `contact-sheet.jpg` | Xem nhanh 6 tờ cạnh nhau (Cam trái, Mun phải) | 1810×1561 |
| `source-reference.jpg` | `ideas-art-light` + ảnh cắt Cam, Mun dùng làm tham chiếu gốc | |
| `cam-turnaround.png` | 5 góc: chính diện, 3/4 trước, nghiêng, 3/4 sau, sau lưng | 1672×941 |
| `mun-turnaround.png` | như trên | 2048×768 |
| `cam-expressions.png` | 6 biểu cảm: vui, ngạc nhiên, tò mò, ngáp, phụng phịu, cười lớn | 1672×941 |
| `mun-expressions.png` | 6 biểu cảm: lim dim, ngạc nhiên, tò mò, ngáp, khó chịu, cười lớn | 1672×941 |
| `cam-poses.png` | 6 tư thế: ngồi, đi, chạy, nhảy, đạp xe (yên trước), ngước nhìn | 1672×941 |
| `mun-poses.png` | 6 tư thế: ngồi, đi, chạy, nhảy, ngồi baga sau, ngước nhìn | 1672×941 |

`alt-gemini/` — bản Gemini 3.1 Pro (Nano Banana Pro) đầu tiên của `cam-turnaround`, `mun-turnaround`, `cam-expressions`, `cam-poses`, 2752×1536, có logo ✦ ở góc. Giữ lại để so sánh hoặc khi cần độ phân giải cao.

Ghi chú:
- Bộ ChatGPT được vẽ lại từ bản Gemini, kèm tờ của con kia làm style reference, nên hai con cùng nét, cùng màu râu, cùng chất liệu.
- Vị trí đốm cam/đen của Cam xê dịch nhẹ giữa các tờ — lấy `cam-turnaround.png` làm chuẩn.
- Độ phân giải ~1.6K: đủ làm tham chiếu, không đủ để cắt hình đưa thẳng vào app.

## Cách dùng khi tạo ảnh mới

1. Đính kèm turnaround (+ expression/pose sheet nếu cần) của đúng nhân vật làm **character reference**.
2. Đính kèm `ideas-art-light` làm **style reference**.
3. Trong prompt ghi rõ: *flat textured gouache picture-book illustration, no ink outlines, soft paper grain, muted warm palette, plain white background, no sky*.
4. Một con một tờ cho kết quả ổn định hơn ghép hai con trong một prompt.
