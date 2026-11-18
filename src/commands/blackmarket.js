const { SlashCommandBuilder } = require('discord.js');
const { getMarketListings, listItem, buyMarketItem, cancelListing } = require('../services/marketService');
const { getPlayer } = require('../services/playerService');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { formatNumber } = require('../utils/formatters');
const { createTextEmbedPages, replyWithEmbedPages } = require('../utils/embedPagination');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('Chợ Đen & Nhà Đấu Giá Tự Do - Mua bán tài nguyên bằng Ngân Lượng')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('Xem danh sách vật phẩm đang bày bán trên Chợ Đen')
        .addStringOption(opt =>
          opt.setName('category')
            .setDescription('Lọc theo danh mục vật phẩm')
            .setRequired(false)
            .addChoices(
              { name: 'Linh Kim Đột Phá', value: 'spirit_gold' },
              { name: 'Đan Dược', value: 'pill' },
              { name: 'Linh Thảo', value: 'herb' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('sell')
        .setDescription('Đăng bán vật phẩm lên Chợ Đen')
        .addStringOption(opt =>
          opt.setName('item')
            .setDescription('Loại vật phẩm muốn bán')
            .setRequired(true)
            .addChoices(
              { name: 'Linh Kim (Phẩm Phàm)', value: 'spirit_gold:Phàm:Linh Kim (Phẩm Phàm)' },
              { name: 'Linh Kim (Phẩm Tinh)', value: 'spirit_gold:Tinh:Linh Kim (Phẩm Tinh)' },
              { name: 'Linh Kim (Phẩm Linh)', value: 'spirit_gold:Linh:Linh Kim (Phẩm Linh)' },
              { name: 'Linh Kim (Phẩm Địa)', value: 'spirit_gold:Địa:Linh Kim (Phẩm Địa)' },
              { name: 'Linh Kim (Phẩm Thiên)', value: 'spirit_gold:Thiên:Linh Kim (Phẩm Thiên)' },
              { name: 'Trúc Cơ Đan', value: 'pill:TrucCoDan:Trúc Cơ Đan' },
              { name: 'Tụ Linh Đan', value: 'pill:TuLinhDan:Tụ Linh Đan' },
              { name: 'Tẩy Tủy Đan', value: 'pill:TayTuyDan:Tẩy Tủy Đan' },
              { name: 'Bách Hóa Kim Đan', value: 'pill:BachHoaKimDan:Bách Hóa Kim Đan' }
            )
        )
        .addStringOption(opt =>
          opt.setName('amount')
            .setDescription('Số lượng muốn bán hoặc all để bán toàn bộ')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('price')
            .setDescription('Giá bán bằng Ngân Lượng (tổng cộng)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('buy')
        .setDescription('Mua một vật phẩm trên Chợ Đen bằng ID')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Mã ID gian hàng muốn mua')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Hủy bài đăng bán của chính mình để thu hồi vật phẩm')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Mã ID gian hàng của bạn muốn hủy')
            .setRequired(true)
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

    // 1. Xem Chợ Đen
    if (sub === 'view') {
      const category = interaction.options.getString('category');
      const listings = await getMarketListings(category);

      if (listings.length === 0) {
        return interaction.reply({
          embeds: [createTuTienEmbed(player.realm_id).setTitle('🏪 Chợ Đen Vạn Giới').setDescription('*Hiện tại chưa có tu sĩ nào niêm yết vật phẩm bán!*')],
          ephemeral: true
        });
      }

      const listText = listings.map(l =>
        `**#ID: ${l.id}** • **${l.item_title}**\n` +
        `  • Giá: \`${formatNumber(l.price_silver)}\` Ngân Lượng\n` +
        `  • Người bán: **${l.seller_name}** (<@${l.seller_id}>)`
      );
      const description =
        `*Nơi giao thương tự do giữa các tu sĩ, mua bán vật phẩm bằng Ngân Lượng!*\n` +
        `*(Trang bị Trợ Thủ Sinh Hoạt sẽ được giảm giá 15% khi mua hàng)*\n\n` +
        `${listText.join('\n\n')}\n\n👉 Dùng lệnh \`/market buy id:<id>\` để mua!`;
      return replyWithEmbedPages(interaction, createTextEmbedPages(description, {
        title: '🏪 Chợ Đen Vạn Giới • Giao Dịch Tự Do',
        realmId: player.realm_id
      }), { customIdPrefix: 'market_page' });
    }

    // 2. Đăng Bán
    if (sub === 'sell') {
      const rawChoice = interaction.options.getString('item');
      const [itemCategory, itemKey, itemName] = rawChoice.split(':');
      const amountInput = interaction.options.getString('amount');
      const priceSilver = interaction.options.getInteger('price');

      if (priceSilver <= 0) {
        return interaction.reply({ embeds: [createErrorEmbed('Lỗi Dữ Liệu', 'Số lượng và giá phải lớn hơn 0!')], ephemeral: true });
      }

      let amount;
      if (/^all$/i.test(amountInput)) {
        const { getItemAmount } = require('../services/itemService');
        amount = await getItemAmount(userId, itemCategory, itemKey);
      } else {
        amount = Number(amountInput);
      }
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        return interaction.reply({ embeds: [createErrorEmbed('Lỗi Dữ Liệu', 'Số lượng phải là số nguyên dương hoặc all!')], ephemeral: true });
      }

      const res = await listItem(userId, player.dao_hieu || player.username, itemCategory, itemKey, itemName, amount, priceSilver);
      if (!res.success) {
        return interaction.reply({ embeds: [createErrorEmbed('Đăng Bán Thất Bại', res.message)], ephemeral: true });
      }

      return interaction.reply({
        embeds: [createSuccessEmbed('Niêm Yết Thành Công', res.message, player.realm_id)]
      });
    }

    // 3. Mua Vật Phẩm
    if (sub === 'buy') {
      const listingId = interaction.options.getInteger('id');
      const res = await buyMarketItem(userId, listingId);
      if (!res.success) {
        return interaction.reply({ embeds: [createErrorEmbed('Giao Dịch Thất Bại', res.message)], ephemeral: true });
      }

      return interaction.reply({
        embeds: [createSuccessEmbed('Mua Hàng Thành Công', res.message, player.realm_id)]
      });
    }

    // 4. Hủy Đăng Bán
    if (sub === 'cancel') {
      const listingId = interaction.options.getInteger('id');
      const res = await cancelListing(userId, listingId);
      if (!res.success) {
        return interaction.reply({ embeds: [createErrorEmbed('Hủy Thất Bại', res.message)], ephemeral: true });
      }

      return interaction.reply({
        embeds: [createSuccessEmbed('Hủy Bài Đăng Hoàn Tất', res.message, player.realm_id)]
      });
    }
  }
};
