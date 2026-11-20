# Bàn giao kết quả test iOS — 20/11/2026

Đọc file này trước khi chạy tiếp. Đây là kết quả theo từng revision/lượt chạy, **không phải chứng nhận toàn bộ 22 flow đã đạt trên main mới nhất**. Các mốc giờ/run ID bên dưới theo Asia/Ho_Chi_Minh (UTC+7).

## Revision và phạm vi

- Branch đã push: `codex/fix-profile-root-navigation`, HEAD `32dbb031`. Chưa tạo PR/merge trong đợt công việc này; kiểm tra lại remote trước khi tiếp tục.
- Base của bản sửa: `4e352385`.
- `37932bda`: sửa Profile phân biệt độ sâu stack hiện tại với lịch sử navigator cha; kiểm tra lại index trước khi `popToTop` sau khi kết thúc phiên.
- `7ebbea9c`: thêm integration test với router thật cho đăng xuất/xóa tài khoản khi các tab giữ lịch sử.
- `32dbb031`: sửa `common/open-account.yaml` nhận Account đang mở sẵn, vẫn xác nhận đích cuối là Account hoặc guest hub; kèm ghi chép REVIEW.
- Môi trường đã kiểm: iPhone 17 Pro, iOS 26.5, Expo Go SDK 58, Maestro 2.10.0; Metro tại cổng 8084 phục vụ worktree bản sửa.

## Kết quả E2E đã xác nhận

| Lượt | Revision/nội dung kiểm | Kết quả | Bằng chứng và giới hạn |
| --- | --- | --- | --- |
| `20261119-213051` | Baseline `26629da8` | 7/22 PASS, 15 FAIL | Baseline cũ, không đại diện main hiện tại. Các ca lỗi có màn hình `POP_TO_TOP` che UI. |
| `20261120-032436` | Bản sửa Profile, sau đó lưu ở `37932bda` | 04, 07, 09 PASS | JUnit; signup account tạm đã xóa. 04 còn PASS riêng ở `20261120-033154`. |
| `20261120-035122` | `7ebbea9c`; chạy lại 15 ca baseline lỗi | 10 PASS, 5 FAIL | PASS: 04, 09, 10, 11, 12, 15, 17, 18, 19, 21. FAIL: 05, 06, 13, 16, 20. Không có JUnit vì hết ổ đĩa lúc xuất; đối chiếu console và `commands.json`, gồm assertion cuối của 12. |
| `20261120-060554` | `7ebbea9c` + helper mới, sau đó commit `32dbb031` | 05, 06, 13, 16 PASS; 20 ERROR | Có JUnit. 20 báo `Unknown error` tại tap `tab-trips` khi chuẩn bị; cleanup đồng thời `fetch failed`. Chưa xác định chính xác nguyên nhân gián đoạn. |
| `20261120-065804` | Cùng helper mới; chạy riêng 20 | 20 PASS, runner exit 0 | Có JUnit; cleanup thành công. Giữ máy thức bằng `caffeinate -i` trong lượt này, không đủ bằng chứng kết luận sleep là nguyên nhân lượt trước. |

**Kết luận được phép dùng:** năm ca mục tiêu 05/06/13/16/20 đều đã PASS sau sửa helper, qua hai lượt. Không gọi lượt `060554` là 5/5 PASS. Chưa chạy lại toàn suite 22 flow trên `32dbb031`; các PASS từ revision cũ chỉ là bằng chứng lịch sử.

| Ca chạy lại sau sửa helper | Thời gian PASS (làm tròn) | Lượt |
| --- | --- | --- |
| 05-plan-trip | 3m01s | `060554` |
| 06-save-place | 2m20s | `060554` |
| 13-trip-edit | 4m51s | `060554` |
| 16-trip-invite | 20m14s | `060554` |
| 20-guest-trip-resume | 4m06s | `065804` |

Thời gian này gồm thao tác driver, đổi tài khoản, mạng và cold start; không dùng như số đo độ trễ app.

## Unit/integration và kiểm tra tĩnh

- **162 test trên 6 file PASS** tại `7ebbea9c`: `ProfileScreen.ui.test.tsx`, `MeScreen.ui.test.tsx`, `DeleteAccountScreen.ui.test.tsx`, `authNavigation.integration.test.tsx`, `sessionNavSync.ui.test.tsx`, `sessionNav.test.ts`.
- TypeScript và ESLint file test thay đổi đạt ở đợt đó. Không phải kết quả chạy toàn bộ unit suite hay báo cáo coverage phần trăm.
- Hai test mới dùng container/TabRouter/StackRouter và `SessionNavSync` thật, nhưng auth backend và phần trình bày Person/Explore là mock. Tạm bỏ `SessionNavSync` khiến cả hai ca thất bại; khôi phục rồi chạy đạt.
- `32dbb031` chỉ đổi YAML/tài liệu so với `7ebbea9c`; `maestro check-syntax` helper và `git diff --check` đạt. Không chạy lại Vitest sau thay đổi YAML.

## Nguyên nhân đã sửa và việc còn mở

1. **Lỗi app đã sửa:** `canGoBack()` xét cả navigator cha, nên không chứng minh Profile đang được push. Dùng index của stack hiện tại và kiểm tra lại trước `popToTop` để tránh đua với reset từ `SessionNavSync`.
2. **Lỗi helper đã sửa:** bấm tab Profile có thể giữ Account đang mở. Cả năm hierarchy lỗi ở lượt `035122` có `account-back` và `profile-email`, không có `POP_TO_TOP`. Helper nhận `person-account|account-back|profile-sign-in`, chỉ mở Account khi cần, rồi xác nhận `account-back|profile-sign-in`. 05/13/16 lỗi cũ ở đăng xuất cuối; 20 bị chặn trước nghiệp vụ guest resume.
3. **Còn mở — URL Metro:** YAML hard-code 8081 đã lấn override 8084 trong lượt thử. Chưa sửa runner/config; các lượt xác nhận dùng bản sao flow chỉ thay URL, giữ nguyên assertion. Kiểm tra URL thực tế trong log `Maestro.openLink`, không chỉ `/status`.
4. **Còn mở — cạnh tranh simulator:** runner ở `/Users/andy/wt-maestro/app` từng tự khởi động lại, gây `DeviceUnreachable`. Lock fixture theo checkout không khóa simulator giữa các checkout. Kiểm tra process và thư mục làm việc trước khi chạy; không dừng process chưa xác định chủ sở hữu.
5. **Còn mở — dung lượng và mạng:** hết ổ đĩa có thể làm mất JUnit dù các flow đã xong. Log lớn ở `035122` đã nén `.gz`, đọc kiểm chứng và giải phóng khoảng 1,3 GB. Lỗi `fetch failed` lúc cleanup phải được xử lý bằng ledger giữ lại, không coi run đã sạch chỉ vì Maestro kết thúc.

Chi tiết diễn biến và bài học: [REVIEW.md](../../app/.maestro/REVIEW.md). Không sửa selector/timeout để che lỗi app hoặc môi trường.

## Artifacts và cleanup

Artifacts **chỉ có trên máy đã chạy**, không đi theo Git clone/push:

- Worktree bản sửa: `/Users/andy/.codex/worktrees/fix-profile-root/city-crew`.
- Baseline: `/Users/andy/.codex/worktrees/e2e-20261119/city-crew/.smoke-local/maestro/20261119-213051/`.
- Trong worktree bản sửa: `.smoke-local/maestro/<run-id>/report.xml`, `console.log`, thư mục `<timestamp>/<flow>/{commands.json,screenshots,screen-hierarchy,logs}`. Log lớn có thể là `.log.gz`.
- `035122` không có `report.xml`; có `summary.md` và artifacts từng flow. Không tự tạo JUnit rồi trình bày như báo cáo gốc.
- Log Vitest đã đối chiếu: `/tmp/profile-priority2-validation.log` (tạm thời, có thể bị hệ thống xóa).

Sau lượt cuối, cleanup cặp tài khoản tạm thành công; kiểm tra **0 JSON ledger** trong `.smoke-local/trip-accounts`, không còn `trip-accounts.lock`. Ledger của lượt `060554` bị lỗi mạng đã được cleanup thành công trước khi provision lượt `065804`. Đây là trạng thái lúc bàn giao, không phải bảo đảm cho các lượt chạy sau.

## Agent tiếp tục từ đây

1. Kiểm tra branch/commit và thay đổi local; `git fetch origin` để biết main đã tiến thêm hay chưa. Không tự đổi revision giữa một lượt chạy. Nếu test revision khác, ghi SHA mới và không kế thừa kết luận PASS của revision này.
2. Đọc [README Maestro](../../app/.maestro/README.md) cho setup/runner và [GUIDELINES](../../app/.maestro/GUIDELINES.md) trước khi sửa flow. `config.yaml` hiện liệt kê 22 flow, gồm signup/delete tự động, guest resume và privacy.
3. Kiểm tra simulator đang boot, Metro đúng checkout, không có runner cạnh tranh, còn dung lượng ghi artifacts. Credential lấy qua runner/Keychain; không chép credential hoặc ledger JSON vào Markdown/Git.
4. Nếu dùng 8084 như đợt này: bản sao flow ở `.smoke-local/account-helper-retry-8084/` trên máy hiện tại. Đồng bộ lại từ `.maestro` và chỉ đổi URL nếu code/test mới; không dùng bản sao cũ để kiểm revision mới. Nếu dùng cổng mặc định 8081, xác nhận Metro ở đó phục vụ đúng checkout.
5. Lệnh mẫu dưới đây chỉ áp dụng khi bản sao 8084 đã được đồng bộ và Metro đã được xác nhận. Runner provision/cleanup fixture; không gọi Maestro trực tiếp cho các flow cần tài khoản tạm.

```sh
cd app
EXPO_URL=exp://127.0.0.1:8084 caffeinate -i bash .maestro/smoke.sh \
  ../.smoke-local/account-helper-retry-8084/05-plan-trip.yaml \
  ../.smoke-local/account-helper-retry-8084/06-save-place.yaml \
  ../.smoke-local/account-helper-retry-8084/13-trip-edit.yaml \
  ../.smoke-local/account-helper-retry-8084/16-trip-invite.yaml \
  ../.smoke-local/account-helper-retry-8084/20-guest-trip-resume.yaml
```

Nếu cần đánh giá sẵn sàng merge/release, việc chưa làm là chạy toàn suite trên revision được chọn, kiểm tra JUnit và cleanup, rồi cập nhật file này với ngày, SHA, run ID và phạm vi thực sự đã chạy. Giữ diễn biến lỗi cũ trong REVIEW để không mất nguyên nhân.
