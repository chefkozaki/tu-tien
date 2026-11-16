const { SlashCommandBuilder } = require('discord.js');
const { 
  getRealmLeaderboard, 
  getThanDienLeaderboard, 
  getRichLeaderboard, 
  getPvPLeaderboard, 
  getTowerLeaderboard 
} = require('../services/leaderboardService');
const { createTuTienEmbed } = require('../utils/embedBuilder');
const { getRealmDisplay, formatNumber } = require('../utils/formatters');
const { RACES } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Bảng Xếp Hạng Tu Tiên: Thiên Đạo Bảng, Thần Điện Tối Thượng, Phú Hộ, Đấu Pháp')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Chọn bảng xếp hạng muốn xem')
        .setRequired(true)
        .addChoices(
          { name: 'Thiên Đạo Bảng (Top Tu Vi & Cảnh Giới)', value: 'tu_vi' },
          { name: 'Thần Điện (Dành Cho Cảnh Giới Tối Thượng)', value: 'than_dien' },
          { name: 'Phú Hộ Bảng (Top Ngân Lượng)', value: 'phu_ho' },
          { name: 'Đấu Pháp Bảng (Top PvP)', value: 'pvp' },
          { name: 'Thí Luyện Tháp (Top Leo Tháp)', value: 'tower' }
        )
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');

    if (type === 'tu_vi') {
      const rows = await getRealmLeaderboard(10);
      let desc = rows.length === 0 ? '*Chưa có tu sĩ nào trong bảng!*' : rows.map((r, i) => {
        const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `**#${i + 1}**`));
        const race = RACES[r.race] || RACES.nhan_toc;
        return `${medal} **${r.username}** ${race.icon}\n` +
               `  • Cảnh giới: \`${getRealmDisplay(r.realm_id, r.level)}\` | Linh Lực: \`${formatNumber(r.xp)}\``;
      }).join('\n\n');

      const embed = createTuTienEmbed(0)
        .setTitle('📜 Thiên Đạo Bảng • Top Tu Vi Toàn Cõi')
        .setDescription(desc);
      return interaction.reply({ embeds: [embed] });
    }

    if (type === 'than_dien') {
      const rows = await getThanDienLeaderboard(10);
      let desc = rows.length === 0 
        ? '*Chưa có vị Đại Năng nào đột phá thành công cảnh giới Tối Thượng để bước vào Thần Điện!*' 
        : rows.map((r, i) => {
            const medal = i === 0 ? '👑' : `**#${i + 1}**`;
            return `${medal} **${r.username}** [Quy Tắc: ${r.rule_enlightenment || 'Hỗn Độn'}]\n` +
                   `  • Tích lũy Linh Lực Vô Hạn: \`${formatNumber(r.xp)}\``;
          }).join('\n\n');

      const embed = createTuTienEmbed(8)
        .setTitle('🏛️ Thần Điện Bảng • Đỉnh Cao Tối Thượng')
        .setDescription(
          `*Nơi ghi danh những đấng Tối Thượng bất tử bất diệt, vượt qua quy tắc thiên địa!*\n\n${desc}`
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (type === 'phu_ho') {
      const rows = await getRichLeaderboard(10);
      let desc = rows.length === 0 ? '*Chưa có thông tin!*' : rows.map((r, i) => {
        const medal = i === 0 ? '💰' : (i === 1 ? '🪙' : `**#${i + 1}**`);
        return `${medal} **${r.username}** - \`${formatNumber(r.silver)}\` Ngân Lượng`;
      }).join('\n');

      const embed = createTuTienEmbed(0)
        .setTitle('💎 Kim Ngân Bảng • Phú Hộ Vạn Giới')
        .setDescription(desc);
      return interaction.reply({ embeds: [embed] });
    }

    if (type === 'pvp') {
      const rows = await getPvPLeaderboard(10);
      let desc = rows.length === 0 ? '*Chưa có thông tin!*' : rows.map((r, i) => {
        const medal = i === 0 ? '⚔️' : `**#${i + 1}**`;
        return `${medal} **${r.username}** - \`${r.pvp_points}\` Điểm Đấu Pháp`;
      }).join('\n');

      const embed = createTuTienEmbed(0)
        .setTitle('⚔️ Đấu Pháp Bảng • Chiến Thần Bát Hoang')
        .setDescription(desc);
      return interaction.reply({ embeds: [embed] });
    }

    if (type === 'tower') {
      const rows = await getTowerLeaderboard(10);
      let desc = rows.length === 0 ? '*Chưa có thông tin!*' : rows.map((r, i) => {
        const medal = i === 0 ? '🗼' : `**#${i + 1}**`;
        return `${medal} **${r.username}** - Tầng **${r.tower_floor}**`;
      }).join('\n');

      const embed = createTuTienEmbed(0)
        .setTitle('🗼 Thí Luyện Tháp Bảng • Bá Chủ Leo Tháp')
        .setDescription(desc);
      return interaction.reply({ embeds: [embed] });
    }
  }
};
