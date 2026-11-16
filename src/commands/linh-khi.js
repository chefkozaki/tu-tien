const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { 
  getUserWeapons, 
  equipWeapon, 
  setNatalWeapon, 
  devourWeapon 
} = require('../services/weaponService');
const { getPlayer } = require('../services/playerService');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');

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

      const listText = weapons.map(w => 
        `**#${w.id} - ${w.name}** [Bậc ${w.tier}] ${w.is_natal ? '🌟 *(Bản Mệnh Khí)*' : ''} ${w.is_equipped ? '👉 *(Đang Trang Bị)*' : ''}\n` +
        `  • Công: +${w.atk} | Thủ: +${w.def} | Điểm Thôn Phệ: ${w.devour_exp || 0}\n` +
        `  • *${w.effect_name}:* ${w.effect_desc}`
      ).join('\n\n');

      const embed = createTuTienEmbed(player.realm_id)
        .setTitle(`⚔️ Bách Binh Các • Linh Khí Của ${player.dao_hieu || player.username}`)
        .setDescription(
          `*Bản Mệnh Linh Khí tự động tăng sức mạnh theo cảnh giới của chủ nhân và thôn phệ các vũ khí khác để tăng bậc!*\n\n` +
          listText
        );

      return interaction.reply({ embeds: [embed] });
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

      collector.on('collect', async i => {
        if (i.customId === 'select_weapon_equip') {
          const wId = Number(i.values[0]);
          const res = await equipWeapon(userId, wId);
          return i.update({ content: null, embeds: [createSuccessEmbed('Trang Bị Thành Công', res.message, player.realm_id)], components: [] });
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

      collector.on('collect', async i => {
        if (i.customId === 'select_natal_weapon') {
          const wId = Number(i.values[0]);
          const res = await setNatalWeapon(userId, wId);
          return i.update({ content: null, embeds: [createSuccessEmbed('Bản Mệnh Khí Đã Thành', res.message, player.realm_id)], components: [] });
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

      collector.on('collect', async i => {
        if (i.customId === 'select_food_weapon') {
          const foodId = Number(i.values[0]);
          const res = await devourWeapon(userId, natal.id, foodId);
          if (!res.success) {
            return i.update({ content: null, embeds: [createErrorEmbed('Thôn Phệ Thất Bại', res.message)], components: [] });
          }
          return i.update({ content: null, embeds: [createSuccessEmbed('Thôn Phệ Thành Công', res.message, player.realm_id)], components: [] });
        }
      });
    }
  }
};
