# Changelog

## Thay đổi trong ngày — 22/11/2026

### Tính năng mới

- **Hệ thống Linh Giáp (HP + Thủ + Giảm Sát Thương nhận vào) & Cầu Nguyện Giáp:**
  - **Cơ sở dữ liệu:** Thêm bảng `tutien_armors`, bổ sung cột `dmg_reduction` cho `tutien_gacha_items`, cột pity riêng (`armor_pity_4`, `armor_pity_5`, `armor_rate_up_guaranteed`) cho `tutien_wish_pity`, và tự động khởi tạo 9 Linh Giáp mặc định (3★–5★).
  - **Cầu Nguyện (`/wish`):** Thêm Đài Cầu Nguyện mới **🛡️ Huyền Giáp Kim Thân (`banner:armor`)** cùng hỗ trợ Linh Giáp trong banner Tổng Hợp (`standard`).
  - **Lệnh quản lý mới (`/armor` / `aarmor` / `agiap` / `alinhgiap`):**
    - `/armor list`: Xem danh sách Linh Giáp (HP, Thủ, Giảm ST %, Bản Mệnh, Đang Trang Bị).
    - `/armor equip`: Trang bị Linh Giáp hộ thể.
    - `/armor bond`: Tế luyện **Bản Mệnh Linh Giáp** (tăng tiến HP & Thủ theo cảnh giới).
    - `/armor devour [all]`: Thôn phệ Linh Giáp dư thừa tăng HP, Thủ, Giảm ST (%) và bậc.
  - **Tích hợp Chiến Đấu & Hồ Sơ:** Linh Giáp cộng HP, Thủ và **Giảm Sát Thương Nhận Vào** (tối đa 50%) trong PvP (`/duel`), Tháp (`/tower`), Boss Thế Giới (`/boss`), Tông Môn và hiển thị trực tiếp trong `/profile`. Tân thủ `/start` được tặng 1 **Thanh Y Linh Giáp (Phàm)**.
  - **Admin Panel:**
    - Thêm tab **🛡️ Linh Giáp / Hộ Giáp** với đầy đủ API CRUD (`/api/armors`, `/api/armors/presets`), lọc theo bậc/người chơi, Ban Thưởng Linh Giáp theo Presets, đổi ảnh và xóa.
    - Cập nhật tab **Cầu Nguyện (Wish / Gacha)** & trình **Giả Lập Quay**: hỗ trợ loại `Linh Giáp (armor)`, đài **Huyền Giáp Kim Thân (`armor`)** và cấu hình chỉ số **Giảm Sát Thương (`dmg_reduction`)**.

- **Cân bằng hệ thống Đấu Pháp Đài (`/duel`):**
  - **Giới hạn chênh lệch cảnh giới (`±2` cảnh giới):** Chế độ Đấu Xếp Hạng (`mode:rank`, mặc định) chỉ cho phép thách đấu trong phạm vi `±2` đại cảnh giới để tránh áp đảo tân thủ.
  - **Chế độ Đồng Cảnh Giới (`/duel target:@user mode:fair` hoặc `aduel @user fair`):** Không giới hạn cảnh giới, tự động chuẩn hóa cả 2 về cùng mốc cảnh giới & cấp độ để so tài thuần túy theo Tộc, Linh Căn, Trận Pháp, Linh Khí và Công Pháp.
  - **Tính điểm Elo theo chênh lệch thực lực:** Thắng đối thủ mạnh hơn nhận `+30` đến `+45` điểm (thua chỉ mất ít); thắng đối thủ yếu hơn nhiều bị giới hạn còn `+1`–`+5` điểm (hoặc `+0` điểm / `0` bạc nếu chênh lệch quá lớn) để chống farm tân thủ.
  - **Cân bằng Combat PvP (`combat.js`):**
    - Giảm độ dốc `realmMultiplier` trong PvP (`1.0`/cảnh giới) và áp dụng **PvP Damage Reduction (65%)** để trận đấu kéo dài qua nhiều hiệp hơn.
    - Áp dụng **Soft Cap theo cảnh giới** cho tổng chỉ số cộng thêm từ Linh Khí, Linh Thú, Trợ Thủ trong PvP (phần vượt ngưỡng trần tính 35%).
    - Tương khắc Linh Căn vừa tăng `+25%` ST gây ra vừa giảm `-10%` ST nhận vào; hỗ trợ **Công Pháp khác hệ khắc chế ngược** linh căn đối thủ (`+20%` ST và bỏ qua bất lợi giảm ST).
    - Hết 20 hiệp xét thắng thua theo **% HP còn lại** (và hỗ trợ kết quả **Hòa** nếu % HP ngang nhau).

- **Trao đổi ngược Linh Kim (1 bậc cao = 10 bậc thấp):**
  - Cho phép phân tách 1 Linh Kim phẩm cao thành 10 Linh Kim phẩm thấp hơn liền kề (Hỗn Độn ➔ Thần ➔ Thánh ➔ Thiên ➔ Địa ➔ Linh ➔ Tinh ➔ Phàm).
  - Hỗ trợ lệnh slash: `/bag split from:<phẩm> [amount:<số/all>]` và `/shop split from:<phẩm> [amount:<số/all>]`.
  - Hỗ trợ lệnh prefix: `abag split <phẩm> [số/all]` hoặc alias nhanh `asplit`, `adowngrade`, `atach` (hỗ trợ gõ không dấu/gạch dưới như `hon_don`, `hondon`, `dia`).
  - Toàn bộ thao tác trừ và cộng Linh Kim chạy an toàn trong 1 transaction.

### Sửa lỗi (Bug Fixes)

- **Tự động khôi phục xung đột đồng bộ Turso Cache (`InvalidPushFrameConflict`):**
  - Khi nhiều tiến trình cùng ghi lên Turso khiến local replica bị lệch frame (`Sync(InvalidPushFrameConflict(...))`), [`src/config/database.js`](file:///home/kozaki/Documents/tu-tien/src/config/database.js) sẽ tự động sao lưu file replica cũ vào `data/backups/` (giữ tối đa 3 bản), xóa bản replica bị xung đột, khởi tạo lại client và đồng bộ bản mới nhất từ Turso thay vì lặp lỗi mãi.
  - Sửa `syncDatabase()` luôn gọi `getDb()` bên trong hàng đợi đồng bộ để không dùng nhầm client cũ sau khi khôi phục.

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

