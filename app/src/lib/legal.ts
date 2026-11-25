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
  effective: { en: 'Effective 25 November 2026', vi: 'Hiệu lực từ 25/11/2026' },
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
      en: 'Collections, trip plans, profile text, comments, place suggestions and reports are all written by people, and this is the part of the app where one person\'s words reach another. **We do not tolerate objectionable content or abusive behaviour.** Do not post:',
      vi: 'Bộ sưu tập, kế hoạch đi chơi, phần giới thiệu hồ sơ, bình luận, địa điểm đề xuất và báo cáo đều do người viết ra, và đây chính là phần của app nơi lời của người này đến với người kia. **Chúng tôi không dung thứ nội dung phản cảm hay hành vi lăng mạ.** Không được đăng:' },
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
    { k: 'p',
      en: '**Comments** are the one thing here that appears the moment you post it. Anyone signed in can comment on a public collection, up to 500 characters at a time and 30 comments a day. A comment is checked against a list of banned words as it is posted, and one that contains any of them is refused. A comment cannot be edited afterwards. You can delete your own, and **deleting a comment also deletes every reply under it**, whoever wrote them. The owner of a collection can delete any comment on it, and can turn comments off for that collection: what is already there stays readable, and nothing new can be added.',
      vi: '**Bình luận** là thứ duy nhất ở đây hiện ra ngay lúc bạn đăng. Ai đã đăng nhập cũng bình luận được trên một bộ sưu tập công khai, mỗi lần tối đa 500 ký tự và 30 bình luận mỗi ngày. Bình luận được so với một danh sách từ cấm ngay lúc đăng, và bình luận nào chứa một từ trong đó sẽ bị từ chối. Bình luận đã đăng thì không sửa được. Bạn xoá được bình luận của mình, và **xoá một bình luận là xoá luôn mọi câu trả lời bên dưới nó**, dù ai viết. Chủ bộ sưu tập xoá được mọi bình luận trên bộ của mình, và tắt được bình luận cho bộ đó: những gì đã có vẫn đọc được, và không thêm mới được nữa.' },
    { k: 'h2',
      en: 'Your content stays yours',
      vi: 'Nội dung vẫn là của bạn' },
    { k: 'p',
      en: 'You keep ownership of everything you write. By publishing a collection, filling in a profile or writing a comment, you give us permission to store it and show it where you chose to make it visible — nothing more. A collection you keep private is shown to nobody, unless you share it with friends you choose, and then only to them. Delete the content, or your account, and that permission ends with it.',
      vi: 'Bạn giữ quyền sở hữu mọi thứ mình viết. Khi công khai một bộ sưu tập, điền hồ sơ hay viết một bình luận, bạn cho phép chúng tôi lưu và hiển thị nó ở đúng nơi bạn đã chọn để hiện — không hơn. Bộ sưu tập bạn để riêng tư thì không ai thấy, trừ khi bạn chia sẻ nó với một số bạn bè do bạn chọn, và khi đó chỉ những người đó thấy. Xoá nội dung, hoặc xoá tài khoản, thì quyền đó chấm dứt theo.' },
    { k: 'h2',
      en: 'Reporting and blocking',
      vi: 'Báo cáo và chặn' },
    { k: 'p',
      en: 'Every collection, every profile, every comment and every photo on a check-in can be **reported** from inside the app, in a few taps, with a reason and an optional note. You cannot report yourself, and there is a daily limit so the queue stays usable for people who need it.',
      vi: 'Mọi bộ sưu tập, mọi hồ sơ, mọi bình luận và mọi ảnh check-in đều có thể **báo cáo** ngay trong app, chỉ vài lần chạm, kèm lý do và ghi chú tuỳ chọn. Bạn không thể tự báo cáo chính mình, và có hạn mức mỗi ngày để hàng đợi còn dùng được cho người thật sự cần.' },
    { k: 'p',
      en: 'You can also **block** another user. Be clear about what a block does: it is a contact policy, not a content filter. It ends the friendship between you, stops new friend requests, and keeps that person\'s likes and copies out of your activity feed, and yours out of what they see and theirs out of what you see on any collection\'s activity page. Neither of you sees the other\'s comments, or the replies under them, and neither is told about the other in Activity. **It does not hide their public collections** — those stay public, the same as they are to everyone else. Only you can see who you have blocked, and unblocking is immediate.',
      vi: 'Bạn cũng có thể **chặn** một người dùng khác. Nói rõ chặn làm được gì: đây là chính sách liên hệ, không phải bộ lọc nội dung. Nó cắt quan hệ bạn bè giữa hai người, ngăn lời mời kết bạn mới, và gỡ lượt thích cùng bản sao của người đó khỏi mục Hoạt động của bạn; trên trang hoạt động của bất kỳ bộ sưu tập nào, họ không thấy lượt của bạn và bạn không thấy lượt của họ. Hai người không thấy bình luận của nhau, cũng không thấy các câu trả lời bên dưới chúng, và mục Hoạt động không báo cho người này về người kia. **Nó không ẩn bộ sưu tập công khai của họ** — những bộ sưu tập đó vẫn công khai, y như với mọi người khác. Chỉ mình bạn thấy danh sách mình đã chặn, và bỏ chặn có hiệu lực ngay.' },
    { k: 'h2',
      en: 'How we handle reports',
      vi: 'Chúng tôi xử lý báo cáo thế nào' },
    { k: 'p',
      en: 'Reports go to our editorial desk, which **aims to act within 24 hours** of a report arriving. The desk can do five things. The first four are reversible; the fifth is not:',
      vi: 'Báo cáo đi tới ban biên tập, nơi **đặt mục tiêu xử lý trong vòng 24 giờ** kể từ khi báo cáo tới. Ban biên tập làm được năm việc. Bốn việc đầu đảo ngược được; việc thứ năm thì không:' },
    { k: 'ul',
      en: [
        'Hide a public collection, so it is no longer visible to other users.',
        'Blank one field of a profile — a name, a bio, a photo.',
        'Hide a photo on a check-in, so nobody sees it.',
        'Stop an account from signing in. Its check-in photos are hidden with it.',
        'Remove a comment, together with the replies under it. A removed comment is deleted and cannot be restored.',
      ],
      vi: [
        'Ẩn một bộ sưu tập công khai, để người dùng khác không còn thấy nó.',
        'Xoá trắng một trường trong hồ sơ — một cái tên, một dòng giới thiệu, một tấm ảnh.',
        'Ẩn một ảnh check-in, để không ai thấy nó nữa.',
        'Dừng một tài khoản, không cho đăng nhập nữa. Ảnh check-in của tài khoản đó bị ẩn theo.',
        'Gỡ một bình luận, cùng các câu trả lời bên dưới nó. Bình luận đã gỡ là bị xoá hẳn, không khôi phục được.',
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
      en: 'Weather data',
      vi: 'Dữ liệu thời tiết' },
    { k: 'p',
      en: 'The temperature and weather icon at the top of Places come from [Open-Meteo](https://open-meteo.com/), under the [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) licence. The app rounds the temperature to a whole degree and draws the conditions as its own icon; it does not otherwise change the data.',
      vi: 'Nhiệt độ và biểu tượng thời tiết ở đầu màn hình Địa điểm lấy từ [Open-Meteo](https://open-meteo.com/), theo giấy phép [Creative Commons Ghi công 4.0](https://creativecommons.org/licenses/by/4.0/). App làm tròn nhiệt độ đến độ nguyên và tự vẽ biểu tượng cho tình trạng thời tiết; ngoài ra không thay đổi dữ liệu.' },
    { k: 'h2',
      en: 'Ending your account',
      vi: 'Kết thúc tài khoản' },
    { k: 'p',
      en: 'You can leave at any time: **Account → Delete account** removes your account and everything personal under it, immediately and permanently. No email required, no waiting period. That same screen offers **Download your data** first, so you can take a copy with you.',
      vi: 'Bạn có thể rời đi bất cứ lúc nào: **Tài khoản → Xoá tài khoản** xoá tài khoản và mọi thứ cá nhân thuộc về nó, ngay lập tức và vĩnh viễn. Không cần gửi email, không phải chờ. Chính màn hình đó có **Tải dữ liệu của bạn** ở trên, để bạn mang một bản sao đi trước.' },
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
  effective: { en: 'Effective 25 November 2026', vi: 'Hiệu lực từ 25/11/2026' },
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
      en: 'Your profile (display name, handle, photo, bio, and the cover at the top of your page — a city, one of your collections, or a picture you upload), the collections and trip plans you create, places you save or like, collections you like (your like is listed, with your name, on that collection\'s activity page, for anyone signed in who can open the collection, and on your own page it is shown to a signed-in reader who liked the same collection), places you check in at (which place, when, and the note you write about the visit; a check-in is seen by you alone unless you choose Friends for it, and then your friends see the place, the day — never the time — and the note on your page, and can like it; if you choose Public, anyone signed in sees and can like the same, and a new check-in never starts out Public), up to three photos you add to a check-in (seen by exactly the people who see that check-in; your phone makes the photo smaller before it is sent, and our server removes the location and every other detail the camera wrote into the file before it is stored; a check-in photo is shown to a stranger only on a check-in you made Public, never becomes a photo of the place, and is kept in private storage that is reached only through links that stop working within an hour), the likes you give someone else\'s check-in (counted on it, without your name), lists you save a copy of (the copy remembers which list; its curator can see that a copy was made and by whom, and for a copy made from 16 November 2026 on, so can anyone signed in who can open that list — a copy made before then is shown to the curator alone), place suggestions you submit, comments you write on public collections (the words, when, which comment you answered, and the people and places you tagged), the hearts you set on other people\'s comments, friend connections, the friends you share a private collection with, and preferences you set (favourite categories, budget, theme, and the tips you have closed). All of it exists because you typed or picked it, and all of it is deleted with your account.',
      vi: 'Hồ sơ (tên hiển thị, handle, ảnh, giới thiệu, và ảnh bìa trên đầu trang của bạn — một thành phố, một bộ sưu tập của bạn, hoặc một ảnh bạn tải lên), bộ sưu tập và kế hoạch đi chơi bạn tạo, địa điểm bạn lưu hoặc thích, bộ sưu tập bạn thích (lượt thích của bạn hiện kèm tên bạn trên trang hoạt động của bộ sưu tập đó, cho bất kỳ ai đã đăng nhập và mở được bộ sưu tập, và trên trang của bạn nó hiện cho người đã đăng nhập cũng thích bộ sưu tập đó), nơi bạn check-in (địa điểm nào, lúc nào, và ghi chú bạn viết về lần ghé; một lần check-in chỉ mình bạn thấy, trừ khi bạn chọn Bạn bè cho nó, khi đó bạn bè thấy địa điểm, ngày ghé — không bao giờ thấy giờ — và ghi chú trên trang của bạn, và có thể thả tim; nếu bạn chọn Công khai, bất kỳ ai đã đăng nhập đều thấy và thả tim được như vậy, và một lần check-in mới không bao giờ mặc định là Công khai), tối đa ba ảnh bạn thêm vào một lần check-in (đúng những người thấy lần check-in đó mới thấy ảnh; điện thoại thu nhỏ ảnh trước khi gửi, và máy chủ của chúng tôi bỏ vị trí cùng mọi thông tin khác máy ảnh ghi vào tệp trước khi lưu; ảnh check-in chỉ hiện cho người lạ khi lần check-in đó được bạn chọn Công khai, không bao giờ trở thành ảnh của địa điểm, và được lưu ở kho riêng tư chỉ mở được qua đường dẫn hết hạn trong vòng một giờ), lượt tim bạn thả cho check-in của người khác (được đếm trên đó, không kèm tên bạn), bộ sưu tập bạn lưu bản sao (bản sao ghi nhớ list gốc; người tạo list đó thấy có bản sao và ai đã lưu, và với bản sao lưu từ ngày 16/11/2026 trở đi thì bất kỳ ai đã đăng nhập và mở được list đó cũng thấy — bản sao lưu trước ngày này chỉ người tạo list thấy), địa điểm bạn đề xuất, bình luận bạn viết trên các bộ sưu tập công khai (nội dung, thời điểm, bạn trả lời bình luận nào, và những người, những địa điểm bạn nhắc tới), những trái tim bạn thả vào bình luận của người khác, kết nối bạn bè, những bạn bè mà bạn chia sẻ bộ sưu tập riêng tư cùng, và tuỳ chọn bạn đặt (thể loại yêu thích, ngân sách, theme, và các thông báo hướng dẫn bạn đã đóng). Tất cả tồn tại vì bạn tự nhập hoặc tự chọn, và tất cả bị xoá cùng tài khoản.' },
    { k: 'h3',
      en: 'Activity history — on, and yours to switch off',
      vi: 'Lịch sử hoạt động — bật sẵn, và bạn tắt được' },
    { k: 'p',
      en: 'The app remembers which places you open, so somewhere you looked at and walked away from stops coming back. This is **on when your account is made**, and the sign-up screen tells you so before anything is recorded. Turn it off any time under Edit profile → Personalise my experience: the switch is enforced in our database, not just in the app, so once it is off nothing can record for you. **Delete my history** sits beside it and works whether the switch is on or off — switching recording off and being unable to remove what was already kept would be no protection at all. This history is never shown to anyone else and never leaves your account.',
      vi: 'App ghi nhớ những địa điểm bạn mở, để nơi bạn đã xem rồi bỏ qua thôi quay lại. Việc này **bật sẵn khi tài khoản được tạo**, và màn hình đăng ký nói rõ điều đó trước khi bất cứ gì được ghi. Tắt lúc nào cũng được trong Sửa hồ sơ → Nâng cao trải nghiệm cá nhân: công tắc này được ép ngay ở tầng cơ sở dữ liệu, không chỉ trong app, nên khi đã tắt thì không gì ghi được cho bạn nữa. Nút **Xoá lịch sử của tôi** nằm ngay cạnh và dùng được dù công tắc đang bật hay tắt — tắt ghi mà không xoá được thứ đã ghi thì chẳng bảo vệ được gì. Lịch sử này không bao giờ hiển thị cho người khác và không bao giờ rời khỏi tài khoản của bạn.' },
    { k: 'h2',
      en: 'What we do not collect',
      vi: 'Chúng tôi không thu thập gì' },
    { k: 'ul',
      en: [
        '**We do not keep your location.** What the app does with it, and who else sees it, is set out under “Your location and the map” below.',
        '**No advertising, no trackers, no third-party analytics.** The App Store build sends no diagnostics. What the app does count is set out here in full. Each time a collection is opened, one is added to that list’s count for the day — a number and nothing else, never who opened it, whether you are signed in or not. And a trip you save from collections remembers which ones, so each list’s author can see how many trips their list started, never whose. Both numbers are shown to anyone signed in who can open the list. The app also orders public collections by these totals, and by how many people liked a list or saved a copy of it — numbers only, never who. How many people saved a copy of a public collection is also shown beside it, to anyone, signed in or not.',
        '**No device identifiers.** We do not collect advertising IDs or fingerprint your device.',
      ],
      vi: [
        '**Chúng tôi không lưu vị trí của bạn.** App dùng vị trí vào việc gì, và ai khác nhìn thấy nó, được nêu ở mục “Vị trí của bạn và bản đồ” bên dưới.',
        '**Không quảng cáo, không tracker, không analytics bên thứ ba.** Bản phát hành trên App Store không gửi dữ liệu chẩn đoán nào. Những gì app có đếm được nêu đủ ở đây. Mỗi lần một bộ sưu tập được mở, số lượt mở trong ngày của bộ sưu tập đó tăng thêm một — chỉ là một con số, không bao giờ ghi ai đã mở, dù bạn có đăng nhập hay không. Và chuyến đi bạn lưu từ các bộ sưu tập sẽ ghi nhớ đó là những bộ sưu tập nào, để người tạo mỗi bộ sưu tập thấy nó đã mở đầu bao nhiêu chuyến đi, không bao giờ thấy của ai. Cả hai con số hiện cho bất kỳ ai đã đăng nhập và mở được bộ sưu tập. App cũng xếp thứ tự các bộ sưu tập công khai theo những tổng số này, và theo số người đã thích hoặc lưu bản sao của một bộ sưu tập — chỉ là con số, không bao giờ là ai. Số người đã lưu bản sao của một bộ sưu tập công khai cũng hiện cạnh bộ sưu tập đó, cho bất kỳ ai, dù có đăng nhập hay không.',
        '**Không định danh thiết bị.** Chúng tôi không thu thập advertising ID hay nhận dạng thiết bị của bạn.',
      ] },
    { k: 'h2',
      en: 'Your location and the map',
      vi: 'Vị trí của bạn và bản đồ' },
    { k: 'p',
      en: 'If you allow it, the app reads your position on your phone and uses it in three places:',
      vi: 'Nếu bạn cho phép, app đọc vị trí của bạn ngay trên điện thoại và dùng nó ở ba chỗ:' },
    { k: 'ul',
      en: [
        '**Choosing a city.** On your phone only, to open on the nearest city the app covers.',
        '**Choose a starting point** When you open this screen without dropping a pin, your position is sent through our server to Google, so the map can say which street you are on and a search can look near you first. Our server passes it on and keeps nothing; Google receives it to answer that request.',
        '**The maps.** The maps in the app are drawn by Google Maps, which runs inside the app. When a map shows where you are, that position is handled by Google’s map software, under [Google’s privacy policy](https://policies.google.com/privacy).',
      ],
      vi: [
        '**Chọn thành phố.** Chỉ trên điện thoại, để mở đúng thành phố gần nhất mà app có.',
        '**Chọn địa điểm bắt đầu** Khi bạn mở màn này mà chưa thả ghim, vị trí của bạn được gửi qua máy chủ của chúng tôi tới Google, để bản đồ ghi được bạn đang ở đường nào và ô tìm kiếm ưu tiên những chỗ gần bạn. Máy chủ của chúng tôi chỉ chuyển tiếp và không giữ lại gì; Google nhận vị trí để trả lời đúng yêu cầu đó.',
        '**Bản đồ.** Bản đồ trong app do Google Maps vẽ, chạy ngay bên trong app. Khi bản đồ hiện vị trí của bạn, vị trí đó do phần mềm bản đồ của Google xử lý, theo [chính sách quyền riêng tư của Google](https://policies.google.com/privacy).',
      ] },
    { k: 'p',
      en: 'A pin you drop, a search you type and an area you pick travel the same way — through our server to Google — to name the spot and find places near it. If you save a trip that starts from a pin, the pin is saved with the trip. Your own position is never saved with it.',
      vi: 'Ghim bạn thả, nội dung bạn tìm và khu vực bạn chọn cũng đi theo đúng đường đó — qua máy chủ của chúng tôi tới Google — để đặt tên cho điểm đó và tìm chỗ gần. Nếu bạn lưu một chuyến đi bắt đầu từ ghim, ghim được lưu cùng chuyến đi. Vị trí của chính bạn không bao giờ được lưu cùng.' },
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
      en: 'Nothing identifying goes with it: not your name, not your email, not your account id, not your location. The model can never choose a place — it may only write about the ones the app already picked. Anthropic processes this on our behalf as a service provider, and under its API terms does not use it to train models. Apart from Supabase, this, the photos below, and the services under “Other services the app talks to”, we share data with no one.',
      vi: 'Không có gì nhận dạng bạn đi kèm: không tên, không email, không id tài khoản, không vị trí. Model không bao giờ được chọn địa điểm — nó chỉ được viết về những nơi app đã chọn sẵn. Anthropic xử lý dữ liệu này với vai trò nhà cung cấp dịch vụ cho chúng tôi, và theo điều khoản API của họ, không dùng để huấn luyện model. Ngoài Supabase, trường hợp này, ảnh địa điểm ở mục dưới và các dịch vụ ở mục “Những dịch vụ khác app kết nối tới”, chúng tôi không chia sẻ dữ liệu với bất kỳ ai.' },
    { k: 'h2',
      en: 'Photos of places are read by the same assistant',
      vi: 'Ảnh địa điểm cũng được trợ lý AI đọc' },
    { k: 'p',
      en: 'Photos in the catalog — **including any you add to a place** — are sent through our own server to [Anthropic](https://www.anthropic.com)\'s Claude model, to note what each one shows (the food, the inside, the front, the view) and whether it would make a good cover, and to help write the place\'s description. Only the photo goes, with nothing that identifies you, and Anthropic handles it on the same terms as above. The photo score in the gallery is different: it is measured on your phone, by Apple Vision. **Photos you add to a check-in are not sent anywhere.**',
      vi: 'Ảnh trong danh mục — **kể cả ảnh bạn thêm cho một địa điểm** — được gửi qua máy chủ của chúng tôi tới model Claude của [Anthropic](https://www.anthropic.com), để ghi nhận ảnh chụp gì (món ăn, bên trong, mặt tiền, cảnh) và có hợp làm ảnh bìa không, và để giúp viết phần mô tả địa điểm. Chỉ ảnh được gửi đi, không kèm gì nhận dạng bạn, và Anthropic xử lý theo đúng điều kiện nêu ở trên. Điểm ảnh trong thư viện ảnh thì khác: điểm đó được đo ngay trên điện thoại của bạn, bằng Apple Vision. **Ảnh bạn thêm vào check-in không được gửi đi đâu cả.**' },
    { k: 'h2',
      en: 'Other services the app talks to',
      vi: 'Những dịch vụ khác app kết nối tới' },
    { k: 'p',
      en: 'Besides Supabase, your phone reaches three services directly. Like any request on the internet, each of them sees your phone’s IP address; none of them is sent your name, your email or your account.',
      vi: 'Ngoài Supabase, điện thoại của bạn kết nối trực tiếp tới ba dịch vụ. Như mọi yêu cầu trên internet, mỗi dịch vụ đều thấy địa chỉ IP của điện thoại; không dịch vụ nào nhận tên, email hay tài khoản của bạn.' },
    { k: 'ul',
      en: [
        'Google Maps — draws the maps inside the app. Naming and finding places for “Choose a starting point” goes to Google through our server, as set out above.',
        '[Open-Meteo](https://open-meteo.com/) — the weather on Places. It is asked about the centre of the city you are browsing, never about your own position.',
        '[Expo](https://expo.dev) — delivers updates to the app itself.',
      ],
      vi: [
        'Google Maps — vẽ bản đồ bên trong app. Việc đặt tên và tìm chỗ cho “Chọn địa điểm bắt đầu” đi tới Google qua máy chủ của chúng tôi, như đã nêu ở trên.',
        '[Open-Meteo](https://open-meteo.com/) — thời tiết trên màn Địa điểm. App hỏi về trung tâm thành phố bạn đang xem, không bao giờ hỏi về vị trí của bạn.',
        '[Expo](https://expo.dev) — phân phối các bản cập nhật cho chính app.',
      ] },
    { k: 'h2',
      en: 'Public content and moderation',
      vi: 'Nội dung công khai và kiểm duyệt' },
    { k: 'p',
      en: 'Collections you publish, and your profile, are visible to other users. Your page also shows a signed-in reader what the two of you have in common: places that are in public collections of you both, and public collections you both liked. Nothing you keep private is read for it, and nothing is shown across a block. Your page also shows a signed-in reader the mark of a role our editorial desk has given your account (Local Guide or Super User), unless one of you has blocked the other. Every user can report content or block another user from inside the app; reports are reviewed by our editorial desk.',
      vi: 'Bộ sưu tập bạn công khai và hồ sơ của bạn hiển thị với người dùng khác. Trang của bạn còn cho người đã đăng nhập thấy điểm chung giữa hai người: những địa điểm có trong bộ sưu tập công khai của cả hai, và những bộ sưu tập công khai cả hai cùng thích. Không thứ gì bạn giữ riêng tư được dùng để tính, và không gì hiện ra khi giữa hai người có một lượt chặn. Trang của bạn cũng cho người đã đăng nhập thấy huy hiệu vai trò mà ban biên tập đã cấp cho tài khoản của bạn (Local Guide hoặc Super User), trừ khi một trong hai người đã chặn người kia. Mọi người dùng đều có thể báo cáo nội dung hoặc chặn người khác ngay trong app; báo cáo được ban biên tập xem xét.' },
    { k: 'p',
      en: '**Comments.** A comment you write on a public collection is shown with your name, handle and photo to anyone who can open that collection, signed in or not. It tells three people, in their Activity: the owner of the collection, the writer of the comment you answered, and anyone you tagged. You can tag your friends, the collection\'s owner and people who have already commented there, and a tag links to that person\'s page. A heart on a comment is shown to everyone as a number; who set it is told to the writer of that comment and to nobody else. Across a block, neither person sees the other\'s comments or is told about them. Which comment news you have already seen is remembered on your phone, not on our server.',
      vi: '**Bình luận.** Bình luận bạn viết trên một bộ sưu tập công khai hiện kèm tên, handle và ảnh của bạn cho bất kỳ ai mở được bộ sưu tập đó, dù đã đăng nhập hay chưa. Nó báo cho ba người, trong mục Hoạt động của họ: chủ bộ sưu tập, người viết bình luận mà bạn trả lời, và những người bạn nhắc tới. Bạn nhắc tới được bạn bè của mình, chủ bộ sưu tập và những người đã bình luận ở đó, và mỗi lần nhắc dẫn tới trang của người đó. Trái tim trên một bình luận hiện cho mọi người dưới dạng một con số; ai đã thả thì chỉ người viết bình luận đó được biết, không ai khác. Khi giữa hai người có một lượt chặn, không ai thấy bình luận của người kia hay được báo về chúng. Việc bạn đã xem tin bình luận nào được ghi nhớ trên máy bạn, không phải trên máy chủ của chúng tôi.' },
    { k: 'p',
      en: 'When our desk removes a comment it keeps a record that it did: which account wrote it, which collection it was on, and how many replies went with it. **The words themselves are not kept.**',
      vi: 'Khi ban biên tập gỡ một bình luận, họ giữ lại một ghi nhận rằng việc đó đã xảy ra: tài khoản nào viết, trên bộ sưu tập nào, và bao nhiêu câu trả lời bị gỡ theo. **Nội dung bình luận thì không được giữ lại.**' },
    { k: 'p',
      en: '**Check-in photos.** Anyone who can see a photo can report it. A reported photo is seen by our editorial desk, beside the check-in\'s place and note, and the desk can hide it: a hidden photo is shown to nobody, and on your own check-in it is marked as hidden by City Crew. The desk keeps a record that it hid or restored a photo, and whose it was. If the desk stops your account from signing in, all your check-in photos are hidden with it, and lifting that puts them back.',
      vi: '**Ảnh check-in.** Ai thấy được ảnh thì đều có thể báo cáo nó. Ảnh bị báo cáo được ban biên tập xem, kèm địa điểm và ghi chú của lần check-in, và ban biên tập có thể ẩn ảnh: ảnh đã ẩn không hiện cho ai, và trên lần check-in của chính bạn nó được đánh dấu là City Crew đã ẩn. Ban biên tập giữ lại ghi nhận rằng họ đã ẩn hay khôi phục một ảnh, và ảnh đó của ai. Nếu ban biên tập dừng tài khoản của bạn, mọi ảnh check-in của bạn bị ẩn theo, và khi bỏ dừng thì chúng hiện lại.' },
    { k: 'h2',
      en: 'Getting a copy of your data',
      vi: 'Lấy bản sao dữ liệu của bạn' },
    { k: 'p',
      en: '**Account → Delete account → Download your data** writes everything we hold about your account — profile, collections, plans, likes, check-ins (with their photos listed by file name; the photos themselves are not in the file, so save the ones you want from the app), comments, crew, preferences, history and the places you added — to a single JSON file, and hands it to your phone\'s share sheet. Nothing is uploaded and we keep no copy: the file is made on your device and goes only where you send it.',
      vi: '**Tài khoản → Xoá tài khoản → Tải dữ liệu của bạn** ghi mọi thứ chúng tôi lưu về tài khoản của bạn — hồ sơ, bộ sưu tập, kế hoạch, lượt thích, check-in (ảnh kèm theo chỉ được ghi tên tệp; chính các tấm ảnh không nằm trong tệp, nên muốn giữ ảnh nào thì lưu từ trong app), bình luận, crew, tuỳ chọn, lịch sử và những địa điểm bạn đã thêm — vào một tệp JSON duy nhất, rồi đưa cho trình chia sẻ của máy bạn. Không có gì được tải lên và chúng tôi không giữ bản sao nào: tệp được tạo ngay trên máy bạn và chỉ đi tới nơi bạn gửi.' },
    { k: 'p',
      en: 'Three things are deliberately not in it. Other people appear only by their public @handle, never by name, email or account id — a copy of your data must not become a copy of theirs. Reports are left out, because a report names the person it is about. And comments are yours where you wrote them: what other people wrote, even in answer to you or tagging you, is theirs and is not in your file.',
      vi: 'Có ba thứ cố ý không nằm trong đó. Người khác chỉ xuất hiện bằng @handle công khai, không có tên, email hay id tài khoản — bản sao dữ liệu của bạn không được trở thành bản sao dữ liệu của họ. Báo cáo vi phạm bị lược đi, vì một báo cáo nêu tên chính người bị báo cáo. Và bình luận là của bạn khi chính bạn viết: những gì người khác viết, kể cả để trả lời hay nhắc tới bạn, là của họ và không có trong tệp của bạn.' },
    { k: 'h2',
      en: 'Deleting your data',
      vi: 'Xoá dữ liệu của bạn' },
    { k: 'p',
      en: '**Account → Delete account** removes your account and everything personal under it — profile, collections, plans, saves, likes, check-ins and their photos, comments, preferences, history — immediately and permanently. No email required, no waiting period. Your comments go with the replies other people wrote under them.',
      vi: '**Tài khoản → Xoá tài khoản** xoá tài khoản và mọi thứ cá nhân thuộc về nó — hồ sơ, bộ sưu tập, kế hoạch, lưu, thích, check-in cùng ảnh của chúng, bình luận, tuỳ chọn, lịch sử — ngay lập tức và vĩnh viễn. Không cần gửi email, không phải chờ. Bình luận của bạn mất cùng các câu trả lời người khác đã viết bên dưới chúng.' },
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
