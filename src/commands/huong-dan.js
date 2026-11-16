const { SlashCommandBuilder } = require('discord.js');
const { createTuTienEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Cẩm nang toàn tập con đường Tu Tiên và danh sách lệnh slash'),

  async execute(interaction) {
    const embed = createTuTienEmbed(0)
      .setTitle('📖 Cẩm Nang Toàn Tập • Tu Tiên Vấn Đạo')
      .setDescription(
        `Chào mừng đạo hữu đến với thế giới Tu Tiên RPG!\n` +
        `Dưới đây là cẩm nang chi tiết và các lệnh của hệ thống:\n\n` +
        `⚡ **LỆNH NHANH:**\n` +
        `• Prefix mặc định là \`a\`: dùng \`aprofile\`, \`aafk\`, \`abase harvest\` hoặc \`awish pull banner:weapon count:10\`.\n` +
        `• Đổi prefix bằng \`/prefix value:<prefix>\` hoặc \`aprefix <prefix>\`; cần quyền Quản lý Máy chủ.\n\n` +
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
        `• Nâng cấp Tụ Linh Trận bằng \`/base upgrade\` để tăng XP/phút; thu hoạch bằng \`/base harvest\` mà không tắt AFK.\n` +
        `• Trồng linh thảo tại Dược Viên (\`/base garden\`) và Luyện Đan Dược (\`/base brew\`).\n\n` +
        `🌠 **7. CẦU NGUYỆN (WISH / GACHA):**\n` +
        `• Bảo hiểm 4★ sau tối đa 10 lượt và 5★ sau tối đa 90 lượt; tỷ lệ 5★ tăng từ lượt 74.\n` +
        `• Dùng lệnh \`/wish pull\` để triệu hoán Linh Khí Bậc 5-7, Linh Thú và Hộ Đạo Giả Cực Phẩm!\n\n` +
        `📜 **DANH SÁCH LỆNH SLASH CHÍNH:**\n` +
        `• \`/start dao_hieu:<đạo hiệu>\` - Tạo đạo hiệu (chỉ một lần), nhận chủng tộc ngẫu nhiên và thức tỉnh linh căn\n` +
        `• \`/profile\` - Xem hồ sơ tu vi, cảnh giới và trang bị\n` +
        `• \`/afk\` - Bật/tắt AFK để bắt đầu/ngừng tích lũy tại Động Phủ\n` +
        `• \`/train\`, \`/break\` - Tu luyện và đột phá cảnh giới\n` +
        `• \`/base\` - Tụ Linh Trận, Dược Viên, Lò Luyện Đan và Lò Rèn\n` +
        `• \`/pets\`, \`/weapons\`, \`/helpers\`, \`/skills\` - Quản lý trang bị và trợ thủ\n` +
        `• \`/wish\` - Cầu nguyện Linh Khí, Linh Thú và Trợ Thủ\n` +
        `• \`/event\` - Thám hiểm Bí Cảnh Ngẫu Nhiên\n` +
        `• \`/boss\`, \`/tower\`, \`/duel\` - Khiêu chiến Boss, Thí Luyện Tháp và người chơi\n` +
        `• \`/boss channel channel:<#kênh>\` - Đặt kênh thông báo boss mới; dùng \`off\` để tắt (cần quyền Quản lý Máy chủ)\n` +
        `• \`/sect\`, \`/market\`, \`/bag\`, \`/rank\` - Tông môn, chợ, túi đồ và bảng xếp hạng\n` +
        `• \`/help\`, \`/prefix\` - Hướng dẫn và thiết lập prefix`
      );

    return interaction.reply({ embeds: [embed] });
  }
};
