// The two public documents, as data rather than as two web pages.
//
// They live here because the app now *shows* them — a sheet over the
// sign-up form and two rows in settings — and they also have to stay
// reachable at a URL, because the App Store requires one. That is two
// copies of a legal document, which is exactly the condition that let
// privacy.html carry "there is no password" for as long as it did while
// the form above the link had a password field in it.
//
// So there is one copy, and it is this one. `legalhtml.ts` renders these
// blocks into the pages under `dashboard/public/`, `npm run legal:build`
// writes them, and `legalhtml.test.ts` fails if what is committed there
// is not what these blocks produce. Edit the words here and nowhere else.
//
// Two languages, matching the pages: Japanese falls back to English
// through `t()`, which is what a reader following the same link in a
// browser already gets. Inventing a legal translation is not a thing to
// do quietly.
//
// The markup is two marks and no more — `**bold**` and `[text](href)`.
// `legalmark.ts` reads them. Anything richer would be a second document
// format nobody asked for; see the note there.

/** A paragraph, heading, or bullet list. Headings carry no `id`: the app
 *  scrolls, the page anchors off its own text, and neither needs one. */
export type Block =
  | { k: 'h2' | 'h3' | 'p'; en: string; vi: string }
  | { k: 'ul'; en: string[]; vi: string[] };

export type LegalId = 'terms' | 'privacy';

export type Doc = {
  id: LegalId;
  /** The file this renders to, and the last segment of its public URL. */
  file: string;
  /** As the sheet's header shows it. The pages prefix "City Crew — ". */
  title: { en: string; vi: string };
  /** Moves whenever the words below change materially. */
  effective: { en: string; vi: string };
  blocks: Block[];
};


export const TERMS: Doc = {
  id: 'terms',
  file: 'terms.html',
  title: { en: 'Terms of Service', vi: 'Điều khoản sử dụng' },
  effective: { en: 'Effective 29 August 2026', vi: 'Hiệu lực từ 29/08/2026' },
  blocks: [
    { k: 'p',
      en: 'City Crew is a curated city guide for Vietnam. You can browse all of it without an account. These terms apply from the moment you use the app, and they matter most once you sign in and start posting things other people can see. They sit alongside our [Privacy Policy](privacy.html), which covers what the app does with your data.',
      vi: 'City Crew là cẩm nang thành phố có tuyển chọn cho Việt Nam. Bạn có thể xem toàn bộ nội dung mà không cần tài khoản. Điều khoản này áp dụng từ lúc bạn dùng app, và quan trọng nhất khi bạn đăng nhập rồi bắt đầu đăng những thứ người khác nhìn thấy. Nó đi kèm [Chính sách quyền riêng tư](privacy.html), nơi nói về việc app làm gì với dữ liệu của bạn.' },
    { k: 'h2',
      en: 'Your account',
      vi: 'Tài khoản của bạn' },
    { k: 'p',
      en: 'One account per person. Use a display name and photo that are yours to use — the display name sits beside your handle wherever your public work appears, and it is not a place to borrow somebody else\'s identity. Keep your password to yourself; anything posted from your account is treated as posted by you.',
      vi: 'Mỗi người một tài khoản. Dùng tên hiển thị và ảnh mà bạn có quyền dùng — tên hiển thị nằm cạnh handle của bạn ở mọi nơi có nội dung công khai của bạn, và đó không phải chỗ để mượn danh người khác. Giữ mật khẩu cho riêng mình; mọi thứ đăng từ tài khoản của bạn được xem là do bạn đăng.' },
    { k: 'p',
      en: 'You must be at least 13 to have an account.',
      vi: 'Bạn phải từ 13 tuổi trở lên mới được có tài khoản.' },
    { k: 'h2',
      en: 'What you may post, and what you may not',
      vi: 'Được đăng gì, không được đăng gì' },
    { k: 'p',
      en: 'Collections, trip plans, profile text, place suggestions and reports are all written by people, and this is the part of the app where one person\'s words reach another. **We do not tolerate objectionable content or abusive behaviour.** Do not post:',
      vi: 'Bộ sưu tập, kế hoạch đi chơi, phần giới thiệu hồ sơ, địa điểm đề xuất và báo cáo đều do người viết ra, và đây chính là phần của app nơi lời của người này đến với người kia. **Chúng tôi không dung thứ nội dung phản cảm hay hành vi lăng mạ.** Không được đăng:' },
    { k: 'ul',
      en: [
        '**Harassment or abuse** — threats, targeted insults, or anything meant to frighten or humiliate another person.',
        '**Hate** — content attacking people over race, ethnicity, nationality, religion, disability, gender, age or sexual orientation.',
        '**Sexual content** — pornography, or any sexual content involving minors, which we report to the authorities without exception.',
        '**Impersonation** — passing yourself off as another person, a business, or City Crew itself.',
        '**Spam** — advertising, repetition, or collections made to push traffic somewhere rather than to be read.',
        '**Illegal content** — anything unlawful in Vietnam or where you are, including content that infringes someone else\'s copyright.',
        '**Private information** — someone else\'s address, phone number or documents, posted without their consent.',
      ],
      vi: [
        '**Quấy rối hoặc lăng mạ** — đe doạ, xúc phạm nhắm vào một người, hay bất cứ thứ gì nhằm khiến người khác sợ hãi hoặc bẽ mặt.',
        '**Thù ghét** — nội dung tấn công người khác vì chủng tộc, sắc tộc, quốc tịch, tôn giáo, khuyết tật, giới tính, tuổi tác hay xu hướng tính dục.',
        '**Nội dung tình dục** — nội dung khiêu dâm, và tuyệt đối không có nội dung tình dục liên quan tới trẻ em; trường hợp đó chúng tôi báo cơ quan chức năng, không có ngoại lệ.',
        '**Mạo danh** — giả làm người khác, giả làm một doanh nghiệp, hay giả làm chính City Crew.',
        '**Spam** — quảng cáo, đăng lặp, hay bộ sưu tập lập ra để kéo lượt truy cập đi chỗ khác chứ không phải để người ta đọc.',
        '**Nội dung phi pháp** — bất cứ điều gì trái luật Việt Nam hoặc nơi bạn đang ở, kể cả nội dung xâm phạm bản quyền của người khác.',
        '**Thông tin riêng tư của người khác** — địa chỉ, số điện thoại hay giấy tờ của ai đó, đăng lên khi chưa được họ đồng ý.',
      ] },
    { k: 'p',
      en: 'Places you suggest are reviewed by our editorial desk before they appear in the catalog for anyone else.',
      vi: 'Địa điểm bạn đề xuất được ban biên tập duyệt trước khi xuất hiện trong danh mục cho người khác.' },
    { k: 'h2',
      en: 'Your content stays yours',
      vi: 'Nội dung vẫn là của bạn' },
    { k: 'p',
      en: 'You keep ownership of everything you write. By publishing a collection or filling in a profile, you give us permission to store it and show it where you chose to make it visible — nothing more. A collection you keep private is shown to nobody. Delete the content, or your account, and that permission ends with it.',
      vi: 'Bạn giữ quyền sở hữu mọi thứ mình viết. Khi công khai một bộ sưu tập hay điền hồ sơ, bạn cho phép chúng tôi lưu và hiển thị nó ở đúng nơi bạn đã chọn để hiện — không hơn. Bộ sưu tập bạn để riêng tư thì không ai thấy. Xoá nội dung, hoặc xoá tài khoản, thì quyền đó chấm dứt theo.' },
    { k: 'h2',
      en: 'Reporting and blocking',
      vi: 'Báo cáo và chặn' },
    { k: 'p',
      en: 'Every collection and every profile can be **reported** from inside the app, in a few taps, with a reason and an optional note. You cannot report yourself, and there is a daily limit so the queue stays usable for people who need it.',
      vi: 'Mọi bộ sưu tập và mọi hồ sơ đều có thể **báo cáo** ngay trong app, chỉ vài lần chạm, kèm lý do và ghi chú tuỳ chọn. Bạn không thể tự báo cáo chính mình, và có hạn mức mỗi ngày để hàng đợi còn dùng được cho người thật sự cần.' },
    { k: 'p',
      en: 'You can also **block** another user. Be clear about what a block does: it is a contact policy, not a content filter. It ends the friendship between you, stops new friend requests, and keeps that person\'s likes out of your activity feed. **It does not hide their public collections** — those stay public, the same as they are to everyone else. Only you can see who you have blocked, and unblocking is immediate.',
      vi: 'Bạn cũng có thể **chặn** một người dùng khác. Nói rõ chặn làm được gì: đây là chính sách liên hệ, không phải bộ lọc nội dung. Nó cắt quan hệ bạn bè giữa hai người, ngăn lời mời kết bạn mới, và gỡ lượt thích của người đó khỏi mục Hoạt động của bạn. **Nó không ẩn bộ sưu tập công khai của họ** — những bộ sưu tập đó vẫn công khai, y như với mọi người khác. Chỉ mình bạn thấy danh sách mình đã chặn, và bỏ chặn có hiệu lực ngay.' },
    { k: 'h2',
      en: 'How we handle reports',
      vi: 'Chúng tôi xử lý báo cáo thế nào' },
    { k: 'p',
      en: 'Reports go to our editorial desk, which **aims to act within 24 hours** of a report arriving. The desk can do three things, and all three are reversible:',
      vi: 'Báo cáo đi tới ban biên tập, nơi **đặt mục tiêu xử lý trong vòng 24 giờ** kể từ khi báo cáo tới. Ban biên tập làm được ba việc, và cả ba đều đảo ngược được:' },
    { k: 'ul',
      en: [
        'Hide a public collection, so it is no longer visible to other users.',
        'Blank one field of a profile — a name, a bio, a photo.',
        'Stop an account from signing in.',
      ],
      vi: [
        'Ẩn một bộ sưu tập công khai, để người dùng khác không còn thấy nó.',
        'Xoá trắng một trường trong hồ sơ — một cái tên, một dòng giới thiệu, một tấm ảnh.',
        'Dừng một tài khoản, không cho đăng nhập nữa.',
      ] },
    { k: 'p',
      en: 'Nothing there can rewrite somebody\'s words, and nothing there can reach a private collection. We remove content that breaks the rules above and, for serious or repeated breaches, end the account behind it. If we end your account you can write to us at the address below.',
      vi: 'Không việc nào trong đó viết lại lời của ai, và không việc nào với tới được một bộ sưu tập riêng tư. Chúng tôi gỡ nội dung vi phạm các quy tắc trên, và với vi phạm nghiêm trọng hoặc lặp lại thì chấm dứt tài khoản đứng sau. Nếu chúng tôi chấm dứt tài khoản của bạn, bạn có thể viết thư cho chúng tôi theo địa chỉ bên dưới.' },
    { k: 'h2',
      en: 'Plans are written with an AI assistant',
      vi: 'Kế hoạch được viết bằng trợ lý AI' },
    { k: 'p',
      en: 'The app chooses the stops in a plan from our own catalog, then asks an AI assistant to write the title and the line about each stop. A plan is a suggestion, not a booking and not a guarantee. **Check opening hours, prices and whether a place still exists before you go.** Our [Privacy Policy](privacy.html) describes exactly what is sent.',
      vi: 'App tự chọn các điểm dừng trong kế hoạch từ danh mục của chính chúng tôi, rồi nhờ trợ lý AI viết tên kế hoạch và một dòng về mỗi điểm dừng. Kế hoạch là gợi ý, không phải đặt chỗ và không phải bảo đảm. **Hãy kiểm tra giờ mở cửa, giá cả và xem nơi đó còn tồn tại không trước khi đi.** [Chính sách quyền riêng tư](privacy.html) mô tả chính xác những gì được gửi đi.' },
    { k: 'h2',
      en: 'Ending your account',
      vi: 'Kết thúc tài khoản' },
    { k: 'p',
      en: 'You can leave at any time: **Profile → Delete account** removes your account and everything personal under it, immediately and permanently. No email required, no waiting period.',
      vi: 'Bạn có thể rời đi bất cứ lúc nào: **Hồ sơ → Xoá tài khoản** xoá tài khoản và mọi thứ cá nhân thuộc về nó, ngay lập tức và vĩnh viễn. Không cần gửi email, không phải chờ.' },
    { k: 'h2',
      en: 'No warranty',
      vi: 'Không bảo hành' },
    { k: 'p',
      en: 'City Crew is provided as it is. Our catalog is compiled with care but places close, move, change their hours and change their prices, and other users write things we have not read. We do not promise the app is accurate, complete, or available without interruption, and we are not liable for what happens on a trip you planned with it. Nothing here limits rights you have under Vietnamese law that cannot be waived.',
      vi: 'City Crew được cung cấp nguyên trạng. Danh mục của chúng tôi được soạn cẩn thận nhưng quán xá vẫn đóng cửa, dời chỗ, đổi giờ và đổi giá, còn người dùng khác thì viết những thứ chúng tôi chưa đọc. Chúng tôi không cam kết app luôn chính xác, đầy đủ hay không gián đoạn, và không chịu trách nhiệm cho những gì xảy ra trong chuyến đi bạn lên kế hoạch bằng app. Điều khoản này không hạn chế những quyền mà pháp luật Việt Nam cho bạn và không thể từ bỏ.' },
    { k: 'h2',
      en: 'Children',
      vi: 'Trẻ em' },
    { k: 'p',
      en: 'City Crew is not directed at children under 13, and accounts for them are not permitted. If you believe a child has created an account, write to us and we will remove it.',
      vi: 'City Crew không hướng tới trẻ em dưới 13 tuổi và không cho phép trẻ em lập tài khoản. Nếu bạn cho rằng một trẻ em đã lập tài khoản, hãy viết thư cho chúng tôi và chúng tôi sẽ xoá.' },
    { k: 'h2',
      en: 'Changes and contact',
      vi: 'Thay đổi và liên hệ' },
    { k: 'p',
      en: 'If these terms change materially we will update this page and its effective date. Continuing to use the app after that means you accept the new version. Questions: [anhlt1983@gmail.com](mailto:anhlt1983@gmail.com).',
      vi: 'Nếu điều khoản này thay đổi đáng kể, chúng tôi sẽ cập nhật trang này cùng ngày hiệu lực. Tiếp tục dùng app sau đó nghĩa là bạn chấp nhận bản mới. Câu hỏi: [anhlt1983@gmail.com](mailto:anhlt1983@gmail.com).' },
  ],
};

export const PRIVACY: Doc = {
  id: 'privacy',
  file: 'privacy.html',
  title: { en: 'Privacy Policy', vi: 'Chính sách quyền riêng tư' },
  effective: { en: 'Effective 29 August 2026', vi: 'Hiệu lực từ 29/08/2026' },
  blocks: [
    { k: 'p',
      en: 'City Crew is a curated city guide. You can browse everything in it without an account. This policy describes what the app collects when you do sign in, what it deliberately does not collect, and how to erase everything.',
      vi: 'City Crew là cẩm nang thành phố có tuyển chọn. Bạn có thể xem toàn bộ nội dung mà không cần tài khoản. Chính sách này mô tả app thu thập gì khi bạn đăng nhập, những gì app cố tình không thu thập, và cách xoá mọi thứ.' },
    { k: 'h2',
      en: 'What we collect',
      vi: 'Chúng tôi thu thập gì' },
    { k: 'h3',
      en: 'Your account',
      vi: 'Tài khoản của bạn' },
    { k: 'p',
      en: 'An account is an **email address and a password**. We email you a one-time code to confirm the address when you sign up, and again if you ever reset the password.',
      vi: 'Tài khoản là **một địa chỉ email và một mật khẩu**. Chúng tôi gửi mã một lần qua email để xác nhận địa chỉ khi bạn đăng ký, và gửi lại nếu bạn đặt lại mật khẩu.' },
    { k: 'h3',
      en: 'What you choose to share',
      vi: 'Những gì bạn chọn chia sẻ' },
    { k: 'p',
      en: 'Your profile (display name, handle, photo, bio), the collections and trip plans you create, places you save or like, place suggestions you submit, friend connections, and preferences you set (favourite categories, budget). All of it exists because you typed or picked it, and all of it is deleted with your account.',
      vi: 'Hồ sơ (tên hiển thị, handle, ảnh, giới thiệu), bộ sưu tập và kế hoạch đi chơi bạn tạo, địa điểm bạn lưu hoặc thích, địa điểm bạn đề xuất, kết nối bạn bè, và tuỳ chọn bạn đặt (thể loại yêu thích, ngân sách). Tất cả tồn tại vì bạn tự nhập hoặc tự chọn, và tất cả bị xoá cùng tài khoản.' },
    { k: 'h3',
      en: 'Activity history — on, and yours to switch off',
      vi: 'Lịch sử hoạt động — bật sẵn, và bạn tắt được' },
    { k: 'p',
      en: 'The app remembers which places you open, so somewhere you looked at and walked away from stops coming back. This is **on when your account is made**, and the sign-up screen tells you so before anything is recorded. Turn it off any time under Edit profile → Remember what I open: the switch is enforced in our database, not just in the app, so once it is off nothing can record for you. **Delete my history** sits beside it and works whether the switch is on or off — switching recording off and being unable to remove what was already kept would be no protection at all. This history is never shown to anyone else and never leaves your account.',
      vi: 'App ghi nhớ những địa điểm bạn mở, để nơi bạn đã xem rồi bỏ qua thôi quay lại. Việc này **bật sẵn khi tài khoản được tạo**, và màn hình đăng ký nói rõ điều đó trước khi bất cứ gì được ghi. Tắt lúc nào cũng được trong Sửa hồ sơ → Nhớ những chỗ tôi mở: công tắc này được ép ngay ở tầng cơ sở dữ liệu, không chỉ trong app, nên khi đã tắt thì không gì ghi được cho bạn nữa. Nút **Xoá lịch sử của tôi** nằm ngay cạnh và dùng được dù công tắc đang bật hay tắt — tắt ghi mà không xoá được thứ đã ghi thì chẳng bảo vệ được gì. Lịch sử này không bao giờ hiển thị cho người khác và không bao giờ rời khỏi tài khoản của bạn.' },
    { k: 'h2',
      en: 'What we do not collect',
      vi: 'Chúng tôi không thu thập gì' },
    { k: 'ul',
      en: [
        '**Your location never leaves your phone.** The app reads it once, on-device, to open on the nearest city. It is not sent to our servers and not stored anywhere.',
        '**No advertising, no trackers, no third-party analytics.** The App Store build sends no diagnostics or usage analytics of any kind.',
        '**No device identifiers.** We do not collect advertising IDs or fingerprint your device.',
      ],
      vi: [
        '**Vị trí của bạn không bao giờ rời khỏi điện thoại.** App đọc vị trí một lần, ngay trên máy, để mở đúng thành phố gần nhất. Vị trí không được gửi lên máy chủ và không được lưu ở bất cứ đâu.',
        '**Không quảng cáo, không tracker, không analytics bên thứ ba.** Bản phát hành trên App Store không gửi bất kỳ dữ liệu chẩn đoán hay thống kê sử dụng nào.',
        '**Không định danh thiết bị.** Chúng tôi không thu thập advertising ID hay nhận dạng thiết bị của bạn.',
      ] },
    { k: 'h2',
      en: 'Where your data lives',
      vi: 'Dữ liệu được lưu ở đâu' },
    { k: 'p',
      en: 'Data is stored with [Supabase](https://supabase.com) in Singapore (AWS ap-southeast-1). Supabase processes it on our behalf and has no right to use it for anything else.',
      vi: 'Dữ liệu lưu tại [Supabase](https://supabase.com), đặt ở Singapore (AWS ap-southeast-1). Supabase xử lý dữ liệu thay chúng tôi và không có quyền dùng cho mục đích nào khác.' },
    { k: 'h2',
      en: 'Plans are written with an AI assistant',
      vi: 'Kế hoạch được viết bằng trợ lý AI' },
    { k: 'p',
      en: 'The app picks the stops in a plan itself, from our own catalog. To give the plan a title and a line about each stop, it sends those already-chosen stops — place names, neighbourhoods, times — together with the answers you gave (who you are with, when, what you feel like) to [Anthropic](https://www.anthropic.com)\'s Claude model, through our own server. If you describe your evening in your own words instead of using the chips, **that text is sent too**.',
      vi: 'App tự chọn các điểm dừng trong một kế hoạch, từ danh mục của chính chúng tôi. Để đặt tên cho kế hoạch và viết một dòng về mỗi điểm dừng, app gửi những điểm dừng đã chọn đó — tên địa điểm, khu vực, giờ giấc — cùng các câu trả lời của bạn (đi với ai, khi nào, đang muốn gì) tới model Claude của [Anthropic](https://www.anthropic.com), thông qua máy chủ của chúng tôi. Nếu bạn tự gõ mô tả buổi tối của mình thay vì chọn các thẻ có sẵn, **đoạn văn bản đó cũng được gửi đi**.' },
    { k: 'p',
      en: 'Nothing identifying goes with it: not your name, not your email, not your account id, not your location. The model can never choose a place — it may only write about the ones the app already picked. Anthropic processes this on our behalf as a service provider, and under its API terms does not use it to train models. Apart from Supabase and this, we share data with no one.',
      vi: 'Không có gì nhận dạng bạn đi kèm: không tên, không email, không id tài khoản, không vị trí. Model không bao giờ được chọn địa điểm — nó chỉ được viết về những nơi app đã chọn sẵn. Anthropic xử lý dữ liệu này với vai trò nhà cung cấp dịch vụ cho chúng tôi, và theo điều khoản API của họ, không dùng để huấn luyện model. Ngoài Supabase và trường hợp này, chúng tôi không chia sẻ dữ liệu với bất kỳ ai.' },
    { k: 'h2',
      en: 'Public content and moderation',
      vi: 'Nội dung công khai và kiểm duyệt' },
    { k: 'p',
      en: 'Collections you publish, and your profile, are visible to other users. Every user can report content or block another user from inside the app; reports are reviewed by our editorial desk.',
      vi: 'Bộ sưu tập bạn công khai và hồ sơ của bạn hiển thị với người dùng khác. Mọi người dùng đều có thể báo cáo nội dung hoặc chặn người khác ngay trong app; báo cáo được ban biên tập xem xét.' },
    { k: 'h2',
      en: 'Deleting your data',
      vi: 'Xoá dữ liệu của bạn' },
    { k: 'p',
      en: '**Profile → Delete account** removes your account and everything personal under it — profile, collections, plans, saves, likes, preferences, history — immediately and permanently. No email required, no waiting period.',
      vi: '**Hồ sơ → Xoá tài khoản** xoá tài khoản và mọi thứ cá nhân thuộc về nó — hồ sơ, bộ sưu tập, kế hoạch, lưu, thích, tuỳ chọn, lịch sử — ngay lập tức và vĩnh viễn. Không cần gửi email, không phải chờ.' },
    { k: 'h2',
      en: 'Children',
      vi: 'Trẻ em' },
    { k: 'p',
      en: 'City Crew is not directed at children under 13, and we do not knowingly collect their data.',
      vi: 'City Crew không hướng tới trẻ em dưới 13 tuổi và không cố ý thu thập dữ liệu của trẻ em.' },
    { k: 'h2',
      en: 'Changes and contact',
      vi: 'Thay đổi và liên hệ' },
    { k: 'p',
      en: 'If this policy changes materially we will update this page and its effective date. Questions: [anhlt1983@gmail.com](mailto:anhlt1983@gmail.com).',
      vi: 'Nếu chính sách này thay đổi đáng kể, chúng tôi sẽ cập nhật trang này cùng ngày hiệu lực. Câu hỏi: [anhlt1983@gmail.com](mailto:anhlt1983@gmail.com).' },
  ],
};

/** Both, in the order the sign-up sentence names them. */
export const DOCS: Doc[] = [TERMS, PRIVACY];
