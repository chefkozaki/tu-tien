const { SlashCommandBuilder } = require('discord.js');
const { getInventory } = require('../services/itemService');
const { getPlayer } = require('../services/playerService');
const { SPIRIT_GOLD_QUALITIES } = require('../config/constants');
const { createErrorEmbed } = require('../utils/embedBuilder');
const { formatNumber } = require('../utils/formatters');
const { createTextEmbedPages, replyWithEmbedPages } = require('../utils/embedPagination');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inv')
    .setDescription('Xem số dư tiền tệ, Linh Kim và tài nguyên'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const [player, items] = await Promise.all([
      getPlayer(userId),
      getInventory(userId)
    ]);

    if (!player) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Hãy dùng `/start` trước!')]
      });
    }

    const goldItems = items.filter(item => item.item_type === 'spirit_gold');
    const goldLinesWithIds = SPIRIT_GOLD_QUALITIES.flatMap(quality => {
      const matchingItems = goldItems.filter(item => item.item_key === quality.id);
      return matchingItems.length > 0
        ? matchingItems.map(item =>
            `• **${quality.name}** (ID: \`${item.id}\`): \`${formatNumber(item.amount)}\` viên`
          )
        : [`• **${quality.name}:** \`0\` viên`];
    });
    const resourceLines = items
      .filter(item => item.item_type !== 'spirit_gold')
      .map(item =>
        `• **${String(item.item_name).slice(0, 100)}** (ID: \`${item.id}\`): \`${formatNumber(item.amount)}\``
      );
    const description =
      `**💰 Số Dư**\n` +
      `• **Ngân Lượng:** \`${formatNumber(player.silver)}\`\n` +
      `• **Linh Lực:** \`${formatNumber(player.xp)}\` XP\n\n` +
      `**✨ Linh Kim**\n${goldLinesWithIds.join('\n')}\n` +
      `*Quy đổi: 100 viên bậc thấp = 1 viên bậc cao (\`/bag convert\` / \`aconvert\`) • Đổi ngược: 1 viên bậc cao = 10 viên bậc thấp (\`/bag split\` / \`asplit\`)*\n\n` +
      `**📦 Tài Nguyên Khác**\n${resourceLines.length ? resourceLines.join('\n') : '*Không có*'}`;
    const embeds = createTextEmbedPages(description, {
      title: `💰 Tài Nguyên • ${player.dao_hieu || player.username}`,
      realmId: player.realm_id
    });
    return replyWithEmbedPages(interaction, embeds, {
      ephemeral: true,
      customIdPrefix: 'inventory_page'
    });
  }
};
