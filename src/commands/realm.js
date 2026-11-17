const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPlayer } = require('../services/playerService');
const { getRandomEvent } = require('../services/bicanhService');
const { createTuTienEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { onComponentCollect, runComponentAction } = require('../utils/componentAction');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Thám hiểm Bí Cảnh Thượng Cổ'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const player = await getPlayer(userId);
    if (!player) {
      return interaction.reply({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Hãy dùng `/start` trước!')],
        ephemeral: true
      });
    }

    const event = getRandomEvent();

    const embed = createTuTienEmbed(player.realm_id)
      .setTitle(`🔮 Bí Cảnh Kỳ Ngộ: ${event.title}`)
      .setDescription(
        `${event.desc}\n\n` +
        (player.race === 'ke_do_bo' ? '🛸 *Nội tại Kẻ Đổ Bộ: Kháng mọi bẫy môi trường bí cảnh & +20% tỉ lệ rơi đồ hiếm!*\n\n' : '') +
        `Đạo hữu sẽ lựa chọn hành động ra sao trước tình huống này?`
      );

    const buttons = event.options.map((opt, idx) => 
      new ButtonBuilder()
        .setCustomId(`event_opt_${idx}`)
        .setLabel(opt.text)
        .setStyle(idx === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);
    const msg = await interaction.reply({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 60000
    });

    onComponentCollect(collector, async i => {
      const optIndex = parseInt(i.customId.replace('event_opt_', ''), 10);
      const chosenOption = event.options[optIndex];

      if (chosenOption && chosenOption.action) {
        collector.stop();
        await runComponentAction(
          i,
          async () => {
            const result = await chosenOption.action(userId, player);
            const resultEmbed = createTuTienEmbed(player.realm_id)
              .setTitle(`🔮 Kết Cục Kỳ Ngộ: ${event.title}`)
              .setDescription(result.message);

            return { embeds: [resultEmbed], components: [] };
          },
          () => ({
            embeds: [createErrorEmbed('Kỳ Ngộ Gián Đoạn', 'Không thể xử lý lựa chọn bí cảnh lúc này. Vui lòng kiểm tra trạng thái nhân vật.')],
            components: []
          }),
          'chọn hành động bí cảnh'
        );
      }
    }, 'bí cảnh');
  }
};
