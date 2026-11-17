# Hướng dẫn lệnh Prefix

Bot hỗ trợ gọi các lệnh trong kênh máy chủ Discord bằng prefix. Prefix mặc định là `a`, ví dụ:

```text
aprofile
abase harvest
awish pull banner:weapon count:10
```

Sau khi đổi prefix, thay `a` trong các ví dụ bằng prefix mới.

## Cú pháp chung

- Dùng ` <prefix><tên-lệnh> [lệnh-con] [tham-số]`. Tên lệnh và lệnh con viết thường, giống tên slash command.
- Có thể truyền tham số theo tên, ví dụ `levels:10` hoặc `levels=10`. Cách nên dùng là `ten-tham-so:gia-tri`.
- Tham số không ghi tên cũng được nhận theo thứ tự khai báo của lệnh. Với lệnh có nhiều tham số, nên ghi tên để tránh nhầm.
- Giá trị có khoảng trắng cần đặt trong dấu nháy đơn hoặc kép, ví dụ `dao_hieu:"Thanh Vân"`; áp dụng cả khi giá trị bắt đầu bằng `tham-so:`.
- Số phải nhập đúng kiểu và các lựa chọn giới hạn chỉ nhận giá trị được liệt kê bên dưới.
- Với tham số người dùng, có thể dùng mention (`@Tên`) hoặc Discord user ID.
- Lệnh prefix hoạt động trong máy chủ, không phải tin nhắn riêng với bot. Mỗi lệnh có cooldown 10 giây dùng chung với slash command.
- Mọi phản hồi từ lệnh prefix đều được gửi trực tiếp vào kênh đã nhập lệnh; bot không gửi kết quả prefix qua tin nhắn riêng.
- Nếu một lệnh trả về nút hoặc menu, hãy bấm/chọn trực tiếp trên tin nhắn bot.

## Quản lý Prefix

Prefix mặc định là `a` và được lưu riêng cho từng máy chủ. Chỉ thành viên có quyền **Quản lý Máy chủ** mới được đổi.

```text
aprefix                         Xem prefix hiện tại
aprefix !                       Đổi prefix thành !
aprefix <prefix>                Cú pháp alias cố định để đổi prefix
<prefix>prefix                  Xem prefix hiện tại
<prefix>prefix value:<prefix>   Đổi prefix
```

Prefix mới dài từ 1 đến 5 ký tự, không chứa khoảng trắng và không được là `aprefix`. Alias `aprefix` luôn dùng được để xem/đổi prefix, kể cả sau khi đã đổi prefix máy chủ.

## Bật/tắt lệnh theo kênh

Thành viên có quyền **Quản lý Máy chủ** có thể tắt một lệnh trong chính kênh đang nhập. Tắt lệnh gốc sẽ chặn cả lệnh con; dùng lại lệnh đó trong cùng kênh để bật lại. Thiết lập áp dụng cho cả slash command và prefix command.

```text
adisable wish
adisable sect
/disable command:sect
```

Alias `adisable` luôn dùng được để quản lý lệnh, kể cả khi lệnh `disable` bị tắt ở kênh đó. Khi máy chủ đã đổi prefix, vẫn dùng alias cố định `adisable <lệnh>`, hoặc `<prefix>disable command:<lệnh>`.

## Danh sách lệnh

### Tu luyện và hồ sơ

| Lệnh | Cách dùng / chức năng |
|---|---|
| `start` | `astart dao_hieu:"Thanh Vân"` — tạo nhân vật mới; `dao_hieu` là bắt buộc. |
| `profile` | `aprofile` xem hồ sơ của mình; `aprofile user:@Tên` xem hồ sơ người khác. |
| `inv` | `ainv` xem Ngân Lượng, Linh Lực, Linh Kim và số lượng tài nguyên. Hiển thị ID vật phẩm để dùng ở lệnh `bag use`. |
| `bag` | `abag view` xem túi; `abag use item_id:123` dùng đan dược theo ID lấy từ `ainv`. |
| `train` | `atrain` đả tọa, hấp thụ Linh Lực. |
| `break` | `abreak` đột phá đại cảnh giới khi đủ điều kiện. |
| `afk` | `aafk` bật/tắt trạng thái AFK của Động Phủ. |
| `rank` | `arank type:tu_vi` xem bảng xếp hạng. `type` nhận một trong: `tu_vi`, `than_dien`, `phu_ho`, `pvp`, `tower`. |
| `help` | `ahelp` xem cẩm nang trong bot. |

### Động Phủ, chế tạo và Cầu Nguyện

| Lệnh | Cách dùng / chức năng |
|---|---|
| `base harvest` | Thu hoạch XP và Ngân Lượng đã tích lũy; AFK vẫn tiếp tục bật. |
| `base upgrade` | Nâng Tụ Linh Trận. Ví dụ `abase upgrade levels:10` nâng 10 cấp trong một lần; bỏ `levels` thì nâng 1 cấp. Không vượt quá cấp 50; chi phí tính cộng dồn theo từng cấp. |
| `base garden` | Xem Dược Viên, gieo trồng hoặc thu hoạch linh thảo qua menu/nút. |
| `base brew` | Luyện đan qua menu tương tác. |
| `base forge` | Rèn Linh Khí qua menu tương tác. |
| `wish view` | Xem banner và tiến trình bảo hiểm; `banner` tùy chọn, nhận `weapon`, `pet`, `helper`, `standard`. Ví dụ `awish view banner:pet`. |
| `wish pull` | Cầu Nguyện; cần `banner` (`weapon`, `pet`, `helper`, `standard`) và `count` (`1` hoặc `10`). Giá: 2.000 Bạc/lượt hoặc 18.000 Bạc/10 lượt. 5★ cơ bản 0,6%, soft pity từ lượt 74, hard pity lượt 90; 4★ cơ bản 5,1%, bảo hiểm 4★+ ở lượt 10. Ví dụ `awish pull banner:weapon count:10`. |
| `event` | `aevent` thám hiểm Bí Cảnh; chọn hành động trên nút trong tin nhắn kết quả. |

### Trang bị và chiến đấu

| Lệnh | Cách dùng / chức năng |
|---|---|
| `weapons list` | Xem Linh Khí. |
| `weapons equip` | Chọn Linh Khí để trang bị qua menu. |
| `weapons bond` | Chọn Linh Khí để tế luyện thành Bản Mệnh Khí. |
| `weapons devour` | Chọn Linh Khí làm nguyên liệu cho Bản Mệnh Khí thôn phệ. |
| `pets list` | Xem Linh Thú và Trận Pháp Cộng Hưởng. |
| `pets equip slot:1` | Chọn Linh Thú cho ô 1; `slot` chỉ nhận `1`, `2`, hoặc `3`. |
| `pets evolve` | Chọn Linh Thú chính và Linh Thú hiến tế qua menu. |
| `helpers list` | Xem Trợ Thủ. |
| `helpers deploy` | Chọn Trợ Thủ xuất chiến qua menu. |
| `helpers rest` | Thu hồi Trợ Thủ đang xuất chiến. |
| `skills` | `askills` xem/quản lý Công Pháp và Thần Thông qua menu. |
| `duel target:@Tên` | Khiêu chiến người chơi khác. Có cooldown riêng 60 giây cho mỗi người dùng, dùng chung giữa slash và prefix. Có thể thay mention bằng Discord user ID; không thể tự đấu hoặc đấu với bot. |
| `tower` | `atower` khiêu chiến Thí Luyện Tháp. |
| `boss info` | Xem Boss Thế Giới, lượng máu và bảng sát thương. |
| `boss atk` | Tấn công Boss Thế Giới. |
| `boss channel` | Xem kênh thông báo Boss hiện tại. |
| `boss channel channel:123456789012345678` | Đặt kênh thông báo bằng ID hoặc mention, ví dụ `aboss channel channel:<#123456789012345678>`. Nhập `off` để tắt. Cần quyền **Quản lý Máy chủ**. |

### Tông Môn và giao dịch

| Lệnh | Cách dùng / chức năng |
|---|---|
| `sect info` | Xem thông tin Tông Môn của mình. |
| `sect members` | Xem danh sách thành viên trong Tông Môn. |
| `sect create name:"Thanh Vân Tông"` | Thành lập Tông Môn; cần đạt cảnh giới **Linh Tướng**, có 50.000 Ngân Lượng và tên chưa bị trùng. Điều kiện chỉ áp dụng khi tạo Tông Môn mới, không ảnh hưởng Tông Môn đã có. |
| `sect join id:12` | Gửi đơn xin gia nhập Tông Môn theo ID; cần Chưởng Môn duyệt. |
| `sect applications` | Chưởng Môn xem các đơn xin gia nhập đang chờ duyệt. |
| `sect approve application-id:12` | Chưởng Môn chấp nhận đơn xin gia nhập. |
| `sect reject application-id:12` | Chưởng Môn từ chối đơn xin gia nhập. |
| `sect recruit member:@Tên` | Chưởng Môn tuyển trực tiếp một thành viên. Có thể dùng Discord user ID thay mention. |
| `sect donate silver:10000` | Cống hiến Ngân Lượng. |
| `sect donate gold:2 quality:Phàm` | Cống hiến Linh Kim; `quality` nhận `Phàm`, `Tinh`, `Linh`, `Địa`, `Thiên`. Có thể dùng `silver` hoặc `gold` theo hướng dẫn của bot. |
| `sect mine action:view` | Xem danh sách mỏ. |
| `sect mine action:capture mine-id:1` | Đánh chiếm mỏ theo ID. |
| `sect mine action:claim mine-id:1` | Thu thuế mỏ theo ID. |
| `market view` | Xem các bài đăng bán; có thể lọc bằng `category:spirit_gold`, `category:pill`, hoặc `category:herb`. |
| `market sell item:"pill:TrucCoDan:Trúc Cơ Đan" amount:1 price:1000` | Đăng bán vật phẩm. `item` phải chọn giá trị hợp lệ trong danh mục bên dưới; `amount` là số lượng và `price` là tổng giá bán. |
| `market buy id:12` | Mua bài đăng theo ID. |
| `market cancel id:12` | Hủy bài đăng của chính mình theo ID để thu hồi vật phẩm. |
| `shop view` | Xem Đan Dược, Linh Kim và giá động theo lượng bạc/nguồn cung toàn server. |
| `shop buy item:TrucCoDan amount:1` | Mua vật phẩm trong cửa hàng hệ thống; số lượng từ 1 đến 100. `item` nhận `TrucCoDan`, `TuLinhDan`, `TayTuyDan`, `BachHoaKimDan`, `Phàm`, `Tinh`, `Linh`, `Địa`, `Thiên`, `Thánh`, `Thần`, hoặc `"Hỗn Độn"` (đặt tên có khoảng trắng trong dấu nháy). |

Các giá trị `item` được hỗ trợ ở `market sell`:

```text
spirit_gold:Phàm:Linh Kim (Phẩm Phàm)
spirit_gold:Tinh:Linh Kim (Phẩm Tinh)
spirit_gold:Linh:Linh Kim (Phẩm Linh)
spirit_gold:Địa:Linh Kim (Phẩm Địa)
spirit_gold:Thiên:Linh Kim (Phẩm Thiên)
pill:TrucCoDan:Trúc Cơ Đan
pill:TuLinhDan:Tụ Linh Đan
pill:TayTuyDan:Tẩy Tủy Đan
pill:BachHoaKimDan:Bách Hóa Kim Đan
```

Khi dùng một giá trị có khoảng trắng, hãy đặt toàn bộ giá trị trong dấu nháy như ví dụ `item:"pill:TrucCoDan:Trúc Cơ Đan"`.

## Ví dụ nhanh

```text
aprofile
astart dao_hieu:"Thanh Vân"
aafk
abase upgrade levels:10
awish pull banner:pet count:10
apets equip slot:1
asect mine action:view
amarket sell item:"pill:TrucCoDan:Trúc Cơ Đan" amount:1 price:1000
```
