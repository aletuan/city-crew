# Bàn giao E2E iOS — 20/11/2026

**Kết quả: toàn suite 19/22 PASS; sửa helper rồi chạy lại 3/3 PASS. Chưa có một lượt 22/22 trên revision cuối.** Giờ/run ID theo Việt Nam (UTC+7).

## Revision và phạm vi

- Branch: `codex/maestro-stable-baseline`, base main `0a1008d9` (đã có #1479/#1480/#1481).
- `52946726`: 22 flow tôn trọng override EXPO_URL; thêm chờ RewardBanner trong 06; README/REVIEW.
- `f3fedc5e`: sửa helper đăng xuất không ép Sign in vào giữa viewport. Không đổi source app/navigation.
- Branch tham chiếu `claude/maestro-expo-url-reference` (`02fcd0d9`): chỉ lấy URL/banner, giữ helper Account và navigation đã merge. Không cherry-pick toàn commit.
- Simulator: iPhone 17 Pro, iOS 26.5, UDID `2E5D58A8-A2A7-41F1-B6B0-A5477102C7E4`; Expo Go SDK 58, Maestro 2.10.0, Node 24.14.0.
- Metro 8085 phục vụ `/Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability/app`. URL thực tế đã kiểm qua `Maestro.openLink`.

## Kết quả và bằng chứng

| Lượt | Revision/phạm vi | Kết quả |
| --- | --- | --- |
| `091655` / `.smoke-local/url-default-direct` | 00 với cổng mặc định; lần trực tiếp không truyền `-e` | PASS; fallback 8081 đúng |
| `091943` | 00 qua runner override 8085 | PASS; openLink dùng 8085 |
| `092035` / `092317` | Probe 06 với fixture mới, lần có banner thật rồi lần không có banner | PASS cả hai; screenshot First Find và assertion hiện banner trước helper |
| `20261120-093151` | Toàn bộ 22 flow, `52946726` | **19 PASS, 3 FAIL: 17/19/20**, đủ JUnit; cleanup thành công |
| `20261120-105743` | Retry trên `f3fedc5e` | Gián đoạn, không có kết luận/JUnit; máy reboot, khôi phục/cleanup sau đó |
| `20261120-114411` | Khởi động sai đường dẫn CLI | Không chạy case nào; cleanup thành công |
| `20261120-114433` | Retry 17/19/20, `f3fedc5e` | **3/3 PASS**, runner exit 0, JUnit và cleanup đạt |

Bảng baseline `093151` (thời gian làm tròn):

| Flow | Kết quả | Thời gian |
| --- | --- | --- |
| 00-launch | PASS | 0m 24s |
| 01-explore | PASS | 0m 49s |
| 02-place-detail | PASS | 0m 28s |
| 03-search | PASS | 1m 09s |
| 04-sign-in | PASS | 1m 55s |
| 05-plan-trip | PASS | 2m 47s |
| 06-save-place | PASS | 2m 23s |
| 07-sign-up-delete | PASS | 3m 28s |
| 08-explore-filter | PASS | 0m 49s |
| 09-collections-browse | PASS | 0m 52s |
| 10-check-in | PASS | 1m 38s |
| 11-collection-crud | PASS | 3m 21s |
| 13-trip-edit | PASS | 5m 02s |
| 14-forgot-password | PASS | 0m 54s |
| 15-theme | PASS | 7m 51s |
| 16-trip-invite | PASS | 20m 04s |
| 17-unfriend | FAIL — helper centering | 5m 06s |
| 18-guest-save-resume | PASS | 7m 32s |
| 19-collection-privacy | FAIL — helper centering | 1m 53s |
| 20-guest-trip-resume | FAIL — helper centering | 4m 10s |
| 21-tab-bar-responsive | PASS | 8m 47s |
| 12-language | PASS | 3m 04s |

Retry `114433`: 17 **4m39s**, 19 **7m59s**, 20 **3m42s**. Không cộng PASS từ hai SHA thành chứng nhận 22/22 trên bản cuối.

## Nguyên nhân và thay đổi

1. **URL Metro bị ghi đè trong flow:** env literal 8081 thắng `-e EXPO_URL`. Dùng `${EXPO_URL || 'exp://127.0.0.1:8081'}`; không cần sao chép flow để thay cổng.
2. **RewardBanner che thao tác bỏ lưu:** 06 chờ `reward-banner` biến mất (timeout 8s) trước tap. Probe thực sự thấy banner, helper chờ khoảng 2,6s; probe không banner cũng đạt. Giới hạn: `notVisible` không bảo đảm bắt được mọi banner mạng tới trễ sau khi assertion đã qua; chưa có ca chủ động trì hoãn response.
3. **17/19/20 fail vì centering:** log có Sign in y=232–290, visibility 1.0, screenshot xác nhận guest đã đăng xuất; `centerElement: true` vẫn cuộn tới timeout. 17 lỗi ở cleanup cuối, 19/20 bị chặn khi chuẩn bị. Sửa helper chờ visibility, swipe DOWN thêm một lần để tránh nút sát status bar, rồi assert visible. Không tăng timeout, không bỏ hậu điều kiện. Retry cả ba đạt.
4. **Môi trường:** reboot lúc 11:33:59 khiến runner/Metro và log `/tmp` mất; chưa xác định nguyên nhân reboot. Thu hồi fixture từ ledger trước khi chạy lại. Sau reboot có thêm Pro Max booted; wrapper local chỉ thêm `--device` chọn đúng Pro của baseline.

Bài học và bằng chứng chi tiết: [REVIEW](../../app/.maestro/REVIEW.md). Quy tắc sửa/thêm flow: [GUIDELINES](../../app/.maestro/GUIDELINES.md).

## Gate và cleanup

- Trước baseline: cú pháp 22 flow + helper banner đạt; URL/default/banner probes đạt; 5 gate đạt.
- Sau sửa helper: cú pháp helper đạt; **122 test selector** đạt.
- Chạy lại 5 gate sau reboot trên code `f3fedc5e`: typecheck, lint, unit, timezone, coverage **PASS**. Unit và timezone: **7460 test, 318 file**; coverage qua floors của repo.
- Sau retry cuối: không còn JSON ledger trong `trip-accounts` (kể cả thư mục a/b) hoặc `signup-accounts`; không còn trip lock. Không ghi credential/ledger vào Git.

## Artifacts cho agent khác

Chỉ có trên máy đã chạy, không đi theo Git:

- Root: `/Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability`.
- `.smoke-local/maestro/<run-id>/report.xml`, `console.log`, `<timestamp>/<flow>/{commands.json,screenshots,screen-hierarchy,logs}`.
- 17 baseline: `20261120-093151/2026-11-20_093158/17-unfriend/screenshots/step-189-scrollUntilVisible-profile-sign-in.png`.
- Probe banner: `20261120-092035/2026-11-20_092038/06-save-place/takeScreenshot/banner-visible.png`.
- `.smoke-local/validation/{typecheck,lint,test,test-tz,coverage}.log`: gate sau reboot.
- `.smoke-local/retry-final.log`, `.smoke-local/metro-recovery.log`; `.smoke-local/full-suite-metadata.json` ghi metadata baseline.
- Artifacts cũ `035122/060554/065804` chuyển sang `.smoke-local/previous-runs/` và giữ symlink từ worktree cũ, đã kiểm SHA-256 trước khi xóa bản nguồn. Kết quả lịch sử và root cause #1479 còn trong REVIEW/Git history.

## Chạy tiếp

1. Xác nhận branch/SHA, Metro đúng checkout, còn dung lượng và chỉ một runner trên simulator. Không chỉnh YAML/script trong lượt chạy.
2. Chạy bằng flow gốc qua runner, không dùng bản sao đổi URL cũ:

```sh
cd /Volumes/T7-Workspace/Projects/Claude/city-crew-e2e-stability/app
EXPO_URL=exp://127.0.0.1:8085 caffeinate -i bash .maestro/smoke.sh
```

Nếu nhiều simulator đang boot, chọn UDID tường minh cho Maestro (lượt retry dùng wrapper local `.smoke-local/device-bin/maestro` thêm `--device`); không để auto-select sang thiết bị khác. Đảm bảo Node/Maestro có trong PATH.

3. Muốn chứng nhận baseline xanh hoàn toàn, chạy lại **22/22 cùng revision cuối** và xác nhận JUnit + cleanup. Kết quả hiện tại chỉ xác nhận toàn suite trên `52946726` và hồi quy 3 case trên `f3fedc5e`.
4. Tiếp theo P1: flow Profile/Account và ScreenBoundary/router thật; chưa triển khai trong nhánh này. P2: quan hệ bạn bè/avatar bằng fixture riêng. P3: comments cần preflight flag, quota và cleanup đúng dữ liệu run.
5. Tối ưu suite: testcase baseline tổng ~84m24s; trip invite ~20m04s (~24%), tab bar ~8m47s, theme ~7m51s. Đo chi phí setup/auth trước khi giảm cold start; giữ kiểm tra đúng identity và dữ liệu sau reload. Đây không phải số đo latency app.
