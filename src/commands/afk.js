const { SlashCommandBuilder } = require('discord.js');
const { toggleAfk } = require('../services/dongPhuService');
const { createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { formatNumber } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Bật hoặc tắt trạng thái AFK để Động Phủ bắt đầu/ngừng tích lũy'),

  async execute(interaction) {
    const result = await toggleAfk(interaction.user.id);
    if (!result.success) {
      return interaction.reply({
        embeds: [createErrorEmbed('Không Thể Đổi Trạng Thái AFK', result.message)],
        ephemeral: true
      });
    }

    if (result.active) {
      return interaction.reply({
        embeds: [createSuccessEmbed('🌙 Đã Bật Trạng Thái AFK', result.message)],
        ephemeral: true
      });
    }

    const description = result.elapsedMinutes > 0
      ? `Đã tắt AFK sau **${result.elapsedMinutes} phút**.\n\n` +
        `• **Linh Lực nhận được:** +${formatNumber(result.xpGained)} XP\n` +
        `• **Ngân Lượng nhận được:** +${formatNumber(result.silverGained)} Bạc\n` +
        (result.helperName ? `• *Trợ Thủ Sinh Hoạt [${result.helperName}] tăng thêm 30% sản lượng.*` : '')
      : 'Đã tắt AFK. Động Phủ không tích lũy thời gian khi trạng thái này đang tắt.';

    return interaction.reply({
      embeds: [createSuccessEmbed('🌅 Đã Tắt Trạng Thái AFK', description)],
      ephemeral: true
    });
  }
};
