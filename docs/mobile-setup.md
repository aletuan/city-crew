# Data desk trên điện thoại — hướng dẫn kích hoạt

Sau thay đổi này, toàn bộ quy trình curation chạy không cần máy tính:

```
Điện thoại ──▶ Dashboard (GitHub Pages, đăng nhập magic link)
                 │  đọc/ghi trực tiếp Supabase (anon key + RLS)
                 ├─ "Add place" ──▶ Edge Function fetch-place ──▶ Google Places ──▶ DB
                 └─ "Sync mockup" ─▶ Edge Function sync-mockup ─▶ GitHub Actions
                                        └─ export-snapshot + inject-mockup → commit
```

## Đã cấu hình sẵn phía Supabase ✅

Những phần này đã được apply trực tiếp lên project `citycrew-data`
(amdvitzpogaejzzqroco) — ghi lại đây để tra cứu, không cần làm lại:

- **Migration `mobile_editor_auth`** (nguồn:
  `supabase/migrations/20260807000000_mobile_editor_auth.sql`): bảng
  `editors` (allow-list email được quyền ghi — đã seed `anhlt1983@gmail.com`),
  hàm `is_editor()`, và Row Level Security trên `places`, `place_photos`,
  `collections`, `collection_places` + policy ghi cho bucket `place-photos`.
  Người lạ (kể cả đã đăng nhập) chỉ đọc được nội dung published + approved;
  đã kiểm chứng: role anon thấy đúng 22/41 địa điểm, 0 dòng bảng `editors`.
  Thêm editor mới: `insert into editors (email) values ('em@example.com');`
- **Edge Functions `fetch-place` và `sync-mockup`** đã deploy (verify JWT bật,
  kèm kiểm tra allow-list `editors` bên trong). Nguồn: `supabase/functions/`.

Key phía client là **publishable key** (`sb_publishable_…`) — công khai theo
thiết kế (nằm trong mọi client bundle; RLS mới là lớp bảo vệ) nên được nhúng
sẵn vào 2 workflow và `.env.example`, không cần cấu hình GitHub Variables.
Dùng định dạng publishable thay cho anon key JWT legacy để secret scanner
(GitGuardian…) không báo nhầm, và có thể rotate độc lập tại Supabase →
Settings → API Keys. Nếu rotate, đặt repo Variables `VITE_SUPABASE_ANON_KEY`
/ `VITE_SUPABASE_URL` để override.

## Việc còn lại (làm một lần, từ trình duyệt điện thoại)

### 1. Supabase — Auth URL (bắt buộc)

[Authentication → URL Configuration](https://supabase.com/dashboard/project/amdvitzpogaejzzqroco/auth/url-configuration):

- **Site URL**: `https://aletuan.github.io/city-crew/`
- **Redirect URLs**: thêm `https://aletuan.github.io/city-crew/**`
  (và `http://localhost:5180/**` nếu còn dev local)

Khuyến nghị: Authentication → Sign In / Up → tắt **Allow new users to sign
up** (RLS đã chặn người ngoài ghi data, tắt luôn cho sạch).

### 2. Supabase — Function secrets

[Edge Functions → Secrets](https://supabase.com/dashboard/project/amdvitzpogaejzzqroco/functions/secrets):

- `GOOGLE_MAPS_API_KEY` — bắt buộc cho **＋ Add place** (key Google Maps
  Platform đã dùng cho `data/scripts/fetch-places.mjs`).
- `GH_PAT` — chỉ cần cho nút **Sync mockup** trong dashboard: GitHub →
  Settings → Developer settings → Fine-grained tokens → repo
  `aletuan/city-crew`, quyền **Actions: Read and write**. Bỏ qua cũng được —
  sync bằng GitHub app: Actions → *Sync mockup from database* → Run workflow.

### 3. GitHub — secret cho bản đồ (bắt buộc nếu muốn thấy bản đồ)

Repo → Settings → Secrets and variables → Actions → **New repository
secret**: `VITE_GOOGLE_MAPS_KEY`, giá trị là một **browser key** của Google
Maps Platform.

Key đó cần, trong Google Cloud Console → Credentials:

- **API restrictions**: bật **Maps JavaScript API**. Desk không gọi Embed,
  Static hay Places bằng key này, nên không cần bật gì thêm.
- **Website restrictions**: thêm `https://aletuan.github.io/*` và
  `http://localhost:*`. Thiếu dòng đầu thì bản đồ chạy ở máy bạn và **trắng
  trên Pages** — đây là cách hỏng hay gặp nhất.
- **Quota cap** hằng ngày. Key nằm trong bundle công khai và referrer thì giả
  mạo được, nên hạn mức mới là cái phanh thật.

Đây là secret chứ không phải variable, và không có giá trị mặc định trong
repo: khác `VITE_SUPABASE_ANON_KEY`, phía sau nó không có RLS. Bỏ qua bước
này thì desk vẫn chạy — Coverage vẫn vẽ bubble trên nền tối, khung Fact-check
vẫn hiện toạ độ — chỉ là không có bản đồ.

Dev local: đặt `VITE_GOOGLE_MAPS_KEY` trong `dashboard/.env.local` (đã được
gitignore) hoặc truyền thẳng vào lệnh: `VITE_GOOGLE_MAPS_KEY=… npm run dev`.

### 4. GitHub — Pages (bắt buộc)

Repo → Settings → Pages → **Source: GitHub Actions**. Merge PR này vào
`main` là workflow *Deploy dashboard to GitHub Pages* tự chạy; dashboard lên
tại **https://aletuan.github.io/city-crew/**. Trên điện thoại: mở URL →
Share → **Add to Home Screen** để dùng như app.

## Quy trình hằng ngày (từ điện thoại)

1. Mở Data desk → đăng nhập bằng email (magic link, một lần mỗi thiết bị).
2. Duyệt/sửa địa điểm, chụp & upload ảnh, Approve/Flag như cũ.
3. Đứng ở quán mới? **＋ Add place** → gõ tên → Import → chỉnh → Approve.
4. Xong phiên: bấm **Sync mockup** — GitHub Actions xuất snapshot từ database
   và commit mockup mới lên `main`.
5. Xem kết quả: mockup mới nhất luôn ở
   **https://aletuan.github.io/city-crew/mockup.html** (commit sync tự
   kích hoạt deploy lại Pages, chờ ~1 phút sau khi sync).

## Ghi chú

- Đăng nhập được ≠ sửa được: tài khoản ngoài bảng `editors` chỉ xem như
  khách (mọi write bị RLS chặn, Edge Function trả 403).
- Security advisor của Supabase báo 2 cảnh báo về `is_editor()` (anon/
  authenticated gọi được qua RPC) và 1 INFO về bảng `editors` không có
  policy — cả ba đều là chủ đích: hàm chỉ trả lời "chính bạn có phải editor
  không", bảng `editors` deny-all để chỉ service role đọc được.
- Kéo-thả đổi thứ tự ảnh cần chuột — trên điện thoại tính năng này hạn chế
  (HTML5 drag & drop không hỗ trợ cảm ứng); các thao tác khác đầy đủ.
- Server Express local (`dashboard/server/`) đã bỏ — không còn service key
  nào ngoài Supabase. Dev local: `cp .env.example .env.local` → `npm run dev`.
