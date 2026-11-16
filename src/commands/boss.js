const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../services/playerService');
const { getActiveBoss, attackBoss } = require('../services/bossService');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { createProgressBar, formatNumber } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boss')
    .setDescription('Khiêu chiến Hung Thú Thượng Cổ - Boss Thế Giới toàn server')
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Xem tình trạng Boss Thế Giới, lượng máu và bảng xếp hạng sát thương')
    )
    .addSubcommand(sub =>
      sub.setName('atk')
        .setDescription('Dẫn dắt Linh Khí, Linh Thú và Trợ Thủ dốc toàn lực công kích Hung Thú!')
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const player = await getPlayer(userId);
    if (!player) {
      return interaction.reply({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Hãy dùng `/start` trước!')],
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'info') {
      const boss = await getActiveBoss();
      const currentHp = Number(boss.current_hp);
      const maxHp = Number(boss.max_hp);
      const hpBar = createProgressBar(currentHp, maxHp);

      const damageMap = JSON.parse(boss.damage_data || '{}');
      const sorted = Object.entries(damageMap).sort((a, b) => b[1] - a[1]);

      let topList = sorted.length === 0 
        ? '*Chưa có tu sĩ nào phát động công kích!*' 
        : sorted.slice(0, 5).map(([uid, dmg], idx) => `**Top ${idx + 1}:** <@${uid}> - \`${formatNumber(dmg)}\` Sát Thương`).join('\n');

      const embed = createTuTienEmbed(player.realm_id)
        .setTitle(`👹 Hung Thú Thế Giới • ${boss.name}`)
        .setDescription(
          `Toàn server hợp lực thảo phạt Hung Thú! Khi Boss bị hạ gục, top sát thương sẽ được chia Linh Kim phẩm cao và có cơ hội nhận Linh Thú!\n\n` +
          `• **Sinh Lực Hung Thú:** \`${formatNumber(currentHp)} / ${formatNumber(maxHp)}\`\n` +
          `• **Tiến Độ:** ${hpBar}\n` +
          `• **Trạng Thái:** ${boss.status === 'alive' ? '🟢 Đang Cuồng Nộ (Còn sống)' : '🔴 Đã Bị Tiêu Diệt'}\n\n` +
          `🏆 **Bảng Xếp Hạng Công Kích:**\n${topList}\n\n` +
          `👉 Dùng \`/boss atk\` để xuất chiêu công kích!`
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'atk') {
      const result = await attackBoss(userId);
      if (!result.success) {
        return interaction.reply({ embeds: [createErrorEmbed('Công Kích Thất Bại', result.message)], ephemeral: true });
      }

      const embed = createSuccessEmbed(
        '⚔️ Tấn Công Hung Thú Thế Giới!',
        `Đạo hữu xuất chiêu uy lực, đánh mạnh vào **${result.bossName}**!\n\n` +
        `• **Sát Thương Gây Ra:** \`${formatNumber(result.damageDealt)}\` Điểm!\n` +
        `• **Máu Hung Thú Còn Lại:** \`${formatNumber(Number(result.remainingHp))} / ${formatNumber(Number(result.maxHp))}\`\n` +
        `• **Thưởng Nhanh:** \`+${formatNumber(result.silverReward)}\` Ngân Lượng\n` +
        (result.isDefeated 
          ? `\n🎉 **HUNG THÚ ĐÃ BỊ TIÊU DIỆT TOÀN DIỆN!**\n🎁 **Phần Thưởng Top Xếp Hạng Đã Trao:**\n${result.rewardSummary}` 
          : ''),
        player.realm_id
      );

      return interaction.reply({ embeds: [embed] });
    }
  }
};
