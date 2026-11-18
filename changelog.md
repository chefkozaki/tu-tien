# Changelog

## Thay đổi trong ngày — 18/11/2026

### Tính năng mới

- **Mã quà tặng Ngân Lượng:** admin pane bổ sung loại quà **Ngân Lượng (Bạc)**. Khi đổi mã, bạc được cộng trực tiếp vào nhân vật trong cùng transaction với việc ghi nhận lượt đổi; mỗi tài khoản vẫn chỉ đổi mỗi mã một lần.
- **Chu kỳ Boss Thế Giới:** Boss xuất hiện cố định lúc 20:00 hàng ngày theo giờ Việt Nam. Khi bị hạ gục, Boss không spawn lại đến 20:00 ngày hôm sau; HP Boss đã giảm xuống mức 5-100 triệu tùy loại.
- **Nâng cấp Linh Thú và Trợ Thủ:** Linh Thú có tiến hóa 1-5 Sao bằng hiến tế Linh Thú không trang bị và Ngân Lượng. Trợ Thủ có nâng Bậc 1-7 bằng hiến tế Trợ Thủ không xuất chiến và Ngân Lượng; cả hai luồng tăng cấp được xử lý transaction.

### Cân bằng và tiện ích

- **Tham số `all`:**
  - `market sell amount:all` đăng bán toàn bộ vật phẩm của đúng loại đang sở hữu.
  - `base upgrade levels:all` nâng Tụ Linh Trận tối đa bằng bạc hiện có, không vượt cấp 50.
  - `wish pull count:all` Cầu Nguyện tối đa 100 lượt theo số bạc hợp lệ hiện có.
  - `aweapons devour all:true` thôn phệ toàn bộ Linh Khí dư thừa không trang bị.
- **Cân bằng Thủ Vệ Tháp:** Thủ Vệ dùng đường cong riêng theo tầng/chặng 10 tầng cho HP, Công, Thủ, Tốc độ và bạo kích. Chỉ số không còn nhân theo level, cảnh giới, Linh Lực hoặc trang bị của người chơi.

### Tài liệu

- Cập nhật hướng dẫn prefix cho các tham số `all` và cơ chế scale độc lập của Thủ Vệ Tháp.
