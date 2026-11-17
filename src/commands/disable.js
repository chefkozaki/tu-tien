const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { toggleCommandDisabled } = require('../services/disabledCommandService');

function resolveCommandName(input, commands) {
  const name = String(input || '').trim().replace(/^\/+/, '').split(/\s+/)[0].toLowerCase();
  if (!name) throw new Error('Hãy nhập tên lệnh cần tắt, ví dụ `adisable wish`.');

  const command = commands.get(name);
  if (!command) throw new Error(`Không tìm thấy lệnh \`${name}\`.`);
  if (name === 'disable') throw new Error('Không thể tự tắt lệnh `disable`.');
  return name;
}

async function executeAdisable(interaction, commandInput) {
  if (!interaction.guildId || !interaction.channelId) {
    return interaction.reply({
      content: 'Lệnh này chỉ dùng được trong một kênh của máy chủ.',
      ephemeral: true
    });
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: 'Bạn cần quyền Quản lý Máy chủ để bật/tắt lệnh trong kênh.',
      ephemeral: true
    });
  }

  let commandName;
  try {
    commandName = resolveCommandName(commandInput, interaction.client.commands);
  } catch (error) {
    return interaction.reply({ content: error.message, ephemeral: true });
  }

  try {
    const isDisabled = await toggleCommandDisabled(
      interaction.guildId,
      interaction.channelId,
      commandName
    );
    const action = isDisabled ? 'đã tắt' : 'đã bật lại';
    return interaction.reply({
      content: `Lệnh \`/${commandName}\` ${action} trong kênh này${isDisabled ? ', bao gồm tất cả lệnh con' : ''}.`,
      ephemeral: true
    });
  } catch (error) {
    console.error(`Không thể cập nhật trạng thái lệnh ${commandName}:`, error);
    return interaction.reply({
      content: 'Không thể cập nhật trạng thái lệnh trong kênh này. Vui lòng thử lại sau.',
      ephemeral: true
    });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disable')
    .setDescription('Bật/tắt một lệnh trong kênh hiện tại (cần quyền Quản lý Máy chủ)')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Tên lệnh; tắt lệnh gốc cũng tắt mọi lệnh con')
        .setRequired(true)
    ),

  async execute(interaction) {
    return executeAdisable(interaction, interaction.options.getString('command'));
  },

  executeAdisable
};
