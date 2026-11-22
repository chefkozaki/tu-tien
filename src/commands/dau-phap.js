const { SlashCommandBuilder } = require('discord.js');
const { duelPlayers } = require('../services/pvpService');
const { REALMS } = require('../config/constants');
const { createTuTienEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { formatNumber } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Khiêu chiến 1v1 trên Đấu Pháp Đài kiểm tra thực lực toàn diện')
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('Chọn đạo hữu muốn luận bàn tỷ thí')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('mode')
        .setDescription('Chế độ đấu pháp (mặc định: Đấu Xếp Hạng ±2 cảnh giới)')
        .setRequired(false)
        .addChoices(
          { name: '⚔️ Đấu Xếp Hạng (Giới hạn ±2 cảnh giới, tính Elo)', value: 'rank' },
          { name: '⚖️ Đồng Cảnh Giới (Chuẩn hóa cảnh giới, so tài build)', value: 'fair' }
        )
    ),

  async execute(interaction) {
    const challenger = interaction.user;
    const target = interaction.options.getUser('target');
    const mode = interaction.options.getString('mode') || 'rank';

    if (challenger.id === target.id) {
      return interaction.reply({
        embeds: [createErrorEmbed('Lỗi Luận Bàn', 'Đạo hữu không thể tự đấu pháp với chính mình!')],
        ephemeral: true
      });
    }

    if (target.bot) {
      return interaction.reply({
        embeds: [createErrorEmbed('Lỗi Đối Thủ', 'Không thể thách đấu với bot thần thức nhân tạo!')],
        ephemeral: true
      });
    }

    await interaction.deferReply();
    const result = await duelPlayers(challenger.id, target.id, mode);

    if (!result.success) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Không Thể Đấu Pháp', result.message)]
      });
    }

    // Hiển thị tóm tắt 6 hiệp cuối
    const logSummary = result.logs.slice(-6).join('\n');

    const modeLabel = result.mode === 'fair'
      ? `⚖️ Đồng Cảnh Giới (${REALMS[result.equalizeRealm.realm_id]?.name || `Bậc ${result.equalizeRealm.realm_id}`} • Tầng ${result.equalizeRealm.level})`
      : '⚔️ Đấu Xếp Hạng (Elo • ±2 Cảnh Giới)';

    const outcomeLine = result.isDraw
      ? `⚖️ **KẾT QUẢ:** **HÒA NHAU!** (${result.challengerName}: ${result.challengerHpPercent}% HP vs ${result.targetName}: ${result.targetHpPercent}% HP)`
      : `🏆 **CHIẾN THẮNG:** **${result.winnerName}**!`;

    const rewardSummary = result.isDraw
      ? `• **Điểm Đấu Pháp:** Không thay đổi (Trận hòa)`
      : `• **Người Thắng:** \`+${result.winnerGain}\` Điểm Đấu Pháp${result.silverReward > 0 ? ` & \`+${formatNumber(result.silverReward)}\` Ngân lượng` : ' *(đối thủ quá yếu, không thưởng bạc)*'}\n` +
        `• **Người Thua:** \`-${result.loserLoss}\` Điểm Đấu Pháp`;

    const embed = createTuTienEmbed(0)
      .setTitle(`⚔️ Đấu Pháp Đài: ${result.challengerName} VS ${result.targetName}`)
      .setDescription(
        `**Chế Độ:** ${modeLabel}\n` +
        `Hai vị đại năng thi triển tuyệt kỹ thần thông, linh thú thét gào, lôi đình giáng thế!\n\n` +
        `${outcomeLine}\n\n` +
        `📜 **Nhật Ký Quyết Đấu:**\n${logSummary}\n\n` +
        `${rewardSummary}`
      );

    return interaction.editReply({ embeds: [embed] });
  }
};
