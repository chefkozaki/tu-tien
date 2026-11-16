const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getPlayer, executeBreakthrough } = require('../services/playerService');
const { REALMS } = require('../config/constants');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { getRealmDisplay } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('break')
    .setDescription('Đột phá Đại Cảnh Giới khi đã đạt Cấp 10 (Đỉnh Cấp)'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const player = await getPlayer(userId);

    if (!player) {
      return interaction.reply({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Hãy dùng `/start` trước!')],
        ephemeral: true
      });
    }

    if (player.realm_id >= 8) {
      return interaction.reply({
        embeds: [createTuTienEmbed(8).setTitle('🌟 Tối Thượng Cảnh Giới').setDescription('Đạo hữu đã đứng trên đỉnh cao vạn giới, không thể đột phá thêm!')],
        ephemeral: true
      });
    }

    if (player.level < 10) {
      return interaction.reply({
        embeds: [createErrorEmbed(
          'Chưa Đạt Đỉnh Cấp',
          `Đạo hữu hiện tại mới ở **${getRealmDisplay(player.realm_id, player.level)}**.\n` +
          `Cần tích lũy linh lực đạt **Cấp 10 (Đỉnh Cấp)** mới có thể dẫn phát thiên địa dị tượng để đột phá!`
        )],
        ephemeral: true
      });
    }

    const currentRealm = REALMS[player.realm_id];
    const nextRealm = REALMS[player.realm_id + 1];
    const req = currentRealm.breakthrough;

    // Nếu đột phá từ Chúa Tể lên Thần: Cần Lĩnh Ngộ Quy Tắc
    if (req.type === 'quy_tac') {
      const embed = createTuTienEmbed(player.realm_id)
        .setTitle('🌌 Vượt Ải Chúa Tể: Lĩnh Ngộ Thiên Đạo Quy Tắc')
        .setDescription(
          `Để bước vào cảnh giới **Thần Chi Cảnh**, đạo hữu cần dung hợp quy tắc vũ trụ!\n\n` +
          `• **Yêu Cầu:** ${req.extraDesc}\n` +
          `Hãy chọn một Đạo Quy Tắc mà đạo hữu muốn khắc sâu vào linh hồn:`
        );

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_rule')
        .setPlaceholder('Chọn Thiên Đạo Quy Tắc...')
        .addOptions([
          { label: 'Quy Tắc Không Gian', description: 'Xé toạc hư không, di chuyển vô thanh vô tức', value: 'Không Gian' },
          { label: 'Quy Tắc Thời Gian', description: 'Ngưng đọng thời gian, chúa tể vạn kiếp', value: 'Thời Gian' },
          { label: 'Quy Tắc Luân Hồi', description: 'Bất tử bất diệt, chưởng quản sinh tử', value: 'Luân Hồi' },
          { label: 'Quy Tắc Hỗn Độn', description: 'Vạn vật quy nhất, sức mạnh nguyên thủy sơ khai', value: 'Hỗn Độn' }
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      const res = await interaction.reply({ embeds: [embed], components: [row] });

      const collector = res.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.customId === 'select_rule') {
          const chosenRule = i.values[0];
          const result = await executeBreakthrough(userId, chosenRule);
          if (!result.success) {
            return i.update({ embeds: [createErrorEmbed('Đột Phá Thất Bại', result.message)], components: [] });
          }

          const successEmbed = createSuccessEmbed(
            '🌟 THẦN CẢNH ĐỘT PHÁ THÀNH CÔNG!',
            `Đạo hữu đã lĩnh ngộ **Quy Tắc ${chosenRule}**, thoát thai hoán cốt trở thành **Chân Thần**!\n` +
            `Cảnh Giới Mới: **${result.newRealm} Hạ Cấp (Cấp 1)**!`,
            nextRealm.id
          );
          return i.update({ embeds: [successEmbed], components: [] });
        }
      });
      return;
    }

    // Embed xác nhận đột phá thông thường hoặc Lôi Kiếp
    const embed = createTuTienEmbed(player.realm_id)
      .setTitle(`⚡ Chuẩn Bị Đột Phá: ${currentRealm.name} ➔ ${nextRealm.name}`)
      .setDescription(
        `Đạo hữu đã tích lũy linh lực đạt đỉnh phong **${currentRealm.name} Đỉnh Cấp**!\n\n` +
        `📜 **Điều Kiện Đột Phá Yêu Cầu:**\n` +
        `• ${req.extraDesc}\n\n` +
        `Đạo hữu đã chuẩn bị sẵn sàng nghênh tiếp thiên kiếp, bước sang một tầng trời mới?`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_breakthrough')
        .setLabel('Nghênh Tiếp Thiên Kiếp / Đột Phá Ngay')
        .setEmoji('⚡')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_breakthrough')
        .setLabel('Tạm Dừng Chuẩn Bị Thêm')
        .setStyle(ButtonStyle.Secondary)
    );

    const replyMsg = await interaction.reply({ embeds: [embed], components: [row] });

    const collector = replyMsg.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 60000
    });

    collector.on('collect', async i => {
      if (i.customId === 'cancel_breakthrough') {
        return i.update({
          embeds: [createTuTienEmbed(player.realm_id).setTitle('Đã Hủy Đột Phá').setDescription('Đạo hữu quyết định tích lũy thêm đan dược và trang bị trước khi độ kiếp.')],
          components: []
        });
      }

      if (i.customId === 'confirm_breakthrough') {
        // Thực hiện đột phá
        const result = await executeBreakthrough(userId);
        if (!result.success) {
          return i.update({
            embeds: [createErrorEmbed('Đột Phá Bất Thành', result.message)],
            components: []
          });
        }

        // Nếu là Lôi Kiếp (Linh Vương -> Linh Đế hoặc Linh Đế -> Chúa Tể hoặc Thần -> Tối Thượng)
        let extraText = '';
        if (req.lightningCount) {
          extraText = `\n⚡ **${req.lightningCount} Đạo Thiên Lôi** giáng xuống kinh thiên động địa! Đạo hữu bằng vào đạo tâm kiên định đã tôi luyện kim thân thành công!`;
        }

        const successEmbed = createSuccessEmbed(
          '🎉 ĐỘT PHÁ THÀNH CÔNG VANG DỘI TAM GIỚI!',
          `Chúc mừng đạo hữu đã phá tan gông cùm, tiến vào **${result.newRealm}**!${extraText}\n\n` +
          `• Cảnh Giới Mới: **${result.newRealm} Hạ Cấp (Cấp 1)**\n` +
          `• Thuộc tính cơ bản (HP, Công, Thủ) gia tăng vượt bậc!\n` +
          `• Hãy tiếp tục tu luyện để vươn tới cảnh giới tiếp theo!`,
          nextRealm.id
        );

        return i.update({ embeds: [successEmbed], components: [] });
      }
    });
  }
};
