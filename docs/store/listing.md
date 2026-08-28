# App Store listing — nội dung ba thứ tiếng

Điền vào App Store Connect → App Information / Version Information.
Giới hạn ký tự của Apple ghi cạnh từng mục; các bản dịch đã đếm để lọt giới hạn.

**Chiến lược ngôn ngữ:** English (U.S.) là ngôn ngữ chính — đó là bản dự phòng
cho toàn thế giới và là bản reviewer của Apple đọc. Thêm localization tiếng Việt
(phần lớn người dùng) và tiếng Nhật (tuỳ, bản dịch đã có). Một bộ screenshots
dùng chung cho mọi ngôn ngữ.

## Tên app (30 ký tự)

- EN/VI/JA chung: `City Crew`

## Subtitle (30 ký tự)

- EN: `Vietnam city guide & plans`
- VI: `Cẩm nang thành phố Việt Nam`
- JA: `ベトナムの街ガイドとプラン`

Subtitle được Apple lập chỉ mục tìm kiếm với trọng số cao, nên nó mang từ khoá
người ta thật sự gõ ("Vietnam") thay vì từ tiếp thị ("curated"). Vì `vietnam` đã
nằm ở đây, keywords EN không lặp lại nó.

## Promotional text (170 ký tự — đổi được không cần review)

- EN: `Hand-picked cafés, restaurants and bars in five Vietnamese cities, lists from people who actually go, and a plan for the day you pick.`
- VI: `Quán cà phê, nhà hàng và bar được chọn tay ở năm thành phố Việt Nam, danh sách từ người đi thật, và kế hoạch cho đúng ngày bạn chọn.`
- JA: `ベトナム5都市の厳選スポット、実際に通う人のリスト、そして選んだ日のプラン。`

## Description

Ba dòng đầu là phần người dùng đọc trước khi bấm "more", nên câu đầu nói ngay
app là gì và phủ những đâu, câu thứ hai gỡ rào cản lớn nhất (không cần tài
khoản).

**Giọng văn:** câu ngắn, động từ thường, chi tiết cụ thể. Tránh nhịp ba vế và
lối "không phải X, chỉ là Y" — nghe như quảng cáo máy viết, và người đọc App
Store nhận ra ngay.

**Hai thứ tuyệt đối không được viết sai:**

- **Không viết "tonight"/"tối nay".** App cho chọn **ngày bất kỳ** và **ban ngày
  hoặc buổi tối** (`TimeOfDay = 'day' | 'evening'` trong `lib/trip.ts`). Nói
  "tối nay" là thu hẹp sai một nửa tính năng.
- **Không viết "walkable"/"đi bộ được".** Planner *phạt theo khoảng cách*
  (`KM_PENALTY` trong `lib/planner.ts`) để các điểm gần nhau, và tôn trọng giờ
  mở cửa — nhưng không hứa đi bộ được. Nói "gần nhau" và "đang mở cửa" là đúng
  với những gì mã thật sự làm.
- **Không viết giá** — Apple cấm đưa thông tin giá vào metadata.

### EN

```
City Crew is a hand-picked guide to five Vietnamese cities: Ho Chi Minh
City, Hanoi, Da Nang, Da Lat and Hue. No account needed to look around.

EXPLORE
Cafés, restaurants, bars and places worth going out of your way for. Our
editors check every one before it appears, so the list stays short and
stays good. The app opens on the city nearest you.

COLLECTIONS
Lists made by people who actually go: where to take a date, where to bring
six friends, which cafés are worth the ride. Browse them, or sign in and
make your own.

PLANS
Pick a day, say whether you are going out in the afternoon or the evening,
and say who is coming. You get a short route: places near each other, in
an order that gets you to each one while it is open. Edit it, save it,
send it to the people coming with you.

YOUR CREW
Add friends, invite them to a trip, see what they have been saving. Easier
than five people pasting links into a group chat.

PRIVACY
Browsing needs no account. Signing in takes an email address and a
one-time code, no password. Your location is read on the phone to pick the
nearest city and is never sent to us. No ads, no tracking. You can delete
your account from inside the app.

More cities are on the way.
```

### VI

```
City Crew là cẩm nang chọn tay cho năm thành phố Việt Nam: TP. Hồ Chí Minh,
Hà Nội, Đà Nẵng, Đà Lạt và Huế. Không cần tài khoản để xem.

KHÁM PHÁ
Quán cà phê, nhà hàng, bar và những nơi đáng đi xa một chút. Ban biên tập
duyệt từng chỗ trước khi lên app, nên danh sách ngắn mà chỗ nào cũng đáng.
Mở app là vào đúng thành phố gần bạn nhất.

BỘ SƯU TẬP
Danh sách do người đi thật lập: chỗ nào hợp buổi hẹn, chỗ nào chứa được sáu
người, quán cà phê nào đáng chạy xe tới. Xem của người khác, hoặc đăng nhập
rồi tự lập.

KẾ HOẠCH
Chọn ngày, chọn đi ban ngày hay buổi tối, cho biết đi với ai. App trả về một
lộ trình gọn: các điểm gần nhau, xếp theo thứ tự sao cho tới nơi nào cũng
đang mở cửa. Sửa lại, lưu, gửi cho những người cùng đi.

HỘI CỦA BẠN
Thêm bạn bè, mời họ vào chuyến đi, xem họ đang lưu gì. Đỡ hơn nhiều so với
năm người dán link vào nhóm chat.

RIÊNG TƯ
Xem không cần tài khoản. Đăng nhập chỉ cần email và mã một lần, không mật
khẩu. Vị trí được đọc ngay trên máy để chọn thành phố gần nhất, không gửi về
chúng tôi. Không quảng cáo, không theo dõi. Bạn có thể tự xoá tài khoản ngay
trong app.

Các thành phố khác sẽ sớm có mặt.
```

### JA

```
City Crewは、ベトナム5都市の厳選ガイドです。ホーチミン市、ハノイ、ダナン、
ダラット、フエ。アカウントなしで閲覧できます。

さがす
カフェ、レストラン、バー、少し足を延ばす価値のある場所。編集部が一軒ずつ確認
してから掲載するので、リストは短く、質は高いまま。アプリを開けば、いちばん近い
街から。

コレクション
実際に通う人がつくるリスト:デートに使える店、六人で入れる店、わざわざ行く価値
のあるカフェ。人のリストを見るのも、サインインして自分でつくるのも自由。

プラン
日付を選び、昼か夜かを選び、誰と行くかを伝える。近い場所どうしをまとめ、着いた
ときに開いている順番に並べた短いルートが返ってきます。編集して、保存して、一緒
に行く人に送る。

あなたのクルー
友だちを追加し、旅に誘い、保存したスポットを見る。五人がグループチャットにリン
クを貼り合うより、ずっと楽です。

プライバシー
閲覧にアカウントは不要。サインインはメールアドレスとワンタイムコードだけで、
パスワードはありません。位置情報は最寄りの街を選ぶために端末上で読むだけで、
こちらには送信されません。広告なし、トラッキングなし。アカウントはアプリ内で
削除できます。

対応都市は今後さらに増えます。
```

## Keywords (100 ký tự, phân cách bằng dấu phẩy, KHÔNG có dấu cách sau dấu phẩy)

Không lặp từ đã có trong tên/subtitle — Apple đã lập chỉ mục những từ đó rồi,
lặp lại là phí ký tự. Tên năm thành phố là từ khoá đáng giá nhất: người ta tìm
"da nang cafe" nhiều hơn tìm "curated guide".

- EN (94/100): `saigon,hanoi,danang,dalat,hue,cafe,restaurant,bar,nightlife,travel,food,date,itinerary,weekend`
- VI (96/100): `sài gòn,hà nội,đà nẵng,đà lạt,huế,quán cà phê,nhà hàng,ăn uống,đi chơi,hẹn hò,cuối tuần,địa điểm`
- JA (54/100): `ホーチミン,ハノイ,ダナン,ダラット,フエ,ベトナム,カフェ,レストラン,旅行,グルメ,デート,週末,プラン`

## Release notes v1.0 (What's New)

- EN: `First release. Hand-picked places in Ho Chi Minh City, Hanoi, Da Nang, Da Lat and Hue, lists from people who go there, and plans for the day you pick.`
- VI: `Bản phát hành đầu tiên. Địa điểm chọn tay ở TP.HCM, Hà Nội, Đà Nẵng, Đà Lạt và Huế, danh sách từ người đi thật, và kế hoạch cho ngày bạn chọn.`
- JA: `初回リリース。ホーチミン市、ハノイ、ダナン、ダラット、フエの厳選スポット、実際に通う人のリスト、選んだ日のプラン。`

## Phạm vi phủ — kiểm lại trước mỗi lần nộp

Description và release notes nói về số thành phố, nên chúng là metadata có thể
sai theo thời gian (Apple guideline 2.3 — Accurate Metadata). Tính đến
2026-08-28, database production có **5 thành phố active / 373 địa điểm đã
duyệt**:

| Thành phố | Địa điểm đã publish |
|---|---|
| Hà Nội | 179 |
| TP. Hồ Chí Minh | 114 |
| Đà Nẵng | 45 |
| Đà Lạt | 20 |
| Huế | 15 |

Câu kiểm tra lại:
`select c.id, count(p.*) from cities c left join places p on p.city_id = c.id and p.is_published and p.review_status='approved' where c.is_active group by 1;`

## Còn thiếu (không làm được từ repo)

- **Screenshots**: chụp từ simulator iPhone 17 Pro Max (6.9" — cỡ Apple ưu tiên,
  tự co xuống cho các cỡ khác), bấm ⌘S trong Simulator. Ba ảnh đầu là ba ảnh
  người dùng thấy trước nhất: Explore (hero ảnh đẹp) → Collections → chi tiết
  địa điểm; rồi Plan và Crew.
- **Category**: đề xuất Primary `Travel`, Secondary `Food & Drink`.
- **Age rating**: xem `app-privacy-labels.md` — trả lời trung thực, dự kiến ra
  13+ chứ không phải 4+.
- **EU trader status** (mục Business): không khai thì app không phát hành được ở
  châu Âu. Với app hướng Việt Nam, có thể bỏ qua và giới hạn khu vực phát hành.
