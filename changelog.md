# Changelog

## Thay đổi trong ngày — 22/11/2026

### Sửa lỗi (Bug Fixes)

- **Sửa lỗi Boss Thế Giới không spawn đúng hạn, bị nhảy sang ngày hôm sau và lỗi `ConnectTimeoutError`:**
  - Viết lại logic kiểm tra chu kỳ Boss Thế Giới theo mốc chu kỳ 20:00 (giờ VN) trong `src/services/bossService.js`:
    - Tự động dọn dẹp (`expired`) các boss `alive` thuộc chu kỳ cũ thay vì trả về `null` vĩnh viễn gây tắc chu kỳ spawn.
    - Ngăn spawn sớm trước 20:00 và ngăn spawn loop khi boss hôm nay đã bị đánh bại.
    - Boss bị tiêu diệt sau 00:00 (qua nửa đêm) không còn làm bỏ qua lượt spawn 20:00 cùng ngày.
    - Boss do Admin triệu hồi thủ công trước 20:00 hiển thị và chiến đấu được ngay lập tức, không còn bị ẩn hay làm kẹt boss 20:00.
  - Bọc `tx.rollback()` an toàn và thêm cờ chống chồng chéo (`isCheckingBoss`) kèm xử lý cảnh báo lỗi timeout mạng cho vòng lặp kiểm tra Boss trong `index.js`.
  - Cập nhật `defeated_at` đầy đủ khi Admin tiêu diệt hoặc triệu hồi đè Boss trong `admin/routes/api.js`.
  - Kết hợp với Turso Embedded Replica Cache, chu kỳ kiểm tra Boss mỗi 60 giây chạy hoàn toàn cục bộ (< 1ms), loại bỏ hoàn toàn lỗi `UND_ERR_CONNECT_TIMEOUT` khi gọi Turso từ hosting.

## Thay đổi trong ngày — 20/11/2026

### Tính năng mới & Tối ưu hóa hiệu năng

- **Kỹ thuật Bộ đệm dữ liệu Turso Cache (Embedded Replica) trên Hosting:**
  - **Tối ưu tốc độ tải và lưu dữ liệu:** Mọi thao tác truy vấn và ghi dữ liệu của bot chạy trực tiếp trên file database SQLite cục bộ tại hosting (`./data/turso_cache.db`), giảm độ trễ từ ~1.500ms xuống **dưới 2ms** (tăng tốc hơn 500 lần).
  - **Cơ chế tự động đồng bộ 2 chiều (Sync):** Cứ mỗi 10 phút bot online (tùy chỉnh qua biến môi trường `TURSO_CACHE_SYNC_INTERVAL_MINUTES`), hệ thống tự động đẩy dữ liệu đã thay đổi lên Turso và cập nhật các dữ liệu mới nhất về hosting.
  - **Khởi động và tải dữ liệu an toàn:** Khi khởi chạy bot, hệ thống tự động đồng bộ dữ liệu mới nhất từ Turso về hosting.
  - **Graceful Shutdown (Bảo toàn dữ liệu khi dừng bot):** Bắt các tín hiệu dừng (`SIGINT`, `SIGTERM`), tự động đồng bộ toàn bộ dữ liệu cuối cùng lên Turso trước khi đóng tiến trình.
  - **Tích hợp Admin Panel & API:**
    - Cung cấp endpoint `GET /api/cache/status` và `POST /api/cache/sync` để kiểm tra và kích hoạt đồng bộ thủ công.
    - Giao diện Admin Panel hiển thị trạng thái Cache, chu kỳ đồng bộ, thời gian đồng bộ lần cuối và nút **"Lưu / Đồng Bộ Ngay Lên Turso"**.
  - **Cấu hình qua file `.env`:**
    - `TURSO_CACHE_ENABLED`: `true`/`false` (bật/tắt cache, mặc định: `true`).
    - `TURSO_CACHE_DB_PATH`: đường dẫn file database cục bộ (mặc định: `./data/turso_cache.db`).
    - `TURSO_CACHE_SYNC_INTERVAL_MINUTES`: số phút mỗi chu kỳ đồng bộ (mặc định: `10`).

## Thay đổi trong ngày — 19/11/2026

### Tính năng mới

- **Cơ chế quy đổi Linh Kim:** Cứ 100 Linh Kim phẩm bậc thấp hơn có thể dung hợp quy đổi thành 1 Linh Kim bậc cao hơn 1 bậc (Phàm ➔ Tinh ➔ Linh ➔ Địa ➔ Thiên ➔ Thánh ➔ Thần ➔ Hỗn Độn).
  - Hỗ trợ qua lệnh slash: `/bag convert`, `/bag exchange`, `/shop convert`, `/shop exchange`.
  - Hỗ trợ lệnh prefix: `abag convert from:<phẩm> amount:<số/all>`, hoặc alias nhanh `aconvert <phẩm> [số/all]`, `aexchange <phẩm> [số/all]`, `adoi <phẩm> [số/all]`.
  - Tham số `amount:all` tự động đổi tối đa theo số Linh Kim hiện có.
  - Toàn bộ quá trình tiêu hao và nhận Linh Kim được thực hiện an toàn trong một transaction.

