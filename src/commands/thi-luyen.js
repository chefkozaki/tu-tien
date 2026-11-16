const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../services/playerService');
const { challengeTower } = require('../services/towerService');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { formatNumber } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tower')
    .setDescription('Khiêu chiến Thí Luyện Tháp (PvE) - Leo tầng kiểm tra sức mạnh combo nhân vật'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const player = await getPlayer(userId);
    if (!player) {
      return interaction.reply({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Hãy dùng `/start` trước!')],
        ephemeral: true
      });
    }

    await interaction.deferReply();
    const result = await challengeTower(userId);

    if (!result.success) {
      const logSummary = result.logs.slice(-5).join('\n');
      const embed = createErrorEmbed(
        `Thất Bại Tại Tầng ${result.failedFloor}!`,
        `Thủ Vệ Tháp quá dũng mãnh, đạo hữu đã bị đánh lui!\n\n` +
        `📜 **Nhật Ký Giao Tranh:**\n${logSummary}\n\n` +
        `💡 *Hãy nâng cấp Linh Khí, tiến hóa Linh Thú hoặc tăng cấp cảnh giới rồi quay lại thử lại!*`
      );
      return interaction.editReply({ embeds: [embed] });
    }

    const logSummary = result.logs.slice(-5).join('\n');
    const embed = createSuccessEmbed(
      `🎉 Vượt Tháp Thành Công: Tầng ${result.clearedFloor}!`,
      `Đạo hữu đã đánh bại Thủ Vệ Tháp oanh liệt và tiến vào **Tầng ${result.nextFloor}**!\n\n` +
      `🎁 **Chiến Lợi Phẩm Thu Hoạch:**\n` +
      `• **Ngân Lượng:** \`+${formatNumber(result.silverReward)}\` Bạc\n` +
      `• **Linh Lực:** \`+${formatNumber(result.xpReward)}\` XP\n` +
      `• **Linh Kim:** \`+${result.goldAmount}x Linh Kim (Phẩm ${result.goldQuality})\`\n\n` +
      `📜 **Diễn Biến Hiệp Đấu Cuối:**\n${logSummary}`,
      player.realm_id
    );

    return interaction.editReply({ embeds: [embed] });
  }
};
