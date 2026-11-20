# Hướng dẫn sau đăng ký

Chỉ bắt đầu khi tài khoản mới hoàn tất màn chào mừng và không có hành động chờ từ lúc vào đăng ký đến lúc rời màn chào mừng. Hành động chờ đã hết thời gian tiếp tục vẫn được coi là trải nghiệm trước đó. Đăng nhập và mở lại ứng dụng không kích hoạt hướng dẫn.

1. Tìm kiếm (nút tìm kiếm trên Khám phá): “Tìm theo tên quán, món ăn hay khu phố.”
2. Lưu (nút Lưu trên trang một địa điểm): “Thêm địa điểm vào bộ sưu tập để dễ tìm lại”. Dùng địa điểm thật trong danh sách; không tự ghi dữ liệu. Nếu danh sách trống, bỏ qua bước này.
3. Bộ sưu tập (mục Cộng đồng trên màn Bộ sưu tập; hướng dẫn mở màn này ở mục Cộng đồng): “Bộ sưu tập của mọi người ở mục Cộng đồng. Những nơi bạn lưu nằm ở mục Của bạn.” Dùng các bộ sưu tập cộng đồng thật, không có dữ liệu demo.
4. Trang của bạn (tab cá nhân, không chuyển màn): “Kết bạn, và xem ai đã thích hay bình luận bộ sưu tập của bạn.”
5. Lên kế hoạch (hướng dẫn mở Ý tưởng, vòng sáng ở tab Ý tưởng trên thanh tab nổi): “Chọn đi cùng ai và bạn thích gì, City Crew sẽ gợi ý một buổi đi chơi để rủ bạn bè cùng đi.” Chỉ có nút Hoàn tất, không có Bỏ qua hướng dẫn.

Năm bước có từ 21/11/2026 (chủ dự án). Trước đó là bốn bước: tìm kiếm, lọc, lưu, bộ sưu tập. Bỏ bước Lọc vì người mới chưa có gì để lọc. Thêm Lên kế hoạch, đặt cuối, vì đó là việc app làm mà app bản đồ không làm. Thêm Trang của bạn, đặt trước Lên kế hoạch, để câu “rủ bạn bè” ở bước cuối có chỗ dựa. Bước 3 và 5 chuyển màn, bước 4 thì không (chủ dự án, 21/11/2026). Một vòng sáng quanh tab chỉ nói “ở đây có một màn”; người mới cần thấy nội dung của màn đó. Bước 3 mở Cộng đồng vì Của bạn còn trống với người mới. Đã cân nhắc và bỏ cách dùng dữ liệu demo cho bước 3 và 4: một bộ sưu tập hay một trang người dùng giả sẽ trông như thật, rồi biến mất khi hướng dẫn kết thúc. Bước 4 chỉ vào tab vì trang cá nhân của người mới chưa có gì để xem. Bước 5 không chỉ vào nút “Lên kế hoạch”, vì nút này nằm dưới mép màn hình và bị tắt cho đến khi chọn đi cùng ai và loại địa điểm. Cũng không chỉ vào câu hỏi đầu “Bạn muốn đi cùng…”: đã thử trong một bản ngày 21/11/2026, nhưng vòng sáng quanh cả khối ô chọn phủ gần hết màn hình (chủ dự án). Vòng sáng nằm ở tab Ý tưởng, còn trang lên kế hoạch hiện phía sau.

Mỗi bước hiển thị tiến độ x/5. Tiếp theo chuyển sang phần giới thiệu kế tiếp. Bỏ qua hoặc chạm ra ngoài kết thúc toàn bộ hướng dẫn. Thẻ không có nút ×: số bước nằm cùng dòng với tiêu đề, và phía sau có một lớp tối nhẹ để vòng sáng và thẻ nổi lên. Bấm nút được highlight kết thúc hướng dẫn và thực hiện hành động thật của nút đó. Vị trí lấy từ nút đang hiển thị; màu lấy từ theme của ứng dụng. Mỗi bước chỉ hiện khi hai lần đo cách nhau 100ms cho cùng một vị trí, để thẻ không vẽ ở chỗ cũ rồi nhảy theo khi trang địa điểm còn đang trượt vào (bước 2) hay đang trượt đi (bước 3); đã hiện rồi thì thẻ bám theo nút ngay khi người dùng cuộn.

## TODO

- Khi có website hướng dẫn sản phẩm với URL chính thức, bổ sung link “Hướng dẫn sử dụng City Crew” ở bước cuối. Không hiển thị link giả trong lúc chưa có website.

## Hồ sơ và xem lại

“Hiện hướng dẫn” thay thế setting gợi ý Collection; không còn các hộp TipBox trong Collection. Switch bật/tắt lưu độc lập với tiến độ: hoàn tất 5/5 vẫn bật, không tự phát lại. “Xem lại hướng dẫn” xuất hiện khi bật và đưa người dùng về Explorer, bắt đầu từ 1/5. Bật switch chỉ hiện lời mời có nút “Bắt đầu”, không tự chuyển màn hình. Lời mời có thể đóng và không tự hết hạn. Lời mời là một thẻ nổi ngay trên thanh tab: biểu tượng bóng đèn, tiêu đề “Đã bật hướng dẫn”, một dòng mô tả, nút “Bắt đầu” và dấu × để đóng; màu lấy từ theme đang dùng. Khi thẻ hiện, Hồ sơ tự cuộn để dòng “Hiện hướng dẫn” nằm trên thẻ, không bị che.

Bỏ qua hoặc chạm ra ngoài lớp hướng dẫn sẽ tắt switch và hiện thông báo cách bật lại trong Hồ sơ trong 10 giây, kèm nút đóng và thông báo cho trình đọc màn hình. Bấm control thật kết thúc lượt hướng dẫn, ghi tiến độ và thực hiện hành động; không tắt setting. Người dùng có thể chủ động xem lại sau đó. Đăng nhập/mở lại app không tự phát tiếp một lượt đang dở.

Trạng thái lưu trên thiết bị theo ID tài khoản (`highlight.v1:<uid>`), khách có key riêng. Không dùng email để định danh và không kế thừa record gợi ý Collection cũ. Khi xoá tài khoản thành công, record được xoá; đăng ký lại với cùng email tạo ID mới và onboarding bắt đầu lại (vẫn tôn trọng pending action nếu có trong lần đăng ký mới). Không tự khởi chạy cho tài khoản cũ chỉ vì chưa có record. Trạng thái chưa đồng bộ giữa các thiết bị.
