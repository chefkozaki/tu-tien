const { SlashCommandBuilder } = require('discord.js');
const { 
  getSectById, 
  getSectMembers,
  createSect, 
  joinSect, 
  getSectApplications,
  resolveSectApplication,
  recruitSectMember,
  contributeSect, 
  getMines, 
  captureMine, 
  claimMineTax 
} = require('../services/sectService');
const { getPlayer } = require('../services/playerService');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { formatNumber, getRealmDisplay } = require('../utils/formatters');

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
        .setDescription('Thành lập Tông Môn mới (cần Linh Tướng và 50.000 Ngân Lượng)')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Tên Tông Môn muốn khai sáng')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Gửi đơn xin gia nhập Tông Môn, chờ Chưởng Môn duyệt')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Mã ID của Tông Môn')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('applications')
        .setDescription('Chưởng Môn xem các đơn xin gia nhập đang chờ duyệt')
    )
    .addSubcommand(sub =>
      sub.setName('approve')
        .setDescription('Chưởng Môn chấp nhận đơn xin gia nhập')
        .addIntegerOption(opt =>
          opt.setName('application-id')
            .setDescription('Mã đơn xin gia nhập')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('reject')
        .setDescription('Chưởng Môn từ chối đơn xin gia nhập')
        .addIntegerOption(opt =>
          opt.setName('application-id')
            .setDescription('Mã đơn xin gia nhập')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('members')
        .setDescription('Xem danh sách thành viên Tông Môn')
    )
    .addSubcommand(sub =>
      sub.setName('recruit')
        .setDescription('Chưởng Môn tuyển một tu sĩ vào Tông Môn')
        .addUserOption(opt =>
          opt.setName('member')
            .setDescription('Tu sĩ muốn tuyển vào Tông Môn')
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
      if (!sect) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Tìm Thấy Tông Môn', 'Dữ liệu Tông Môn không còn tồn tại. Vui lòng liên hệ quản trị viên.')],
          ephemeral: true
        });
      }
      const embed = createTuTienEmbed(player.realm_id)
        .setTitle(`🏯 Tông Môn • ${sect.name} [ID: #${sect.id}]`)
        .setDescription(
          `*${sect.notice}*\n\n` +
          `• **Chưởng Môn:** <@${sect.leader_id}>\n` +
          `• **Cấp Độ Tông Môn:** Cấp ${sect.level}\n` +
          `• **Quỹ Ngân Lượng:** \`${formatNumber(sect.fund_silver)}\` Bạc\n` +
          `• **Quỹ Linh Kim:** \`${sect.fund_spirit_gold}\` Viên\n` +
          `• **Công Pháp Trấn Phái:** ⚡ **${sect.sect_skill}**\n\n` +
          `• **Thành viên:** ${ (await getSectMembers(sect.id)).length} — xem bằng \`/sect members\`\n\n` +
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
        embeds: [createSuccessEmbed('Đã Gửi Đơn Gia Nhập', res.message, player.realm_id)]
      });
    }

    if (sub === 'applications') {
      const applications = await getSectApplications(userId);
      if (applications.length === 0) {
        return interaction.reply({
          embeds: [createTuTienEmbed(player.realm_id)
            .setTitle('📨 Đơn Xin Gia Nhập')
            .setDescription('*Tông Môn của đạo hữu hiện không có đơn xin gia nhập đang chờ duyệt.*')],
          ephemeral: true
        });
      }

      const displayedApplications = applications.slice(0, 25);
      const applicationList = displayedApplications.map(application =>
        `**Đơn #${application.id}** — <@${application.applicant_id}> (${application.dao_hieu || application.username})\n` +
        `Gửi lúc: <t:${Math.floor(Number(application.created_at) / 1000)}:R>`
      ).join('\n\n');
      const moreText = applications.length > displayedApplications.length
        ? `\n\n*Còn ${applications.length - displayedApplications.length} đơn chưa hiển thị.*`
        : '';
      return interaction.reply({
        embeds: [createTuTienEmbed(player.realm_id)
          .setTitle(`📨 Đơn Xin Gia Nhập • ${applications[0].sect_name}`)
          .setDescription(
            `${applicationList}${moreText}\n\n` +
            'Duyệt bằng `/sect approve application-id:<mã đơn>` hoặc từ chối bằng `/sect reject application-id:<mã đơn>`.'
          )],
        ephemeral: true
      });
    }

    if (sub === 'approve' || sub === 'reject') {
      const applicationId = interaction.options.getInteger('application-id');
      const decision = sub === 'approve' ? 'accept' : 'reject';
      const result = await resolveSectApplication(userId, applicationId, decision);
      if (!result.success) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Thể Xử Lý Đơn', result.message)],
          ephemeral: true
        });
      }
      return interaction.reply({
        embeds: [createSuccessEmbed(
          sub === 'approve' ? 'Đã Chấp Nhận Đơn' : 'Đã Từ Chối Đơn',
          result.message,
          player.realm_id
        )]
      });
    }

    if (sub === 'members') {
      if (!player.sect_id) {
        return interaction.reply({
          embeds: [createErrorEmbed('Chưa Có Tông Môn', 'Đạo hữu cần gia nhập Tông Môn để xem danh sách thành viên.')],
          ephemeral: true
        });
      }

      const sect = await getSectById(player.sect_id);
      if (!sect) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Tìm Thấy Tông Môn', 'Dữ liệu Tông Môn không còn tồn tại. Vui lòng liên hệ quản trị viên.')],
          ephemeral: true
        });
      }

      const members = await getSectMembers(sect.id);
      const displayedMembers = members.slice(0, 25);
      const memberList = displayedMembers.map((member, index) =>
        `**${index + 1}.** <@${member.user_id}> — ${member.sect_role || 'Đệ Tử'}\n` +
        `　${getRealmDisplay(member.realm_id, member.level)} • Cống hiến: ${formatNumber(member.sect_contribution || 0)}`
      ).join('\n');
      const remainingCount = members.length - displayedMembers.length;
      const embed = createTuTienEmbed(player.realm_id)
        .setTitle(`👥 Thành Viên • ${sect.name} (${members.length})`)
        .setDescription(
          memberList || '*Tông Môn hiện chưa có thành viên.*' +
          (remainingCount > 0 ? `\n\n*Còn ${remainingCount} thành viên chưa hiển thị.*` : '')
        );
      if (remainingCount > 0) {
        embed.setFooter({ text: `Đang hiển thị ${displayedMembers.length}/${members.length} thành viên` });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'recruit') {
      const target = interaction.options.getUser('member');
      if (target.bot) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Thể Tuyển', 'Không thể tuyển bot làm thành viên Tông Môn.')],
          ephemeral: true
        });
      }

      const res = await recruitSectMember(userId, target.id);
      if (!res.success) {
        return interaction.reply({
          embeds: [createErrorEmbed('Tuyển Thành Viên Thất Bại', res.message)],
          ephemeral: true
        });
      }
      return interaction.reply({
        embeds: [createSuccessEmbed('Tuyển Thành Viên Thành Công', res.message, player.realm_id)]
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
