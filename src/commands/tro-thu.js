const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getUserHelpers, equipHelper, unequipHelper } = require('../services/helperService');
const { getPlayer } = require('../services/playerService');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { groupDuplicateItems } = require('../utils/groupDuplicateItems');
const { onComponentCollect, runComponentAction } = require('../utils/componentAction');
const { createTextEmbedPages, replyWithEmbedPages } = require('../utils/embedPagination');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('helpers')
    .setDescription('Quản lý Trợ Thủ (Tối đa 1): Hộ Đạo Giả Chiến Đấu hoặc Đạo Đồng Sinh Hoạt')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Xem toàn bộ Trợ Thủ và Trợ Thủ đang xuất chiến')
    )
    .addSubcommand(sub =>
      sub.setName('deploy')
        .setDescription('Chọn 1 Trợ Thủ xuất chiến trợ giúp')
    )
    .addSubcommand(sub =>
      sub.setName('rest')
        .setDescription('Thu hồi Trợ Thủ về nghỉ ngơi')
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
    const helpers = await getUserHelpers(userId);

    // 1. Danh Sách
    if (sub === 'list') {
      if (helpers.length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed('Chưa Có Trợ Thủ', 'Đạo hữu chưa có Trợ Thủ nào! Hãy dùng `/wish` để kết duyên cùng Đạo Lữ & Hộ Đạo Giả (4★ - 5★) hoặc thám hiểm Kỳ Ngộ tại `/event`.')],
          ephemeral: true
        });
      }

      const helperGroups = groupDuplicateItems(helpers, ['name', 'type', 'tier', 'effect_desc', 'image_url']);
      const listText = helperGroups.map(({ item: h, items }) => {
        const typeBadge = h.type === 'combat' ? '⚔️ [Chiến Đấu - Hộ Đạo Giả]' : '🌾 [Sinh Hoạt - Đạo Đồng]';
        const ids = items.map(item => `#${item.id}`).join(', ');
        const equippedIds = items.filter(item => item.is_equipped).map(item => `#${item.id}`).join(', ');
        return `**${ids} - ${String(h.name).slice(0, 100)}** ${typeBadge} [Bậc ${h.tier}] ×${items.length} ${equippedIds ? `👉 *(Đang Xuất Chiến: ${equippedIds})*` : ''}\n` +
               `  • *Hiệu quả:* ${String(h.effect_desc).slice(0, 300)}`;
      });

      const description =
          `*Người chơi chỉ được trang bị tối đa **1 Trợ Thủ** cùng lúc.*\n` +
          `• **Chiến Đấu:** Trực tiếp tham chiến gây sát thương, đỡ đòn hoặc hồi máu.\n` +
          `• **Sinh Hoạt:** Tăng +30% tài nguyên AFK khi trạng thái AFK đang bật, tăng tỷ lệ luyện đan và giảm giá Chợ Đen.\n\n` +
          listText.join('\n\n');

      return replyWithEmbedPages(interaction, createTextEmbedPages(description, {
        title: `🤝 Đạo Hữu Các • Trợ Thủ Của ${player.dao_hieu || player.username}`,
        realmId: player.realm_id
      }), { customIdPrefix: 'helpers_page' });
    }

    // 2. Xuất Chiến
    if (sub === 'deploy') {
      if (helpers.length === 0) {
        return interaction.reply({ embeds: [createErrorEmbed('Trống', 'Đạo hữu không có Trợ Thủ nào!')], ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_helper_equip')
        .setPlaceholder('Chọn Trợ Thủ xuất chiến...')
        .addOptions(
          helpers.slice(0, 25).map(h => ({
            label: `${h.name} [${h.type === 'combat' ? 'Chiến Đấu' : 'Sinh Hoạt'}]`,
            description: h.effect_desc.substring(0, 100),
            value: h.id.toString()
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);
      const msg = await interaction.reply({ content: 'Chọn Trợ Thủ muốn xuất chiến:', components: [row] });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      onComponentCollect(collector, async i => {
        if (i.customId === 'select_helper_equip') {
          collector.stop();
          const hId = Number(i.values[0]);
          await runComponentAction(
            i,
            async () => {
              const res = await equipHelper(userId, hId);
              return {
                content: null,
                embeds: [res.success
                  ? createSuccessEmbed('Xuất Chiến Thành Công', res.message, player.realm_id)
                  : createErrorEmbed('Xuất Chiến Thất Bại', res.message)],
                components: []
              };
            },
            () => ({
              embeds: [createErrorEmbed('Xuất Chiến Thất Bại', 'Không thể xuất chiến Trợ Thủ lúc này. Vui lòng thử lại.')],
              components: []
            }),
            'xuất chiến Trợ Thủ'
          );
        }
      });
      return;
    }

    // 3. Nghỉ Ngơi
    if (sub === 'rest') {
      const equipped = helpers.find(h => h.is_equipped === 1);
      if (!equipped) {
        return interaction.reply({ embeds: [createErrorEmbed('Chưa Trang Bị', 'Hiện tại không có Trợ Thủ nào đang xuất chiến!')], ephemeral: true });
      }

      await unequipHelper(userId, equipped.id);
      return interaction.reply({
        embeds: [createSuccessEmbed('Thu Hồi Trợ Thủ', `Đã cho Trợ Thủ **${equipped.name}** lui về tĩnh dưỡng!`, player.realm_id)]
      });
    }
  }
};
