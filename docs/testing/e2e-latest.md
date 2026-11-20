# Bàn giao E2E iOS — P1 Profile/Account — 20/11/2026

**P1 đạt hai lượt liên tiếp và suite hiện có đạt 22/22 trên cùng SHA `54bdd56398509aa36e80f5de359dcb84a0950e3f`.** Sau khi đạt mới đăng ký `22-profile-account` vào config. Config hiện có **23 flow**; bằng chứng bên dưới là **22 flow trong một lượt + P1 hai lượt riêng**, không gọi là một lượt 23/23. Giờ/run ID theo Việt Nam (UTC+7).

## Revision và môi trường

- Branch `codex/maestro-profile-account`, tạo từ main `7737fe91` (#1494), gồm main `18589b5` (#1492) và layout/search Profile mới. Đã fetch và đọc plan trước khi làm.
- `54bdd563`: flow PA-1…PA-6, helper kiểm hai tab Activity, sửa Back ở trang khách và regression unit test. Source/YAML giữ nguyên trong hai lượt P1 và cả hai lượt toàn suite.
- Commit sau nghiệm thu chỉ đăng ký config và cập nhật tài liệu; không đổi app hay flow đã chạy. Không tự áp kết quả này cho main mới hơn.
- **Main đã tiến trong lúc chạy:** tại lúc mở PR, `origin/main` là `a9c9a4b2`, thêm 10 commit sau base (gồm Trips #1502/#1505, Activity #1496/#1503 và quyết định P3 #1497/#1498). Merge thử không conflict, nhưng **không phải validation của nội dung sau merge**. Cần rà các flow bị tác động và chạy lại trên SHA tích hợp trước khi coi main có baseline mới. Không rebase âm thầm rồi gắn bằng chứng cũ cho SHA mới.
- iPhone 17 Pro / iOS 26.5, UDID `2E5D58A8-A2A7-41F1-B6B0-A5477102C7E4`; Expo Go SDK 58, Maestro 2.10.0, Node 24.14.0.
- Metro `exp://127.0.0.1:8085`, cwd đã xác nhận: `/Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability/app`.
- Chỉ một runner; wrapper local chọn UDID tường minh vì Pro Max khác cũng boot. Foreground với `caffeinate -i`, không dùng launchctl. Khởi động lại riêng simulator test giữa hai lượt full suite; không sửa code/timeout.

## Các lượt nghiệm thu

| Run ID | SHA | Phạm vi | Kết quả |
| --- | --- | --- | --- |
| `20261120-181004` | `54bdd563` | 22-profile-account, PA-1…PA-6 | PASS 3m11s, lượt đầu |
| `20261120-181405` | `54bdd563` | 22-profile-account, PA-1…PA-6 | PASS 3m02s, liên tiếp lần hai |
| `20261120-181739` | `54bdd563` | Toàn suite 22 flow theo config lúc đó | **20/22**, 16/17 fail; runner exit 1; cleanup thành công |
| `20261120-192724` | `54bdd563` | Chạy lại toàn bộ 22 flow, không đổi mã | **22/22 PASS**, 78m39s, runner exit 0; cleanup thành công |

Đã đối chiếu JUnit lượt cuối: đủ 22 tên flow đúng thứ tự config trước đăng ký, không failure/error/skip. Không cộng kết quả từng flow từ hai lượt full thành một lượt xanh.

## Kết quả toàn suite cuối

| Flow | Kết quả | Thời gian làm tròn |
| --- | --- | --- |
| 00-launch | PASS | 0m 25s |
| 01-explore | PASS | 0m 48s |
| 02-place-detail | PASS | 0m 30s |
| 03-search | PASS | 1m 08s |
| 04-sign-in | PASS | 1m 56s |
| 05-plan-trip | PASS | 2m 36s |
| 06-save-place | PASS | 2m 11s |
| 07-sign-up-delete | PASS | 3m 28s |
| 08-explore-filter | PASS | 0m 49s |
| 09-collections-browse | PASS | 0m 54s |
| 10-check-in | PASS | 1m 41s |
| 11-collection-crud | PASS | 3m 30s |
| 13-trip-edit | PASS | 4m 33s |
| 14-forgot-password | PASS | 0m 54s |
| 15-theme | PASS | 7m 22s |
| 16-trip-invite | PASS | 19m 35s |
| 17-unfriend | PASS | 4m 06s |
| 18-guest-save-resume | PASS | 3m 29s |
| 19-collection-privacy | PASS | 8m 26s |
| 20-guest-trip-resume | PASS | 3m 45s |
| 21-tab-bar-responsive | PASS | 4m 40s |
| 12-language | PASS | 1m 54s |

Thời gian gồm driver, cold start, auth và mạng; không phải số đo latency app. `16-trip-invite` vẫn dài nhất (19m35s).

## P1 đã kiểm tra và bản sửa

- **PA-1/2:** tab Profile mở trang của @maestro với mặt, handle và ba công cụ; bánh răng `person-settings` mở Account, `profile-email` khớp TEST_EMAIL; Back trở lại trang cá nhân.
- **PA-3:** chuông và dòng Account `.*Activity.*What's new.*` đều tới Activity; thấy/chuyển được cả hai tab rồi quay về đúng màn. Dòng chọn theo chữ như `common/open-crew.yaml`, không thêm testID. Helper Back dùng nhãn tiếng Anh có sẵn; flow đặt English rõ ràng trước đó.
- **PA-4:** tìm `Maestro smoke`, khớp **activity-open + title**, không nhầm chữ trong ô nhập; đóng bàn phím rồi Cancel, ô nhập biến mất và header trở lại. Dùng bộ Private cũ của TEST_EMAIL; không tạo collection/account mới.
- **PA-5/6:** trang khách có Sign in/Sign up, không có account-back; đăng xuất không có POP_TO_TOP. Flow kết thúc signed out.
- **Lỗi app đã sửa:** khi logout, MeScreen có thể mount ProfileScreen trước khi stack loại Account. Giá trị `pushed` chụp active index lúc mount bị giữ true dù đây là root. MeScreen nay truyền `home`; root không suy ra vị trí của chính mình từ active index của cả navigator. Regression test tái hiện đỏ trước sửa, xanh sau sửa; 130 test ProfileScreen/MeScreen qua, rồi P1 qua hai lượt native.

## Findings và giới hạn còn mở

| Finding | Bằng chứng / kết luận | Trạng thái |
| --- | --- | --- |
| Back còn trên trang khách sau logout | Probe `20261120-180318`, screenshot `step-055-assertCondition-account-back.png`; unit tái hiện timing stack trước reset | **Đã sửa**, xác nhận hai lượt P1 và full suite cuối |
| Chạm Cancel khi đang nhập chỉ đóng bàn phím | Probe `20261120-175938`, `step-111-assertCondition-person-find-input.png`; Person ScrollView chưa đặt keyboardShouldPersistTaps | **UX còn mở**. Test đóng bàn phím rõ trước Cancel; không sửa UX hoặc bỏ assertion đóng search trong PR này |
| 16 chờ Profile quá hạn 15s | Full `20261120-181739`, `step-363-assertCondition-person-settingsaccount-b.png`; hierarchy có person-loading và tab Profile selected | Không tái hiện ở full retry. Chưa chứng minh nguyên nhân request cụ thể; không kết luận chắc do mạng, không tăng timeout |
| 17 không nhận bạn sau Accept | Cùng full run, `step-166-assertCondition-crew-friend-0.png`: alert “fetch failed: The network connection was lost” | Lỗi mạng có bằng chứng; full retry nguyên mã PASS, kết bạn lại thành công |
| CLI báo số flow 0 khi khởi tạo retry | Run `20261120-192724` có cảnh báo shard 0 flows, nhưng driver thực thi và JUnit đủ 22 | Không nhận exit 0 đơn độc là bằng chứng; luôn đối chiếu tên/số testcase |

Probe chẩn đoán `20261120-180542` đã bỏ assertion Back để kiểm tiếp PA-3/4: **không tính nghiệm thu**, không commit probe. Các probe chạy working tree trên base `7737fe91` trước commit `54bdd563`.

Một lượt full xanh không chứng minh đã hết flaky. Không đổi flow 16/17 trong PR P1. P2/P3 chưa làm. Các quyết định P3 lấy từ phiên bản [e2e-plan.md](e2e-plan.md) trên main; báo cáo này không thay thế plan (main đã cập nhật một số quyết định trong khi chạy P1).

## Gate và cleanup

- Cú pháp flow P1 PASS; **135 kiểm tra selector** PASS. Config sau đăng ký parse được và có 23 tên không trùng, hai danh sách/thứ tự khớp nhau.
- Cả năm gate trên source/flow `54bdd563` PASS: typecheck, lint, unit, timezone, coverage.
- Unit và timezone: **7.503 test / 318 file**; coverage qua floors (toàn repo: statements/lines 99,92%, branches 98,44%, functions 98,01%). Không dùng số tổng thay cho floors từng file.
- Sau mỗi full run: signup fixture không đăng nhập được, disposable trip accounts xoá thành công; không còn JSON ledger trong `signup-accounts`/`trip-accounts`, không còn `trip-accounts.lock`.
- Audit collection trước/sau: tài khoản A vẫn đúng một `Maestro smoke` từ 11/09, Private, 0 place; B không có collection. Không còn Maestro CRUD. Đây là audit hai tài khoản test, không phải toàn DB.
- Lượt 17 cuối hoàn tất kết bạn lại và logout; không sửa fixture bằng API để làm xanh assertion.

## Artifacts và cách chạy tiếp

Checkout local: `/Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability`. Artifacts nằm local, không theo PR/clone; không commit credentials hoặc ledger.

- `.smoke-local/maestro/<run ID>/report.xml`, `console.log`, `<timestamp>/<flow>/{logs,screenshots,screen-hierarchy,commands.json}`.
- `.smoke-local/p1-{accept1,accept2,full,full-retry}.log`, `p1-evidence.json`.
- `.smoke-local/p1-final-{typecheck,lint,test,test-tz,coverage}.log`; `p1-regression-{red,green}.log`.
- `.smoke-local/p1-collections-{before,after-attempt,after-final}.json` (audit đọc, không phải credential ledger).
- Probe logs: `p1-probe.log`, `p1-probe2.log`, `p1-remaining-probe.log`.

```sh
cd /Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability
PATH="$PWD/.smoke-local/device-bin:/Users/andy/.nvm/versions/node/v24.14.0/bin:$PATH" \
EXPO_URL=exp://127.0.0.1:8085 caffeinate -i bash app/.maestro/smoke.sh .maestro/22-profile-account.yaml
```

Bỏ target cuối để chạy config hiện tại gồm 23 flow. Wrapper local thêm `--device` đúng UDID; cần kiểm tra lại PATH/cwd Metro/runner/ledger trước lượt mới. Giữ nguyên SHA và working tree trong khi chạy. Baseline trước P1: 22/22 trên `d0c9cd07`, run `20261120-142328` (#1492); không gộp vào kết quả trên.
