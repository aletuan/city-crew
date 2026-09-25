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
- **Số thành phố phải khớp `cities.is_active` có địa điểm.** Câu mở đầu từng
  nói "five Vietnamese cities" trong khi DB đã có Vũng Tàu và Melbourne
  active (#586/#587) — Melbourne còn làm sai cả chữ "Vietnamese". Kiểm bằng
  câu SQL ở mục "Phạm vi phủ" trước mỗi lần nộp; một thành phố active nhưng
  0 địa điểm (Hải Phòng lúc viết) thì **tắt** `is_active` trước khi nộp chứ
  không kể vào description.
- **Không viết giá** — Apple cấm đưa thông tin giá vào metadata.
- **Không viết "one-time code"/"mã một lần"/"không mật khẩu".** App đăng nhập
  bằng **email + mật khẩu** (`supabase.auth.signInWithPassword`, xem
  `app/src/lib/auth.tsx`). Mã một lần chỉ còn ở khôi phục mật khẩu — đăng ký
  **không** gửi mã xác nhận nào, địa chỉ được auto-confirm trên project này
  (`confirmation_sent_at` NULL với cả 17 tài khoản trong `auth.users`), nên
  đừng viết ngược lại ở đây lẫn trong `review-notes.md`. Cả ba bản dịch đã
  từng viết sai cách đăng nhập và bản EN đã lên App Store Connect — mô tả sai
  chỗ đó là guideline 2.3.1.

### EN

```
City Crew is a hand-picked guide to seven cities: Ho Chi Minh City, Hanoi,
Da Nang, Da Lat, Hue and Vung Tau in Vietnam, and Melbourne. No account
needed to look around.

EXPLORE
Cafés, restaurants, bars and places worth going out of your way for. Our
editors check every one before it appears, so the list stays short and
stays good. See them as a list or as pins on a map, sort by what is nearest
or best rated, and open one for its hours, photos and a map of where it is.
The app opens on the city nearest you.

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
password. Your location is used on the phone to pick the nearest city and
to sort places by distance, and is never sent to us. No ads, no tracking.
You can delete your account from inside the app.

More cities are on the way.
```

### VI

```
City Crew là cẩm nang chọn tay cho bảy thành phố: TP. Hồ Chí Minh, Hà Nội,
Đà Nẵng, Đà Lạt, Huế và Vũng Tàu ở Việt Nam, cùng Melbourne. Không cần tài
khoản để xem.

KHÁM PHÁ
Quán cà phê, nhà hàng, bar và những nơi đáng đi xa một chút. Ban biên tập
duyệt từng chỗ trước khi lên app, nên danh sách ngắn mà chỗ nào cũng đáng.
Xem dạng danh sách hoặc ghim trên bản đồ, sắp theo gần nhất hay điểm cao
nhất, mở một chỗ để thấy giờ mở cửa, ảnh và bản đồ tới đó. Mở app là vào
đúng thành phố gần bạn nhất.

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
Xem không cần tài khoản. Đăng nhập chỉ cần email và mật khẩu. Vị trí được
dùng ngay trên máy để chọn thành phố gần nhất và sắp địa điểm theo khoảng
cách, không gửi về chúng tôi. Không quảng cáo, không theo dõi. Bạn có thể
tự xoá tài khoản ngay trong app.

Các thành phố khác sẽ sớm có mặt.
```

### JA

```
City Crewは、7都市の厳選ガイドです。ベトナムのホーチミン市、ハノイ、ダナン、
ダラット、フエ、ブンタウ、そしてメルボルン。アカウントなしで閲覧できます。

さがす
カフェ、レストラン、バー、少し足を延ばす価値のある場所。編集部が一軒ずつ確認
してから掲載するので、リストは短く、質は高いまま。リストでも地図のピンでも見ら
れ、近い順・評価順に並べ替え、開けば営業時間と写真と場所の地図。アプリを開けば、
いちばん近い街から。

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
閲覧にアカウントは不要。サインインはメールアドレスとパスワードだけです。
位置情報は最寄りの街を選び、近い順に並べるために端末上で使うだけで、こちらには
送信されません。
広告なし、トラッキングなし。アカウントはアプリ内で削除できます。

対応都市は今後さらに増えます。
```

## Keywords (100 ký tự, phân cách bằng dấu phẩy, KHÔNG có dấu cách sau dấu phẩy)

Không lặp từ đã có trong tên/subtitle — Apple đã lập chỉ mục những từ đó rồi,
lặp lại là phí ký tự. Tên thành phố là từ khoá đáng giá nhất: người ta tìm
"da nang cafe" nhiều hơn tìm "curated guide". Bản 1.0.4 thêm `vungtau`,
`melbourne`, `map` và bỏ `itinerary`, `weekend` để lọt 100 ký tự; VI/JA chưa
có localization trên App Store Connect nên chưa cần cập nhật.

- EN (99/100): `saigon,hanoi,danang,dalat,hue,vungtau,melbourne,cafe,restaurant,bar,nightlife,travel,food,date,map`
- VI (96/100): `sài gòn,hà nội,đà nẵng,đà lạt,huế,quán cà phê,nhà hàng,ăn uống,đi chơi,hẹn hò,cuối tuần,địa điểm`
- JA (54/100): `ホーチミン,ハノイ,ダナン,ダラット,フエ,ベトナム,カフェ,レストラン,旅行,グルメ,デート,週末,プラン`

## Release notes v1.0 (What's New)

- EN: `First release. Hand-picked places in Ho Chi Minh City, Hanoi, Da Nang, Da Lat and Hue, lists from people who go there, and plans for the day you pick.`
- VI: `Bản phát hành đầu tiên. Địa điểm chọn tay ở TP.HCM, Hà Nội, Đà Nẵng, Đà Lạt và Huế, danh sách từ người đi thật, và kế hoạch cho ngày bạn chọn.`
- JA: `初回リリース。ホーチミン市、ハノイ、ダナン、ダラット、フエの厳選スポット、実際に通う人のリスト、選んだ日のプラン。`

## Release notes v1.0.1 (What's New)

Build 9. Viết từ các PR đã merge sau commit "The next build is 1.0.1", chỉ giữ
những gì người dùng nhận thấy. Mẫu cho các lần sau: dòng đầu là lợi ích lớn
nhất (người đọc thường chỉ thấy 2–3 dòng trước "more"), rồi vài gạch đầu dòng
bằng chữ thường ngày; không từ nội bộ (Sketching, OTA, Edge Function), không
chỉ "Bug fixes and improvements", không hứa tính năng tương lai. Giới hạn 4000
ký tự; ba bản cùng nội dung. What's New chỉ sửa được khi nộp version mới —
Promotional text thì sửa lúc nào cũng được.

### EN

```
Plans and reminders you can count on.

• Everyone going on a trip now gets the evening-before reminder — not just the person who planned it. Leave a trip and its reminder goes too.
• City Crew now follows you to the right city when you open the app or sign out, instead of staying on the last one.
• Place photos load faster and stay put.
• Clearer messages when something goes wrong: if places can't load, you can try again right there, and adding a new place asks you to sign in first.
• Smoother Crew and Activity: no more double taps, and you're told when something doesn't save.
• Better VoiceOver support across buttons and filters.
```

### VI

```
Kế hoạch và nhắc nhở đáng tin cậy hơn.

• Mọi người trong chuyến đi đều nhận nhắc nhở tối hôm trước — không chỉ người lên kế hoạch. Rời chuyến đi thì nhắc nhở cũng tự huỷ.
• City Crew tự chuyển đúng thành phố bạn đang ở khi mở app hoặc đăng xuất, thay vì giữ thành phố cũ.
• Ảnh địa điểm tải nhanh hơn và không còn bị mất.
• Thông báo rõ ràng hơn khi có lỗi: không tải được địa điểm thì có nút thử lại ngay tại chỗ, và thêm địa điểm mới sẽ mời bạn đăng nhập trước.
• Crew và Hoạt động mượt hơn: không còn bấm hai lần, và app báo khi thao tác chưa lưu được.
• Hỗ trợ VoiceOver tốt hơn cho các nút và bộ lọc.
```

### JA

```
プランとリマインダーがより確実に。

• 旅程の前夜のリマインダーが、プランを立てた人だけでなく参加する全員に届くようになりました。旅程から抜けるとリマインダーも消えます。
• アプリを開いたときやサインアウトしたときに、今いる街へ自動で切り替わるようになりました。
• スポットの写真がより速く表示され、消えなくなりました。
• エラー時の表示をわかりやすく：スポットを読み込めないときはその場で再試行でき、新しいスポットを追加するときはまずサインインを案内します。
• クルーとアクティビティの操作がスムーズに：二重タップを防ぎ、保存できなかったときはお知らせします。
• ボタンやフィルターの VoiceOver 対応を改善しました。
```

## Release notes v1.0.2 (What's New)

Viết từ các PR merge sau build 9 (#523 → #542), cùng quy tắc như v1.0.1.
Bản này là build native mới vì #525 thêm config plugin của react-native-maps
(Google Maps SDK) — OTA không mang được.

### EN

```
Pick where your day starts on a real map.

• Planning a trip now opens a Google map: search any place or drop a pin, and the plan starts from there. Your pin keeps the name you gave it.
• Place cards show the day at a glance: a bar under the photo shows when a place is open, the closing hour appears only when it's near, and a closed place says when it opens.
• Cleaner cards and screens: the vibe sits next to the district, trip and profile options are laid out as a grid, and every switch lines up with its row.
• Shorter dates that fit on small phones: "Saturday, Sep 12".
```

### VI

```
Chọn điểm bắt đầu ngày của bạn trên bản đồ thật.

• Lên kế hoạch chuyến đi giờ mở bản đồ Google: tìm địa điểm hoặc thả ghim, kế hoạch bắt đầu từ đó. Ghim giữ đúng tên bạn đặt.
• Thẻ địa điểm cho thấy cả ngày: thanh dưới ảnh hiện giờ mở cửa, giờ đóng chỉ hiện khi sắp đóng, và quán đang đóng ghi rõ mấy giờ mở lại.
• Thẻ và màn hình gọn hơn: vibe nằm cạnh quận, tuỳ chọn chuyến đi và hồ sơ xếp thành lưới, công tắc thẳng hàng với dòng của nó.
• Ngày tháng ngắn hơn để vừa màn hình nhỏ.
```

### JA

```
一日の出発地点を、本物の地図で選べます。

• 旅程の作成で Google マップが開きます。場所を検索するかピンを置けば、そこからプランが始まります。ピンには付けた名前がそのまま残ります。
• スポットのカードで一日がひと目でわかります。写真の下のバーが営業時間を示し、閉店時刻は間近になったときだけ表示、閉まっている店は開く時刻を表示します。
• カードと画面をすっきりと。雰囲気タグは地区の横に、旅程とプロフィールの選択肢はグリッドに、スイッチは行の中央に揃えました。
• 小さな画面に収まる短い日付表記。
```

## Release notes v1.0.3 (What's New)

Viết từ các PR merge sau build 1.0.2 (#544 → #558), cùng quy tắc như v1.0.1.
Build native mới chứ không phải OTA: #545 nâng patch của Expo và các native
module đi kèm, nên bundle JS mới không khớp với binary đang ở ngoài store.

Hai PR về dữ liệu (#556 sửa thành phố sai, #557 chuẩn hoá tên khi import) cố ý
không có mặt ở đây — chúng đã tới người dùng ngay lúc chạy, không đợi bản này,
nên viết vào What's New của build này là nói sai thời điểm.

### EN

```
See every place on a map, and put the list in the order you want.

• Explore has a map: switch from the list and every place becomes a pin on Google's map. Tap one and its card slides up along the edge.
• Sort and filter what you see: nearest first, highest rated, open now — and your saved places on their own.
• The heading and its sort button stay with you as you scroll, so the control is there when you want it.
• Places with the same rating now order by how many people voted, so a score a thousand people agree on comes first.
• A list you publish yourself now shows up in Explore and in search, where it was invisible to you alone.
```

### VI

```
Xem mọi địa điểm trên bản đồ, và sắp danh sách theo ý bạn.

• Explore có bản đồ: chuyển từ danh sách sang và mỗi địa điểm thành một ghim trên bản đồ Google. Chạm một ghim, thẻ của nó trượt lên dọc mép màn hình.
• Sắp xếp và lọc thứ bạn đang xem: gần nhất, điểm cao nhất, đang mở cửa — và riêng những nơi bạn đã lưu.
• Tiêu đề cùng nút sắp xếp đi theo bạn khi cuộn, nên cần là có ngay.
• Các địa điểm cùng điểm đánh giá giờ xếp theo số lượt bình chọn, nên nơi được cả nghìn người đồng ý sẽ đứng trước.
• Danh sách bạn tự publish giờ hiện trong Explore và trong tìm kiếm — trước đây chỉ mình bạn là không thấy nó.
```

### JA

```
すべてのスポットを地図で。リストの並び順も思いのままに。

• Explore に地図が加わりました。リストから切り替えると、すべてのスポットが Google マップ上のピンになります。ピンをタップすると、そのカードが画面の端に沿って現れます。
• 表示中のスポットを並べ替え・絞り込みできます。近い順、評価の高い順、営業中 — 保存したスポットだけの表示も。
• 見出しと並べ替えボタンはスクロールしても画面に残るので、使いたいときにすぐ押せます。
• 評価が同点のスポットは投票数の多い順になりました。千人が支持する評価が先に出ます。
• 自分で公開したリストが Explore と検索に表示されるようになりました。これまで見えていなかったのは公開した本人だけでした。
```

## Release notes v1.0.4 (What's New)

Viết từ các PR merge sau build 1.0.3 (20) — #565 → #690, 124 PR. Build native
mới: #545-kiểu lần thứ ba (expo 57.0.24 → 57.0.25 cùng bốn module), nên OTA
không mang được; tag `v1.0.4` cho workflow release. `app.json` đã lên 1.0.4
ở #681 vì Apple đóng train 1.0.3 ngay khi duyệt.

Không có mặt ở đây dù có trong build: mọi PR về Data Desk (#621–#649, guide
grant, blurb source), tracing (#674–#680), test (#619–#629, #677) — người
dùng không thấy. Sketch/deck (#658–#676) gộp thành một dòng vì với người đọc
đó là một thứ: màn hình chờ khi tạo plan.

### EN

```
Three more cities, and a place page you can read at a glance.

• Now in Vung Tau, Melbourne and more of Vietnam — pick a city from the new city sheet, or let the phone choose.
• A place's page shows where it is on a map, with directions one tap away. Photos, hours and address sit in one card.
• Opening hours follow the city's own clock, so a café in Melbourne reads right from anywhere.
• Map pins now show the place's photo, and the day's first stop is marked on the map.
• Planning a trip: watch the day being put together, then swipe through all three ways to spend it before you pick one.
• Works at the smallest text size and the largest: every row fits.
```

### VI

```
Thêm ba thành phố, và trang địa điểm đọc được trong một cái nhìn.

• Có thêm Vũng Tàu, Melbourne và nhiều nơi khác — chọn thành phố trong bảng mới, hoặc để điện thoại tự chọn.
• Trang địa điểm cho thấy chỗ đó trên bản đồ, chỉ đường trong một chạm. Ảnh, giờ mở cửa và địa chỉ nằm chung một thẻ.
• Giờ mở cửa tính theo múi giờ của thành phố, nên quán ở Melbourne hiện đúng dù bạn ở đâu.
• Ghim trên bản đồ giờ là ảnh của địa điểm, và điểm dừng đầu tiên trong ngày được đánh dấu.
• Lên kế hoạch: xem ngày của bạn được ghép lại, rồi lướt qua cả ba cách đi trước khi chọn.
• Vừa vặn ở cỡ chữ nhỏ nhất lẫn lớn nhất: hàng nào cũng đủ chỗ.
```

### JA

```
3都市を追加。スポットのページはひと目で読めるように。

• ブンタウ、メルボルンなどが加わりました。新しい都市シートから選ぶか、端末におまかせ。
• スポットのページに地図が入り、ワンタップで経路案内へ。写真・営業時間・住所は一枚のカードに。
• 営業時間はその街の時計で表示。メルボルンのカフェもどこから見ても正しい時間に。
• 地図のピンはスポットの写真になり、その日の最初の目的地に印がつきます。
• 旅程の作成では、一日が組み立てられていく様子を見てから、3つの過ごし方をスワイプして選べます。
• いちばん小さい文字サイズでも、いちばん大きくても、すべての行が収まります。
```

## Phạm vi phủ — kiểm lại trước mỗi lần nộp

Description và release notes nói về số thành phố, nên chúng là metadata có thể
sai theo thời gian (Apple guideline 2.3 — Accurate Metadata). Tính đến
2026-09-26, database production có **8 thành phố active / 690 địa điểm đã
duyệt**:

| Thành phố | Địa điểm đã publish |
|---|---|
| TP. Hồ Chí Minh | 292 |
| Hà Nội | 237 |
| Đà Nẵng | 64 |
| Đà Lạt | 44 |
| Huế | 31 |
| Melbourne | 14 |
| Vũng Tàu | 8 |
| Hải Phòng | **0** |

Description bản 1.0.4 kể **bảy** — Hải Phòng active nhưng trống, không kể và
phải tắt `is_active` trước khi nộp (một thành phố trống trong city sheet là
thứ reviewer bấm vào đầu tiên). Melbourne 14 địa điểm là mỏng; nếu quyết
không đưa ra thì tắt `is_active` và sửa câu mở đầu về "six cities in
Vietnam" — cả ba bản.

Câu kiểm tra lại:
`select c.id, c.is_active, count(p.*) filter (where p.is_published and p.review_status='approved') from cities c left join places p on p.city_id = c.id group by 1,2 order by 3 desc;`

## Screenshots — bộ 1.0.4

Bộ 7 ảnh của 1.0.3 chụp ngày 19/09 trên build 20, trước khi Place detail
(#589–#607), city sheet (#587), pin ảnh (#604) và màn Sketch (#658–#676)
đổi. Ảnh phải phản ánh app hiện tại (guideline 2.3.3), nên bộ mới chụp
26/09 trên build 1.0.4 (TestFlight preview), iPhone Pro Max 1290×2796 — ASC
nhận cho ô 6.9" và tự scale cho các cỡ nhỏ hơn. Thứ tự đi theo đường người
dùng đi trong app:

| # | Màn | Có gì trong ảnh |
|---|---|---|
| 1 | Explore | hero Sài Gòn, "From the community", nút Open Map |
| 2 | Explore — list | filter Focus, card có sash "Opens 08:00", thanh "Not finding it? / Add" |
| 3 | Explore — map | pin theo màu loại, cụm số, bản đồ Google |
| 4 | Place detail | Eureka 89 (Melbourne) — gallery 6 ảnh, "Why go?" có credit Google, panel local guide, address |
| 5 | Collections | tab Yours, lưới 6 collection |
| 6 | Ideas — Plan a trip | hai place đã chọn, chip Cafés/Focus, ngày + nơi, các bước Sketch đang chạy |
| 7 | Trip | "Slow morning in Hoan Kiem" — lịch trình, quãng đường, Open the route, chi phí |

Ảnh 4 cố ý là một place ở Melbourne — nó làm bằng chứng cho câu mở đầu
Description nói tới Melbourne, và panel local guide trong ảnh là thứ mục
UGC của Notes đã nói trước với reviewer.

Trước khi chụp: tắt hotspot, sạc pin, đăng nhập tài khoản có collection và
trip. Không cần 9:41 — Apple không bắt.

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
