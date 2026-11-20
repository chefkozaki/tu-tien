# Changelog

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

