# Bàn giao E2E iOS — P1 sau rebase — 20/11/2026

**Toàn suite 23/23 PASS trong một lượt trên `34a7121e59b657929a2b6fdb302226208433267b`.** Run `20261120-222643`, runner exit 0; JUnit đủ 23 tên đúng thứ tự config, không failure/error/skip. Giờ/run ID theo Việt Nam (UTC+7). Tổng thời gian testcase khoảng 81m13s; không phải latency app.

## Revision và môi trường

- PR #1508, branch `codex/maestro-profile-account`, đã rebase lên main tại lúc bắt đầu: `8d2c98ab17b03fed292612f682505e999c2942f1` (đã gồm Trips #1502/#1505 và Activity #1496/#1503).
- SHA ngay sau rebase: `4fb26f05b5e2a673a98961d3c59196c0b6075879`. Sau khi full phát hiện budget cuộn ở 03 quá ngắn, sửa tại `34a7121e59b657929a2b6fdb302226208433267b`; toàn bộ executable giữ nguyên trong full xanh cuối.
- Commit báo cáo sau nghiệm thu chỉ sửa Markdown. Không gán kết quả native cho revision chưa chạy.
- Trong lúc chạy, main thêm `ec2b10756ab6c379c1cb7c92faca9c2d55b6b269` (#1510: nền tròn/nét dấu cộng header). Đã rà diff: không đổi selector hoặc logic Trips/Activity. **Full native này không chứa #1510**; CI của PR kiểm tích hợp, và P3 sẽ bắt đầu từ main sau merge.
- iPhone 17 Pro / iOS 26.5, UDID `2E5D58A8-A2A7-41F1-B6B0-A5477102C7E4`; Expo Go SDK 58, Maestro 2.10.0, Node 24.14.0.
- Metro `exp://127.0.0.1:8085`, cwd `/Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability/app`, đã xác nhận. Một runner, wrapper chọn UDID tường minh, foreground `caffeinate -i`, không launchctl.

## Các lượt sau rebase

| Run ID | SHA | Phạm vi | Kết quả |
| --- | --- | --- | --- |
| `20261120-213702` | `4fb26f05` | 22, PA-1…PA-6 | PASS 3m07s |
| `20261120-214100` | `4fb26f05` | 05, 13, 16, 20 | 4/4 PASS, 30m09s; cleanup sạch |
| `20261120-221219` | `4fb26f05` | Full attempt | 00–02 PASS, 03 FAIL; dừng có kiểm soát exit 130; không phải lượt hoàn tất |
| `20261120-222307` | working tree trước `34a7121e` | 03, probe budget 60s | PASS; cuộn 30,67s |
| `20261120-222450` | `34a7121e` | 03, xác nhận commit | PASS 1m14s |
| `20261120-222643` | `34a7121e` | **Toàn bộ 23 flow**, gồm 22/05/13/16/20 | **23/23 PASS**, exit 0, cleanup sạch |

Không cộng các lượt riêng thành một lượt suite xanh. 22 và nhóm Trips đã chạy riêng trước full; sau sửa 03, tất cả được kiểm lại trong cùng lượt full cuối.

## Kết quả toàn suite cuối

| Flow | Kết quả | Thời gian làm tròn |
| --- | --- | --- |
| 00-launch | PASS | 25s |
| 01-explore | PASS | 57s |
| 02-place-detail | PASS | 37s |
| 03-search | PASS | 72s |
| 04-sign-in | PASS | 118s |
| 05-plan-trip | PASS | 166s |
| 06-save-place | PASS | 134s |
| 07-sign-up-delete | PASS | 208s |
| 08-explore-filter | PASS | 48s |
| 09-collections-browse | PASS | 52s |
| 10-check-in | PASS | 99s |
| 11-collection-crud | PASS | 207s |
| 13-trip-edit | PASS | 286s |
| 14-forgot-password | PASS | 54s |
| 15-theme | PASS | 437s |
| 16-trip-invite | PASS | 1121s |
| 17-unfriend | PASS | 238s |
| 18-guest-save-resume | PASS | 204s |
| 19-collection-privacy | PASS | 498s |
| 20-guest-trip-resume | PASS | 235s |
| 21-tab-bar-responsive | PASS | 283s |
| 22-profile-account | PASS | 179s |
| 12-language | PASS | 115s |

## P1 đã kiểm tra và bản sửa

- **PA-1/2:** tab Profile mở trang của @maestro với mặt, handle và ba công cụ; bánh răng `person-settings` mở Account, `profile-email` khớp TEST_EMAIL; Back trở lại trang cá nhân.
- **PA-3:** chuông và dòng Account `.*Activity.*What's new.*` đều tới Activity; thấy/chuyển được cả hai tab rồi quay về đúng màn. Dòng chọn theo chữ như `common/open-crew.yaml`, không thêm testID. Helper Back dùng nhãn tiếng Anh có sẵn; flow đặt English rõ ràng trước đó.
- **PA-4:** tìm `Maestro smoke`, khớp **activity-open + title**, không nhầm chữ trong ô nhập; đóng bàn phím rồi Cancel, ô nhập biến mất và header trở lại. Dùng bộ Private cũ của TEST_EMAIL; không tạo collection/account mới.
- **PA-5/6:** trang khách có Sign in/Sign up, không có account-back; đăng xuất không có POP_TO_TOP. Flow kết thúc signed out.
- **Lỗi app đã sửa:** khi logout, MeScreen có thể mount ProfileScreen trước khi stack loại Account. Giá trị `pushed` chụp active index lúc mount bị giữ true dù đây là root. MeScreen nay truyền `home`; root không suy ra vị trí của chính mình từ active index của cả navigator. Regression test tái hiện đỏ trước sửa, xanh sau sửa; 130 test ProfileScreen/MeScreen qua, rồi P1 qua hai lượt native.

## Findings và giới hạn

- **03-search:** query `cafe` có nhiều collection khớp; `buildSearchRows` đặt toàn bộ chúng trước Places. Lệnh cuộn 30s hết hạn ngay trước khi thấy `search-result-0`. Tăng budget hữu hạn lên 60s; giữ keyword, selector, visibility 100% và toàn bộ assertion detail/Back/clear/Cancel. Probe đo cuộn 30,67s; full cuối PASS. Không kết luận đây là latency backend.
- Probe nguyên bản `20261120-221734` FAIL; thử visibility 80%/center `20261120-221911` không giúp; probe không cuộn `20261120-222105` chỉ có Collections trong viewport. Đã bỏ các thử nghiệm này; không phải đổi tab hay clipping. Chi tiết ở REVIEW.md.
- **Unit có một timeout:** mặc định worker, CollectionFormScreen Save audience quá 3s khi simulator đang chạy. File chạy riêng 74/74 PASS; toàn bộ unit/timezone/coverage giới hạn 2 worker PASS. Không đổi test/timeout, chưa chứng minh root cause; CI mặc định trên `34a7121e` cũng PASS.
- **UX còn mở:** Cancel trên tìm kiếm trang cá nhân khi bàn phím đang mở chỉ đóng bàn phím ở lần chạm đầu. P1 đóng bàn phím rõ trước Cancel; không sửa UX trong PR này.
- Lỗi 16/17 của full cũ `20261120-181739` (Profile còn loading / alert network connection lost) không tái hiện trong các lượt sau rebase; không coi một lượt xanh là hết flaky.

## Gate, CI và cleanup

- Typecheck, lint PASS; unit, timezone, coverage **7.531 test / 319 file PASS** (2 worker local). Coverage floors đạt; tổng statements/lines 99,93%, branches 98,43%, functions 98,02%.
- Cú pháp 03 PASS; **135 kiểm tra selector PASS**. Không thay source app sau khi chạy gate.
- CI trên `34a7121e`: app, bundle, dashboard, data, migrations và GitGuardian đều PASS, [Actions run 44769675558](https://github.com/aletuan/city-crew/actions/runs/44769675558). Sau commit Markdown, kiểm CI của head mới trước merge; kết quả cũ không thay cho check mới.
- Signup/trip fixture cleanup thành công sau mọi lượt runner; full cuối không còn JSON ledger, không còn trip lock.
- Audit sau full: A có đúng một `Maestro smoke` Private, 0 place, tạo 11/09; B có 0 collection. Không còn Maestro CRUD. Phạm vi audit là hai tài khoản test, không phải toàn DB.
- 17 đã kết bạn lại và logout. Không sửa data bằng API để làm xanh assertion.
- Disk nội bộ từng còn 2,1GB. Chuyển cache DerivedData CityCrew không có process sử dụng sang `.smoke-local/build-cache-backup/`, không xoá source. Sau chuyển có 5,9GB trống; cuối suite còn khoảng 5GB. Cache có thể đưa lại vị trí cũ nếu cần.

## Bằng chứng P1 ban đầu (trước rebase)

Trên `54bdd56398509aa36e80f5de359dcb84a0950e3f`: P1 hai lượt liên tiếp `20261120-181004` / `20261120-181405`; full `20261120-181739` 20/22, retry nguyên mã `20261120-192724` 22/22. Sau đó mới đăng ký flow 22 vào config. Các lượt này là lịch sử, không thay bằng chứng sau rebase ở trên. Regression Back đỏ trước sửa, xanh sau sửa; 130 test ProfileScreen/MeScreen PASS.

## Artifacts và chạy tiếp

Checkout `/Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability`. Artifact local, không theo clone/PR; không commit credential hoặc ledger.

- `.smoke-local/maestro/<run ID>/report.xml`, console, logs, screenshots và hierarchy.
- `.smoke-local/rebase-p1-{22,trips,full,full-fixed}.log`.
- `.smoke-local/rebase-search-{original,fix1,direct,budget,confirm}.log`.
- `.smoke-local/rebase-p1-{typecheck,lint,test,collection-unit-probe}.log`, `rebase-p1-limited-{test,test-tz,coverage}.log`.
- `.smoke-local/rebase-p1-collections-after.json`; đối chiếu `p1-collections-before.json`.

```sh
cd /Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability
PATH="$PWD/.smoke-local/device-bin:/Users/andy/.nvm/versions/node/v24.14.0/bin:$PATH" \
EXPO_URL=exp://127.0.0.1:8085 caffeinate -i bash app/.maestro/smoke.sh
```

Trước lượt mới kiểm SHA/working tree, chỉ một runner và cwd Metro. P3 theo [e2e-plan.md](e2e-plan.md): làm CM-1…CM-6 và CM-10 bằng A, PR riêng sau merge P1; không chặn A/B, không dùng disposable account cho comments. P2 và phần kế hoạch P3 còn lại được giữ nguyên.
