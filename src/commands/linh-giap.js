const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const {
  getUserArmors,
  equipArmor,
  setNatalArmor,
  devourArmor,
  devourAllArmors
} = require('../services/armorService');
const { getPlayer } = require('../services/playerService');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { groupDuplicateItems } = require('../utils/groupDuplicateItems');
const { onComponentCollect, runComponentAction } = require('../utils/componentAction');

function createArmorListPages(player, armors) {
  const armorGroups = groupDuplicateItems(armors, [
    'name', 'tier', 'hp', 'def', 'dmg_reduction', 'effect_name', 'effect_desc', 'image_url', 'devour_exp'
  ]);
  const entries = armorGroups.map(({ item: armor, items }) => {
    const displayedIds = items.slice(0, 10).map(item => `#${item.id}`);
    const moreIds = items.length - displayedIds.length;
    const ids = `${displayedIds.join(', ')}${moreIds > 0 ? `, +${moreIds} nữa` : ''}`;
    const natalCount = items.filter(item => item.is_natal).length;
    const equippedCount = items.filter(item => item.is_equipped).length;
    const effectName = String(armor.effect_name || 'Hộ Giáp').slice(0, 100);
    const effectDescription = String(armor.effect_desc || 'Chưa có mô tả').slice(0, 300);
    const dmgRedPct = (Number(armor.dmg_reduction || 0) * 100).toFixed(1);
    const extra = `${natalCount ? ` 🌟 *(Bản Mệnh: ${natalCount})*` : ''}` +
      `${equippedCount ? ` 👉 *(Đang Trang Bị: ${equippedCount})*` : ''}`;

    return `**${ids} - ${armor.name}** [Bậc ${armor.tier}] ×${items.length}${extra}\n` +
      `  • HP: +${Number(armor.hp || 0).toLocaleString('vi-VN')} | Thủ: +${Number(armor.def || 0).toLocaleString('vi-VN')} | Giảm ST: **${dmgRedPct}%** | Điểm Thôn Phệ: ${armor.devour_exp || 0}\n` +
      `  • *${effectName}:* ${effectDescription}`;
  });

  const intro = '*Bản Mệnh Linh Giáp tự động tăng HP & Thủ theo cảnh giới chủ nhân; có thể thôn phệ linh giáp khác để tăng bậc và chỉ số Giảm Sát Thương!*\n\n';
  const pageSize = 3500;
  const pages = [];
  let page = intro;

  for (const entry of entries) {
    const separator = page === intro ? '' : '\n\n';
    if (page.length + separator.length + entry.length > pageSize && page !== intro) {
      pages.push(page);
      page = '';
    }

    const nextSeparator = page ? '\n\n' : '';
    page += `${nextSeparator}${entry}`;
  }
  if (page) pages.push(page);

  return pages.map((description, index) => {
    const embed = createTuTienEmbed(player.realm_id)
      .setTitle(`🛡️ Huyền Giáp Các • Linh Giáp Của ${player.dao_hieu || player.username}`)
      .setDescription(description);
    if (pages.length > 1) {
      embed.setFooter({ text: `Trang ${index + 1}/${pages.length} • ${armors.length} Linh Giáp` });
    }
    return embed;
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('armor')
    .setDescription('Quản lý Linh Giáp (HP + Thủ + Giảm Sát Thương), Bản Mệnh Giáp và Thôn Phệ tăng cấp')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Xem toàn bộ Linh Giáp và Bản Mệnh Giáp hiện tại')
    )
    .addSubcommand(sub =>
      sub.setName('equip')
        .setDescription('Trang bị Linh Giáp hộ thể xuất chiến')
    )
    .addSubcommand(sub =>
      sub.setName('bond')
        .setDescription('Tế luyện Linh Giáp thành Bản Mệnh Giáp (Mạnh lên theo cảnh giới)')
    )
    .addSubcommand(sub =>
      sub.setName('devour')
        .setDescription('Cho Bản Mệnh Linh Giáp thôn phệ linh giáp rác khác để tăng chỉ số')
        .addBooleanOption(opt =>
          opt.setName('all')
            .setDescription('Thôn phệ toàn bộ Linh Giáp dư thừa không trang bị')
            .setRequired(false)
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
    const armors = await getUserArmors(userId);

    // 1. Danh Sách
    if (sub === 'list') {
      if (armors.length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Có Linh Giáp', 'Đạo hữu chưa có Linh Giáp nào! Hãy dùng `/wish pull banner:armor` để cầu nguyện **Huyền Giáp Kim Thân (3★ - 5★)**.')],
          ephemeral: true
        });
      }

      const embeds = createArmorListPages(player, armors);
      if (embeds.length === 1) {
        return interaction.reply({ embeds });
      }

      let pageIndex = 0;
      const createControls = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('armor_list_previous')
          .setLabel('Trước')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId('armor_list_next')
          .setLabel('Tiếp')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === embeds.length - 1)
      );

      await interaction.reply({
        embeds: [embeds[pageIndex]],
        components: [createControls()]
      });
      const message = await interaction.fetchReply();
      const collector = message.createMessageComponentCollector({
        filter: component => component.user.id === userId,
        time: 120000
      });

      onComponentCollect(collector, async component => {
        pageIndex += component.customId === 'armor_list_next' ? 1 : -1;
        pageIndex = Math.max(0, Math.min(pageIndex, embeds.length - 1));
        await component.update({
          embeds: [embeds[pageIndex]],
          components: [createControls()]
        });
      }, 'xem danh sách Linh Giáp');

      collector.on('end', () => {
        message.edit({ components: [] }).catch(error => {
          console.error('Không thể dọn nút phân trang danh sách Linh Giáp:', error);
        });
      });
      return;
    }

    // 2. Trang Bị
    if (sub === 'equip') {
      if (armors.length === 0) {
        return interaction.reply({ embeds: [createErrorEmbed('Trống', 'Đạo hữu không có Linh Giáp nào!')], ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_armor_equip')
        .setPlaceholder('Chọn Linh Giáp muốn trang bị...')
        .addOptions(
          armors.slice(0, 25).map(a => ({
            label: `${a.name} [Bậc ${a.tier}]`.slice(0, 100),
            description: `HP +${a.hp}, Thủ +${a.def}, Giảm ST ${(Number(a.dmg_reduction || 0) * 100).toFixed(1)}%`.slice(0, 100),
            value: a.id.toString()
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);
      const msg = await interaction.reply({ content: 'Chọn Linh Giáp hộ thể xuất chiến:', components: [row] });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      onComponentCollect(collector, async i => {
        if (i.customId === 'select_armor_equip') {
          collector.stop();
          const aId = Number(i.values[0]);
          await runComponentAction(
            i,
            async () => {
              const res = await equipArmor(userId, aId);
              return {
                content: null,
                embeds: [res.success
                  ? createSuccessEmbed('Trang Bị Linh Giáp Thành Công', res.message, player.realm_id)
                  : createErrorEmbed('Trang Bị Thất Bại', res.message)],
                components: []
              };
            },
            () => ({
              embeds: [createErrorEmbed('Trang Bị Thất Bại', 'Không thể cập nhật Linh Giáp lúc này. Vui lòng thử lại.')],
              components: []
            }),
            'trang bị Linh Giáp'
          );
        }
      });
      return;
    }

    // 3. Phong Làm Bản Mệnh
    if (sub === 'bond') {
      if (armors.length === 0) {
        return interaction.reply({ embeds: [createErrorEmbed('Trống', 'Đạo hữu không có Linh Giáp nào để tế luyện!')], ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_natal_armor')
        .setPlaceholder('Chọn Linh Giáp để tế luyện Bản Mệnh...')
        .addOptions(
          armors.slice(0, 25).map(a => ({
            label: `${a.name} [Bậc ${a.tier}]`.slice(0, 100),
            description: `HP +${a.hp}, Thủ +${a.def}, Giảm ST ${(Number(a.dmg_reduction || 0) * 100).toFixed(1)}%`.slice(0, 100),
            value: a.id.toString()
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);
      const msg = await interaction.reply({ content: 'Chọn linh giáp làm **Bản Mệnh Linh Giáp**:', components: [row] });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      onComponentCollect(collector, async i => {
        if (i.customId === 'select_natal_armor') {
          collector.stop();
          const aId = Number(i.values[0]);
          await runComponentAction(
            i,
            async () => {
              const res = await setNatalArmor(userId, aId);
              return {
                content: null,
                embeds: [res.success
                  ? createSuccessEmbed('Bản Mệnh Linh Giáp Đã Thành', res.message, player.realm_id)
                  : createErrorEmbed('Tế Luyện Thất Bại', res.message)],
                components: []
              };
            },
            () => ({
              embeds: [createErrorEmbed('Tế Luyện Thất Bại', 'Không thể tế luyện Linh Giáp lúc này. Vui lòng thử lại.')],
              components: []
            }),
            'tế luyện Bản Mệnh Linh Giáp'
          );
        }
      });
      return;
    }

    // 4. Thôn Phệ
    if (sub === 'devour') {
      const devourAll = interaction.options.getBoolean('all') || false;
      if (devourAll) {
        await interaction.deferReply({ ephemeral: true });
        const res = await devourAllArmors(userId);
        return interaction.editReply({
          embeds: [res.success
            ? createSuccessEmbed('Thôn Phệ Hàng Loạt Thành Công', res.message, player.realm_id)
            : createErrorEmbed('Thôn Phệ Thất Bại', res.message)]
        });
      }

      const natal = armors.find(a => Number(a.is_natal) === 1);
      if (!natal) {
        return interaction.reply({
          embeds: [createErrorEmbed('Chưa Có Bản Mệnh Giáp', 'Hãy dùng `/armor bond` để chọn Bản Mệnh Linh Giáp trước!')],
          ephemeral: true
        });
      }

      const foods = armors.filter(a => a.id !== natal.id && Number(a.is_natal) !== 1 && Number(a.is_equipped) !== 1);
      if (foods.length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Có Nguyên Liệu', 'Không có Linh Giáp dư thừa nào (không trang bị) để thôn phệ!')],
          ephemeral: true
        });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_devour_armor')
        .setPlaceholder('Chọn Linh Giáp rác làm nguyên liệu thôn phệ...')
        .addOptions(
          foods.slice(0, 25).map(a => ({
            label: `#${a.id} ${a.name} [Bậc ${a.tier}]`.slice(0, 100),
            description: `HP +${a.hp}, Thủ +${a.def}, Giảm ST ${(Number(a.dmg_reduction || 0) * 100).toFixed(1)}%`.slice(0, 100),
            value: a.id.toString()
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);
      const msg = await interaction.reply({
        content: `Chọn Linh Giáp để **${natal.name}** thôn phệ:`,
        components: [row]
      });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      onComponentCollect(collector, async i => {
        if (i.customId === 'select_devour_armor') {
          collector.stop();
          const foodId = Number(i.values[0]);
          await runComponentAction(
            i,
            async () => {
              const res = await devourArmor(userId, natal.id, foodId);
              return {
                content: null,
                embeds: [res.success
                  ? createSuccessEmbed('Thôn Phệ Thành Công', res.message, player.realm_id)
                  : createErrorEmbed('Thôn Phệ Thất Bại', res.message)],
                components: []
              };
            },
            () => ({
              embeds: [createErrorEmbed('Thôn Phệ Thất Bại', 'Không thể thôn phệ Linh Giáp lúc này. Vui lòng thử lại.')],
              components: []
            }),
            'thôn phệ Linh Giáp'
          );
        }
      });
    }
  }
};
