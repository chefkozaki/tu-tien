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
const { onComponentCollect, runComponentAction } = require('../utils/componentAction');

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
  const rateUpGuaranteed = bannerKey === 'weapon'
    ? pityData.weapon_rate_up_guaranteed
    : bannerKey === 'pet'
      ? pityData.pet_rate_up_guaranteed
      : bannerKey === 'helper'
        ? pityData.helper_rate_up_guaranteed
        : false;

  const embed = new EmbedBuilder()
    .setColor('#4338ca')
    .setTitle(`🌠 HỆ THỐNG CẦU NGUYỆN • ${banner.name.toUpperCase()}`)
    .setDescription(
      `*${banner.desc}*\n\n` +
      `👤 **Đạo Hữu:** \`${player.dao_hieu || player.username}\` | 💰 **Ngân Lượng:** \`${formatNumber(player.silver)}\` Bạc\n\n` +
      `📜 **Quy Tắc Bảo Hiểm Cầu Nguyện:**\n` +
      `• **5★ Hoàng Kim:** Tỷ lệ cơ bản **0.6%**. Soft pity từ lượt 74, tăng 6 điểm phần trăm mỗi lượt; bảo hiểm cứng ở lượt 90.\n` +
      `• **4★ Tử Sắc:** Tỷ lệ cơ bản **5.1%**. Bảo hiểm 4★+ ở lượt 10; pity 4★ reset khi ra 4★/5★, pity 5★ chỉ reset khi ra 5★.\n` +
      (bannerKey !== 'standard'
        ? `• **Rate-Up 5★:** Nếu banner có vật phẩm 5★ Rate-Up, tỷ lệ là 50/50; nếu trượt, lần 5★ tiếp theo cùng banner được bảo đảm Rate-Up. ${rateUpGuaranteed ? '**Bảo đảm Rate-Up đang kích hoạt!**\n' : '\n'}`
        : '') +
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

  const formatResult = (item, idx) => {
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
    if (item.isRateUp) badge += ' 🎯 **[RATE-UP]**';

    if (item.item_type === 'weapon') {
      typeTag = '⚔️ [Linh Khí]';
      return `**${idx + 1}.** ${starStr} ${typeTag} **${String(item.name).slice(0, 60)}** [Bậc ${item.tier}] (Công +${item.atk}, Thủ +${item.def})${badge}\n` +
             `   └ *${item.effect_name ? `${String(item.effect_name).slice(0, 30)}: ` : ''}${String(item.effect_desc || '').slice(0, 80)}*`;
    } else if (item.item_type === 'pet') {
      typeTag = '🐾 [Linh Thú]';
      return `**${idx + 1}.** ${starStr} ${typeTag} **${String(item.name).slice(0, 60)}** [Hệ ${String(item.element).slice(0, 20)}] (Máu +${item.hp}, Công +${item.atk}, Thủ +${item.def})${badge}\n` +
             `   └ *${String(item.effect_desc || '').slice(0, 80)}*`;
    } else {
      typeTag = '🤝 [Trợ Thủ]';
      const role = item.type_detail === 'combat' ? 'Chiến Đấu' : 'Sinh Hoạt';
      return `**${idx + 1}.** ${starStr} ${typeTag} **${String(item.name).slice(0, 60)}** [${role} - Bậc ${item.tier}]${badge}\n` +
             `   └ *${String(item.effect_desc || '').slice(0, 80)}*`;
    }
  };

  const descriptionPrefix =
    `${bannerTheme}\n\n` +
    `⛩️ **Banner:** \`${banner.name}\` | 💫 **Số lượt:** \`${wishCount} Lần\`\n` +
    `💸 **Chi phí:** \`-${formatNumber(totalCost)}\` Bạc | 🎁 **Hồi đáp:** \`+${formatNumber(totalBonusSilver)}\` Bạc\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎁 **DANH SÁCH VẬT PHẨM ĐẮC ĐƯỢC:**\n\n`;
  const descriptionSuffix =
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📊 **Bảo Hiểm Sau Lần Quay:** 5★: \`${newPity5}/90\` | 4★: \`${newPity4}/10\`\n` +
    (wishResult.bannerType !== 'standard'
      ? `🎯 **Rate-Up 5★ kế tiếp:** ${wishResult.rateUpGuaranteed ? '**Được bảo đảm!**' : '50/50'}\n`
      : '') +
    `💰 **Ngân Lượng Còn Lại:** \`${formatNumber(remainingSilver)}\` Bạc\n` +
    `*(Vật phẩm đã được tự động thêm vào Bách Binh Các, Trân Thú Uyển hoặc Đạo Hữu Các!)*`;
  const maxDescriptionLength = 3500;
  const displayedResults = [];

  for (const [index, item] of results.slice(0, 50).entries()) {
    const candidateResults = [...displayedResults, formatResult(item, index)];
    const omittedCount = results.length - candidateResults.length;
    const omittedNote = omittedCount > 0
      ? `\n\n… và **${omittedCount}** vật phẩm khác đã được thêm vào kho.`
      : '';
    const candidateDescription = descriptionPrefix + candidateResults.join('\n\n') + omittedNote + descriptionSuffix;
    if (candidateDescription.length > maxDescriptionLength) break;
    displayedResults.push(candidateResults[candidateResults.length - 1]);
  }

  const buildDescription = () => {
    const omittedCount = results.length - displayedResults.length;
    const itemsList = displayedResults.join('\n\n') +
      (omittedCount > 0
        ? `\n\n… và **${omittedCount}** vật phẩm khác đã được thêm vào kho.`
        : '');
    return descriptionPrefix + itemsList + descriptionSuffix;
  };
  let description = buildDescription();
  while (description.length > maxDescriptionLength && displayedResults.length > 0) {
    displayedResults.pop();
    description = buildDescription();
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'Có thể bấm nút bên dưới để tiếp tục Cầu Nguyện hoặc đổi Banner!' });
  const featuredItemImage = results.find(item => item.image_url)?.image_url;
  if (isHttpUrl(featuredItemImage)) embed.setThumbnail(featuredItemImage);

  return embed;
}

function buildActionRows(currentBanner) {
  const rowButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wish_pull_1_${currentBanner}`)
      .setLabel(`Cầu Nguyện x1 (2K Bạc)`)
      .setEmoji('🌠')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`wish_pull_10_${currentBanner}`)
      .setLabel(`Cầu Nguyện x10 (18K Bạc)`)
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
        .addStringOption(opt =>
          opt.setName('count')
            .setDescription('Số lần quay: 1, 10 hoặc all')
            .setRequired(true)
            .addChoices(
              { name: '1 Lần (2,000 Bạc)', value: '1' },
              { name: '10 Lần (18,000 Bạc - Chắc chắn có 4★+)', value: '10' },
              { name: 'Toàn bộ lượt có thể quay (all)', value: 'all' }
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
      const countInput = interaction.options.getString('count') || '1';
      const count = /^all$/i.test(countInput) ? 'all' : Number(countInput);
      await interaction.deferReply();
      const wishRes = await performWish(userId, currentBanner, count);

      if (!wishRes.success) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Cầu Nguyện Thất Bại', wishRes.message)],
          components: []
        });
      }

      const embed = buildWishResultEmbed(wishRes, player);
      const rows = buildActionRows(currentBanner);
      const msg = await interaction.editReply({ embeds: [embed], components: rows });
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

  onComponentCollect(collector, async i => {
    if (i.isStringSelectMenu() && i.customId === 'wish_select_banner') {
      const selectedBanner = i.values[0];
      await runComponentAction(
        i,
        async () => {
          const [player, pity] = await Promise.all([getPlayer(userId), getUserPity(userId)]);
          if (!player) throw new Error('Không tìm thấy nhân vật khi đổi Banner.');
          activeBanner = selectedBanner;
          return {
            embeds: [buildBannerEmbed(activeBanner, pity, player)],
            components: buildActionRows(activeBanner)
          };
        },
        () => ({
          embeds: [createErrorEmbed('Không Thể Đổi Banner', 'Không thể tải dữ liệu Banner lúc này. Vui lòng thử lại.')],
          components: []
        }),
        'đổi Banner cầu nguyện'
      );
      return;
    }

    if (i.isButton()) {
      if (i.customId.startsWith('wish_view_pity_')) {
        await runComponentAction(
          i,
          async () => {
            const [player, pity] = await Promise.all([getPlayer(userId), getUserPity(userId)]);
            if (!player) throw new Error('Không tìm thấy nhân vật khi xem bảo hiểm cầu nguyện.');
            return {
              embeds: [buildBannerEmbed(activeBanner, pity, player)],
              components: buildActionRows(activeBanner)
            };
          },
          () => ({
            embeds: [createErrorEmbed('Không Thể Tải Bảo Hiểm', 'Không thể tải dữ liệu cầu nguyện lúc này. Vui lòng thử lại.')],
            components: []
          }),
          'xem bảo hiểm cầu nguyện'
        );
        return;
      }

      let count = 1;
      if (i.customId.startsWith('wish_pull_10_')) count = 10;
      else if (i.customId.startsWith('wish_pull_1_')) count = 1;

      await runComponentAction(
        i,
        async () => {
          const wishRes = await performWish(userId, activeBanner, count);
          if (!wishRes.success) {
            await i.followUp({
              embeds: [createErrorEmbed('Ngân Lượng Không Đủ', wishRes.message)],
              ephemeral: true
            });
            const player = await getPlayer(userId);
            const pity = await getUserPity(userId);
            if (!player) throw new Error('Không tìm thấy nhân vật sau lượt cầu nguyện thất bại.');
            return {
              embeds: [buildBannerEmbed(activeBanner, pity, player)],
              components: buildActionRows(activeBanner)
            };
          }

          const player = await getPlayer(userId);
          if (!player) throw new Error('Không tìm thấy nhân vật sau khi cầu nguyện.');
          return {
            embeds: [buildWishResultEmbed(wishRes, player)],
            components: buildActionRows(activeBanner)
          };
        },
        () => ({
          embeds: [createErrorEmbed('Cầu Nguyện Thất Bại', 'Không thể hoàn tất lượt cầu nguyện lúc này. Vui lòng kiểm tra túi đồ trước khi thử lại.')],
          components: []
        }),
        'cầu nguyện'
      );
    }
  }, 'cầu nguyện');

  collector.on('end', () => {
    msg.edit({ components: [] }).catch(error => {
      console.error('Không thể gỡ nút cầu nguyện khi collector kết thúc:', error);
    });
  });
}
