const { SlashCommandBuilder } = require('discord.js');
const { getInventory } = require('../services/itemService');
const { getPlayer } = require('../services/playerService');
const { SPIRIT_GOLD_QUALITIES } = require('../config/constants');
const { createTuTienEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { formatNumber } = require('../utils/formatters');

const RESOURCE_TYPES = {
  pill: '💊 Đan Dược',
  herb: '🌿 Linh Thảo',
  seed: '🌱 Hạt Giống'
};

function formatResourceFields(items) {
  const groupedItems = new Map();
  for (const item of items) {
    if (item.item_type === 'spirit_gold') continue;
    const type = item.item_type || 'other';
    if (!groupedItems.has(type)) groupedItems.set(type, []);
    groupedItems.get(type).push(item);
  }

  const fields = [];
  for (const [type, resources] of groupedItems) {
    const lines = resources.map(item =>
      `• **${item.item_name}** (ID: \`${item.id}\`): \`${formatNumber(item.amount)}\``
    );
    let value = '';
    let chunk = 1;
    const fieldName = RESOURCE_TYPES[type] || `📦 ${type}`;

    for (const line of lines) {
      if (value && value.length + line.length + 1 > 1024) {
        fields.push({ name: chunk === 1 ? fieldName : `${fieldName} (tiếp)`, value });
        value = '';
        chunk++;
      }
      value += `${value ? '\n' : ''}${line}`;
    }

    if (value) {
      fields.push({ name: chunk === 1 ? fieldName : `${fieldName} (tiếp)`, value });
    }
  }

  return fields;
}

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
    const resourceFields = formatResourceFields(items);

    const embed = createTuTienEmbed(player.realm_id)
      .setTitle(`💰 Tài Nguyên • ${player.dao_hieu || player.username}`)
      .addFields(
        {
          name: '💰 Số Dư',
          value:
            `• **Ngân Lượng:** \`${formatNumber(player.silver)}\`\n` +
            `• **Linh Lực:** \`${formatNumber(player.xp)}\` XP`,
          inline: false
        },
        {
          name: '✨ Linh Kim',
          value: goldLinesWithIds.join('\n'),
          inline: false
        },
        ...(resourceFields.length > 0
          ? resourceFields
          : [{ name: '📦 Tài Nguyên Khác', value: '*Không có*', inline: true }])
      );

    return interaction.editReply({ embeds: [embed] });
  }
};
