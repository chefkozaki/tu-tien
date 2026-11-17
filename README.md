# 🌌 Tu Tiên Vấn Đạo - Discord Tu Tiên RPG Bot

Hệ thống Bot Discord Tu Tiên nhập vai toàn diện dựa trên **Discord.js v14**, cơ sở dữ liệu đám mây **Turso (LibSQL)**, giao diện 100% **Rich Embeds** kèm Buttons & Select Menus tương tác trực quan, sử dụng **Slash Commands** chuẩn Discord.

Hướng dẫn đầy đủ về cú pháp và danh sách lệnh prefix: [prefix.md](./prefix.md).

---

## ⚡ Tính Năng Nổi Bật

### 1. Hệ Thống Cấp Độ & 9 Đại Cảnh Giới
- **Cảnh giới:** `Linh Sĩ` ➔ `Linh Úy` ➔ `Linh Tá` ➔ `Linh Tướng` ➔ `Linh Vương` ➔ `Linh Đế` ➔ `Chúa Tể` ➔ `Thần` ➔ `Tối Thượng`.
- **Phân cấp:** Cấp 1-3 (Hạ cấp), Cấp 4-6 (Trung cấp), Cấp 7-9 (Thượng cấp), Cấp 10 (Đỉnh cấp). Riêng **Tối Thượng** không chia cấp, tích lũy vô hạn chỉ số ẩn và mở khóa **Bảng Xếp Hạng Thần Điện**.
- **Điểm Linh Lực (XP):** Tích lũy để thăng cấp. Khi đạt cấp 10 (Đỉnh cấp), phải dùng lệnh `/dot-pha` để vượt thiên kiếp (kiểm tra Linh Kim 8 phẩm chất, Trúc Cơ Đan, Ải Tâm Ma, 3-6-9 Đạo Lôi Kiếp, Lĩnh Ngộ Quy Tắc).

### 2. Hệ Thống 6 Chủng Tộc (Nội Tại & Thiên Phú Độc Nhất)
- 🧘 **Nhân Tộc:** +15% tốc độ hấp thụ Linh Lực (XP), trang bị thêm **+1 Ô Công Pháp/Kỹ Năng** (4 ô thay vì 3).
- 🐉 **Long Tộc:** +25% HP tối đa, +15% Kháng STVL. Thiên phú **Long Uy**: Máu < 30% tăng 40% sát thương và miễn khống chế 5 lượt.
- ✨ **Tiên Tộc:** +20% Sát thương phép, +10% Tốc độ ra đòn. Thiên phú giải trừ debuff và hồi phục linh lực tiêu hao.
- 😈 **Ma Tộc:** +15% Tỷ lệ bạo kích, +10% Hút máu. Thiên phú **Ma Khí**: Hạ địch tăng vĩnh viễn sát thương trong trận (cộng dồn tối đa 5 tầng = +50%).
- 🪓 **Rợ Tộc:** +25% Công vật lý, +30% Kháng khống chế. Thiên phú **Cuồng Chiến**: Càng mất máu sát thương và tốc độ càng tăng (tối đa +50%).
- 🛸 **Kẻ Đổ Bộ:** Miễn nhiễm mọi hiệu ứng giảm chỉ số môi trường ở Bí Cảnh, +20% tỷ lệ rơi vật phẩm hiếm, đòn đánh gây sát thương chuẩn (bỏ qua giáp).

### 3. Kinh Tế & Vật Phẩm Đột Phá
- **Ngân Lượng:** Tiền tệ chính trong game.
- **Linh Kim (8 Phẩm Chất):** Phàm, Tinh, Linh, Địa, Thiên, Thánh, Thần, Hỗn Độn.
- **Linh Thú (Tối đa 3 con xuất trận):**
  - **Trận Pháp Cộng Hưởng:** 3 linh thú cùng hệ sẽ kích hoạt cộng hưởng; hệ linh thú và các chỉ số hiệu ứng có thể quản lý trong tab **Linh Thú** của admin.
  - **Tiến Hóa:** Nuốt lẫn nhau để nâng Sao (1-5⭐) và tăng vọt chỉ số.
- **Động Phủ AFK:** Dùng `/afk` hoặc `aafk` để bật/tắt tích lũy. Tụ Linh Trận cấp 1 tạo 2 XP/phút và 1 Ngân Lượng/phút; nâng cấp bằng `/base upgrade` để tăng tốc độ XP. Thu hoạch bằng `/base harvest`, tối đa 24 giờ mỗi chu kỳ.
- **Linh Khí (Tối đa 1 vũ khí):**
  - **Bản Mệnh Linh Khí:** Lên cấp và mạnh lên theo cảnh giới của chủ nhân bằng cách nuốt các Linh Khí rác khác.
- **Trợ Thủ (Tối đa 1 trợ thủ):**
  - **Hộ Đạo Giả (Chiến Đấu):** Trực tiếp ra đòn, đỡ đòn hoặc buff cho nhân vật trong giao tranh.
  - **Đạo Đồng (Sinh Hoạt):** Tăng 30% tài nguyên AFK khi trạng thái AFK đang bật, tăng 15% tỷ lệ luyện đan và giảm 15% giá mua đồ Chợ Đen.

### 4. Động Phủ (Hệ Thống AFK / Idle & Chế Tạo)
- **Tụ Linh Trận:** Chỉ tích lũy XP và Ngân Lượng khi bật AFK bằng `/afk` hoặc `aafk`. Cấp 1 tạo 2 XP/phút và 1 Ngân Lượng/phút; nâng cấp bằng Ngân Lượng để tăng XP, tích lũy tối đa 24 giờ mỗi chu kỳ.
- **Dược Viên:** Mua hạt giống, gieo trồng và thu hoạch linh thảo quý.
- **Lò Luyện Đan:** Luyện chế Trúc Cơ Đan, Tụ Linh Đan, Tẩy Tủy Đan, Bách Hóa Kim Đan.
- **Lò Rèn:** Rèn Linh Khí mới từ khoáng thạch.

### 5. Tông Môn & Chiến Trường Mỏ Linh Mạch
- Lập phái hoặc gia nhập Tông Môn, đóng góp Ngân Lượng / Linh Kim để nâng cấp tông môn và học Công Pháp Trấn Phái.
- Đánh chiếm các **Mỏ Linh Mạch** trên bản đồ thế giới để nhận thuế Ngân Lượng & Linh Kim chia cho tông môn mỗi ngày.

### 6. Khiêu Chiến & Khám Phá
- **Đấu Pháp Đài (1v1 PvP):** Luận bàn tỷ thí giữa người chơi, tính toán chi tiết combo Tộc + Linh Khí + 3 Linh Thú + Trợ Thủ.
- **Thí Luyện Tháp (PvE):** Leo tầng (Tầng 1 -> 100+), thu hoạch Linh Kim và đan dược quý.
- **Bí Cảnh & Kỳ Ngộ (Roguelike):** Thám hiểm cổ động, gặp gỡ Lão Ăn Mày, Động Phủ Phong Ấn, Linh Điêu với các lựa chọn sinh tử.
- **Boss Thế Giới (Hung Thú Thượng Cổ):** Toàn server hợp lực tấn công, chia thưởng Linh Kim phẩm cao và có cơ hội nhận Linh Thú theo bảng sát thương.

### 7. Chợ Đen & Giao Dịch Tự Do
- Hệ thống nhà đấu giá tự do: Người chơi F2P bán Linh Kim, Đan Dược, Linh Thảo để kiếm Ngân Lượng từ người chơi khác.

---

## 🛠️ Cài Đặt & Chạy Bot

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Cấu hình file `.env`:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID= # Để trống để đăng ký Global, hoặc điền ID Server thử nghiệm

TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_turso_token_here
```

### 3. Deploy Slash Commands:
Lệnh deploy sẽ **xóa sạch toàn bộ lệnh cũ** và đăng ký mới các lệnh slash chuẩn:
```bash
npm run deploy
```

### 4. Khởi động bot:
```bash
npm start
```

### 5. Host bot và Admin Panel trên Bot-Hosting.net:
Có thể chạy bot và Admin Panel trong cùng một deployment Node.js. Bot-Hosting cấp HTTPS/subdomain cho web server và chuyển tiếp yêu cầu tới cổng `SERVER_PORT`; không cần tự mở cổng hay cài chứng chỉ.

Trong phần **Environment** của deployment, thêm các biến sau (dùng secret cho thông tin đăng nhập):
```env
ADMIN_HOST=0.0.0.0
START_ADMIN_WITH_BOT=true
ADMIN_TRUST_PROXY=true
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<mật-khẩu-ngẫu-nhiên-riêng-dài-ít-nhất-16-ký-tự>
```

Giữ lệnh khởi chạy deployment là `node index.js` (hoặc `npm start`), rồi restart/redeploy. Trong tab **Domains**, chọn **Activate** để bật subdomain HTTPS miễn phí. Mở URL `.apps.bot-hosting.cloud` được cấp; trình duyệt sẽ yêu cầu tài khoản và mật khẩu admin. `SERVER_PORT` do nền tảng cấp tự động; không đặt `ADMIN_PORT` trên deployment này.

Đồng thời giữ các biến môi trường cần cho bot và database như `DISCORD_TOKEN`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`. Nếu gói Bot-Hosting chỉ cho một deployment, cách trên vẫn dùng một deployment vì web server chạy cùng tiến trình bot. `ADMIN_TRUST_PROXY=true` chỉ an toàn khi request đi qua HTTPS proxy của nhà cung cấp; không bật tùy chọn này khi tự host hoặc mở port trực tiếp.

Để chạy bên ngoài Bot-Hosting, Admin Panel yêu cầu xác thực và HTTPS khi bind ra giao diện mạng. Có thể dùng HTTPS trực tiếp bằng cách cấu hình `ADMIN_TLS_KEY_PATH` và `ADMIN_TLS_CERT_PATH`, hoặc đặt sau reverse proxy HTTPS đáng tin cậy. Không mở HTTP admin trực tiếp ra Internet.

Không dùng mật khẩu mặc định/yếu, không chia sẻ mật khẩu hoặc commit secret vào mã nguồn.

---

## 📜 Danh Sách Slash Commands

| Lệnh | Mô Tả |
| :--- | :--- |
| `/khoi-dau` | Chọn 1 trong 6 Chủng Tộc và thức tỉnh Linh Căn bước vào con đường tu tiên |
| `/tu-vi` | Xem hồ sơ tu tiên, cảnh giới, trang bị, 3 linh thú, trợ thủ và động phủ |
| `/tu-luyen` | Đả tọa tu luyện hấp thụ thiên địa linh khí (nhận XP) |
| `/dot-pha` | Đột phá Đại Cảnh Giới khi đạt Cấp 10 (Đỉnh Cấp) |
| `/afk` hoặc `aafk` | Bật/tắt trạng thái AFK; chỉ khi bật, Động Phủ mới bắt đầu tính thời gian |
| `/base harvest` | Thu hoạch XP và Ngân Lượng AFK, trạng thái AFK tiếp tục bật |
| `/base upgrade [levels]` | Nâng nhiều cấp Tụ Linh Trận trong một lần; bỏ trống `levels` để nâng 1 cấp, chi phí tính cộng dồn theo từng cấp |
| `/dong-phu duoc-vien` | Xem tình trạng dược viên, gieo trồng và thu hoạch linh thảo |
| `/dong-phu luyen-dan` | Luyện chế đan dược (Trúc Cơ Đan, Tụ Linh Đan, Tẩy Tủy Đan...) |
| `/dong-phu lo-ren` | Rèn Linh Khí mới tại Lò Rèn |
| `/linh-thu danh-sach` | Xem danh sách Linh Thú sở hữu và kích hoạt Trận Pháp Cộng Hưởng |
| `/linh-thu trang-bi` | Trang bị Linh Thú vào Ô 1, Ô 2 hoặc Ô 3 |
| `/linh-thu tien-hoa` | Nuốt linh thú khác để tăng sao (1-5⭐) và chỉ số |
| `/linh-khi danh-sach` | Xem danh sách Linh Khí và Bản Mệnh Khí |
| `/linh-khi trang-bi` | Trang bị vũ khí chính xuất chiến |
| `/linh-khi ban-menh` | Tế luyện vũ khí làm Bản Mệnh Linh Khí |
| `/linh-khi thon-phe` | Cho Bản Mệnh Khí nuốt linh khí rác để tăng cấp và chỉ số |
| `/tro-thu danh-sach` | Xem danh sách Trợ Thủ (Chiến Đấu vs Sinh Hoạt) |
| `/tro-thu xuat-chien` | Chọn 1 Trợ Thủ xuất chiến |
| `/cong-phap` | Xem và trang bị Công Pháp, Thần Thông (Nhân Tộc có 4 ô) |
| `/bi-canh` | Thám hiểm Bí Cảnh Ngẫu Nhiên với các sự kiện Roguelike tương tác |
| `/boss-the-gioi thong-tin` | Xem lượng máu và bảng sát thương Boss Hung Thú Thế Giới |
| `/boss-the-gioi tan-cong` | Xuất chiêu công kích Boss Thế Giới chia thưởng |
| `/boss channel channel:<#kênh>` | Đặt kênh thông báo boss mới cho máy chủ (quyền Quản lý Máy chủ); dùng `off` để tắt |
| `/thi-luyen` | Khiêu chiến Thí Luyện Tháp PvE (Tầng 1 -> 100+) |
| `/dau-phap` | Thách đấu 1v1 Đấu Pháp Đài với tu sĩ khác |
| `/sect info` | Xem thông tin Tông Môn và điểm cống hiến |
| `/sect members` | Xem danh sách thành viên và lực tu vi |
| `/sect create name:<tên>` | Thành lập Tông Môn mới (cần đạt Linh Tướng và có 50.000 Ngân Lượng) |
| `/sect join id:<id>` | Gửi đơn xin gia nhập Tông Môn, chờ Chưởng Môn chấp nhận |
| `/sect applications` | Chưởng Môn xem các đơn xin gia nhập đang chờ |
| `/sect approve application-id:<id>` | Chưởng Môn chấp nhận đơn gia nhập |
| `/sect reject application-id:<id>` | Chưởng Môn từ chối đơn gia nhập |
| `/sect recruit member:<người chơi>` | Chưởng Môn tuyển thành viên vào Tông Môn |
| `/sect donate` | Đóng góp Ngân Lượng hoặc Linh Kim cho tông môn |
| `/sect mine` | Xem, đánh chiếm mỏ hoặc thu thuế mỏ tông môn |
| `/cho-den xem` | Duyệt danh sách vật phẩm đang bày bán trên Chợ Đen |
| `/cho-den ban` | Đăng bán Linh Kim, Đan Dược, Linh Thảo bằng Ngân Lượng |
| `/cho-den mua` | Mua vật phẩm trên Chợ Đen (Giảm giá 15% nếu có Trợ Thủ Sinh Hoạt) |
| `/cho-den huy` | Hủy bài đăng bán để thu hồi vật phẩm |
| `/shop view` | Xem giá động Đan Dược và Linh Kim từ cửa hàng hệ thống |
| `/shop buy item:<vật phẩm> amount:<số lượng>` | Mua Đan Dược hoặc Linh Kim bằng Ngân Lượng |
| `/wish pull` | Cầu Nguyện: 2.000 Ngân Lượng/lượt hoặc 18.000/10 lượt; pity 5★ kiểu Genshin (0,6% cơ bản, soft pity từ lượt 74, hard pity lượt 90) |
| `/tui-do xem` | Xem túi trữ vật (Linh Kim 8 phẩm, Đan Dược, Hạt Giống) |
| `/tui-do dung-dan` | Uống đan dược (Tụ Linh Đan, Tẩy Tủy Đan) |
| `/inv` hoặc `ainv` | Xem Ngân Lượng, Linh Lực, số lượng Linh Kim từng phẩm và tài nguyên |
| `/bag use item_id:<ID>` hoặc `abag use <ID>` | Dùng đan dược theo ID hiển thị trong `/inv` |
| `/bang-xep-hang` | Xem Thiên Đạo Bảng (Tu Vi), Thần Điện Bảng (Tối Thượng), Phú Hộ, PvP, Leo Tháp |
| `/huong-dan` | Cẩm nang toàn tập con đường Tu Tiên |

Mỗi người chơi có cooldown chung 10 giây giữa các lệnh slash và prefix.

Lệnh `/profile` và `/help` dùng phản hồi riêng tư khi gọi bằng slash. Khi gọi qua prefix (`aprofile`, `ahelp`), kết quả luôn được gửi tại kênh đã nhập lệnh.
