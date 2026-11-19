# Changelog

## Thay đổi trong ngày — 19/11/2026

### Tính năng mới

- **Cơ chế quy đổi Linh Kim:** Cứ 100 Linh Kim phẩm bậc thấp hơn có thể dung hợp quy đổi thành 1 Linh Kim bậc cao hơn 1 bậc (Phàm ➔ Tinh ➔ Linh ➔ Địa ➔ Thiên ➔ Thánh ➔ Thần ➔ Hỗn Độn).
  - Hỗ trợ qua lệnh slash: `/bag convert`, `/bag exchange`, `/shop convert`, `/shop exchange`.
  - Hỗ trợ lệnh prefix: `abag convert from:<phẩm> amount:<số/all>`, hoặc alias nhanh `aconvert <phẩm> [số/all]`, `aexchange <phẩm> [số/all]`, `adoi <phẩm> [số/all]`.
  - Tham số `amount:all` tự động đổi tối đa theo số Linh Kim hiện có.
  - Toàn bộ quá trình tiêu hao và nhận Linh Kim được thực hiện an toàn trong một transaction.

## Thay đổi trong ngày — 18/11/2026

### Tính năng mới

- **Mã quà tặng Ngân Lượng:** admin pane bổ sung loại quà **Ngân Lượng (Bạc)**. Khi đổi mã, bạc được cộng trực tiếp vào nhân vật trong cùng transaction với việc ghi nhận lượt đổi; mỗi tài khoản vẫn chỉ đổi mỗi mã một lần.
- **Chu kỳ Boss Thế Giới:** Boss xuất hiện cố định lúc 20:00 hàng ngày theo giờ Việt Nam. Khi bị hạ gục, Boss không spawn lại đến 20:00 ngày hôm sau; HP Boss đã giảm xuống mức 5-100 triệu tùy loại.
- **Nâng cấp Linh Thú và Trợ Thủ:** Linh Thú có tiến hóa 1-5 Sao bằng hiến tế Linh Thú không trang bị và Ngân Lượng. Trợ Thủ có nâng Bậc 1-7 bằng hiến tế Trợ Thủ không xuất chiến và Ngân Lượng; cả hai luồng tăng cấp được xử lý transaction.

### Cân bằng và tiện ích

- **Sửa lỗi Cầu Nguyện nhiều lượt:** Giới hạn an toàn phần mô tả embed và xác nhận interaction trước khi xử lý; toàn bộ vật phẩm vẫn được thêm vào kho kể cả khi kết quả quá dài để hiển thị.
- **Admin reset tài nguyên người chơi:** Có thể reset Ngân Lượng và toàn bộ vật phẩm/tài nguyên trong túi của tất cả người chơi, giữ nguyên cảnh giới, cấp độ, Linh Khí, Linh Thú và Trợ Thủ.
- **Tham số `all`:**
  - `market sell amount:all` đăng bán toàn bộ vật phẩm của đúng loại đang sở hữu.
  - `base upgrade levels:all` nâng Tụ Linh Trận tối đa bằng bạc hiện có, không vượt cấp 50.
  - `wish pull count:all` Cầu Nguyện tối đa 100 lượt theo số bạc hợp lệ hiện có.
  - `aweapons devour all` thôn phệ tối đa 50 Linh Khí dư thừa không phải Bản Mệnh và không trang bị mỗi lần.
- **Sửa thôn phệ Linh Khí hàng loạt:** Xử lý tối đa 50 nguyên liệu trong một transaction, chỉ xóa Linh Khí không phải Bản Mệnh và không trang bị; kết quả báo rõ số lượng và chỉ số nhận được.
- **Tương thích lệnh thôn phệ:** Giữ option boolean cho slash để tương thích lệnh đã đăng ký; prefix chấp nhận cả `aweapons devour all` và `aweapons devour all:true`.
- **Cân bằng Thủ Vệ Tháp:** Thủ Vệ dùng đường cong riêng theo tầng/chặng 10 tầng cho HP, Công, Thủ, Tốc độ và bạo kích. Chỉ số không còn nhân theo level, cảnh giới, Linh Lực hoặc trang bị của người chơi.
- **Giảm thưởng Thí Luyện Tháp:** Linh Kim mỗi tầng giảm còn 1% lượng cần cho lần đột phá tương ứng (làm tròn xuống, tối thiểu 1 viên); Bạc và Linh Lực giảm còn một nửa.

### Tài liệu

- Cập nhật hướng dẫn prefix cho các tham số `all` và cơ chế scale độc lập của Thủ Vệ Tháp.
