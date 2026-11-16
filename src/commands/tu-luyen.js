const { SlashCommandBuilder } = require('discord.js');
const { getPlayer, addXp } = require('../services/playerService');
const { REALMS } = require('../config/constants');
const { createTuTienEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { formatNumber, getRealmDisplay } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('train')
    .setDescription('Đả tọa hấp thụ thiên địa linh khí, tăng điểm Linh Lực (XP)'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const player = await getPlayer(userId);

    if (!player) {
      return interaction.reply({
        embeds: [createErrorEmbed('Chưa Bước Vào Tu Tiên', 'Đạo hữu hãy dùng `/start` trước!')],
        ephemeral: true
      });
    }

    // Cơ sở XP theo cảnh giới
    const realm = REALMS[player.realm_id] || REALMS[0];
    const baseXp = Math.floor(realm.minXp * 0.35) + Math.floor(Math.random() * (realm.minXp * 0.25));

    const result = await addXp(userId, baseXp);

    const embed = createTuTienEmbed(player.realm_id)
      .setTitle('🧘 Đả Tọa Nhập Định')
      .setDescription(
        `Đạo hữu vận chuyển công pháp, dẫn khí nhập thể, hấp thụ tinh hoa nhật nguyệt!\n\n` +
        `• **Linh Lực Thu Hoạch:** \`+${formatNumber(result.addedXp)}\` Linh Lực (XP)\n` +
        (player.race === 'nhan_toc' ? `  *(Nội tại Nhân Tộc: +15% hiệu suất hấp thụ)*\n` : '') +
        `• **Cảnh Giới Hiện Tại:** \`${getRealmDisplay(result.player.realm_id, result.player.level)}\``
      );

    if (result.leveledUp) {
      embed.addFields({
        name: '🎉 ĐỘT PHÁ TIỂU CẢNH GIỚI!',
        value: `Chúc mừng đạo hữu đã thăng lên **Cấp ${result.player.level}**!`
      });
    }

    if (result.breakthroughReady) {
      embed.addFields({
        name: '⚡ ĐẠT ĐỈNH PHONG CẢNH GIỚI!',
        value: `Linh lực đã đạt viên mãn (Cấp 10 Đỉnh Cấp)! Hãy dùng lệnh \`/break\` để tiến hành độ kiếp vượt cảnh giới tiếp theo!`
      });
    }

    return interaction.reply({ embeds: [embed] });
  }
};
