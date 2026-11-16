const { SlashCommandBuilder } = require('discord.js');
const { getInventory, removeItem, getItemAmount } = require('../services/itemService');
const { getPlayer, addXp } = require('../services/playerService');
const { SPIRIT_ROOTS } = require('../config/constants');
const { getDb } = require('../config/database');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { formatNumber } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bag')
    .setDescription('Xem túi trữ vật hoặc sử dụng đan dược')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('Xem toàn bộ Linh Kim, Đan Dược và Linh Thảo trong túi')
    )
    .addSubcommand(sub =>
      sub.setName('use')
        .setDescription('Uống một viên đan dược')
        .addStringOption(opt =>
          opt.setName('pill')
            .setDescription('Chọn đan dược muốn dùng')
            .setRequired(true)
            .addChoices(
              { name: 'Tụ Linh Đan (Tăng 5.000 Linh Lực)', value: 'TuLinhDan' },
              { name: 'Tẩy Tủy Đan (Tẩy đổi lại Linh Căn)', value: 'TayTuyDan' }
            )
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

    if (sub === 'view') {
      const items = await getInventory(userId);

      if (items.length === 0) {
        return interaction.reply({
          embeds: [createTuTienEmbed(player.realm_id).setTitle('🎒 Túi Trữ Vật').setDescription('*Túi trữ vật trống không!*')],
          ephemeral: true
        });
      }

      const goldItems = items.filter(i => i.item_type === 'spirit_gold');
      const pillItems = items.filter(i => i.item_type === 'pill');
      const herbItems = items.filter(i => i.item_type === 'herb');
      const seedItems = items.filter(i => i.item_type === 'seed');

      const embed = createTuTienEmbed(player.realm_id)
        .setTitle(`🎒 Túi Trữ Vật • ${player.dao_hieu || player.username}`)
        .addFields(
          {
            name: '✨ Linh Kim Đột Phá',
            value: goldItems.length > 0 
              ? goldItems.map(i => `• **${i.item_name}:** \`${i.amount}\` Viên`).join('\n')
              : '*Không có*',
            inline: false
          },
          {
            name: '💊 Đan Dược Quý',
            value: pillItems.length > 0
              ? pillItems.map(i => `• **${i.item_name}:** \`${i.amount}\` Viên`).join('\n')
              : '*Không có*',
            inline: true
          },
          {
            name: '🌿 Linh Thảo & Hạt Giống',
            value: (herbItems.length > 0 || seedItems.length > 0)
              ? [...herbItems, ...seedItems].map(i => `• **${i.item_name}:** \`${i.amount}\` Cây/Túi`).join('\n')
              : '*Không có*',
            inline: true
          }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'use') {
      const pillKey = interaction.options.getString('pill');
      const count = await getItemAmount(userId, 'pill', pillKey);

      if (count < 1) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Đủ Đan Dược', `Đạo hữu không có viên đan dược này trong túi! Hãy luyện chế tại \`/base brew\`.`)],
          ephemeral: true
        });
      }

      await removeItem(userId, 'pill', pillKey, 1);

      if (pillKey === 'TuLinhDan') {
        const xpRes = await addXp(userId, 5000);
        return interaction.reply({
          embeds: [createSuccessEmbed(
            'Uống Tụ Linh Đan Thành Công',
            `Đan dược tan chảy nơi đan điền, linh khí cuồn cuộn dâng trào!\n` +
            `• **Linh Lực Thu Được:** \`+${formatNumber(xpRes.addedXp)}\` XP\n` +
            (xpRes.leveledUp ? '🎉 **Chúc mừng đạo hữu đột phá thăng cấp!**\n' : '') +
            (xpRes.breakthroughReady ? '⚡ **Linh lực đã đạt đỉnh phong cảnh giới! Dùng `/break` ngay!**' : ''),
            player.realm_id
          )]
        });
      }

      if (pillKey === 'TayTuyDan') {
        // Tẩy tủy lại linh căn ngẫu nhiên
        const rootKeys = Object.keys(SPIRIT_ROOTS);
        const newRootKey = rootKeys[Math.floor(Math.random() * rootKeys.length)];
        const newRoot = SPIRIT_ROOTS[newRootKey];

        const db = getDb();
        await db.execute({
          sql: 'UPDATE tutien_players SET spirit_root = ? WHERE user_id = ?',
          args: [newRootKey, userId]
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(
            'Tẩy Tủy Hoán Cốt Thành Công',
            `Kinh mạch toàn thân được tái tạo! Đạo hữu đã thức tỉnh linh căn mới:\n\n` +
            `🌟 ${newRoot.icon} **${newRoot.name}**\n` +
            `• *Hiệu quả:* ${newRoot.bonusDesc}\n` +
            `• *Tương khắc:* ${newRoot.counters}`,
            player.realm_id
          )]
        });
      }
    }
  }
};
