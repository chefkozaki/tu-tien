const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const { 
  getUserWeapons, 
  equipWeapon, 
  setNatalWeapon, 
  devourWeapon 
} = require('../services/weaponService');
const { getPlayer } = require('../services/playerService');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { groupDuplicateItems } = require('../utils/groupDuplicateItems');
const { onComponentCollect, runComponentAction } = require('../utils/componentAction');

function createWeaponListPages(player, weapons) {
  const weaponGroups = groupDuplicateItems(weapons, [
    'name', 'tier', 'atk', 'def', 'effect_name', 'effect_desc', 'image_url', 'devour_exp'
  ]);
  const entries = weaponGroups.map(({ item: weapon, items }) => {
    const displayedIds = items.slice(0, 10).map(item => `#${item.id}`);
    const moreIds = items.length - displayedIds.length;
    const ids = `${displayedIds.join(', ')}${moreIds > 0 ? `, +${moreIds} nữa` : ''}`;
    const natalCount = items.filter(item => item.is_natal).length;
    const equippedCount = items.filter(item => item.is_equipped).length;
    const effectName = String(weapon.effect_name || 'Hiệu ứng').slice(0, 100);
    const effectDescription = String(weapon.effect_desc || 'Chưa có mô tả').slice(0, 300);
    const extra = `${natalCount ? ` 🌟 *(Bản Mệnh: ${natalCount})*` : ''}` +
      `${equippedCount ? ` 👉 *(Đang Trang Bị: ${equippedCount})*` : ''}`;

    return `**${ids} - ${weapon.name}** [Bậc ${weapon.tier}] ×${items.length}${extra}\n` +
      `  • Công: +${weapon.atk} | Thủ: +${weapon.def} | Điểm Thôn Phệ: ${weapon.devour_exp || 0}\n` +
      `  • *${effectName}:* ${effectDescription}`;
  });

  const intro = '*Bản Mệnh Linh Khí tự động tăng sức mạnh theo cảnh giới chủ nhân; có thể thôn phệ vũ khí khác để tăng bậc!*\n\n';
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
      .setTitle(`⚔️ Bách Binh Các • Linh Khí Của ${player.dao_hieu || player.username}`)
      .setDescription(description);
    if (pages.length > 1) {
      embed.setFooter({ text: `Trang ${index + 1}/${pages.length} • ${weapons.length} Linh Khí` });
    }
    return embed;
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weapons')
    .setDescription('Quản lý Linh Khí, tế luyện Bản Mệnh Linh Khí và Thôn Phệ tăng cấp')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Xem toàn bộ Linh Khí và Bản Mệnh Khí hiện tại')
    )
    .addSubcommand(sub =>
      sub.setName('equip')
        .setDescription('Trang bị Linh Khí làm vũ khí chính xuất chiến')
    )
    .addSubcommand(sub =>
      sub.setName('bond')
        .setDescription('Tế luyện Linh Khí thành Bản Mệnh Khí (Mạnh lên theo cảnh giới)')
    )
    .addSubcommand(sub =>
      sub.setName('devour')
        .setDescription('Cho Bản Mệnh Linh Khí nuốt linh khí rác khác để tăng cấp')
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
    const weapons = await getUserWeapons(userId);

    // 1. Danh Sách
    if (sub === 'list') {
      if (weapons.length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Có Linh Khí', 'Đạo hữu chưa có Linh Khí nào! Hãy dùng `/wish` để cầu nguyện Thần Binh Vạn Khí (4★ - 5★) hoặc `/base forge` để rèn vũ khí.')],
          ephemeral: true
        });
      }

      const embeds = createWeaponListPages(player, weapons);
      if (embeds.length === 1) {
        return interaction.reply({ embeds });
      }

      let pageIndex = 0;
      const createControls = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('weapons_list_previous')
          .setLabel('Trước')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId('weapons_list_next')
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
        pageIndex += component.customId === 'weapons_list_next' ? 1 : -1;
        pageIndex = Math.max(0, Math.min(pageIndex, embeds.length - 1));
        await component.update({
          embeds: [embeds[pageIndex]],
          components: [createControls()]
        });
      }, 'xem danh sách Linh Khí');

      collector.on('end', () => {
        message.edit({ components: [] }).catch(error => {
          console.error('Không thể dọn nút phân trang danh sách Linh Khí:', error);
        });
      });
      return;
    }

    // 2. Trang Bị
    if (sub === 'equip') {
      if (weapons.length === 0) {
        return interaction.reply({ embeds: [createErrorEmbed('Trống', 'Đạo hữu không có Linh Khí nào!')], ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_weapon_equip')
        .setPlaceholder('Chọn Linh Khí muốn trang bị...')
        .addOptions(
          weapons.slice(0, 25).map(w => ({
            label: `${w.name} [Bậc ${w.tier}]`,
            description: `Công +${w.atk}, Thủ +${w.def}`,
            value: w.id.toString()
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);
      const msg = await interaction.reply({ content: 'Chọn Linh Khí xuất chiến:', components: [row] });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      onComponentCollect(collector, async i => {
        if (i.customId === 'select_weapon_equip') {
          collector.stop();
          const wId = Number(i.values[0]);
          await runComponentAction(
            i,
            async () => {
              const res = await equipWeapon(userId, wId);
              return {
                content: null,
                embeds: [res.success
                  ? createSuccessEmbed('Trang Bị Thành Công', res.message, player.realm_id)
                  : createErrorEmbed('Trang Bị Thất Bại', res.message)],
                components: []
              };
            },
            () => ({
              embeds: [createErrorEmbed('Trang Bị Thất Bại', 'Không thể cập nhật Linh Khí lúc này. Vui lòng thử lại.')],
              components: []
            }),
            'trang bị Linh Khí'
          );
        }
      });
      return;
    }

    // 3. Phong Làm Bản Mệnh
    if (sub === 'bond') {
      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_natal_weapon')
        .setPlaceholder('Chọn Linh Khí để tế luyện Bản Mệnh...')
        .addOptions(
          weapons.slice(0, 25).map(w => ({
            label: `${w.name} [Bậc ${w.tier}]`,
            description: `Công +${w.atk}, Thủ +${w.def}`,
            value: w.id.toString()
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);
      const msg = await interaction.reply({ content: 'Chọn vũ khí làm **Bản Mệnh Linh Khí**:', components: [row] });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      onComponentCollect(collector, async i => {
        if (i.customId === 'select_natal_weapon') {
          collector.stop();
          const wId = Number(i.values[0]);
          await runComponentAction(
            i,
            async () => {
              const res = await setNatalWeapon(userId, wId);
              return {
                content: null,
                embeds: [res.success
                  ? createSuccessEmbed('Bản Mệnh Khí Đã Thành', res.message, player.realm_id)
                  : createErrorEmbed('Tế Luyện Thất Bại', res.message)],
                components: []
              };
            },
            () => ({
              embeds: [createErrorEmbed('Tế Luyện Thất Bại', 'Không thể tế luyện Linh Khí lúc này. Vui lòng thử lại.')],
              components: []
            }),
            'tế luyện Bản Mệnh Khí'
          );
        }
      });
      return;
    }

    // 4. Thôn Phệ
    if (sub === 'devour') {
      const natal = weapons.find(w => w.is_natal === 1);
      if (!natal) {
        return interaction.reply({
          embeds: [createErrorEmbed('Chưa Có Bản Mệnh Khí', 'Đạo hữu cần phong 1 vũ khí làm Bản Mệnh trước (`/weapons bond`)!')],
          ephemeral: true
        });
      }

      const foodWeapons = weapons.filter(w => w.id !== natal.id && w.is_equipped !== 1);
      if (foodWeapons.length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Có Linh Khí Dư Thừa', 'Cần có các linh khí khác không trang bị để làm nguyên liệu cho Bản Mệnh Khí nuốt!')],
          ephemeral: true
        });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_food_weapon')
        .setPlaceholder(`Chọn vũ khí để [${natal.name}] thôn phệ...`)
        .addOptions(
          foodWeapons.slice(0, 25).map(w => ({
            label: `Nuốt: ${w.name} [Bậc ${w.tier}]`,
            description: `Công +${w.atk}, Thủ +${w.def} (Sẽ biến mất)`,
            value: w.id.toString()
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);
      const msg = await interaction.reply({ content: `Cho Bản Mệnh Khí **${natal.name}** thôn phệ:`, components: [row] });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      onComponentCollect(collector, async i => {
        if (i.customId === 'select_food_weapon') {
          collector.stop();
          const foodId = Number(i.values[0]);
          await runComponentAction(
            i,
            async () => {
              const res = await devourWeapon(userId, natal.id, foodId);
              return {
                content: null,
                embeds: [res.success
                  ? createSuccessEmbed('Thôn Phệ Thành Công', res.message, player.realm_id)
                  : createErrorEmbed('Thôn Phệ Thất Bại', res.message)],
                components: []
              };
            },
            () => ({
              embeds: [createErrorEmbed('Thôn Phệ Thất Bại', 'Không thể thôn phệ Linh Khí lúc này. Vui lòng kiểm tra túi đồ trước khi thử lại.')],
              components: []
            }),
            'thôn phệ Linh Khí'
          );
        }
      });
    }
  }
};
