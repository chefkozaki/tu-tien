const { SlashCommandBuilder } = require('discord.js');
const { duelPlayers } = require('../services/pvpService');
const { createTuTienEmbed, createErrorEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Khiêu chiến 1v1 trên Đấu Pháp Đài kiểm tra thực lực toàn diện')
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('Chọn đạo hữu muốn luận bàn tỷ thí')
        .setRequired(true)
    ),

  async execute(interaction) {
    const challenger = interaction.user;
    const target = interaction.options.getUser('target');

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
    const result = await duelPlayers(challenger.id, target.id);

    if (!result.success) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Không Thể Đấu Pháp', result.message)]
      });
    }

    // Hiển thị tóm tắt 6 hiệp cuối
    const logSummary = result.logs.slice(-6).join('\n');

    const embed = createTuTienEmbed(0)
      .setTitle(`⚔️ Đấu Pháp Đài: ${result.challengerName} VS ${result.targetName}`)
      .setDescription(
        `Hai vị đại năng thi triển tuyệt kỹ thần thông, linh thú thét gào, lôi đình giáng thế!\n\n` +
        `🏆 **CHIẾN THẮNG:** **${result.winnerName}**!\n\n` +
        `📜 **Nhật Ký Quyết Đấu:**\n${logSummary}\n\n` +
        `• **Người Thắng:** +25 Điểm Đấu Pháp & +10.000 Ngân lượng\n` +
        `• **Người Thua:** -15 Điểm Đấu Pháp`
      );

    return interaction.editReply({ embeds: [embed] });
  }
};
