# Bàn giao E2E iOS — 20/11/2026

**Baseline đã đạt: 22/22 PASS trong cùng lượt trên cùng SHA `d0c9cd07b033d3abf28fa5d94107697fbcc32421`.** Run `20261120-142328`, tổng thời gian testcase **1h16m45s**; runner exit 0, JUnit đủ 22 tên flow trong config, không failure/error/skip. Giờ/run ID theo Việt Nam (UTC+7).

## Revision và môi trường

- Branch `codex/maestro-private-fixtures`, base main `9fa2f60a` (gồm PR #1484, #1486 audience sheet và #1487).
- `ad7df999`: 06/11 chọn Private trước mọi đường submit, kiểm tra audience sau tạo/rename; README/GUIDELINES/REVIEW.
- `d0c9cd07`: helper mở best plan chờ animation rồi xác nhận editor, dùng chung cho create-trip/13/20. Không thay source app hay mặc định Public của sản phẩm.
- Commit tài liệu sau kết quả không thay executable code/YAML đã kiểm. Không tự coi kết quả này là kết quả cho main nếu main tiến thêm.
- iPhone 17 Pro, iOS 26.5, UDID `2E5D58A8-A2A7-41F1-B6B0-A5477102C7E4`; Expo Go SDK 58, Maestro 2.10.0, Node 24.14.0.
- Metro `exp://127.0.0.1:8085`, checkout `/Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability/app`. Chạy flow gốc, không sao chép để thay URL; wrapper local thêm `--device` vì có Pro Max khác đang boot.

## Kết quả toàn suite

| Flow | Kết quả | Thời gian làm tròn |
| --- | --- | --- |
| 00-launch | PASS | 0m 24s |
| 01-explore | PASS | 0m 45s |
| 02-place-detail | PASS | 0m 28s |
| 03-search | PASS | 1m 08s |
| 04-sign-in | PASS | 1m 53s |
| 05-plan-trip | PASS | 2m 34s |
| 06-save-place | PASS | 2m 09s |
| 07-sign-up-delete | PASS | 3m 28s |
| 08-explore-filter | PASS | 0m 49s |
| 09-collections-browse | PASS | 0m 51s |
| 10-check-in | PASS | 1m 38s |
| 11-collection-crud | PASS | 3m 26s |
| 13-trip-edit | PASS | 4m 40s |
| 14-forgot-password | PASS | 0m 53s |
| 15-theme | PASS | 7m 12s |
| 16-trip-invite | PASS | 18m 35s |
| 17-unfriend | PASS | 4m 02s |
| 18-guest-save-resume | PASS | 3m 16s |
| 19-collection-privacy | PASS | 8m 09s |
| 20-guest-trip-resume | PASS | 3m 54s |
| 21-tab-bar-responsive | PASS | 4m 39s |
| 12-language | PASS | 1m 53s |

Thời gian gồm driver, auth, cold start và mạng; không dùng làm số đo latency app. Trip invite vẫn là flow tốn thời gian nhất.

## Bằng chứng bổ sung và lượt chưa đạt

| Run | Phạm vi | Kết quả/giới hạn |
| --- | --- | --- |
| `20261120-135941` | 06 + 11, cặp tài khoản tạm mới không seed collection | 2/2 PASS (2m51s, 3m23s). Nhánh tạo mới của 06 thực sự chạy. Backend sau flow: đúng một Smoke Private/rỗng, không CRUD; xóa tài khoản thành công. Các YAML 06/11 giống bản baseline cuối. |
| `20261120-140733` | Thử toàn suite trên `ad7df999` | 00–04 PASS; 05 FAIL vì vẫn ở PlanOptions sau tap, chưa vào editor. Dừng có kiểm soát để chẩn đoán; các FAIL nhanh sau SIGINT không phải lỗi chức năng độc lập. Cleanup thành công. Không gọi đây là baseline đầy đủ. |
| `20261120-141628` | 05 giữ nguyên YAML | PASS 2m38s; lỗi tap không tái hiện. Cleanup thành công. |
| `20261120-142003` | 05 với helper mở editor mới | PASS 2m40s, assertion editor đạt; cleanup thành công. |
| `20261120-142328` | Toàn bộ 22 flow trên `d0c9cd07` | **22/22 PASS**, cleanup thành công. |

Các lượt cũ của PR #1484 (19/22 rồi 3/3 trên SHA khác) là lịch sử, không được cộng vào baseline này; diễn biến còn trong REVIEW và Git history.

## Thay đổi và bài học

1. **Fixture phải chọn Private trước submit:** form mới mặc định Public và chọn audience qua `collection-form-seen` → `sheet-action-private`. 06 nhánh tạo mới và 11 chọn Private khi tên còn rỗng, mở lại sheet xác nhận selected, rồi mới nhập tên. `hideKeyboard`/Return có thể submit; chọn sau bước đó là quá muộn.
2. **Kiểm tra trạng thái đã lưu:** `assert-private-collection.yaml` assert Private selected trên trang collection trước khi tap. 11 kiểm lại sau rename. Probe backend xác nhận kết quả cuối; không chỉ dựa vào tap thành công.
3. **Không nhầm thiếu Save với thiếu selector:** 05 có một lần tap card nhưng screenshot vẫn ở PlanOptions, các scroll sau đó tìm Save trên màn sai. Helper mới chờ animation và yêu cầu `plan-stop-name-0` của editor trước khi tìm Save. Không retry mù hoặc tăng timeout Save. Nguyên nhân cấp touch/driver của lần tap không mở màn chưa được chứng minh; animation là giả thuyết, không phải kết luận chắc chắn. Một lượt 22/22 chưa chứng minh hết flaky.
4. **Phạm vi Public có chủ đích:** 19 vẫn chuyển Public/Private để kiểm quyền giữa hai tài khoản, trên fixture run-owned có cleanup. Không làm mất coverage publish chỉ để mọi fixture luôn Private.

Chi tiết: [REVIEW](../../app/.maestro/REVIEW.md), [GUIDELINES](../../app/.maestro/GUIDELINES.md), [README](../../app/.maestro/README.md).

## Gate và dữ liệu sau test

- Cú pháp các flow/helper thay đổi đạt; **123 kiểm tra selector** đạt.
- **Cả 5 gate PASS trên revision cuối:** typecheck, lint, unit, timezone và coverage. Log/status tại `.smoke-local/private-final-validation/`; đã đối chiếu `results.json` trước push.
- Unit: **7481 test / 318 file PASS**; timezone cũng **7481 test / 318 file PASS**. Coverage qua floors repo.
- Sau full suite: không còn JSON ledger trong `trip-accounts`, `signup-accounts`, `private-create-accounts` (kể cả thư mục con); không còn `trip-accounts.lock`.
- Audit trước/sau bằng session đúng hai tài khoản Keychain: tài khoản 1 có đúng một `Maestro smoke` cũ từ 11/09/2026, `is_public=false`, 0 place; tài khoản 2 không có collection. Không có `Maestro CRUD`/`Maestro CRUD 2`. Không sửa/xóa list cũ. Đây là audit hai tài khoản test, không phải toàn DB.

## Artifacts và chạy tiếp

Root local: `/Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability`. Artifacts không đi theo Git clone/push; không chép credential hoặc ledger JSON vào tài liệu.

- `.smoke-local/maestro/20261120-142328/report.xml`, `console.log`, `<timestamp>/<flow>/{commands.json,screenshots,screen-hierarchy,logs}`.
- `.smoke-local/private-full-final-metadata.json`, `private-full-final.log`.
- `.smoke-local/private-create-probe.log`, `collection-audit-before.json`, `collection-audit-after.json`.
- `.smoke-local/private-final-validation/{results.json,typecheck.log,lint.log,test.log,test-tz.log,coverage.log}`.
- `.smoke-local/private-ids-final.log`; các run chẩn đoán theo ID ở bảng trên.

Trước lượt sau: kiểm tra SHA, Metro đúng checkout, chỉ một runner trên simulator, dung lượng và ledger cũ. Nếu nhiều simulator booted, chọn UDID tường minh cho Maestro. Giữ máy thức bằng `caffeinate -i`, chạy foreground, không sửa YAML/script giữa lượt.

```sh
cd /Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability/app
EXPO_URL=exp://127.0.0.1:8085 caffeinate -i bash .maestro/smoke.sh
```

Đảm bảo Node/Maestro trong PATH; lượt này dùng wrapper `.smoke-local/device-bin/maestro` thêm `--device` cho iPhone 17 Pro. Probe nhánh tạo mới 06 phải dùng tài khoản tạm rỗng và có cleanup; không xóa list của tài khoản cố định chỉ để ép nhánh chạy.

**Tiếp theo:** đã có baseline xanh để bắt đầu P1 Profile/Account và ScreenBoundary/router thật. Chưa triển khai các flow mới trong nhánh này. Nếu main đổi UI/behavior liên quan sau SHA này, rà soát tác động và chạy lại phạm vi cần thiết; không kế thừa chứng nhận 22/22 cho revision khác.
