# Review lỗi thường gặp khi chạy Maestro trên iOS

Bản bàn giao hiện tại cho agent: [kết quả test, revision và artifacts](../../docs/testing/e2e-latest.md). Các mục phía dưới giữ lịch sử chẩn đoán, không cộng dồn thành một lượt PASS.

Cập nhật: 20/11/2026. Dùng để chẩn đoán nhanh các lỗi E2E của City Crew trên simulator iOS, đặc biệt khi giao diện vẫn hoạt động nhưng Maestro không tìm thấy phần tử.

Đợt kiểm tra này dùng Maestro 2.10.0, iPhone 17 Pro / iOS 26.5 và Expo Go. Các bản sửa thay đổi test/tài liệu và thêm testID cho hàng SENT và trạng thái danh sách Trips trong app; không đổi logic nghiệp vụ. Kết quả PASS của từng ca không thay thế việc chạy lại toàn bộ suite.

## Tra cứu theo triệu chứng

| Triệu chứng | Kiểm tra đầu tiên | Trường hợp đã gặp |
| --- | --- | --- |
| Không mở được app, nhiều flow lỗi ngay lập tức | Simulator đã boot, Expo Go đã cài xong, Metro có trả `/status` không? | Lượt đầu chạy khi Expo Go chưa cài xong |
| Tap báo COMPLETED nhưng trạng thái không đổi | Selector có khớp nhầm phần tử? Tọa độ tap có đúng hàng? | `00-launch` chạm nhầm switch Fast refresh |
| Nhập xong rồi tap nhưng chỉ thấy bàn phím đóng | Ảnh trước/sau tap; sheet có di chuyển, lựa chọn có được áp dụng không? | `01-explore` chưa chọn Saigon |
| Có dữ liệu nhưng không thấy phần tử đầu tiên | Phần tử nằm dưới section khác, bàn phím hoặc ngoài viewport? | `03-search`: Collections đứng trước Places |
| Thấy ảnh địa điểm nhưng không tìm được ID | Giao diện đang Grid hay List? Hai chế độ có dùng cùng testID không? | `09`, `11`: tile khác list card |
| Thấy đúng tên nhưng selector text không khớp | Đọc toàn bộ accessibility label, không chỉ chữ trên ảnh | `11`: `Maestro CRUD 2, Private` |
| Modal hiện rõ nhưng mọi ID đều mất | Cây accessibility có chỉ còn app và status bar không? | `11`: Save sheet có tree rỗng |
| Nội dung có vẻ đúng nhưng assertion vẫn lỗi | Có system dialog che màn hình không? | `13`: hộp thoại đánh giá Expo Go |

## Quy trình chẩn đoán

1. Chạy riêng flow qua runner của repo; giữ nguyên bản lỗi để có bằng chứng ban đầu.
2. Mở `report.xml`, tìm bước thất bại đầu tiên trong `logs/maestro.log`, rồi xem screenshot và `screen-hierarchy` cùng bước.
3. Đối chiếu selector với testID trong source, accessibility label và bounds thực tế. `tapOn COMPLETED` chỉ xác nhận thao tác đã chạy, không xác nhận kết quả nghiệp vụ.
4. Nếu chưa rõ, tạo flow chẩn đoán trong `.smoke-local/`, chụp trước/sau thao tác hoặc kiểm tra một bước tiếp theo. Không đưa thử nghiệm tạm vào suite chính.
5. Sửa theo nguyên nhân đã quan sát; chờ điều kiện UI cụ thể thay vì tăng timeout hoặc thêm sleep để che lỗi.
6. Chạy lại hai lượt. Khi có trạng thái lưu trên máy, kiểm tra cả trạng thái ban đầu khác nhau; khi có dữ liệu tạo mới, xác nhận cleanup thực sự hoàn tất.

Từ thư mục `app/`:

```sh
xcrun simctl list devices booted
curl -fsS --max-time 3 http://127.0.0.1:8081/status
npm run smoke:ios -- .maestro/03-search.yaml
```

Metro phải trả `packager-status:running`. Nếu chưa chạy, mở terminal riêng và chạy `npx expo start` từ `app/`. Trong lần kiểm tra này, `--localhost` khiến Metro chỉ lắng nghe `::1`, trong khi runner dùng `127.0.0.1`; cần kiểm tra địa chỉ thực tế trước khi quy lỗi cho app. Chờ Expo Go cài xong và mở được bundle trước khi bắt đầu suite.

Artifacts nằm dưới `.smoke-local/maestro/<run>/` tính từ root repo. `latest` trỏ đến lượt mới nhất, kể cả lượt chỉ chạy một ca. Lưu tên thư mục cụ thể khi so sánh kết quả; artifacts này là dữ liệu local, không được Git lưu cùng tài liệu.

## Các cách sửa đã kiểm chứng

### Profile ở gốc nhưng canGoBack trả true

Lượt 19/11 trên `26629da8` có 15/22 flow thất bại; cây giao diện của cả 15 ca đều có thông báo `POP_TO_TOP was not handled by any navigator`. Assert thường báo thiếu `person-account|profile-sign-in`, thẻ địa điểm hoặc collection vì màn hình lỗi đang che nội dung.

`canGoBack()` xét cả navigator cha. Sau khi chuyển từ Explore sang Profile, lịch sử của tab có thể làm nó trả true dù stack Profile có index 0. Dùng giá trị đó làm cờ `pushed` khiến trang khách vẽ nút Back và gọi `popToTop()` tại gốc.

Bản sửa đọc index của stack hiện tại khi xác định `pushed`, đồng thời kiểm tra lại index trước khi pop sau khi kết thúc phiên. Việc kiểm tra lần hai xử lý trường hợp `SessionNavSync` đã reset stack trước effect của màn hình.

Test hồi quy dùng container, TabRouter và StackRouter thật, xác nhận đồng thời `canGoBack() === true` và `index === 0`. Trang khách phải hiển thị, không có nút Back và không phát sinh action bị từ chối. Test này thất bại khi khôi phục cách xác định `pushed` cũ. Một test riêng kiểm tra stack đã được reset trước effect.

Bài học khi mock navigation: giữ độc lập lịch sử navigator cha và độ sâu stack hiện tại. Khi nhiều flow cùng mất selector, xem screenshot và thông báo điều hướng trước khi sửa selector.

Kiểm chứng ngày 20/11 trên bản sửa từ `4e352385`: 143 test liên quan đạt; TypeScript và ESLint đạt. Maestro `04-sign-in`, `07-sign-up-delete`, `09-collections-browse` đạt trong lượt `20261120-032436`; `04` đạt thêm lượt `20261120-033154`. Runner xác nhận tài khoản signup tạm đã bị xóa. Chưa chạy lại toàn bộ 22 flow trên bản sửa.

### Bổ sung ưu tiên 2: kết thúc phiên khi các tab còn lịch sử

Ngày 20/11/2026, bổ sung hai ca integration cho **đăng xuất** và **xóa tài khoản**. Dùng container, TabRouter, StackRouter và `SessionNavSync` thật; mở detail ở Explore, mở Account ở Profile, chuyển tab qua lại rồi bấm nút kết thúc phiên trên màn hình thật. Sau đó kiểm tra Profile về guest root, không có Back, Explore về root và không có action điều hướng bị từ chối qua hai vòng chuyển tab.

**Bài học:** test tab phải giữ navigator của tab không được chọn ở trạng thái mounted. Nếu chỉ render tab đang chọn, test có thể vô tình xóa lịch sử bằng unmount, che lỗi reset stack. Cần kiểm tra cả stack của tab đang mở và stack được giữ ở tab khác. Backend auth và phần trình bày Person/Explore được mô phỏng; các ca này kiểm tra hợp đồng điều hướng khi phiên kết thúc, không chứng minh thao tác xóa trên backend.

Kiểm chứng: tạm bỏ `SessionNavSync` khỏi harness khiến cả hai ca mới thất bại tại assertion Explore phải về root. Khôi phục component và chạy lại **162 test trên 6 file đều đạt** (Profile, Me, DeleteAccount, authNavigation, sessionNavSync, sessionNav); TypeScript, ESLint và diff check đạt. Thay đổi lần này chỉ gồm test và tài liệu; không chạy lại Maestro, kết quả simulator của ưu tiên 1 được ghi riêng ở trên.

### 00-launch chọn nhầm switch Expo Go

**Dấu hiệu:** app đã hiện `tab-explore`, nhưng `gearshape.fill` vẫn còn sau Reload.

**Nguyên nhân xác định thêm khi tái hiện:** selector `text: "1"` kết hợp `rightOf: Tools button` còn khớp switch Fast refresh phía trên. Log lần lỗi chọn bounds của Fast refresh. Cảnh báo tọa độ không ổn định là manh mối, nhưng chỉ thêm chờ animation không giải quyết việc khớp nhầm switch.

**Cách sửa:** trong [expo-go-prep.yaml](common/expo-go-prep.yaml), chờ menu ổn định sau cuộn, thêm `below: Fast refresh` vào selector switch, kiểm tra giá trị `0` của đúng switch trước Reload, rồi xác nhận bánh răng biến mất.

**Kiểm chứng:** PASS khi Tools button ban đầu ON và khi đã OFF. Chạy lại khi nút đã OFF chỉ kiểm tra nhánh bỏ qua, không chứng minh nhánh ON → OFF hoạt động.

### 01-explore kết thúc nhập trước khi chọn thành phố

**Dấu hiệu:** sau nhập `saigon`, tap hàng Saigon chỉ đóng bàn phím và hạ sheet xuống. Sheet vẫn mở; chạm lần nữa khi bàn phím đóng thì chọn được thành phố.

**Cách sửa test:** [01-explore.yaml](01-explore.yaml) dùng `pressKey: Enter`, chờ animation kết thúc, tìm lại hàng theo ID rồi tap. Sau đó chờ `city-search` biến mất trước khi kiểm tra danh sách địa điểm.

**Cách thử không hiệu quả:** `hideKeyboard` đóng cả bottom sheet trên simulator này. Không áp dụng nó máy móc cho mọi màn hình.

**Giới hạn kết luận:** app đã có `keyboardShouldPersistTaps="handled"`. Quan sát trên Maestro không đủ để kết luận handler nào trong app có lỗi. Bản sửa test đạt hai lượt, không thay đổi app; hành vi chạm khi bàn phím mở không được kiểm chứng bởi flow sau sửa.

### 03-search kết quả đầu tiên chưa nằm trong viewport

**Dấu hiệu:** tìm `cafe` có dữ liệu nhưng chỉ thấy Collections và bàn phím. Test chờ `search-result-0` trước cả bước đóng bàn phím nên hết thời gian.

**Cách sửa:** [03-search.yaml](03-search.yaml) nhấn Enter ngay sau nhập, chờ ổn định, dùng `scrollUntilVisible` để tìm `search-result-0` phía dưới Collections rồi mở chi tiết. Không đổi từ khóa để né dữ liệu, không bỏ assertion.

### 09 và 11 phân biệt Grid với List

Danh sách bộ sưu tập và trang chi tiết có quy ước ID khác nhau:

| Màn hình | Layout | ID |
| --- | --- | --- |
| Danh sách bộ sưu tập cộng đồng | Grid hoặc List | `collection-card-0` |
| Địa điểm trong chi tiết bộ sưu tập | Grid | `collection-tile-0` |
| Địa điểm trong chi tiết bộ sưu tập | List | `collection-place-0` |

**Cách sửa:** [09-collections-browse.yaml](09-collections-browse.yaml) và [11-collection-crud.yaml](11-collection-crud.yaml) mở `collection-more`, chọn `collection-menu-grid`, chờ menu đóng, rồi dùng `collection-tile-0`.

Trong CRUD, cả kiểm tra sau thêm và sau bỏ địa điểm phải dùng ID của layout đã chọn. Kiểm tra “không thấy list card” trong Grid sẽ tạo PASS giả dù địa điểm vẫn còn.

Ca `09` đã PASS cả khi ban đầu lưu Grid và khi ban đầu lưu List. Đây là coverage của luồng duyệt ở Grid, không phải coverage mở địa điểm ở cả hai layout.

### 11 nhãn thẻ gộp thêm trạng thái hiển thị

**Dấu hiệu:** thẻ hiện tên “Maestro CRUD 2”, nhưng `text: "Maestro CRUD 2"` không tìm được.

**Bằng chứng:** hierarchy trả `Maestro CRUD 2, Private` dưới một accessibility element.

**Cách sửa:** dùng `Maestro CRUD 2(,.*)?` ở hai bước tìm/mở thẻ sau khi thêm địa điểm. Giữ tiền tố tên chính xác để tránh chọn bộ sưu tập khác. Tên này là dữ liệu test, không phải nhãn UI cần dịch. Các label UI thông thường vẫn ưu tiên testID.

### 11 modal hiện nhưng accessibility tree rỗng

**Dấu hiệu:** screenshot hiển thị Save sheet có “Maestro CRUD 2”, “Maestro smoke” và Done; hierarchy chỉ có Expo Go/status bar, không có các control của modal.

**Cách xử lý đã kiểm chứng:** mở lại app bằng `common/start.yaml` sau tạo/đổi tên, trước khi mở địa điểm và Save sheet. Bộ sưu tập và phiên đăng nhập được giữ lại. Test vốn đã mở lại app sau cleanup có system alert.

Đây là cách ổn định phiên test đã kiểm chứng trên môi trường này; nguyên nhân nội bộ của iOS/XCUITest chưa được xác định. Không thay testID hay chuyển sang tọa độ cố định khi toàn bộ modal đã biến mất khỏi hierarchy. Chỉ thêm restart ở ranh giới có bằng chứng cần thiết, không khởi động lại sau mọi thao tác.

## Kết quả kiểm chứng ngày 27/10/2026

Tên thư mục dưới `.smoke-local/maestro/`; mỗi thư mục có `report.xml` và log tương ứng. Thời lượng làm tròn theo CLI.

| Ca | Hai lượt PASS | Điều kiện kiểm tra |
| --- | --- | --- |
| `00-launch` | `20261027-050258` — 39s; `20261027-050402` — 24s | Tools button ON rồi OFF |
| `01-explore` | `20261027-051339` — 49s; `20261027-051452` — 49s | Chạy liên tiếp, trạng thái thành phố được lưu |
| `02-place-detail` | `20261027-083610` — 29s; `20261027-083706` — 34s | Cuộn đến địa chỉ; lượt thứ hai ngay sau `01` chọn Saigon |
| `05-plan-trip` | `20261027-091719` — 1m33s; `20261027-091919` — 1m27s | Có chuyến đi sót chủ động tạo, rồi trạng thái sạch |
| `03-search` | `20261027-071904` — 58s; `20261027-072026` — 56s | Tìm, mở chi tiết, Back, xóa query, Cancel |
| `09-collections-browse` | `20261027-072406` — 52s; `20261027-072604` — 49s | Bắt đầu từ Grid và từ List |
| `11-collection-crud` | `20261027-073458` — 3m16s; `20261027-073837` — 2m29s | Có dữ liệu sót rồi trạng thái sạch; cả hai kết thúc bằng xóa bộ sưu tập test |

Các lệnh kiểm tra sau sửa, chạy từ `app/`:

```sh
# Nếu JAVA_HOME hiện tại quá cũ, dùng JDK 17+ cho Maestro.
JAVA_HOME=$(/usr/libexec/java_home -v 17+) maestro check-syntax .maestro/11-collection-crud.yaml
npx vitest run scripts/maestroIds.test.ts
git diff --check
```

Kiểm tra testID chỉ chứng minh ID có trong source, không chứng minh nó đang hiện trên simulator hoặc đúng layout. Số lượng kiểm tra thay đổi theo tập selector của suite; dùng kết quả hiện tại, không cố định số test làm tiêu chí.

## Bài học bổ sung khi xử lý các ca còn lại

### 17 không dùng nội dung mô tả làm trạng thái nghiệp vụ

Source `CrewScreen` xác nhận câu “waiting on their answer” đã được bỏ khỏi hàng SENT ngày 26/10 và chỉ còn trong sheet Cancel. Lời mời gửi thành công vẫn có thể làm assertion theo câu này thất bại. Bản sửa thêm `crew-sent-<index>` cho hàng outgoing và kiểm tra ID đó; giữ bước B chấp nhận và kiểm tra danh sách bạn bè. Không khôi phục copy cũ chỉ để test xanh. PASS toàn bộ ở `20261027-074454` (4m20s) và suite trên ổ trong `20261027-084207` (3m57s), gồm B chấp nhận lại và cleanup đăng xuất.

### 13 hộp thoại hệ thống xuất hiện sau thao tác thành công

`askReview.ts` gọi native review sau khi lưu thành công, có độ trễ 1.5 giây và giới hạn theo phiên bản/lịch sử. Dialog có thể không xuất hiện ở lượt chạy lại. Bản sửa xử lý “Not Now” trước khi kiểm tra giờ; PASS khi không có dialog chỉ xác nhận nhánh không xuất hiện. Giữ assertion giờ trước/sau cold start, không bỏ assertion hoặc đánh giá app để đóng dialog. PASS `20261027-075010` (2m19s): reset riêng memo `citycrew.review` khi Expo Go đã dừng để đạt ngưỡng nhắc; log xác nhận tap “Not Now” thực sự chạy, cả hai assertion giờ và cleanup đều hoàn tất. Thêm cuộn đến `trip-stop-time-0` trước assertion để không phụ thuộc vị trí viewport. Lượt trên ổ trong `20261027-084207` PASS lần hai (1m59s), log xác nhận nhánh “Not Now” SKIPPED; đã kiểm chứng cả có và không có dialog.

### 02 nội dung động làm thay đổi vị trí địa chỉ

Lượt toàn suite `20261027-075308` thất bại ở `detail-address`. Screenshot hiển thị XLIII Specialty Coffee và đoạn Highlights dài; source đặt địa chỉ sau nội dung này, hierarchy tại đầu trang chưa có địa chỉ. Assertion ngay sau tên/ảnh giả định địa chỉ luôn trong viewport nên phụ thuộc dữ liệu địa điểm đầu tiên. Bản sửa cuộn DOWN đến `detail-address`, giữ assertion, rồi cuộn UP đến Back. PASS riêng `20261027-083610` (29s) và trong suite `20261027-083706` (34s), ngay sau `01` khôi phục Saigon. Không kết luận app thiếu địa chỉ chỉ từ assertion ngoài viewport.

### Môi trường: `/status` xanh nhưng Metro mất thư mục làm việc

Giữa suite `20261027-075308`, ổ T7 trả `Input/output error` cho file log đang mở; Metro báo `ENOENT: process.cwd` và không thấy `package.json`, dù file hiện vẫn tồn tại và tạo/đọc file mới được. `/status` vẫn trả `packager-status:running`. Các flow từ `13` trở đi bị ảnh hưởng, không dùng kết quả đó để kết luận regression của app. Chưa xác định nguyên nhân thiết bị/mount; dấu hiệu cho thấy các tiến trình cũ đã mất truy cập thư mục làm việc. Dừng runner/Metro cũ, khởi động Metro mới từ đường dẫn hiện tại và chạy lại để xác minh. Lỗi I/O tái diễn ở lượt `20261027-083706` sau `00–03` PASS. Chuyển bản sao nguyên trạng của app và dependencies sang `/private/tmp/citycrew-maestro-20261027/` trên ổ trong để kiểm chứng độc lập với T7. Bài học: health endpoint chỉ chứng minh server trả lời, không chứng minh bundle còn tải được; đối chiếu lỗi filesystem và log Metro trước khi sửa selector.

### 05 chờ refresh dữ liệu sau xóa, không chỉ animation/tab bar

Lượt `20261027-084207` trên ổ trong phát hiện cleanup xóa chuyến đi sót thành công, rồi vào vòng lặp lần hai và lỗi tìm `trip-upcoming-0`; screenshot đã là “No trips yet”. Source gọi `goBack()` rồi `trips.reload()`, trong khi `tab-trips` có trên cả trang chi tiết. Chờ tab bar/animation không chứng minh danh sách đã nhận kết quả mạng. Bản sửa thêm testID `trips-ready` trên danh sách khi hết loading, không dùng cache và không lỗi; helper xóa chờ `trip-delete` biến mất rồi chờ `trips-ready`. PASS `20261027-091719` (1m33s) với chuyến đi sót chủ động tạo bởi flow local `20261027-091513`; log xác nhận cả chờ rời detail và `trips-ready` sau xóa chạy thành công. PASS tiếp `20261027-091919` (1m27s) từ trạng thái sạch; cả hai lượt kết thúc không còn `trip-upcoming-0`. Không thêm sleep hoặc cho tap tùy chọn để nuốt lỗi.

## Kết quả cuối và giới hạn kiểm chứng

- Suite đầy đủ trên ổ trong `20261027-084207`: **16/17 PASS**, một lỗi cleanup `05` phát hiện và sửa sau lượt này. Không gọi report này là suite xanh.
- `05` sau sửa: **hai lượt PASS** (`20261027-091719`, `20261027-091919`), lần đầu có chuyến đi sót, lần sau sạch. Như vậy cả **17 flow tự động đã có PASS qua các lượt kiểm chứng**; chưa chạy lại toàn suite sau thay đổi helper cleanup cuối cùng.
- `13` PASS cả khi có và không có native review dialog; `17` PASS hai lượt, đã khôi phục bạn bè. Các chuyến đi/bộ sưu tập CRUD của các lượt thành công đã cleanup.
- **190 kiểm tra PASS**: `scripts/maestroIds.test.ts`, `TripsScreen.ui.test.tsx`, `CrewScreen.ui.test.tsx`. Cú pháp các flow sửa và `git diff --check` đạt.
- Ở đợt kiểm tra 17 flow phía trên, `07-sign-up-delete` còn là manual QA. Ca này đã được tự động hóa ở phần bổ sung lifecycle bên dưới; không tính ngược vào kết quả cũ.
- Artifacts các lượt chạy trên ổ trong đã sao chép về `.smoke-local/maestro/` của workspace. T7 vẫn cần được kiểm tra riêng nếu lỗi I/O tái diễn; chưa xác định được nguyên nhân phần cứng/mount.

## Cách bổ sung review cho lỗi mới

Ghi: flow và bước lỗi → screenshot/hierarchy/log liên quan → điều đã xác nhận và điều còn giả thuyết → cách sửa → cách thử không hiệu quả → trạng thái trước/sau chạy → các thư mục kết quả PASS. Không ghi mật khẩu, token hoặc sao chép toàn bộ debug log chứa thông tin tài khoản vào tài liệu Git.

Xem thêm [GUIDELINES.md](GUIDELINES.md) để viết flow và [README.md](README.md) để chạy suite.

## Bổ sung lifecycle đăng ký/xóa tài khoản (27/10/2026)

- Server đã xác nhận `mailer_autoconfirm=true` qua auth settings; flow đi thẳng từ form sang chọn sở thích, không đợi email/code.
- Không dùng email ngẫu nhiên không truy vết được: runner tạo `maestro-e2e-<UUID>@example.com` và mật khẩu riêng, ghi ledger local quyền 0600 trước khi UI tạo tài khoản. Không ghi password/token vào review.
- Flow kiểm tra phiên sau cold start, xác nhận tên tài khoản trên màn hình xóa, xóa qua UI, thử đăng nhập lại phải lỗi, rồi cold start vẫn là guest.
- Cleanup dự phòng dùng chính credential của fixture để gọi `delete-account`; không dùng service-role. Nếu phải cleanup một tài khoản còn sống sau flow, runner vẫn trả lỗi để không che lỗi UI. Lỗi mạng/rate limit không được coi là “đã xóa”; giữ ledger để lần chạy tiếp theo retry trước khi tạo account mới.
- SIGINT/SIGTERM/EXIT được xử lý; SIGKILL, mất điện hoặc mạng hỏng vẫn có thể để lại account tạm. Ledger giúp cleanup ở lần chạy tiếp theo, không có cam kết tuyệt đối cleanup ngay khi tiến trình/mạng đã mất.
- 108 kiểm tra (8 cleanup + 100 testID) PASS; cú pháp flow và shell đạt. Typecheck repo đang lỗi ngoài phạm vi ở `scripts/hant.ts`: thiếu module `opencc-js/cn2t`.
- Trạng thái ban đầu: flow chưa bật vì AutoFill. Kết quả kiểm chứng và trạng thái bật suite được cập nhật ở cuối mục này.

Bài học triển khai cleanup: response GoTrue thực tế là `{code: 400, error_code: "invalid_credentials"}`; không coi mọi HTTP 400 là account đã mất. Chỉ nhận mã lỗi định danh cụ thể. Bash macOS với `set -u` cũng báo lỗi khi expand mảng rỗng; danh sách biến signup tùy chọn phải dùng expansion có guard để không làm hỏng các flow khác.

Đính chính thử nghiệm `20261027-093256`: assertion OFF ban đầu đã khớp nhầm switch **Delete After Use** phía dưới. Screenshot `20261027-093527` xác nhận Suggest Strong Passwords và AutoFill đều vẫn ON. Tap theo ID hàng chạm giữa hàng, không phải nút switch bên phải. Không đủ bằng chứng kết luận tắt riêng Suggest Strong Passwords không hiệu quả. Sửa bằng tap giá trị của switch ở bên phải nhãn, giới hạn cả above/below để không khớp switch khác. Lượt `20261027-092634` trước đó cũng thất bại ở form; cleanup không tìm thấy session hợp lệ cho fixture.

Lượt `20261027-093708` sau selector switch đúng đã có mật khẩu (hierarchy là dấu bullet), nhưng confirm rỗng và mật khẩu dài gấp đôi đầu vào: tap confirm khi bàn phím còn mở không đổi focus, lần nhập sau nối vào ô đầu. Sửa bằng Enter kết thúc ô đầu, chờ animation rồi cuộn/tap confirm. Không nhầm lỗi focus này với email verification hay lỗi tạo tài khoản backend.

Lượt `20261027-093941` đã đăng ký thành công, qua taste/welcome và giữ phiên sau cold start. Xóa qua UI cũng thành công (backend từ chối credential, không cần fallback delete), nhưng Profile giữ vị trí cuộn cuối trang nên không thấy nút Sign in ở đầu. Sửa test: chờ màn hình xóa biến mất rồi cuộn UP tới `profile-sign-in`, thay vì chỉ kéo dài timeout.

Settings cũng có animation sau launch/cuộn: lượt `20261027-094307` tap “General” khi vị trí hàng chưa ổn định đã mở Siri. Helper sau thêm `waitForAnimationToEnd` ở launch và trước tap đã PASS riêng (`.smoke-local/signup-settings-check`), nhánh switch đã OFF được bỏ qua đúng.

**PASS lifecycle** `20261027-094524` (3m23s): đăng ký không verify email, cold start vẫn signed in, xóa đúng tên fixture qua UI, credential bị từ chối trong UI, cold start guest; backend cleanup xác nhận credential không đăng nhập được và không phải fallback delete. `07` đã bật vào config (suite hiện có 18 flow); kết quả 17 flow ở phần trước là lịch sử trước khi bổ sung ca này.

**PASS cleanup dự phòng qua backend thật:** tạo fixture riêng với session tức thì, để nguyên account trong ledger rồi gọi cleanup. Helper đăng nhập đúng email fixture, gọi own-account `delete-account`, xác nhận `invalid_credentials`, xóa ledger và trả exit 2 đúng thiết kế. Không dùng service-role/admin và không tạo chuyến đi/bộ sưu tập cho fixture này.

**PASS lần hai** `20261027-095007` (3m22s), tiếp sau `20261027-094524` (3m23s). Cả hai lượt hoàn tất xóa UI, auth-error khi dùng lại credential, cold start guest và backend verification; không cần fallback delete. 108 kiểm tra (8 cleanup + 100 testID), lint các script thay đổi, cú pháp Maestro và shell đều đạt. Chưa chạy lại toàn bộ suite 18 flow sau bổ sung này.

Kiểm tra cuối: ledger `.smoke-local/signup-accounts/` không còn file pending sau hai lượt PASS và lần thử cleanup survivor. Runner cũng được chạy lại với `00-launch` (không có biến signup) để kiểm tra nhánh mảng rỗng của Bash.

## Review follow-up: identity and trip lifecycle (27 October 2026)

- **Có session không có nghĩa đúng account.** Helper cũ giữ cả session B nếu một run bị dừng giữa chừng. Helper mới đăng nhập danh tính được yêu cầu và đọc lại `profile-email`; trip flow dùng tài khoản UUID riêng của run.
- **Không xóa dữ liệu bất kỳ để làm sạch baseline.** 05/13/16 bỏ vòng lặp xóa upcoming trips. Runner tạo cặp account tạm, ghi ledger trước signup, thiết lập và đọc lại friendship bằng session từng phía. Flow bắt buộc baseline rỗng, chỉ thao tác trip duy nhất vừa tạo. Teardown xóa đúng generated account, không có service-role key.
- **Tab bar không chứng minh đã refresh.** Kiểm tra `trips-ready` và empty state sau cold start ở cả A/B. 16 dùng trip thứ hai để kiểm tra Leave, rồi A vẫn giữ trip với trạng thái Can’t make it. Không dùng thao tác rời trip trước kiểm tra cascade vì như vậy B đã mất quyền xem từ trước.
- **Maestro nội suy `${...}` và regex có `{36}`:** lần chạy đầu báo SyntaxError vì biểu thức bị cắt tại dấu `}` của quantifier. Dùng `RegExp` không có brace trong YAML; kiểm tra định dạng fixture chặt chẽ vẫn nằm ở helper Node.
- **Có tab bar không có nghĩa đã về đầu Profile.** Sau khi cuộn xuống Sign out, `scrollUntilVisible(tab-profile)` có thể kết thúc ngay do tab bar đã hiện. Email vẫn ở phía trên; bước đọc `profile-email` phải cuộn UP. Lượt thử đầu bước này fail trước khi tạo trip.
- **Empty state có hai loại:** `trips-none-ahead` chỉ có khi vẫn còn trip quá khứ; account mới dùng `FirstTrip`. Thêm `trips-empty` vào đúng state này. `trips-ready` phải đợi cả trips và invitations để không nhận nhầm trạng thái rỗng khi lời mời chưa tải xong.
- Kiểm chứng tự động: **243 test PASS** (fixture setup/recovery, signup cleanup, Maestro IDs, Profile UI, Trips UI); ESLint, shell/Node syntax và diff check PASS. Typecheck vẫn fail ở import `opencc-js/cn2t` trong `scripts/hant.ts:24` như trước.
- Simulator run `20261027-141135`: **3/3 Maestro flows PASS** — `05` 2m39, `13` 4m35, `16` 19m53. 16 xác nhận A xóa → cold start cả A/B đều rỗng, rồi trip khác B Leave → B restart vẫn rỗng và A còn trip với Can’t make it.
- **Không sửa shell script đang chạy.** Trong run trên, sửa dòng log của `smoke.sh` khi Bash đang chờ Maestro khiến phần đọc tiếp của shell báo unexpected EOF dù `bash -n` trên file mới vẫn PASS. Runner exit 2 sau khi Maestro đã PASS; EXIT trap vẫn cleanup thành công, ledger còn 0. Đây là lỗi thao tác kiểm chứng, không phải lỗi app. Chạy lại `05` với script giữ nguyên: run `20261027-143939` **PASS 2m35, runner exit 0**, teardown PASS. Sau run, ledger credentials còn **0**, không còn lock.


## Guest resume và quyền riêng tư collection (27/10/2026)

- `leaveAuth` có hai hợp đồng: bookmark giữ callback để mở lại SaveSheet; guest lưu trip chỉ giữ tab/draft và cần người dùng bấm Save sau đăng nhập. Helper đăng nhập bình thường kiểm tra Explore rồi chuyển Profile, nên không thể dùng nguyên helper đó để kiểm tra resume. Tách `submit-sign-in.yaml`; caller phải kiểm tra đích đến và kết quả lưu thuộc đúng tài khoản tạm.
- `fetchCollections` lọc `is_public=true` ở client. Không thấy collection trên UI chưa đủ chứng minh RLS: query trực tiếp bằng ID, không lọc owner/is_public, bằng session B để kiểm tra cả collections và collection_places; HTTP lỗi phải fail, không được hiểu là danh sách rỗng. Kiểm tra A vẫn sở hữu collection tránh false pass vì fixture bị mất.
- Menu ⋯ vẫn có ở collection của người khác (copy/share/layout). Kiểm tra không có Edit/Delete trong menu, không assert toàn bộ menu biến mất.
- Lượt `20261027-164058` bị chặn tại launch: Expo Go simulator không tương thích bundle SDK 58. Chưa chạy tới hành vi mới, không phân loại là app regression. Cài đúng Expo Go cho SDK trong package lock trước khi retry; không hạ dependency app để làm test qua.

Lượt `20261027-164401`, flow 18 fail trước đăng nhập: `open-save-sheet.yaml` có hậu điều kiện `save-done`, chỉ đúng cho signed-in reader có collection. Guest đúng ra mở AuthSheet. Sửa flow guest bấm `detail-save` trực tiếp rồi chọn `auth-sheet-cancel`/`auth-sheet-sign-in`; không nới timeout hoặc sửa hành vi app.

Flow 19 **PASS** trong `20261027-164401` (8m13s): Private → Public → Private qua UI A, B tìm kiếm Community sau đổi session; Public mở được detail và không có Edit/Delete. REST bằng session A/B kiểm tra collection và membership theo ID ở cả ba trạng thái. Đây là PASS riêng của 19; toàn lượt vẫn có lỗi test 18 kể trên, chưa kết luận toàn bộ nhóm đạt.

Flow 20 ở `20261027-164401` fail tại `plan-stop-name-0`: hierarchy `step-082` có nút “Open Maison Marou – Nhà Thờ” nhưng không có Text con/name ID; time ID vẫn có. Native accessibility gộp Text trong Pressable có label. Chuyển `nameTestID` lên Pressable thay vì Text; `copyTextFrom` so sánh nhãn đầy đủ của cùng địa điểm trước/sau auth. Flow cũng đổi giờ đến −15 phút trước khi ghi nhận, để chứng minh trạng thái chỉnh sửa được giữ. Không sửa semantics hoặc tắt accessibility grouping.

Flow 18 ở `20261027-165650` qua cancel → ordinary login (không replay), rồi guest login mở lại SaveSheet. Fail ở so sánh tên: detail dùng `splitName(...).title`, SaveSheet có tên đầy đủ “InBook International Bookstore – Ba Đình”. Không bỏ phần chi nhánh khi so sánh vì sẽ nhầm hai địa điểm cùng thương hiệu. Sửa chọn một địa điểm published cụ thể qua Search và kiểm tra slug ở detail, SaveSheet và membership backend. Query tìm kiếm được bỏ dấu để nhập bằng Maestro; danh tính vẫn là slug, không phải kết quả vị trí 0.

Flow 20 ở `20261027-165650` đã trở về đúng bản nháp sau auth, screenshot `step-102` cho thấy Maison Marou và giờ đã sửa 17:45. Fail vì test đợi `plan-save` ở footer trong khi navigation đưa viewport về đầu trang. Sửa hậu điều kiện thành stop đầu tiên, so tên/giờ, kiểm tra Trips còn rỗng, rồi cuộn tới Save khi thực sự cần bấm. Không tăng timeout cho một phần tử đang ngoài viewport.

Flow 18 **PASS** ở `20261027-170343` (3m04s): cancel không replay khi ordinary sign-in; lần bookmark tiếp theo tìm đúng địa điểm published qua Search/Hanoi, kiểm tra slug trên detail và SaveSheet sau auth, lưu đúng một membership có slug đó; cold start không tự mở lại sheet và dữ liệu vẫn còn. Không lấy tên rút gọn làm định danh.

Flow 20 **PASS** ở `20261027-170343` (4m00s): giữ đúng stop đầu và giờ −15 phút sau auth; Trips vẫn rỗng; kiểm tra email phiên đăng nhập đúng fixture A; bấm Save mới có đúng một chuyến; cold start rồi xóa chuyến, Trips trở lại rỗng. Toàn lượt 18+20 PASS, runner exit 0 và cleanup cả hai tài khoản thành công.

Kiểm tra âm phải có mốc dương: trước `assertNotVisible` Edit/Delete ở menu B, đợi `collection-menu-grid` xuất hiện. Nếu menu không mở/không có accessibility tree thì test phải fail, không được coi hai nút vắng mặt là chứng minh phân quyền.


### Kết quả xác nhận cuối

`20261027-171119`: **18 PASS 3m07s, 19 PASS 8m37s, 20 PASS 4m01s**; tổng 15m45s, runner **exit 0**. Mỗi flow mới đã PASS hai lần liên tiếp (đối chiếu các lượt riêng ở trên). Lượt cuối có kiểm tra menu đã mở trước assertion âm và kiểm tra email phiên sau guest trip resume. Cleanup xóa cả hai tài khoản; kiểm tra sau runner: **0 JSON credential records**, **không còn lock**.

**509 unit/UI tests liên quan PASS** trên 10 file test (fixture/cleanup, oracle RLS, testID, AuthSheet, SaveSheet, StopCard, Collections, PlanEdit, PlaceDetail). ESLint, TypeScript, `maestro check-syntax` cho cả ba flow, `bash -n` và diff whitespace check đều PASS. Typecheck trong worktree cài dependency đúng lockfile hiện chạy được; lỗi `opencc-js/cn2t` được ghi ở các lượt cũ không còn tái hiện trong môi trường này.

Config hiện có 21 flow. Chưa chạy lại toàn bộ suite sau đợt bổ sung này; các số PASS ở trên chỉ áp dụng cho phạm vi được nêu.

## Chạy lại main sau merge — 28/10/2026

Commit kiểm tra: `124a89af66461a0bb6fb05a7378517d53afb54e4`, iPhone 17 Pro / iOS 26.5 / Expo Go SDK 58. Lượt toàn suite: `20261028-172847`.

**11-collection-crud: selector tên collection rỗng cũng phải tính nhãn gộp.** Flow fail sau Create ở `scrollUntilVisible(text: "Maestro CRUD")`, không phải Create thất bại. Screenshot `11-collection-crud/screenshots/step-065-scrollUntilVisible-Maestro_CRUD.png` thấy collection mới; hierarchy cùng step có `accessibilityText: "Maestro CRUD, Private"`. Source `CollectionsScreen.tsx` đặt accessibilityLabel gồm title + visibility cho card sở hữu ở Grid. Flow đã xử lý suffix ở đoạn collection có place, nhưng chưa xử lý đoạn ngay sau tạo/đổi tên.

Bài học: một bản sửa selector phải rà cả trạng thái empty/populated và layout List/Grid, vì layout được ghi nhớ giữa các lượt. Không tăng timeout cho chuỗi không khớp. Ưu tiên testID theo ID collection; nếu dùng tên fixture, match trọn nhãn với suffix có giới hạn và vẫn xác nhận đúng collection. Chưa sửa test/app trong lượt audit này; kết quả kiểm chứng bổ sung sẽ ghi riêng sau khi có bằng chứng.

## 14/11/2026 · main cafd3218 · iPhone 17 Pro, iOS 26.5

Suite `20261114-211304`: **19/22 đạt**, JUnit 4630,893 giây. Cùng code/test khi retry; chỉ đổi cổng Metro cho toàn lượt để tránh checkout khác trên 8081.

- **02-place-detail:** step 020 chờ `place-card-0` trước khi mở detail. Hierarchy có “You’re offline. Showing what was saved.”, không có card đầu. Hai lượt chạy riêng `20261114-223110` (30s) và `20261114-231032` (31,5s) đều đạt; chưa xác định nguyên nhân phía mạng/backend. Khi báo lỗi, ghi cả trạng thái tải danh sách, không quy lỗi cho màn hình chưa mở.
- **11-collection-crud:** step 065 thấy nhãn card `Maestro CRUD, New, Private` sau Create, trong khi flow tìm nguyên chuỗi `Maestro CRUD`. Đây là biến thể mới của lỗi nhãn gộp tháng 10. Ưu tiên định danh card ổn định; không tăng timeout. Rename, thêm/bỏ place và Delete chưa được kiểm trong lượt này. Đã dọn và xác nhận không còn đúng collection rỗng do lượt này tạo.
- **17-unfriend:** step 039 đã ở Profile có dữ liệu tài khoản, helper đòi tab Explore được chọn. Lỗi trước thao tác unfriend. Retry `20261114-223203` đạt và khôi phục friendship; chưa xác định tại sao đích điều hướng khác nhau. Theo dõi auth return và tab thực sự chọn trước khi thay assertion.
- 07 signup/delete, 16 invite/delete/leave, 18/20 guest resume, 19 privacy và 21 tab responsive đều đạt. Runner xác nhận cleanup, không còn credential ledger hoặc lock. Không sửa source hay test để làm lượt này đạt.

**Kiểm chứng bản sửa 11 (14/11):** Matcher card mới khớp đúng tên fixture và phần metadata bắt đầu bằng dấu phẩy; cleanup chỉ khớp hai tên fixture, không xóa collection chỉ vì trùng tiền tố. Maestro check-syntax OK. Hai lượt riêng liên tiếp `20261114-224647` và `20261114-225010` đều PASS đến bước xác nhận xóa trên Yours. Không thay code app.


## Chạy lại 15 ca lỗi sau sửa Profile — 20/11/2026

Lượt `20261120-035122`, commit `7ebbea9c`: **10 PASS / 5 FAIL**. PASS: 04, 09, 10, 11, 12, 15, 17, 18, 19, 21. FAIL: 05, 06, 13, 16, 20.

**Common error: bấm tab không bảo đảm về root.** Cả năm ca fail ở `common/open-account.yaml`, đợi `person-account|profile-sign-in` trong khi hierarchy có `account-back` và `profile-email`. Stack Account được giữ khi chuyển tab; helper cần nhận cả trạng thái đang ở Account. Không có `POP_TO_TOP` tại các điểm lỗi này. 05/13/16 fail ở đăng xuất cuối, 20 fail khi chuẩn bị guest trước phần resume. Chưa sửa helper trong lượt này.

**Common error: URL trong YAML lấn override của runner.** Log lượt `034446` mở 8081 dù runner truyền 8084. Lượt chính dùng bản sao flow chỉ thay cổng thành 8084, giữ nguyên assertion. Khi chẩn đoán phải đọc URL thực tế ở `Maestro.openLink`, không chỉ kiểm tra Metro /status.

**Hạ tầng:** runner ở checkout khác gây DeviceUnreachable trước lượt chính; lock cục bộ từng checkout không ngăn tranh simulator. Sau cùng ổ đĩa hết chỗ khiến report.xml không tạo được. Kết quả được đối chiếu console “5/15 Flows Failed” và commands.json của cả 15 ca; ca 12 hoàn tất assertion cuối. Nén log riêng lượt chạy, kiểm chứng nội dung giải nén, giải phóng khoảng 1.3 GB. Cần kiểm tra dung lượng trước suite dài và lock simulator chung. Không quy thời gian chờ driver/cold start thành hiệu năng app.

Cleanup tài khoản fixture thành công, không còn JSON ledger/lock của lượt này. Chi tiết và bằng chứng ở `.smoke-local/maestro/20261120-035122/summary.md` (local, không commit artifacts).


### Bản sửa helper Account và kiểm chứng — 20/11/2026

`common/open-account.yaml` nhận ba trạng thái sau khi bấm Profile: `person-account` (trang cá nhân), `account-back` (Account đang mở), `profile-sign-in` (guest hub). Chỉ bấm nút Account ở trang cá nhân; mọi nhánh đều phải xác nhận hậu điều kiện `account-back|profile-sign-in`. Không tăng timeout, không bỏ kiểm tra trạng thái cuối, không đổi code app.

**Bài học:** helper điều hướng dùng lại phải nhận các trạng thái đầu vào hợp lệ khi navigator giữ stack, đồng thời giữ hậu điều kiện rõ ràng. Chỉ thêm selector vào bước chờ mà không kiểm tra đích cuối có thể làm test đi tiếp sai màn hình.

Lượt `20261120-060554`: 05 PASS **3m01s**, 06 PASS **2m20s**, 13 PASS **4m51s**, 16 PASS **20m14s**. 20 bị `Unknown error` tại tap `tab-trips` trong chuẩn bị, screenshot đã hiển thị Trips rỗng; cleanup đồng thời báo `fetch failed`. Chưa xác định chính xác nguyên nhân gián đoạn; không coi đây là assertion lỗi Account hoặc lỗi nghiệp vụ resume. Ledger được giữ lại và cleanup chạy lại thành công khi mạng phản hồi.

Chạy riêng 20, giữ máy thức trong lúc runner hoạt động: `20261120-065804` **PASS 4m06s**, runner exit 0, cleanup tài khoản fixture thành công. Tổng cộng **5/5 ca mục tiêu đã PASS qua hai lượt**, không phải một lượt 5/5 hay toàn bộ 22 flow. Cả hai lượt đều có JUnit; kiểm tra cú pháp helper và diff whitespace đạt. Chạy trên Metro 8084 bằng bản sao flow chỉ thay URL như lượt trước, source helper mới giống hệt bản được kiểm chứng.


## Ổn định URL Metro và RewardBanner — 20/11/2026

Base `0a1008d9`, branch `codex/maestro-stable-baseline`. Lấy riêng phần URL/banner từ branch tham chiếu `claude/maestro-expo-url-reference` (`02fcd0d9`); không lấy lại thay đổi Profile/MeScreen/SessionNavSync hoặc chép đè helper Account đã merge.

- **Flow env thắng tham số CLI:** 22 flow nay giữ `EXPO_URL` được truyền vào bằng `${EXPO_URL || 'exp://127.0.0.1:8081'}`. `00` PASS qua runner mặc định ở `20261120-091655` (27s), trực tiếp không truyền biến ở `.smoke-local/url-default-direct` (26s), và runner override 8085 ở `20261120-091943` (25s). Log `Maestro.openLink` xác nhận đúng URL cho cả hai cổng, không dùng bản sao flow để đổi URL.
- **Không chỉ kiểm nhánh không có banner:** fixture account mới + collection private rỗng, UI lần đầu lưu có `reward-banner` First Find thật. Probe dùng cùng helper và thêm assertion/screenshot để chứng minh banner tồn tại trước khi chờ; helper đợi khoảng 2,6 giây tới khi banner mất rồi mới bấm Saved. `20261120-092035` PASS 2m29s; lưu lại với cùng account đã nhận badge, probe xác nhận banner không có, `20261120-092317` PASS 2m27s. Sau probe, cleanup cặp account thành công.
- Helper là chờ điều kiện `notVisible`, không phải sleep. Nó không chứng minh mọi trường hợp banner có thể đến muộn sau khi assertion đã kết thúc; không coi probe có banner là chứng minh mọi độ trễ mạng. Nếu tái hiện race đó, ghi timestamp từ sự kiện lưu đến notice trước khi tăng timeout.
- Kiểm tra cú pháp 22 flow + helper mới đạt; `maestroIds.test.ts` 122 test đạt. Full-suite sẽ được ghi riêng sau khi kết thúc trên SHA đã chốt.
- Worktree/artifacts đặt trên T7 để tránh hết ổ trong: `/Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability`. Chỉ một runner foreground, giữ máy thức bằng `caffeinate -i`; không dùng launchd tự khởi động lại.


### `centerElement` có thể timeout dù nút đã thấy đầy đủ — 20/11/2026

Lượt toàn suite `20261120-093151`, SHA `52946726`: `17-unfriend` thất bại ở `common/ensure-signed-out.yaml` cuối flow. Đăng xuất đã thành công: screenshot `step-189-scrollUntilVisible-profile-sign-in.png` hiển thị guest Account và nút Sign in; log ghi bounds `(22,232,358,58)` và visibility `1.0` lặp năm lần. `centerElement: true` vẫn cuộn DOWN tới timeout 20s vì nút gần đầu nội dung không thể nằm giữa màn hình. Thông báo cuối “No visible element found” không mô tả đúng nguyên nhân. Đây là lỗi helper test, không phải bằng chứng unfriend hay auth backend hỏng.

**Bài học:** đối chiếu bounds/visibility và screenshot trước khi tăng timeout hoặc sửa selector. Centering là yêu cầu bổ sung ngoài visibility; không dùng nó cho phần tử không thể đưa vào giữa viewport. Cần giữ xử lý nút dưới status bar từng gặp ngày 9/10 khi sửa. Lượt baseline vẫn giữ nguyên YAML; bản sửa và kết quả chạy lại sẽ được ghi riêng sau khi baseline kết thúc.

Cùng lượt, `19-collection-privacy` cũng thất bại ở helper này trong `sign-in-trip-guest`, trước assertion nghiệp vụ privacy. Log lặp cùng bounds y=232 và visibility 1.0 tới timeout; phải chạy lại cả 17 và 19 sau sửa, không tính 19 là đã kiểm chứng quyền riêng tư.

`20-guest-trip-resume` cũng gặp cùng bounds/visibility trong bước chuẩn bị. Baseline hoàn tất **19/22 PASS, 3 FAIL (17/19/20)** trên `52946726`, có JUnit; signup/trip cleanup thành công. Bản sửa helper: bỏ centering ở Sign in, vẫn `scrollUntilVisible` UP, thêm một swipe DOWN để nút không dừng dưới status bar, rồi `assertVisible`. Không tăng timeout. Kết quả kiểm chứng sau sửa đang chờ.
