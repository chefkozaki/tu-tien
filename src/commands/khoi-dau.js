const { SlashCommandBuilder } = require('discord.js');
const { getPlayer, createPlayer } = require('../services/playerService');
const { RACES, SPIRIT_ROOTS } = require('../config/constants');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Tạo đạo hiệu, thức tỉnh linh căn và chính thức bước chân vào con đường tu tiên!')
    .addStringOption(opt =>
      opt.setName('dao_hieu')
        .setDescription('Đạo hiệu của bạn (chỉ được chọn một lần)')
        .setMinLength(1)
        .setMaxLength(32)
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const daoHieu = interaction.options.getString('dao_hieu').trim();
    if (!daoHieu) {
      return interaction.reply({
        embeds: [createErrorEmbed('Đạo Hiệu Không Hợp Lệ', 'Đạo hiệu không được để trống.')],
        ephemeral: true
      });
    }

    const existing = await getPlayer(userId);

    if (existing) {
      const race = RACES[existing.race] || RACES.nhan_toc;
      const root = SPIRIT_ROOTS[existing.spirit_root] || SPIRIT_ROOTS.hoa;
      const embed = createTuTienEmbed(existing.realm_id)
        .setTitle('✨ Đạo Thân Đã Thức Tỉnh!')
        .setDescription(`Đạo hữu **${existing.dao_hieu || existing.username}** đã bước vào con đường tu tiên từ trước!\n\n` +
          `• **Chủng Tộc:** ${race.icon} **${race.name}**\n` +
          `• **Linh Căn:** ${root.icon} **${root.name}**\n` +
          `• Đạo hiệu chỉ được chọn một lần khi khởi đầu và không thể thay đổi.\n` +
          `• Dùng lệnh \`/profile\` để xem hồ sơ và \`/help\` để tra cứu các tính năng.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const raceKeys = Object.keys(RACES);
    const randomRaceKey = raceKeys[Math.floor(Math.random() * raceKeys.length)];
    const chosenRace = RACES[randomRaceKey];

    // Ngẫu nhiên thức tỉnh 1 Linh Căn (Ngũ Hành hoặc Dị Linh Căn)
    const rootKeys = Object.keys(SPIRIT_ROOTS);
    const randomRootKey = rootKeys[Math.floor(Math.random() * rootKeys.length)];
    const awakenedRoot = SPIRIT_ROOTS[randomRootKey];

    const newPlayer = await createPlayer(
      interaction.user.id,
      interaction.user.username,
      randomRaceKey,
      randomRootKey,
      daoHieu
    );

    const successEmbed = createSuccessEmbed(
      'Đạo Cơ Đã Thành - Chúc Mừng Đạo Hữu!',
      `Chúc mừng đạo hữu **${newPlayer.dao_hieu}** đã được trao **${chosenRace.name}** ${chosenRace.icon}!\n\n` +
      `🌟 **Linh Căn Thức Tỉnh:** ${awakenedRoot.icon} **${awakenedRoot.name}** (${awakenedRoot.bonusDesc})\n` +
      `🎁 **Quà Tân Thủ Ban Thưởng:**\n` +
      `  • 1x **Thanh Phong Kiếm** (Linh Khí Bản Mệnh)\n` +
      `  • 1x **Hỏa Linh Điêu** (Linh Thú Bậc 1)\n` +
      `  • 15x **Linh Kim (Phẩm Phàm)**\n` +
      `  • 5.000 **Ngân Lượng**\n` +
      `  • Đã khai mở **Động Phủ & Tụ Linh Trận** (Treo máy nhận Linh Lực)\n\n` +
      `👉 Hãy dùng \`/profile\` để xem hồ sơ và \`/train\` để bắt đầu hấp thụ linh khí!`,
      0
    );

    return interaction.reply({ embeds: [successEmbed] });
  }
};
