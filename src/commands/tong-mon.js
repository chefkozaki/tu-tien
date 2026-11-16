const { SlashCommandBuilder } = require('discord.js');
const { 
  getSectById, 
  createSect, 
  joinSect, 
  contributeSect, 
  getMines, 
  captureMine, 
  claimMineTax 
} = require('../services/sectService');
const { getPlayer } = require('../services/playerService');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { formatNumber } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sect')
    .setDescription('Hệ thống Tông Môn: Khai tông lập phái, cống hiến và Chiến Trường Mỏ Linh Mạch')
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Xem thông tin Tông Môn hiện tại của đạo hữu')
    )
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Thành lập Tông Môn mới (Tốn 50.000 Ngân lượng)')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Tên Tông Môn muốn khai sáng')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Gia nhập một Tông Môn trong thiên hạ')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Mã ID của Tông Môn')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('donate')
        .setDescription('Cống hiến Ngân Lượng hoặc Linh Kim để xây dựng Tông Môn')
        .addIntegerOption(opt =>
          opt.setName('silver')
            .setDescription('Số Ngân Lượng muốn đóng góp vào quỹ tông môn')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('gold')
            .setDescription('Số lượng Linh Kim đóng góp')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('quality')
            .setDescription('Phẩm chất Linh Kim đóng góp (Phàm, Tinh, Linh, Địa, Thiên...)')
            .setRequired(false)
            .addChoices(
              { name: 'Phẩm Phàm', value: 'Phàm' },
              { name: 'Phẩm Tinh', value: 'Tinh' },
              { name: 'Phẩm Linh', value: 'Linh' },
              { name: 'Phẩm Địa', value: 'Địa' },
              { name: 'Phẩm Thiên', value: 'Thiên' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('mine')
        .setDescription('Chiến Trường Linh Mạch: Xem, đánh chiếm mỏ hoặc thu thuế mỏ tông môn')
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Hành động tại Chiến Trường Linh Mạch')
            .setRequired(true)
            .addChoices(
              { name: 'Xem Danh Sách Các Mỏ', value: 'view' },
              { name: 'Đánh Chiếm Mỏ', value: 'capture' },
              { name: 'Thu Thuế Mỏ Chiếm Giữ', value: 'claim' }
            )
        )
        .addIntegerOption(opt =>
          opt.setName('mine-id')
            .setDescription('Mã ID của Mỏ Linh Mạch (cần khi Đánh Chiếm hoặc Thu Thuế)')
            .setRequired(false)
        )
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

    // 1. Thông Tin Tông Môn
    if (sub === 'info') {
      if (!player.sect_id) {
        return interaction.reply({
          embeds: [createErrorEmbed('Chưa Có Tông Môn', 'Đạo hữu hiện đang là Tán Tu lang bạt kỳ hồ! Dùng `/sect create name:<name>` để lập phái hoặc `/sect join id:<id>` để bái sư.')],
          ephemeral: true
        });
      }

      const sect = await getSectById(player.sect_id);
      const embed = createTuTienEmbed(player.realm_id)
        .setTitle(`🏯 Tông Môn • ${sect.name} [ID: #${sect.id}]`)
        .setDescription(
          `*${sect.notice}*\n\n` +
          `• **Chưởng Môn:** <@${sect.leader_id}>\n` +
          `• **Cấp Độ Tông Môn:** Cấp ${sect.level}\n` +
          `• **Quỹ Ngân Lượng:** \`${formatNumber(sect.fund_silver)}\` Bạc\n` +
          `• **Quỹ Linh Kim:** \`${sect.fund_spirit_gold}\` Viên\n` +
          `• **Công Pháp Trấn Phái:** ⚡ **${sect.sect_skill}**\n\n` +
          `👤 **Thân Phận Của Đạo Hữu:**\n` +
          `• Chức Vụ: **${player.sect_role || 'Đệ Tử'}**\n` +
          `• Điểm Cống Hiến: **${player.sect_contribution.toLocaleString()} Điểm**`
        );

      return interaction.reply({ embeds: [embed] });
    }

    // 2. Lập Tông Môn
    if (sub === 'create') {
      const sectName = interaction.options.getString('name');
      const res = await createSect(userId, sectName);
      if (!res.success) {
        return interaction.reply({ embeds: [createErrorEmbed('Khai Phái Thất Bại', res.message)], ephemeral: true });
      }

      return interaction.reply({
        embeds: [createSuccessEmbed('Khai Tông Lập Phái Thành Công', res.message, player.realm_id)]
      });
    }

    // 3. Gia Nhập Tông Môn
    if (sub === 'join') {
      const sectId = interaction.options.getInteger('id');
      const res = await joinSect(userId, sectId);
      if (!res.success) {
        return interaction.reply({ embeds: [createErrorEmbed('Không Thể Gia Nhập', res.message)], ephemeral: true });
      }

      return interaction.reply({
        embeds: [createSuccessEmbed('Gia Nhập Thành Công', res.message, player.realm_id)]
      });
    }

    // 4. Cống Hiến Tông Môn
    if (sub === 'donate') {
      const silver = interaction.options.getInteger('silver') || 0;
      const gold = interaction.options.getInteger('gold') || 0;
      const goldQuality = interaction.options.getString('quality') || 'Phàm';

      if (silver <= 0 && gold <= 0) {
        return interaction.reply({
          embeds: [createErrorEmbed('Thiếu Thông Tin', 'Vui lòng nhập số Ngân lượng hoặc Linh Kim muốn cống hiến!')],
          ephemeral: true
        });
      }

      const res = await contributeSect(userId, silver, gold, goldQuality);
      if (!res.success) {
        return interaction.reply({ embeds: [createErrorEmbed('Cống Hiến Thất Bại', res.message)], ephemeral: true });
      }

      return interaction.reply({
        embeds: [createSuccessEmbed('Cống Hiến Thành Công', res.message, player.realm_id)]
      });
    }

    // 5. Mỏ Linh Mạch
    if (sub === 'mine') {
      const action = interaction.options.getString('action');
      const mineId = interaction.options.getInteger('mine-id');

      if (action === 'view') {
        const mines = await getMines();
        const mineList = mines.map(m => 
          `**#${m.id} - ${m.name}** [Phẩm ${m.tier_name}]\n` +
          `  • Chiếm giữ: **${m.sect_name ? `🏯 ${m.sect_name}` : '⚪ Vô Chủ (Chưa chiếm)'}**\n` +
          `  • Sản lượng mỗi ngày: +${formatNumber(m.daily_silver)} Bạc & +${m.daily_spirit_gold} Linh Kim (${m.tier_name})`
        ).join('\n\n');

        const embed = createTuTienEmbed(player.realm_id)
          .setTitle('🗺️ Chiến Trường Linh Mạch Thế Giới')
          .setDescription(
            `Các Tông Môn đánh chiếm mỏ khoáng sản để nhận thuế tài nguyên mỗi ngày!\n\n${mineList}\n\n` +
            `👉 Dùng \`/sect mine action:<action> mine-id:<id>\` để phát động công chiếm!`
          );

        return interaction.reply({ embeds: [embed] });
      }

      if (action === 'capture') {
        if (!mineId) {
          return interaction.reply({ embeds: [createErrorEmbed('Thiếu ID Mỏ', 'Vui lòng điền `id-mo` muốn đánh chiếm!')], ephemeral: true });
        }
        const res = await captureMine(userId, mineId);
        if (!res.success) {
          return interaction.reply({ embeds: [createErrorEmbed('Công Chiếm Thất Bại', res.message)], ephemeral: true });
        }
        return interaction.reply({ embeds: [createSuccessEmbed('Chiếm Mỏ Thành Công', res.message, player.realm_id)] });
      }

      if (action === 'claim') {
        if (!mineId) {
          return interaction.reply({ embeds: [createErrorEmbed('Thiếu ID Mỏ', 'Vui lòng điền `id-mo` muốn thu thuế!')], ephemeral: true });
        }
        const res = await claimMineTax(userId, mineId);
        if (!res.success) {
          return interaction.reply({ embeds: [createErrorEmbed('Không Thể Thu Thuế', res.message)], ephemeral: true });
        }
        return interaction.reply({ embeds: [createSuccessEmbed('Thu Thuế Mỏ Thành Công', res.message, player.realm_id)] });
      }
    }
  }
};
