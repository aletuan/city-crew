# Đánh giá: dùng LLM tại chỗ của iOS thay cho Anthropic

Ngày đánh giá: 2026-09-10. Trạng thái: **đánh giá, chưa quyết** — không có gì
trong tài liệu này đã được cài vào app.

Câu hỏi: cityCrew có thể dùng mô hình ngôn ngữ chạy ngay trên iPhone
(Apple Foundation Models / Apple Intelligence) thay vì gọi model Anthropic qua
Edge Function không?

## Kết luận ngắn

- **Có thể thay cho gần như toàn bộ việc model đang làm**, trên các máy đủ
  điều kiện, ngay hôm nay: tác vụ của cityCrew là loại việc Apple thiết kế mô
  hình on-device cho (viết ngắn theo dữ kiện cho sẵn, đầu ra có cấu trúc), tiếng
  Việt đã được hỗ trợ từ iOS 26.1, và prompt hiện tại (~1.300 token) lọt thoải
  mái vào cửa sổ 4K.
- **Không thể *bỏ hẳn* Anthropic**: mô hình tại chỗ chỉ có trên iPhone 15 Pro
  trở lên có bật Apple Intelligence. Android (hơn 85% thị trường Việt Nam) và
  iPhone cũ không có gì để chạy — hoặc giữ Edge Function cho họ, hoặc chấp nhận
  họ nhận bản "facts-only" mà app vốn đã có sẵn.
- **Từ 14/9/2026 (iOS 27) có thêm một tầng miễn phí ở giữa**: model server của
  Apple trên Private Cloud Compute, 32K context, không tốn phí API cho dev
  trong Small Business Program, nhưng phải xin entitlement và mỗi người dùng có
  hạn mức ngày.
- **Khuyến nghị**: kiến trúc bốn tầng (on-device → PCC → Edge/Anthropic →
  rules), bắt đầu bằng một PoC 1–2 buổi cho `narrate` trên iOS, so mù chất
  lượng tiếng Việt với Opus trên ~20 plan thật trước khi quyết.

## 1. cityCrew đang dùng model cho việc gì

Toàn bộ lời gọi model đi qua **một** Edge Function,
`supabase/functions/plan-assist/index.ts`, model `claude-opus-5`,
`effort: "low"`:

| Hành động | Trạng thái | Vào | Ra |
|---|---|---|---|
| `narrate` | **đang chạy** | draft + tối đa 8 stop đã chọn (slug, tên, loại, khu, giờ đến, rating), ngôn ngữ en/vi/ja | `{ title ≤ 6 từ, stops: [{ slug ∈ enum, why ≤ 20 từ }] }` |
| `parse` | có code, **không màn hình nào gọi** (#200) | một câu tự do + taxonomy + danh sách quận | chip wizard, mọi trường là enum |
| `revise` | chỉ có trong thiết kế (#205) | — | — |

Ba đặc điểm quyết định câu trả lời:

1. **Model chỉ viết chữ, không chọn quán.** `planner.ts` chọn và xếp thứ tự
   hoàn toàn bằng số học trên máy; model nhận danh sách đã chốt và bị ràng
   buộc bằng JSON schema — `slug` là `enum` của đúng các slug được gửi.
2. **System prompt cấm world knowledge một cách tường minh**: *"You may
   recognise some of these places; write as if you do not. No dishes, no
   decor, no house speciality, no history."* Tức là cityCrew đã tự tước đi thứ
   duy nhất mà model lớn hơn hẳn model nhỏ — kiến thức về thế giới — để đổi
   lấy an toàn. Phần còn lại (giọng văn, ngắn gọn, đúng ngôn ngữ) là việc một
   model 3B làm được.
3. **App đã được thiết kế để sống không có model.** `narrate` không bao giờ
   throw; vắng model thì `derivedTitle`/`factLine` in tên và dòng dữ kiện; trip
   lưu `generated_by: rules | rules+llm`. Đổi engine sinh chữ vì thế là việc
   *thay một nguồn prose*, không phải đụng vào planner.

Số đo thật (từ `docs/ai-agent-planner.md`): system prompt 786 token, phần thay
đổi ~260, ra ~219 — **~1.300 token một lượt**; chi phí ~$0,0072–0,0117 mỗi lần,
tức ~$8 cho 1.000 lượt. Với 47 trip đã lưu từ 17/8 (43 có prose của model,
4 không), chi phí hiện tại là **vài xu một tháng** — tiền không phải lý do để
đổi. Lý do, nếu có, là **độ trễ** (Edge Function khoẻ mất 3–8 giây, app giữ
màn hình tối đa 8 giây), **offline**, **riêng tư** (không gửi kế hoạch của
người dùng ra ngoài), và **bớt một nhà cung cấp**.

## 2. Apple cung cấp gì, tính đến 10/9/2026

### 2.1 Mô hình tại chỗ — Foundation Models framework (iOS 26, 9/2025)

- Model ~**3 tỷ tham số, lượng tử 2-bit**, chạy hoàn toàn trên máy, không
  cần tải, không tốn phí, không có API key.
- Apple nói thẳng nó **tối ưu cho** tóm tắt, trích xuất, phân loại, sinh nội
  dung ngắn; **không dành cho** world knowledge hay suy luận sâu — khớp mục 1.
- **Guided generation** (`@Generable`): đầu ra có cấu trúc được *bảo đảm* bằng
  constrained decoding, không phải "xin JSON rồi parse". Ràng buộc `slug ∈ enum`
  của cityCrew ánh xạ thẳng sang `@Guide(.anyOf(...))`.
- **Tool calling**, session nhiều lượt, streaming.
- Cửa sổ ngữ cảnh **4.096 token** trên iOS 26 (Apple nêu `contextSize`
  8.192 trong phiên WWDC26 cho iOS 27). cityCrew cần ~1.300.
- **Ngôn ngữ**: tiếng Anh, Nhật có từ iOS 26.0; **tiếng Việt có từ iOS 26.1
  (3/11/2025)**. App kiểm tra lúc chạy bằng `supportsLocale(_:)` /
  `supportedLanguages`, không hard-code.
- **Thiết bị**: iPhone 15 Pro/Pro Max và mọi iPhone 16, 17 (kể cả 16e, 17e,
  Air); iPad/Mac chip A17 Pro hoặc M1 trở lên. Người dùng phải **bật** Apple
  Intelligence, có ~7 GB trống, vùng và ngôn ngữ được hỗ trợ.
- API availability trả lý do rõ (`deviceNotEligible`,
  `appleIntelligenceNotEnabled`, `modelNotReady`) — đúng chỗ để rẽ sang fallback.

### 2.2 iOS 27 — phát hành 14/9/2026

- **Model on-device mới**, Apple mô tả "rebuilt from the ground up", tốt hơn ở
  logic và tool calling; thêm đầu vào **hình ảnh**. Theo báo cáo AFM 3 (qua
  nguồn thứ cấp — trang Apple ML bị chặn từ môi trường này): hai model tại chỗ,
  *AFM 3 Core* 3B dense và *AFM 3 Core Advanced* 20B thưa (kích hoạt 1–4B mỗi
  lượt). Máy nào nhận model nào **chưa xác minh được**.
- **`PrivateCloudComputeLanguageModel`** mở cho app bên thứ ba: 32K context,
  ba mức reasoning, **"no token costs to you, the developer"**. Điều kiện (theo
  trang Apple Developer): trong **App Store Small Business Program**, dưới
  **2 triệu lượt tải lần đầu**, và được cấp **entitlement**
  `com.apple.developer.private-cloud-compute` (xin qua form, đã mở). Vượt
  ngưỡng → 6 tháng để chuyển đi; không có tầng trả phí. **Mỗi người dùng có
  hạn mức ngày** (cao hơn nếu iCloud+); chạm hạn → request throw, có
  `quotaUsage.isLimitReached` để hỏi trước. **Chỉ chạy trên máy đủ điều kiện
  Apple Intelligence** — không phải lối thoát cho iPhone cũ.
- **Giao thức `LanguageModel`**: cùng một `LanguageModelSession` giờ nhận
  model tại chỗ, model PCC, *hoặc* model bên thứ ba — Apple nói Anthropic và
  Google phát hành Swift package. Với cityCrew điều này có nghĩa: **một lớp
  gọi duy nhất** trong native module, chỉ đổi đối số `model:` để đi tầng nào.

### 2.3 Mức độ phù hợp với tác vụ

| Tiêu chí | `narrate` cần | Model tại chỗ | Ghi chú |
|---|---|---|---|
| Kiểu việc | viết 1 tên + ≤8 câu ngắn từ dữ kiện cho sẵn | ✅ đúng sở trường | Apple: "content generation" từ input |
| Cấu trúc | JSON, slug ∈ enum | ✅ tốt hơn hiện tại | constrained decoding, không cần "kiểm lại lần ba" |
| Ngôn ngữ | en / vi / ja | ✅ cả ba (vi từ 26.1) | kiểm `supportsLocale` lúc chạy |
| Context | ~1.300 token | ✅ 4K–8K | dư 3–6 lần |
| Giọng văn vi | "như bạn bè", không brochure | ⚠️ **chưa biết** | rủi ro chính, phải đo |
| World knowledge | bị cấm bởi prompt | ✅ không cần | khớp cố ý |
| Offline | hiện không có | ✅ có | plan offline có luôn cả prose |
| Độ trễ | 3–8 s qua Edge | ✅ kỳ vọng dưới 2 s | chưa đo trên máy thật |

Riêng `parse` (nếu #200 làm sống lại): guided generation với enum là **đúng
công cụ**, thậm chí hợp hơn server — câu tự do thành chip, không rời máy.

## 3. Độ phủ người dùng — vì sao "thay" không phải "bỏ"

- Việt Nam: Android **trên 85%** thị phần di động (StatCounter, 2026); iOS
  phần còn lại, và chỉ tập con iPhone 15 Pro+ đủ điều kiện, lại còn phải tự bật
  Apple Intelligence. Ước lượng thô: **một phần nhỏ người dùng** chạy được
  model tại chỗ — con số chính xác phụ thuộc tập người dùng thật của cityCrew,
  vốn đang nghiêng iOS vì App Store lên trước.
- cityCrew **ship cả Android** (`com.aletuan.citycrew`), nên mọi thiết kế chỉ
  chạy trên iOS đều để lại nửa còn lại: giữ Edge Function, hoặc chọn rules-only
  cho họ. Cả hai đều hợp lệ; chọn cái nào là quyết định sản phẩm, không phải kỹ
  thuật.
- Android có lựa chọn tương đương (Gemini Nano qua ML Kit GenAI, hoặc model
  mở qua `@react-native-ai/mlc`/`llama`) nhưng cần tải model và không nằm
  trong phạm vi câu hỏi này.

## 4. Đường tích hợp trong Expo

Hiện trạng app: Expo SDK 54 (`~54.0.37`), React Native 0.81.5, New Architecture
(mặc định của SDK 54), đã dùng EAS dev client + build — tức **native module
cài được**, không cần đổi cách build. Chưa có `ai` (Vercel AI SDK) trong deps.

| Lựa chọn | Có gì | Thiếu gì |
|---|---|---|
| **A. `@react-native-ai/apple`** (Callstack, 0.12.0, 1/2026) | `generateText`/`streamText`/`generateObject` (Zod), `apple.isAvailable()`, iOS 26+, Expo SDK 54, AI SDK v6 | **Chưa có PCC** hay giao thức `LanguageModel` (bản mới nhất ra trước WWDC26); chưa thấy lộ `supportsLocale`/lý do unavailable |
| **B. `react-native-apple-llm`** | availability kèm lý do, structured output theo schema, tools, streaming | không có hướng dẫn Expo/config plugin; ghi rõ "beta" |
| **C. Expo Module Swift tự viết** (~150–250 dòng) | kiểm soát đủ: `SystemLanguageModel`, `PrivateCloudComputeLanguageModel`, `supportsLocale`, `quotaUsage`, một session API cho mọi tầng | tự bảo trì; cần Xcode 26/27 trên EAS (ảnh build mặc định đã có) |

Khuyến nghị **C**: bề mặt cityCrew cần rất hẹp (một hàm `narrate(stops, draft,
lang) → {title, stops}` có ràng buộc), và chỉ C dùng được PCC và giao thức mới
ngay khi iOS 27 ra. A là đường tắt hợp lý cho PoC nếu muốn đo chất lượng trong
một buổi.

Kiểm thử: iOS Simulator trên macOS 26 với Apple Intelligence bật chạy được
model; EAS build không đổi; bộ test hiện có không đụng (native module được mock
như mọi native dependency khác trong `uitest/setup.tsx`).

## 5. Kiến trúc đề xuất

```
narrate(stops, draft, lang)
  ├─ 1. on-device  nếu availability == available && supportsLocale(lang)
  ├─ 2. PCC        nếu iOS 27 && có entitlement && !quotaUsage.isLimitReached
  ├─ 3. Edge Function (Anthropic)   — Android, iPhone cũ, Apple Intelligence tắt
  └─ 4. rules      — derivedTitle + factLine (đã có)
```

- **Hợp đồng không đổi**: cùng `Narration { title, why: Map<slug,string>,
  fromModel }`, cùng cache `narrationKey`, cùng `NARRATION_HOLD_MS`. Màn hình
  không biết prose đến từ tầng nào.
- **Prompt dùng lại nguyên văn**: `SYSTEM` của `plan-assist` là instructions
  của session; phần "ask" là prompt; schema JSON thành `@Generable` với
  `@Guide(.anyOf(slugs))` cho `slug`. Ba lớp kiểm slug hiện có giữ nguyên.
- **Nên** thêm giá trị cho `generated_by` (`rules+device`, `rules+pcc`) để
  biết prose đến từ đâu khi đọc lại trip — đây là **thay đổi cột/constraint**,
  cần migration, để chủ dự án quyết riêng.
- Tầng 1 và 2 **không rời máy hoặc rời máy có kiểm chứng**; tầng 3 giữ nguyên
  chính sách hiện tại. Đây là lúc nên cập nhật
  `docs/store/app-privacy-labels.md` nếu tầng 3 bị bỏ.

## 6. Được gì, mất gì

| | Giữ Anthropic qua Edge | On-device (+PCC) |
|---|---|---|
| Độ trễ | 3–8 s, đôi khi tới 12 s | kỳ vọng < 2 s (chưa đo) |
| Chi phí | vài xu/tháng hiện tại, tuyến tính theo người dùng | 0 |
| Riêng tư | kế hoạch đi qua Supabase → Anthropic | không rời máy / PCC không lưu prompt |
| Offline | không có prose | có prose |
| Chất lượng | Opus, ổn định | 3B: **cần đo**, đặc biệt tiếng Việt |
| Độ phủ | mọi máy có mạng | thiểu số máy iOS mới |
| Vận hành | 1 secret, 1 function, 1 hoá đơn | native module, 2–3 tầng logic, entitlement |
| Phụ thuộc | Anthropic | Apple (chính sách, hạn mức, entitlement) |

## 7. Rủi ro

1. **Giọng tiếng Việt của model 3B** — rủi ro thật duy nhất về sản phẩm.
   Giảm bằng cách đo: 20 plan thật, hai bản prose (Opus / on-device), người
   duyệt không biết bản nào của ai.
2. **PCC**: entitlement phải được duyệt (thời gian không rõ); hạn mức ngày
   không công bố số; chỉ chạy trên máy đủ điều kiện nên không mở rộng độ phủ,
   chỉ nâng chất lượng cho cùng nhóm máy.
3. **Độ chín của cầu nối cộng đồng** — chưa theo kịp iOS 27; tự viết module thì
   tự bảo trì.
4. **Hai giọng văn trong cùng app** (Opus cho Android, 3B cho iOS mới). App đã
   chấp nhận "rules vs llm", nên đây là sự chênh đã có, không phải mới.
5. **Người dùng chưa bật Apple Intelligence** — không có số liệu; API
   availability trả đúng lý do nên rẽ fallback sạch.

## 8. Khuyến nghị và bước tiếp theo

1. **PoC `narrate` on-device** trên iOS, sau cờ, giữ nguyên hợp đồng (1–2 buổi:
   Expo Module Swift hoặc lựa chọn A để đi nhanh).
2. **So mù chất lượng** trên ~20 plan thật, ba ngôn ngữ, chủ dự án chấm.
3. **Nộp đơn entitlement PCC** song song — miễn phí, đủ điều kiện, mất gì thì
   mất thời gian chờ.
4. **Quyết định tầng 3** sau khi có số: giữ Edge cho Android/iPhone cũ, hay
   để họ dùng rules-only.
5. `parse` để nguyên cho đến khi #200 có lý do sống lại; khi đó guided
   generation on-device là đường mặc định.

Ước lượng: PoC 1–2 buổi; đưa vào production (module, ba tầng, test, migration
`generated_by`, cập nhật privacy labels) 3–5 buổi.

## Nguồn

- Apple, WWDC26 §241 *What's new in the Foundation Models framework* —
  https://developer.apple.com/videos/play/wwdc2026/241/
- Apple, WWDC26 §319 *Build with the new Apple Foundation Model on Private
  Cloud Compute* — https://developer.apple.com/videos/play/wwdc2026/319/
- Apple, WWDC25 §286 *Meet the Foundation Models framework* —
  https://developer.apple.com/videos/play/wwdc2025/286/
- Apple Developer, *Private Cloud Compute* (điều kiện, entitlement) —
  https://developer.apple.com/private-cloud-compute/
- Apple Developer, `SystemLanguageModel.supportedLanguages` —
  https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel/supportedlanguages
- AppleInsider, *iOS 26.1 arrives with … more Apple Intelligence languages*
  (3/11/2025) — https://appleinsider.com/articles/25/11/03/ios-261-arrives-with-new-toggles-and-more-apple-intelligence-languages
- MacRumors, *Apple Announces iOS 27 Release Date* (14/9/2026) —
  https://www.macrumors.com/2026/09/09/apple-announces-ios-27-release-date/
- Apple ML Research, *Introducing the Third Generation of Apple's Foundation
  Models* (không truy cập được từ môi trường này; số 3B/20B lấy qua 9to5Mac,
  MacStories) — https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models
- Callstack, `@react-native-ai/apple` — https://github.com/callstackincubator/ai
- deveix, `react-native-apple-llm` — https://github.com/deveix/react-native-apple-llm
- StatCounter, Mobile OS market share Viet Nam —
  https://gs.statcounter.com/os-market-share/mobile/viet-nam
- Nội bộ: `supabase/functions/plan-assist/index.ts`, `app/src/lib/assist.ts`,
  `docs/ai-agent-planner.md` (mục *Chi phí và vận hành*).
