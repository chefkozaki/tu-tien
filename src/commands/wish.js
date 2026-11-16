const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  StringSelectMenuBuilder 
} = require('discord.js');
const { 
  performWish, 
  getUserPity, 
  getGachaItems, 
  BANNER_CONFIG, 
  WISH_COST_SINGLE, 
  WISH_COST_TEN 
} = require('../services/gachaService');
const { getPlayer } = require('../services/playerService');
const { createTuTienEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { formatNumber } = require('../utils/formatters');

function buildBannerEmbed(bannerKey, pityData, player) {
  const banner = BANNER_CONFIG[bannerKey] || BANNER_CONFIG.standard;
  let pity4 = pityData.standard_pity_4 || 0;
  let pity5 = pityData.standard_pity_5 || 0;

  if (bannerKey === 'weapon') {
    pity4 = pityData.weapon_pity_4 || 0;
    pity5 = pityData.weapon_pity_5 || 0;
  } else if (bannerKey === 'pet') {
    pity4 = pityData.pet_pity_4 ?? pityData.pet_helper_pity_4 ?? 0;
    pity5 = pityData.pet_pity_5 ?? pityData.pet_helper_pity_5 ?? 0;
  } else if (bannerKey === 'helper') {
    pity4 = pityData.helper_pity_4 ?? pityData.pet_helper_pity_4 ?? 0;
    pity5 = pityData.helper_pity_5 ?? pityData.pet_helper_pity_5 ?? 0;
  }

  const embed = new EmbedBuilder()
    .setColor('#4338ca')
    .setTitle(`🌠 HỆ THỐNG CẦU NGUYỆN • ${banner.name.toUpperCase()}`)
    .setDescription(
      `*${banner.desc}*\n\n` +
      `👤 **Đạo Hữu:** \`${player.dao_hieu || player.username}\` | 💰 **Ngân Lượng:** \`${formatNumber(player.silver)}\` Bạc\n\n` +
      `📜 **Quy Tắc Bảo Hiểm Cầu Nguyện:**\n` +
      `• **5★ Hoàng Kim:** Tỷ lệ cơ bản **0.6%**. Bảo hiểm sau tối đa **90 lượt** (tỷ lệ tăng từ lượt 74)!\n` +
      `• **4★ Tử Sắc:** Tỷ lệ cơ bản **5.1%**. Bảo hiểm **10 lần** (Mỗi 10 lần quay chắc chắn ra ít nhất 1 món 4★ hoặc 5★)!\n` +
      `• **Hồi Đáp Bạc:** Mỗi món 5★ hoàn lại **+30,000 Bạc**, 4★ hoàn lại **+5,000 Bạc**, 3★ hoàn lại **+500 Bạc**!\n\n` +
      `📊 **Tiến Trình Bảo Hiểm Hiện Tại:**\n` +
      `• Bảo hiểm **5★ Hoàng Kim:** \`${pity5}/90\` *(Còn ${90 - pity5} lần nữa)*\n` +
      `• Bảo hiểm **4★ Tử Sắc:** \`${pity4}/10\` *(Còn ${10 - pity4} lần nữa)*\n` +
      `• Tổng số lần đã Cầu Nguyện: \`${pityData.total_wishes || 0}\` lần`
    )
    .setFooter({ text: 'Nhấn nút bên dưới để Cầu Nguyện hoặc chuyển Banner đổi vận mệnh!' });

  return embed;
}

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function buildWishResultEmbed(wishResult, player) {
  const { highestRarity, results, banner, wishCount, totalCost, totalBonusSilver, newPity4, newPity5, remainingSilver } = wishResult;

  let color = '#0070DD'; // 3* Blue
  let title = '🔵 [ÁNH LAM LINH KHÍ] CẦU NGUYỆN HIỂN THẾ';
  let bannerTheme = '🌌 Một luồng linh quang xanh lam dịu nhẹ đáp xuống tay đạo hữu.';

  if (highestRarity === 5) {
    color = '#F1B93A'; // 5* Golden
    title = '🌟✨ [ÁNH KIM QUANG] THIÊN ĐẠO VẬN MỆNH GIÁNG LÂM! ✨🌟';
    bannerTheme = '☄️ **MỘT VỆT SAO BĂNG HOÀNG KIM CHÓI LÒA XÉ TOẠC BẦU TRỜI ĐÊM!**\nĐạo hữu hữu duyên nghịch thiên cải mệnh, nghênh đón kỳ ngộ 5★ Tuyệt Phẩm!';
  } else if (highestRarity === 4) {
    color = '#A335EE'; // 4* Purple
    title = '🟣✨ [ÁNH TÍM SỬ THI] TIÊN DUYÊN KỲ NGỘ! ✨🟣';
    bannerTheme = '🌠 **VỆT SÁNG TỬ SẮC HUYỀN ẢO HẠ PHÀM!**\nBảo vật Tiên Phẩm 4★ đã thuộc về đạo hữu!';
  }

  const itemsList = results.map((item, idx) => {
    let starStr = '⭐⭐⭐';
    let typeTag = '';
    let badge = '';

    if (item.rarity === 5) {
      starStr = '🌟🌟🌟🌟🌟';
      badge = ' 🔥 **[5★ CỰC PHẨM]**';
    } else if (item.rarity === 4) {
      starStr = '⭐⭐⭐⭐';
      badge = ' ✨ **[4★ HIẾM]**';
    }

    if (item.item_type === 'weapon') {
      typeTag = '⚔️ [Linh Khí]';
      return `**${idx + 1}.** ${starStr} ${typeTag} **${item.name}** [Bậc ${item.tier}] (Công +${item.atk}, Thủ +${item.def})${badge}\n` +
             `   └ *${item.effect_name ? `${item.effect_name}: ` : ''}${item.effect_desc}*`;
    } else if (item.item_type === 'pet') {
      typeTag = '🐾 [Linh Thú]';
      return `**${idx + 1}.** ${starStr} ${typeTag} **${item.name}** [Hệ ${item.element}] (Máu +${item.hp}, Công +${item.atk}, Thủ +${item.def})${badge}\n` +
             `   └ *${item.effect_desc}*`;
    } else {
      typeTag = '🤝 [Trợ Thủ]';
      const role = item.type_detail === 'combat' ? 'Chiến Đấu' : 'Sinh Hoạt';
      return `**${idx + 1}.** ${starStr} ${typeTag} **${item.name}** [${role} - Bậc ${item.tier}]${badge}\n` +
             `   └ *${item.effect_desc}*`;
    }
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      `${bannerTheme}\n\n` +
      `⛩️ **Banner:** \`${banner.name}\` | 💫 **Số lượt:** \`${wishCount} Lần\`\n` +
      `💸 **Chi phí:** \`-${formatNumber(totalCost)}\` Bạc | 🎁 **Hồi đáp:** \`+${formatNumber(totalBonusSilver)}\` Bạc\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎁 **DANH SÁCH VẬT PHẨM ĐẮC ĐƯỢC:**\n\n` +
      itemsList + `\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 **Bảo Hiểm Sau Lần Quay:** 5★: \`${newPity5}/90\` | 4★: \`${newPity4}/10\`\n` +
      `💰 **Ngân Lượng Còn Lại:** \`${formatNumber(remainingSilver)}\` Bạc\n` +
      `*(Vật phẩm đã được tự động thêm vào Bách Binh Các, Trân Thú Uyển hoặc Đạo Hữu Các!)*`
    )
    .setFooter({ text: 'Có thể bấm nút bên dưới để tiếp tục Cầu Nguyện hoặc đổi Banner!' });
  const featuredItemImage = results.find(item => item.image_url)?.image_url;
  if (isHttpUrl(featuredItemImage)) embed.setThumbnail(featuredItemImage);

  return embed;
}

function buildActionRows(currentBanner) {
  const rowButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wish_pull_1_${currentBanner}`)
      .setLabel(`Cầu Nguyện x1 (1.6K Bạc)`)
      .setEmoji('🌠')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`wish_pull_10_${currentBanner}`)
      .setLabel(`Cầu Nguyện x10 (16K Bạc)`)
      .setEmoji('🌟')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`wish_view_pity_${currentBanner}`)
      .setLabel('Xem Bảo Hiểm')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary)
  );

  const selectBanner = new StringSelectMenuBuilder()
    .setCustomId('wish_select_banner')
    .setPlaceholder('Chuyển đổi Đài Cầu Nguyện...')
    .addOptions(
      {
        label: 'Thần Binh Vạn Khí (Linh Khí)',
        description: 'Tăng tỷ lệ Linh Khí 4★ - 5★',
        value: 'weapon',
        emoji: '⚔️',
        default: currentBanner === 'weapon'
      },
      {
        label: 'Vạn Thú Quy Tông (Linh Thú)',
        description: 'Tăng tỷ lệ Linh Thú 4★ - 5★',
        value: 'pet',
        emoji: '🐾',
        default: currentBanner === 'pet'
      },
      {
        label: 'Hộ Đạo Tiên Duyên (Trợ Thủ)',
        description: 'Tăng tỷ lệ Hộ Đạo Giả & Tiên Đồng 4★ - 5★',
        value: 'helper',
        emoji: '🤝',
        default: currentBanner === 'helper'
      },
      {
        label: 'Thiên Mệnh Thần Cơ (Tổng Hợp)',
        description: 'Bể tổng hợp toàn bộ Linh Khí, Linh Thú & Trợ Thủ',
        value: 'standard',
        emoji: '🌌',
        default: currentBanner === 'standard'
      }
    );

  const rowSelect = new ActionRowBuilder().addComponents(selectBanner);

  return [rowButtons, rowSelect];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wish')
    .setDescription('Hệ thống Cầu Nguyện Linh Khí, Linh Thú và Trợ Thủ.')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('Xem thông tin các Đài Cầu Nguyện và tiến trình Bảo Hiểm')
        .addStringOption(opt =>
          opt.setName('banner')
            .setDescription('Chọn Đài Cầu Nguyện')
            .setRequired(false)
            .addChoices(
              { name: '⚔️ Thần Binh Vạn Khí (Linh Khí)', value: 'weapon' },
              { name: '🐾 Vạn Thú Quy Tông (Linh Thú)', value: 'pet' },
              { name: '🤝 Hộ Đạo Tiên Duyên (Trợ Thủ)', value: 'helper' },
              { name: '🌌 Thiên Mệnh Thần Cơ (Tổng Hợp)', value: 'standard' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('pull')
        .setDescription('Tiến hành Cầu Nguyện nhận Linh Khí, Linh Thú, Trợ Thủ')
        .addStringOption(opt =>
          opt.setName('banner')
            .setDescription('Chọn Đài Cầu Nguyện')
            .setRequired(true)
            .addChoices(
              { name: '⚔️ Thần Binh Vạn Khí (Linh Khí)', value: 'weapon' },
              { name: '🐾 Vạn Thú Quy Tông (Linh Thú)', value: 'pet' },
              { name: '🤝 Hộ Đạo Tiên Duyên (Trợ Thủ)', value: 'helper' },
              { name: '🌌 Thiên Mệnh Thần Cơ (Tổng Hợp)', value: 'standard' }
            )
        )
        .addIntegerOption(opt =>
          opt.setName('count')
            .setDescription('Số lần quay (1 lần hoặc 10 lần)')
            .setRequired(true)
            .addChoices(
              { name: '1 Lần (1,600 Bạc)', value: 1 },
              { name: '10 Lần (16,000 Bạc - Chắc chắn có 4★+)', value: 10 }
            )
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const player = await getPlayer(userId);
    if (!player) {
      return interaction.reply({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Đạo hữu hãy dùng `/start` trước để bước vào con đường tu chân!')],
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();
    let currentBanner = interaction.options.getString('banner') || 'standard';

    if (sub === 'pull') {
      const count = interaction.options.getInteger('count') || 1;
      const wishRes = await performWish(userId, currentBanner, count);

      if (!wishRes.success) {
        return interaction.reply({
          embeds: [createErrorEmbed('Cầu Nguyện Thất Bại', wishRes.message)],
          ephemeral: true
        });
      }

      const embed = buildWishResultEmbed(wishRes, player);
      const rows = buildActionRows(currentBanner);
      const msg = await interaction.reply({ embeds: [embed], components: rows });
      setupCollector(msg, userId, currentBanner);
      return;
    }

    // Mặc định: Xem Banner
    const pity = await getUserPity(userId);
    const embed = buildBannerEmbed(currentBanner, pity, player);
    const rows = buildActionRows(currentBanner);
    const msg = await interaction.reply({ embeds: [embed], components: rows });
    setupCollector(msg, userId, currentBanner);
  }
};

function setupCollector(msg, userId, initialBanner) {
  let activeBanner = initialBanner;

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === userId,
    time: 120000 // 2 phút tương tác
  });

  collector.on('collect', async i => {
    const player = await getPlayer(userId);
    if (!player) return;

    if (i.isStringSelectMenu() && i.customId === 'wish_select_banner') {
      activeBanner = i.values[0];
      const pity = await getUserPity(userId);
      const embed = buildBannerEmbed(activeBanner, pity, player);
      const rows = buildActionRows(activeBanner);
      return i.update({ embeds: [embed], components: rows });
    }

    if (i.isButton()) {
      if (i.customId.startsWith('wish_view_pity_')) {
        const pity = await getUserPity(userId);
        const embed = buildBannerEmbed(activeBanner, pity, player);
        const rows = buildActionRows(activeBanner);
        return i.update({ embeds: [embed], components: rows });
      }

      let count = 1;
      if (i.customId.startsWith('wish_pull_10_')) count = 10;
      else if (i.customId.startsWith('wish_pull_1_')) count = 1;

      const wishRes = await performWish(userId, activeBanner, count);
      if (!wishRes.success) {
        return i.reply({
          embeds: [createErrorEmbed('Ngân Lượng Không Đủ', wishRes.message)],
          ephemeral: true
        });
      }

      const embed = buildWishResultEmbed(wishRes, player);
      const rows = buildActionRows(activeBanner);
      return i.update({ embeds: [embed], components: rows });
    }
  });

  collector.on('end', () => {
    msg.edit({ components: [] }).catch(() => {});
  });
}
