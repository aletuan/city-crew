# Review lỗi thường gặp khi chạy Maestro trên iOS

Cập nhật: 27/10/2026. Dùng để chẩn đoán nhanh các lỗi E2E của City Crew trên simulator iOS, đặc biệt khi giao diện vẫn hoạt động nhưng Maestro không tìm thấy phần tử.

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
