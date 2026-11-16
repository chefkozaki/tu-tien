const { SlashCommandBuilder } = require('discord.js');
const {
  getInventory,
  getInventoryItemById,
  removeInventoryItemById
} = require('../services/itemService');
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
        .setDescription('Uống một viên đan dược bằng ID trong lệnh /inv')
        .addStringOption(opt =>
          opt.setName('item_id')
            .setDescription('ID của đan dược trong /inv')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();
    const isUse = sub === 'use';
    const replyOrEdit = payload => isUse
      ? interaction.editReply(payload)
      : interaction.reply(payload);

    if (isUse) {
      await interaction.deferReply({ ephemeral: true });
    }

    const player = await getPlayer(userId);
    if (!player) {
      return replyOrEdit({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Hãy dùng `/start` trước!')],
        ephemeral: true
      });
    }

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
      const itemId = interaction.options.getString('item_id');
      if (!/^\d+$/.test(itemId)) {
        return replyOrEdit({
          embeds: [createErrorEmbed('ID Không Hợp Lệ', 'Hãy nhập ID đan dược hiển thị trong lệnh `/inv`.')],
          ephemeral: true
        });
      }

      const item = await getInventoryItemById(userId, itemId);
      if (!item || item.item_type !== 'pill') {
        return replyOrEdit({
          embeds: [createErrorEmbed('Không Tìm Thấy Đan Dược', 'ID này không phải đan dược còn trong túi của đạo hữu. Hãy xem lại bằng `/inv`.')],
          ephemeral: true
        });
      }

      const pillKey = item.item_key;
      if (!['TuLinhDan', 'TayTuyDan'].includes(pillKey)) {
        return replyOrEdit({
          embeds: [createErrorEmbed('Chưa Thể Sử Dụng', 'Đan dược này hiện chưa hỗ trợ sử dụng trực tiếp.')],
          ephemeral: true
        });
      }

      const removed = await removeInventoryItemById(userId, itemId);
      if (!removed) {
        return replyOrEdit({
          embeds: [createErrorEmbed('Đan Dược Không Còn', 'Vật phẩm này vừa được sử dụng hoặc không còn trong túi.')],
          ephemeral: true
        });
      }

      if (pillKey === 'TuLinhDan') {
        const xpRes = await addXp(userId, 5000);
        return replyOrEdit({
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

        return replyOrEdit({
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
