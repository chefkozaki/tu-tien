# Changelog

## Thay đổi trong phiên — 17/11/2026

### Sửa lỗi và cân bằng gameplay

- **Đột phá:** kiểm tra đủ XP cấp 10 và xử lý kiểm tra/tiêu thụ vật phẩm đột phá nguyên tử để tránh vượt cấp sai hoặc tiêu vật phẩm trùng khi có nhiều yêu cầu đồng thời.
- **Túi đồ:** cộng gộp các dòng vật phẩm trùng và ngăn tiêu quá số lượng đang sở hữu.
- **Bảng xếp hạng:** so sánh XP lớn chính xác, không làm sai thứ hạng do giới hạn độ chính xác của số JavaScript; định dạng số lớn cũng được sửa.
- **Mỏ Tông Môn:** khi có người tấn công, so sánh tổng sức mạnh chiến đấu của thành viên hai tông môn. Tông môn phòng thủ giữ mỏ nếu hòa.
- **Thành viên Tông Môn:** bổ sung xem danh sách thành viên, Chưởng Môn tuyển trực tiếp và quy trình gửi đơn gia nhập để Chưởng Môn duyệt hoặc từ chối.
- **Điều kiện lập Tông Môn:** người chơi phải đạt cảnh giới Linh Tướng mới được tạo Tông Môn; điều kiện này chỉ áp dụng cho Tông Môn mới, không ảnh hưởng các Tông Môn hiện có.
- **Danh sách Linh Khí:** gom các món trùng và thêm phân trang để xem kho dài.
- **Gacha:** sửa Rate-Up 5★ thành 50/50 đúng nghĩa; nếu trượt, lần 5★ tiếp theo cùng banner được bảo đảm Rate-Up. Bảo đảm được lưu riêng theo banner và giữ độc lập với pity phẩm chất.
- **Banner Gacha:** banner Linh Khí, Linh Thú và Trợ Thủ chỉ trả đúng loại vật phẩm đó ở 4★/5★. Bổ sung pool Linh Thú 5★ mặc định và kiểm tra để không rơi về vật phẩm sai loại khi thiếu pool.
- **Gacha pity và giá quay:** chỉnh 5★ về tỷ lệ cơ bản 0,6%, soft pity kiểu Genshin từ lượt 74 (tăng 6 điểm phần trăm mỗi lượt) và hard pity lượt 90; pity 4★ reset khi nhận 4★ hoặc 5★, pity 5★ chỉ reset khi nhận 5★. Giá mới là 2.000 Bạc/lượt, 18.000 Bạc/10 lượt, cân theo số dư trung vị toàn server.

### Tính năng mới

- **Cửa hàng hệ thống:** thêm `/shop view` và `/shop buy` để mua Đan Dược, Linh Kim. Giá được điều chỉnh theo lượng bạc bình quân toàn máy chủ và lượng hàng lưu thông/khan hiếm; giao dịch trừ bạc và cấp vật phẩm trong transaction.
- **Quản lý lệnh theo kênh:** thêm lệnh bật/tắt lệnh trong kênh hiện tại, giới hạn cho người có quyền Quản lý Máy chủ. Tắt lệnh gốc cũng chặn lệnh con; dùng lại để bật. Trạng thái lưu riêng theo máy chủ và kênh.

### Cập nhật trải nghiệm và tài liệu

- Phản hồi từ lệnh prefix, kể cả phản hồi vốn được đánh dấu riêng tư, follow-up và nội dung sau defer, giờ gửi trực tiếp vào kênh đã nhập lệnh; slash command không đổi.
- Cập nhật README, hướng dẫn trong bot và tài liệu cú pháp prefix cho các tính năng Tông Môn, cửa hàng, quản lý lệnh, Rate-Up và phản hồi prefix.

### Kiểm tra

- Đã chạy kiểm tra cú pháp JavaScript và `git diff --check` cho các thay đổi liên quan.
- Đã chạy kiểm thử tập trung cho transaction đột phá/vật phẩm, phòng thủ mỏ, quy trình thành viên, phân trang Linh Khí, cửa hàng, pity/Rate-Up, migration cơ sở dữ liệu, quản lý lệnh theo kênh và phản hồi prefix; các kiểm tra này đạt.
- Repository chưa cấu hình test suite tổng thể (`npm test` hiện là placeholder).

### Lưu ý triển khai

- Các slash command mới hoặc thay đổi schema cần bot khởi động để khởi tạo/migrate cơ sở dữ liệu; slash command mới cần deploy lại bằng `npm run deploy` để xuất hiện trên Discord.
