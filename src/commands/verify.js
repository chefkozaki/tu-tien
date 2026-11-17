const { SlashCommandBuilder } = require('discord.js');
const { whitelistGuild } = require('../services/guildWhitelistService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Xác minh máy chủ để cho phép sử dụng bot'),

  async execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID?.trim();
    if (!ownerId || !/^\d{17,20}$/.test(ownerId)) {
      return interaction.reply({
        content: 'Bot chưa được cấu hình BOT_OWNER_ID hợp lệ trong biến môi trường.',
        ephemeral: true
      });
    }

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: 'Chỉ chủ bot mới có thể xác minh máy chủ.',
        ephemeral: true
      });
    }

    if (!interaction.guildId) {
      return interaction.reply({
        content: 'Lệnh xác minh chỉ dùng được trong máy chủ Discord.',
        ephemeral: true
      });
    }

    const added = await whitelistGuild(interaction.guildId, interaction.user.id);
    return interaction.reply({
      content: added
        ? `Đã xác minh máy chủ **${interaction.guild?.name || interaction.guildId}**. Máy chủ này hiện được phép sử dụng bot.`
        : 'Máy chủ này đã được xác minh và nằm trong whitelist.',
      ephemeral: true
    });
  }
};
