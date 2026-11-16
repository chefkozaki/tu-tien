const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { 
  getUserPets, 
  getEquippedPets, 
  equipPet, 
  unequipPet, 
  checkResonance, 
  evolvePetWithPet 
} = require('../services/petService');
const { getPlayer } = require('../services/playerService');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pets')
    .setDescription('Quản lý Linh Thú (Tối đa 3 con), kích hoạt Trận Pháp Cộng Hưởng và Tiến Hóa')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Xem toàn bộ Linh Thú trong tay và trạng thái Trận Pháp kích hoạt')
    )
    .addSubcommand(sub =>
      sub.setName('equip')
        .setDescription('Trang bị Linh Thú vào Ô 1, 2 hoặc 3')
        .addIntegerOption(opt =>
          opt.setName('slot')
            .setDescription('Vị trí ô trang bị (1, 2, hoặc 3)')
            .setRequired(true)
            .addChoices(
              { name: 'Ô Số 1', value: 1 },
              { name: 'Ô Số 2', value: 2 },
              { name: 'Ô Số 3', value: 3 }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('evolve')
        .setDescription('Tiến hóa Linh Thú bằng cách nuốt Linh Thú khác')
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

    // 1. Danh Sách Linh Thú
    if (sub === 'list') {
      const pets = await getUserPets(userId);
      const resonance = await checkResonance(userId);

      if (pets.length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Có Linh Thú', 'Đạo hữu chưa có Linh Thú nào! Hãy dùng `/wish` để cầu nguyện Linh Thú (4★ - 5★) hoặc thám hiểm `/event`.')],
          ephemeral: true
        });
      }

      const listText = pets.map((p, i) => 
        `**#${p.id} - ${p.name}** [${p.element}] (${p.star}⭐) ${p.is_equipped ? `👉 *(Đang Trang Bị Ô ${p.slot})*` : ''}\n` +
        `  • HP: +${p.hp} | Công: +${p.atk} | Thủ: +${p.def} | Tốc: +${p.speed}\n` +
        `  • *Hiệu ứng:* ${p.effect_desc}`
      ).join('\n\n');

      const embed = createTuTienEmbed(player.realm_id)
        .setTitle(`🐾 Trân Thú Uyển • Linh Thú Của ${player.dao_hieu || player.username}`)
        .setDescription(
          `• **Trạng Thái Trận Pháp:** ${resonance.active ? `🔥 **${resonance.name}**\n  *(${resonance.desc})*` : `*${resonance.message}*`}\n\n` +
          `📜 **Danh Sách Linh Thú:**\n\n${listText}`
        );

      return interaction.reply({ embeds: [embed] });
    }

    // 2. Trang Bị
    if (sub === 'equip') {
      const targetSlot = interaction.options.getInteger('slot');
      const pets = await getUserPets(userId);

      if (pets.length === 0) {
        return interaction.reply({ embeds: [createErrorEmbed('Không Có Linh Thú', 'Đạo hữu chưa có Linh Thú!')], ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_pet_equip')
        .setPlaceholder(`Chọn Linh Thú muốn trang bị vào Ô ${targetSlot}...`)
        .addOptions(
          pets.slice(0, 25).map(p => ({
            label: `${p.name} [${p.element}] (${p.star}⭐)`,
            description: `Công +${p.atk}, HP +${p.hp} | ${p.effect_desc}`.substring(0, 100),
            value: p.id.toString()
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);
      const msg = await interaction.reply({ content: `Chọn Linh Thú cho **Ô ${targetSlot}**:`, components: [row] });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.customId === 'select_pet_equip') {
          const petId = Number(i.values[0]);
          const res = await equipPet(userId, petId, targetSlot);
          if (!res.success) {
            return i.update({ content: null, embeds: [createErrorEmbed('Thất Bại', res.message)], components: [] });
          }
          return i.update({ content: null, embeds: [createSuccessEmbed('Trang Bị Hoàn Tất', res.message, player.realm_id)], components: [] });
        }
      });
      return;
    }

    // 3. Tiến Hóa Linh Thú
    if (sub === 'evolve') {
      const pets = await getUserPets(userId);
      if (pets.length < 2) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Đủ Linh Thú', 'Cần ít nhất 2 Linh Thú để thực hiện tiến hóa (1 con chính và 1 con hiến tế)!')],
          ephemeral: true
        });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_main_pet')
        .setPlaceholder('Chọn Linh Thú CHÍNH muốn tiến hóa...')
        .addOptions(
          pets.filter(p => p.star < 5).slice(0, 25).map(p => ({
            label: `${p.name} (${p.star}⭐) [${p.element}]`,
            description: `Công +${p.atk}, HP +${p.hp}`,
            value: p.id.toString()
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);
      const msg = await interaction.reply({ content: 'Bước 1: Chọn Linh Thú CHÍNH để tăng Sao:', components: [row] });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      let chosenTargetPetId = null;

      collector.on('collect', async i => {
        if (i.customId === 'select_main_pet') {
          chosenTargetPetId = Number(i.values[0]);
          const sacrificeOptions = pets.filter(p => p.id !== chosenTargetPetId);

          const sacrificeMenu = new StringSelectMenuBuilder()
            .setCustomId('select_sacrifice_pet')
            .setPlaceholder('Chọn Linh Thú HIẾN TẾ (sẽ bị nuốt và biến mất)...')
            .addOptions(
              sacrificeOptions.slice(0, 25).map(p => ({
                label: `Hiến tế: ${p.name} (${p.star}⭐)`,
                description: `ID: #${p.id} - HP +${p.hp}, Công +${p.atk}`,
                value: p.id.toString()
              }))
            );

          const sacrificeRow = new ActionRowBuilder().addComponents(sacrificeMenu);
          return i.update({ content: 'Bước 2: Chọn Linh Thú HIẾN TẾ để nuốt:', components: [sacrificeRow] });
        }

        if (i.customId === 'select_sacrifice_pet') {
          const sacrificePetId = Number(i.values[0]);
          const res = await evolvePetWithPet(userId, chosenTargetPetId, sacrificePetId);
          if (!res.success) {
            return i.update({ content: null, embeds: [createErrorEmbed('Tiến Hóa Thất Bại', res.message)], components: [] });
          }
          return i.update({ content: null, embeds: [createSuccessEmbed('Tiến Hóa Rực Rỡ', res.message, player.realm_id)], components: [] });
        }
      });
    }
  }
};
