const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../services/playerService');
const { getDb } = require('../config/database');
const { SPIRIT_ROOTS, RACES } = require('../config/constants');
const { createTuTienEmbed, createErrorEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skills')
    .setDescription('Xem và quản lý Công Pháp (Bị Động) và Thần Thông (Chủ Động)'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const player = await getPlayer(userId);
    if (!player) {
      return interaction.reply({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Hãy dùng `/start` trước!')],
        ephemeral: true
      });
    }

    const db = getDb();
    const skillsRes = await db.execute({
      sql: 'SELECT * FROM tutien_skills WHERE user_id = ? ORDER BY is_equipped DESC, id ASC',
      args: [userId]
    });
    const skills = skillsRes.rows;

    const race = RACES[player.race] || RACES.nhan_toc;
    const root = SPIRIT_ROOTS[player.spirit_root] || SPIRIT_ROOTS.hoa;
    const maxSlots = player.race === 'nhan_toc' ? 4 : 3;

    const equippedSkills = skills.filter(s => s.is_equipped === 1);
    const unequippedSkills = skills.filter(s => s.is_equipped === 0);

    const embed = createTuTienEmbed(player.realm_id)
      .setTitle(`📜 Tàng Kinh Các • Công Pháp Của ${player.dao_hieu || player.username}`)
      .setDescription(
        `• **Linh Căn Chủ Đạo:** ${root.icon} **${root.name}** (${root.bonusDesc})\n` +
        `• **Số Ô Kỹ Năng Cho Phép:** **${maxSlots} Ô** ${player.race === 'nhan_toc' ? '*(Nhân Tộc Thiên Phú: +1 Ô)*' : ''}\n\n` +
        `⚡ **Kỹ Năng Đang Trang Bị (${equippedSkills.length}/${maxSlots}):**\n` +
        (equippedSkills.length > 0 
          ? equippedSkills.map((s, i) => `**Ô ${i + 1}:** [${s.type === 'active' ? 'Chủ Động' : 'Bị Động'}] **${s.name}** (Hệ ${s.element}) - Uy lực x${s.damage_mult}\n  *${s.desc}*`).join('\n\n')
          : '*Chưa trang bị kỹ năng nào!*') +
        `\n\n📚 **Kỹ Năng Trong Khoang Chứa (${unequippedSkills.length}):**\n` +
        (unequippedSkills.length > 0
          ? unequippedSkills.map(s => `• **${s.name}** (Hệ ${s.element}) - *${s.desc}*`).join('\n')
          : '*Không còn kỹ năng dự phòng.*')
      );

    return interaction.reply({ embeds: [embed] });
  }
};
