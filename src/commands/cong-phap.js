const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../services/playerService');
const { getDb } = require('../config/database');
const { SPIRIT_ROOTS, RACES } = require('../config/constants');
const { createErrorEmbed } = require('../utils/embedBuilder');
const { createTextEmbedPages, replyWithEmbedPages } = require('../utils/embedPagination');

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

    const description =
      `• **Linh Căn Chủ Đạo:** ${root.icon} **${root.name}** (${root.bonusDesc})\n` +
      `• **Số Ô Kỹ Năng Cho Phép:** **${maxSlots} Ô** ${player.race === 'nhan_toc' ? '*(Nhân Tộc Thiên Phú: +1 Ô)*' : ''}\n\n` +
      `⚡ **Kỹ Năng Đang Trang Bị (${equippedSkills.length}/${maxSlots}):**\n` +
      (equippedSkills.length > 0
        ? equippedSkills.map((s, i) => `**Ô ${i + 1}:** [${s.type === 'active' ? 'Chủ Động' : 'Bị Động'}] **${String(s.name).slice(0, 100)}** (Hệ ${String(s.element).slice(0, 30)}) - Uy lực x${s.damage_mult}\n  *${String(s.desc).slice(0, 300)}*`).join('\n\n')
        : '*Chưa trang bị kỹ năng nào!*') +
      `\n\n📚 **Kỹ Năng Trong Khoang Chứa (${unequippedSkills.length}):**\n` +
      (unequippedSkills.length > 0
        ? unequippedSkills.map(s => `• **${String(s.name).slice(0, 100)}** (Hệ ${String(s.element).slice(0, 30)}) - *${String(s.desc).slice(0, 300)}*`).join('\n')
        : '*Không còn kỹ năng dự phòng.*');

    return replyWithEmbedPages(interaction, createTextEmbedPages(description, {
      title: `📜 Tàng Kinh Các • Công Pháp Của ${player.dao_hieu || player.username}`,
      realmId: player.realm_id
    }), { customIdPrefix: 'skills_page' });
  }
};
