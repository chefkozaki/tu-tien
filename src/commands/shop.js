const { SlashCommandBuilder } = require('discord.js');
const { getShopCatalog, buyShopItem } = require('../services/shopService');
const { getPlayer } = require('../services/playerService');
const { createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { formatNumber } = require('../utils/formatters');
const { createTextEmbedPages, replyWithEmbedPages } = require('../utils/embedPagination');

const SHOP_ITEM_CHOICES = [
  { name: 'Trúc Cơ Đan', value: 'TrucCoDan' },
  { name: 'Tụ Linh Đan', value: 'TuLinhDan' },
  { name: 'Tẩy Tủy Đan', value: 'TayTuyDan' },
  { name: 'Bách Hóa Kim Đan', value: 'BachHoaKimDan' },
  { name: 'Linh Kim Phẩm Phàm', value: 'Phàm' },
  { name: 'Linh Kim Phẩm Tinh', value: 'Tinh' },
  { name: 'Linh Kim Phẩm Linh', value: 'Linh' },
  { name: 'Linh Kim Phẩm Địa', value: 'Địa' },
  { name: 'Linh Kim Phẩm Thiên', value: 'Thiên' },
  { name: 'Linh Kim Phẩm Thánh', value: 'Thánh' },
  { name: 'Linh Kim Phẩm Thần', value: 'Thần' },
  { name: 'Linh Kim Hỗn Độn', value: 'Hỗn Độn' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Cửa hàng hệ thống bán Đan Dược và Linh Kim với giá động')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('Xem hàng hóa và giá hiện tại của cửa hàng')
    )
    .addSubcommand(sub =>
      sub.setName('buy')
        .setDescription('Mua Đan Dược hoặc Linh Kim bằng Ngân Lượng')
        .addStringOption(option =>
          option.setName('item')
            .setDescription('Vật phẩm muốn mua')
            .setRequired(true)
            .addChoices(...SHOP_ITEM_CHOICES)
        )
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Số lượng muốn mua (1-100)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const player = await getPlayer(interaction.user.id);
    if (!player) {
      return interaction.reply({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Hãy dùng `/start` trước!')],
        ephemeral: true
      });
    }

    if (interaction.options.getSubcommand() === 'view') {
      const catalog = await getShopCatalog();
      const items = catalog.map(item =>
        `**${String(item.name).slice(0, 100)}** — **${formatNumber(item.unitPrice)}** Bạc/món\n` +
        `  • Khan hiếm: ${item.scarcityMultiplier >= 1.5 ? 'Cao' : item.scarcityMultiplier >= 0.9 ? 'Vừa' : 'Thấp'}` +
        ` • Đang lưu thông: ${formatNumber(item.stock)} / mục tiêu ${formatNumber(item.targetStock)}`
      );
      const description =
        `*Giá tự điều chỉnh theo bạc bình quân mỗi tu sĩ và lượng vật phẩm đang lưu thông toàn server.*\n\n` +
        `${items.join('\n\n')}`;
      const embeds = createTextEmbedPages(description, {
        title: '🏪 Tiên Gia Bách Hóa • Đan Dược & Linh Kim',
        realmId: player.realm_id,
        footer: 'Giá được tính lại khi xem và mua; tối đa 100 món mỗi giao dịch.'
      });
      return replyWithEmbedPages(interaction, embeds, { customIdPrefix: 'shop_page' });
    }

    const itemKey = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount');
    const result = await buyShopItem(interaction.user.id, itemKey, amount);
    if (!result.success) {
      return interaction.reply({
        embeds: [createErrorEmbed('Mua Hàng Thất Bại', result.message)],
        ephemeral: true
      });
    }

    return interaction.reply({
      embeds: [createSuccessEmbed('Mua Hàng Thành Công', result.message, player.realm_id)]
    });
  }
};
