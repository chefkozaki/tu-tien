const { SlashCommandBuilder } = require('discord.js');
const { redeemGiftCode } = require('../services/giftCodeService');
const { createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { getPlayer } = require('../services/playerService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('code')
    .setDescription('Đổi mã quà tặng')
    .addStringOption(option =>
      option.setName('code')
        .setDescription('Mã quà tặng')
        .setMaxLength(64)
        .setRequired(true)
    ),

  async execute(interaction) {
    const player = await getPlayer(interaction.user.id);
    if (!player) {
      return interaction.reply({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Hãy dùng `/start` để tạo nhân vật trước khi đổi mã.')],
        ephemeral: true
      });
    }

    const result = await redeemGiftCode(interaction.user.id, interaction.options.getString('code'));
    if (!result.success) {
      return interaction.reply({
        embeds: [createErrorEmbed('Đổi Mã Thất Bại', result.message)],
        ephemeral: true
      });
    }

    return interaction.reply({
      embeds: [createSuccessEmbed(
        'Đổi Mã Quà Tặng Thành Công',
        `Mã \`${result.code}\` đã được đổi.\nNhận **${result.amount.toLocaleString()}x ${result.itemName}**.`,
        player.realm_id
      )],
      ephemeral: true
    });
  }
};
