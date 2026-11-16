const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { getPrefix, setPrefix } = require('../services/prefixService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('View or change the server command prefix')
    .addStringOption(option =>
      option.setName('value')
        .setDescription('New prefix (1-5 characters, no spaces; not aprefix)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({ content: 'Prefix chỉ có thể được thiết lập trong máy chủ Discord.', ephemeral: true });
    }

    const prefix = interaction.options.getString('value');
    if (!prefix) {
      const currentPrefix = await getPrefix(interaction.guildId);
      return interaction.reply({
        content: `Prefix hiện tại là \`${currentPrefix}\`. Đổi bằng \`/prefix value:<prefix>\` hoặc \`${currentPrefix}prefix <prefix>\`.`,
        ephemeral: true
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Bạn cần quyền Quản lý Máy chủ để đổi prefix.', ephemeral: true });
    }

    try {
      const newPrefix = await setPrefix(interaction.guildId, prefix);
      return interaction.reply({ content: `Đã đổi prefix thành \`${newPrefix}\`.`, ephemeral: true });
    } catch (error) {
      return interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
