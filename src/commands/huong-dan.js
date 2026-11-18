const { SlashCommandBuilder } = require('discord.js');
const { createTextEmbedPages, replyWithEmbedPages } = require('../utils/embedPagination');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Cẩm nang toàn tập con đường Tu Tiên và danh sách lệnh slash'),

  async execute(interaction) {
    const description =
        `Chào mừng đạo hữu đến với thế giới Tu Tiên RPG!\n` +
        `Dưới đây là cẩm nang chi tiết và các lệnh của hệ thống:\n\n` +
        `⚡ **LỆNH NHANH:**\n` +
        `• Prefix mặc định là \`a\`: dùng \`aprofile\`, \`aafk\`, \`abase harvest\` hoặc \`awish pull banner:weapon count:10\`.\n` +
        `• Mỗi đạo hữu cần chờ 10 giây giữa các lệnh; cooldown dùng chung cho slash và prefix.\n` +
        `• Kết quả của lệnh prefix luôn gửi trong kênh đã nhập lệnh; lệnh slash vẫn giữ chế độ phản hồi riêng tư nếu được thiết lập.\n` +
        `• Dùng \`/inv\` hoặc \`ainv\` để xem Ngân Lượng, Linh Lực, số lượng Linh Kim từng phẩm và tài nguyên.\n` +
        `• Dùng đan dược bằng \`/bag use item_id:<ID>\` hoặc \`abag use <ID>\`; lấy ID trong \`/inv\`.\n` +
        `• Đổi mã quà tặng bằng \`/code code:<mã>\` hoặc \`acode <mã>\`; mỗi mã chỉ đổi một lần và cần còn hạn.\n` +
        `• Chỉ máy chủ nằm trong whitelist mới dùng được bot; chủ bot xác minh máy chủ bằng \`/verify\` hoặc \`averify\`.\n` +
        `• Đổi prefix bằng \`/prefix value:<prefix>\` hoặc \`aprefix <prefix>\`; cần quyền Quản lý Máy chủ.\n\n` +
        `• Quản lý lệnh theo kênh bằng \`adisable <lệnh>\` hoặc \`/adisable command:<lệnh>\`; dùng lại lệnh để bật lại, cần quyền Quản lý Máy chủ.\n\n` +
        `🥋 **1. CẢNH GIỚI & CẤP ĐỘ:**\n` +
        `• 9 Đại Cảnh Giới: Linh Sĩ ➔ Linh Úy ➔ Linh Tá ➔ Linh Tướng ➔ Linh Vương ➔ Linh Đế ➔ Chúa Tể ➔ Thần ➔ Tối Thượng.\n` +
        `• Mỗi cảnh giới gồm 10 Cấp: Cấp 1-3 (Hạ cấp), 4-6 (Trung cấp), 7-9 (Thượng cấp), Cấp 10 (Đỉnh cấp).\n` +
        `• Đạt Cấp 10 Đỉnh Cấp cần dùng \`/break\` kèm Linh Kim và vượt các thử thách (Tâm Ma, Lôi Kiếp, Quy Tắc).\n\n` +
        `🧬 **2. HỆ THỐNG CHỦNG TỘC:**\n` +
        `• **Nhân Tộc:** +15% XP, +1 ô Công Pháp (4 ô).\n` +
        `• **Long Tộc:** +25% HP, +15% Kháng STVL. Khi máu < 30% kích hoạt *Long Uy* (+40% DMG, miễn khống 5 lượt).\n` +
        `• **Tiên Tộc:** +20% Sát thương phép, +10% Tốc đánh / Giảm hồi chiêu, giải trừ bất lợi.\n` +
        `• **Ma Tộc:** +15% Bạo kích, +10% Hút máu, hạ địch tích lũy Ma Khí (+50% DMG tối đa).\n` +
        `• **Rợ Tộc:** +25% Công vật lý, +30% Kháng khống chế, mất máu tăng sát thương & tốc độ.\n` +
        `• **Kẻ Đổ Bộ:** Miễn debuff môi trường bí cảnh, +20% rơi đồ hiếm, sát thương chuẩn bỏ qua giáp.\n\n` +
        `🐾 **3. LINH THÚ & TRẬN PHÁP:**\n` +
        `• Trang bị tối đa **3 Linh Thú**. Nếu cả 3 con cùng hệ sẽ kích hoạt **Cộng Hưởng Trận Pháp**.\n` +
        `• Tiến hóa: Nuốt lẫn nhau để tăng Sao (1-5⭐) tại \`/pets evolve\`.\n\n` +
        `⚔️ **4. LINH KHÍ BẢN MỆNH:**\n` +
        `• Trang bị tối đa **1 Linh Khí**. Đặt làm **Bản Mệnh Linh Khí** (\`/weapons bond\`) để vũ khí mạnh lên theo cảnh giới chủ nhân và nuốt các vũ khí rác khác để tăng bậc!\n\n` +
        `🤝 **5. TRỢ THỦ:**\n` +
        `• **Hộ Đạo Giả (Chiến Đấu):** Trực tiếp tham chiến đánh quái, đỡ đòn.\n` +
        `• **Đạo Đồng (Sinh Hoạt):** Tăng +30% tài nguyên AFK khi trạng thái AFK đang bật, tăng tỷ lệ luyện đan và giảm giá Chợ Đen 15%.\n\n` +
        `🏯 **6. ĐỘNG PHỦ (TREO MÁY IDLE):**\n` +
        `• Dùng \`/afk\` hoặc \`aafk\` để bật/tắt AFK. Chỉ khi bật AFK, Tụ Linh Trận mới tích lũy XP và Ngân Lượng, tối đa 24 giờ.\n` +
        `• Dùng \`/base upgrade\` rồi chọn số cấp muốn nâng, hoặc \`abase upgrade levels:10\` qua prefix, để nâng nhiều cấp một lần (tối đa cấp 50); thu hoạch bằng \`/base harvest\` mà không tắt AFK.\n` +
        `• Trồng linh thảo tại Dược Viên (\`/base garden\`) và Luyện Đan Dược (\`/base brew\`).\n\n` +
        `🌠 **7. CẦU NGUYỆN (WISH / GACHA):**\n` +
        `• Mỗi lượt Cầu Nguyện tốn 2.000 Bạc; 10 lượt tốn 18.000 Bạc. Tỷ lệ 5★ cơ bản 0,6%, soft pity từ lượt 74, bảo hiểm cứng lượt 90; 4★ cơ bản 5,1%, bảo hiểm 4★+ lượt 10.\n` +
        `• Dùng lệnh \`/wish pull\` để triệu hoán Linh Khí Bậc 5-7, Linh Thú và Hộ Đạo Giả Cực Phẩm!\n\n` +
        `📜 **DANH SÁCH LỆNH SLASH CHÍNH:**\n` +
        `• \`/start dao_hieu:<đạo hiệu>\` - Tạo đạo hiệu (chỉ một lần), nhận chủng tộc ngẫu nhiên và thức tỉnh linh căn\n` +
        `• \`/profile\` - Xem hồ sơ tu vi, cảnh giới và trang bị\n` +
        `• \`/afk\` - Bật/tắt AFK để bắt đầu/ngừng tích lũy tại Động Phủ\n` +
        `• \`/train\`, \`/break\` - Tu luyện và đột phá cảnh giới\n` +
        `• \`/base\` - Tụ Linh Trận, Dược Viên, Lò Luyện Đan và Lò Rèn\n` +
        `• \`/pets\`, \`/weapons\`, \`/helpers\`, \`/skills\` - Quản lý trang bị và trợ thủ\n` +
        `• \`/wish\` - Cầu nguyện Linh Khí, Linh Thú và Trợ Thủ\n` +
        `• \`/event\` - Thám hiểm Bí Cảnh Ngẫu Nhiên, mỗi 24 giờ một lần\n` +
        `• \`/boss\`, \`/tower\`, \`/duel\` - Khiêu chiến Boss, Thí Luyện Tháp và người chơi; Tháp thưởng 1% Linh Kim đột phá mỗi tầng (làm tròn xuống, tối thiểu 1 viên); \`/duel\` có cooldown riêng 60 giây mỗi người\n` +
        `• \`/boss channel channel:<#kênh>\` - Đặt kênh thông báo boss mới; dùng \`off\` để tắt (cần quyền Quản lý Máy chủ)\n` +
        `• \`/inv\`, \`/bag\` - Xem tài nguyên, Linh Kim và túi trữ vật\n` +
        `• \`/sect\`, \`/market\`, \`/rank\` - Tông môn, chợ và bảng xếp hạng\n` +
        `• \`/shop view\`, \`/shop buy\` - Mua Đan Dược và Linh Kim với giá động, áp dụng khan hiếm\n` +
        `• \`/code code:<mã>\` - Đổi mã quà tặng còn hạn (prefix: \`acode <mã>\`)\n` +
        `• \`/verify\` - Chủ bot xác minh máy chủ vào whitelist\n` +
        `• \`/help\`, \`/prefix\`, \`/adisable\` - Hướng dẫn và quản lý prefix/lệnh theo kênh`;

    const embeds = createTextEmbedPages(description, {
      title: '📖 Cẩm Nang Toàn Tập • Tu Tiên Vấn Đạo',
      realmId: 0,
      footer: 'Dùng nút Trước/Tiếp để xem toàn bộ cẩm nang'
    });
    return replyWithEmbedPages(interaction, embeds, {
      ephemeral: true,
      customIdPrefix: 'help_page'
    });
  }
};
