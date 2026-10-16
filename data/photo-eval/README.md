# Đánh giá độ phù hợp của ảnh (bước B3–B5 trong `docs/photo-critic.md`)

Script này hỏi một mô hình hiểu cả ảnh lẫn chữ (SigLIP 2, hoặc CLIP để so
sánh): **mỗi ảnh trong catalog có giống những gì category của địa điểm hứa
không?** Các câu mô tả cho từng category nằm trong `prompts.json`.

- **Chỉ đọc.** Script lấy ảnh và category qua API công khai, bằng đúng key
  công khai mà app đang dùng. Nó không ghi gì vào database.
- **Chạy trên Mac.** Container của phiên Claude không kết nối được tới kho
  ảnh và kho mô hình. Phần không cần mạng (chấm, đo, xuất báo cáo) đã được
  chạy thử ở đó với `--model fake`.

## Cài đặt (một lần)

```bash
cd data/photo-eval
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Lần chạy đầu tiên sẽ tải mô hình từ Hugging Face: SigLIP 2 base có thể tới
khoảng 1,5 GB, vì phần đọc chữ có bộ từ vựng rất lớn; CLIP B/32 khoảng
600 MB. Đây là kích thước để đánh giá trên Mac. Nếu đưa vào app thì chỉ cần
phần đọc ảnh, nhỏ hơn nhiều (số liệu ở `docs/photo-critic.md` mục 8).

## Chạy

```bash
source .venv/bin/activate
python eval.py                          # SigLIP 2 trên toàn catalog
python eval.py --model clip             # CLIP, để so sánh
python eval.py --limit 50               # chạy thử 50 ảnh
python eval.py --extra ~/Pictures/citycrew-test   # thêm ảnh thử của anh (B6)
```

Kết quả nằm trong `out/` và không được commit:

- `photo-fit-<model>.html`: **mở file này trong trình duyệt.** Mỗi nhóm lấy
  ngẫu nhiên 12 ảnh (`--sample 20` để xem nhiều hơn, `--sample 0` để xem hết,
  `--seed 2` để đổi mẫu). Thứ tự các nhóm: ảnh bìa bị coi là lạc đề, lạc đề,
  chưa rõ, năm cặp category hay nhầm nhất, rồi đến hợp. Mỗi ảnh ghi category
  **mong đợi** (tô xanh), top 3 mô hình đoán kèm điểm, độ chênh và kết luận.
- **Ba nút Hợp / Chưa rõ / Lạc đề dưới mỗi ảnh** để anh tự chấm. Phần chấm
  được giữ lại khi tải lại trang. Bấm **Copy** ở cuối trang rồi gửi lại.
- `photo-fit-<model>.csv`: điểm của từng ảnh với từng category.
- `photo-fit-<model>.json`: bản tóm tắt các số đo, dùng để dán vào
  `docs/photo-critic.md` mục 4.

Ảnh đã tải về và **vector của từng ảnh** được giữ trong `out/cache/`
(`vectors-<model>.jsonl`). Lần chạy đầu với một mô hình mất khoảng 1,5 giờ
cho toàn catalog. Từ lần sau, nếu chỉ đổi câu mô tả, luật hay ngưỡng thì chỉ
mất vài giây, vì mô hình chỉ còn phải đọc lại các câu. Nếu chạy dở rồi dừng,
lần sau chạy tiếp từ chỗ dừng.

## Ảnh thử của anh (B6)

Xếp ảnh vào thư mục con mang **đúng tên khoá category**. Tên thư mục chính là
đáp án đúng:

```
citycrew-test/
  focus/      ← người ngồi làm việc với laptop, học bài
  markets/    ← cửa hàng, trung tâm mua sắm, chợ
  fun/        ← rạp phim, karaoke, bowling…
  nightlife/  ← quầy bar, cocktail buổi tối
  cafes/  eats/  views/  heritage/  nature/   (có thể bỏ trống)
```

Mỗi thư mục khoảng 10 ảnh. Đuôi JPEG, PNG hoặc HEIC đều được. Ảnh do chính
anh chụp nên không vướng giấy phép.

## Đọc kết quả

- **`top1` / `top3`**: tỉ lệ ảnh mà category đoán đầu tiên, hoặc một trong
  ba category đầu, trùng với category của địa điểm. Đây chỉ là thước đo gần
  đúng: ảnh menu của một quán cà phê vẫn mang category "cafes".
- **`verdicts`**: số ảnh rơi vào mỗi mức:
  - **Hợp**: category của địa điểm được đoán đầu tiên;
  - **Chưa rõ**: nó đứng thứ hai hoặc thứ ba, hoặc ảnh là menu hay biển hiệu;
  - **Lạc đề**: nó không lọt top 3, và category khác hơn nó quá
    `--off-margin` (0,02), hoặc nhóm "trời, đường, xe" đứng đầu.

  Chốt ngưỡng là việc của B7, sau khi xem trang HTML.
- **`covers`** / **`covers_off`**: số ảnh bìa, và số ảnh bìa bị coi là lạc
  đề. `covers_off` phải bằng **0** thì mới đạt.
- **`vision_fit`** so với **`model_fit_where_vision_scored`**: luật dựa trên
  nhãn Vision (bản thử ngày 16/10) so với mô hình, trên cùng những ảnh đã
  chấm.
- **`confusion`**: với các địa điểm chỉ có một category, ảnh hay bị đoán
  nhầm sang category nào.
- **`extra_by_category`**: kết quả trên ảnh thử, nơi đáp án chắc chắn đúng.

Xong thì gửi lại file `.json` (và ảnh chụp trang HTML nếu có chỗ đáng bàn) để
ghi vào `docs/photo-critic.md` và chốt B7.

## So ngưỡng với phần chấm của anh (B7)

Sau khi chấm trên trang và bấm **Copy**:

```bash
pbpaste > out/marks.json
python eval.py --marks out/marks.json
```

Lệnh này chạy trong vài giây nhờ cache, và in một bảng, mỗi dòng là một cặp
ngưỡng (`off_rank` = category phải nằm trong top mấy thì không bị gọi lạc
đề, `off_margin` = độ chênh):

- **`off_precision`**: trong số ảnh mô hình gọi lạc đề, bao nhiêu phần anh
  cũng gọi lạc đề;
- **`off_recall`**: trong số ảnh anh gọi lạc đề, mô hình bắt được bao nhiêu
  phần;
- **`covers_fit_called_off`**: ảnh bìa anh chấm Hợp mà mô hình gọi lạc đề.
  Phải bằng **0**;
- **`catalog_off`** / **`catalog_covers_off`**: luật đó gọi bao nhiêu ảnh,
  bao nhiêu ảnh bìa của cả catalog là lạc đề.

Chọn được cặp nào thì chạy lại với `--off-rank` và `--off-margin` tương ứng.
Phần chấm cộng dồn trong trình duyệt, nên chấm thêm rồi Copy lại là đủ.

## Kiểm tra script

`python3 -m unittest test_eval` (không cần venv). `npm test` trong `data/`
và CI cũng chạy phần này.
