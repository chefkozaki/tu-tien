const { Client, GatewayIntentBits, Collection, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./src/config/database');
const { createErrorEmbed, createSuccessEmbed, createTuTienEmbed } = require('./src/utils/embedBuilder');
const { getPlayer, addXp } = require('./src/services/playerService');
const { claimTuLinhTran } = require('./src/services/dongPhuService');
const { REALMS } = require('./src/config/constants');
const { formatNumber, getRealmDisplay } = require('./src/utils/formatters');
const { getPrefix, setPrefix } = require('./src/services/prefixService');
const { executePrefixCommand, tokenize } = require('./src/utils/prefixCommand');
const { setBossAnnouncementClient } = require('./src/services/bossAnnouncementService');
const { acquireCommandCooldown, acquireDuelCooldown } = require('./src/utils/commandCooldown');
const { isCommandDisabled } = require('./src/services/disabledCommandService');
const { isGuildWhitelisted } = require('./src/services/guildWhitelistService');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
setBossAnnouncementClient(client);

client.commands = new Collection();

// Load Commands
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[CẢNH BÁO] Lệnh tại ${filePath} thiếu thuộc tính "data" hoặc "execute".`);
  }
}

// Client Ready
client.once('ready', async (c) => {
  console.log(`🤖 Bot Tu Tiên đã đăng nhập thành công với tên: ${c.user.tag}`);
  console.log(`🌐 Hoạt động trên ${c.guilds.cache.size} máy chủ.`);
  
  // Set Presence
  client.user.setActivity('con đường Tu Tiên Nghịch Thiên | /help', { type: 0 });

  // Init Turso Database
  try {
    await initDatabase();
  } catch (err) {
    console.error('❌ Lỗi khởi tạo cơ sở dữ liệu Turso:', err);
  }

});

// Interaction Create Handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'verify') {
    let isWhitelisted = false;
    try {
      isWhitelisted = await isGuildWhitelisted(interaction.guildId);
    } catch (error) {
      console.error(`Không thể kiểm tra whitelist máy chủ ${interaction.guildId || 'DM'}:`, error);
      if (interaction.isRepliable()) {
        await interaction.reply({
          content: 'Không thể xác minh quyền sử dụng bot lúc này. Vui lòng thử lại sau.',
          ephemeral: true
        }).catch(replyError => {
          console.error('Không thể gửi thông báo lỗi whitelist:', replyError);
        });
      }
      return;
    }

    if (!isWhitelisted) {
      if (interaction.isRepliable()) {
        await interaction.reply({
          content: interaction.guildId
            ? 'Máy chủ này chưa được xác minh để sử dụng bot. Chủ bot cần chạy `/verify` hoặc `averify` trong máy chủ.'
            : 'Bot chỉ hoạt động trong máy chủ Discord đã được xác minh.',
          ephemeral: true
        });
      }
      return;
    }
  }

  // 1. Xử lý Slash Command
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`Không tìm thấy lệnh: ${interaction.commandName}`);
      return;
    }

    if (interaction.commandName !== 'disable' &&
      await isCommandDisabled(interaction.guildId, interaction.channelId, interaction.commandName)) {
      return interaction.reply({
        content: `Lệnh \`/${interaction.commandName}\` đã bị tắt trong kênh này.`,
        ephemeral: true
      });
    }

    const cooldown = interaction.commandName === 'duel'
      ? acquireDuelCooldown(interaction.user.id)
      : { type: 'command', remaining: acquireCommandCooldown(interaction.user.id) };
    if (cooldown.remaining > 0) {
      try {
        return await interaction.reply({
          content: cooldown.type === 'duel'
            ? `Bạn cần chờ ${Math.ceil(cooldown.remaining / 1000)} giây trước khi đấu pháp lần tiếp theo.`
            : `Bạn cần đợi ${Math.ceil(cooldown.remaining / 1000)} giây trước khi dùng lệnh tiếp theo.`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Không thể phản hồi cooldown lệnh slash:', error);
        return;
      }
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Lỗi thực thi lệnh ${interaction.commandName}:`, error);
      const errorEmbed = createErrorEmbed(
        'Đạo Tâm Gặp Trở Ngại!',
        'Đã xảy ra thiên kiếp hỗn loạn trong lúc thi triển pháp quyết! Vui lòng thử lại sau.'
      );
      if (interaction.replied || interaction.deferred) {
        try {
          await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } catch (replyError) {
          console.error('Không thể gửi thông báo lỗi lệnh slash:', replyError);
        }
      } else {
        try {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        } catch (replyError) {
          console.error('Không thể gửi thông báo lỗi lệnh slash:', replyError);
        }
      }
    }
    return;
  }

  // 2. Xử lý Quick Buttons từ Embed Hồ Sơ Tu Vi
  if (interaction.isButton() && [
    'btn_cultivate',
    'btn_breakthrough',
    'btn_claim_dongphu'
  ].includes(interaction.customId)) {
    const userId = interaction.user.id;
    try {
      await interaction.deferReply({ ephemeral: true });

      if (interaction.customId === 'btn_breakthrough') {
        const dotPhaCmd = client.commands.get('break');
        if (!dotPhaCmd) throw new Error('Không tìm thấy lệnh đột phá.');
        return await dotPhaCmd.execute(interaction);
      }

      const player = await getPlayer(userId);
      if (!player) {
        return await interaction.editReply({
          embeds: [createErrorEmbed('Chưa Tu Tiên', 'Đạo hữu hãy dùng `/start` trước!')]
        });
      }

      if (interaction.customId === 'btn_cultivate') {
      const realm = REALMS[player.realm_id] || REALMS[0];
      const baseXp = Math.floor(realm.minXp * 0.35) + Math.floor(Math.random() * (realm.minXp * 0.25));
      const res = await addXp(userId, baseXp);

      const embed = createTuTienEmbed(player.realm_id)
        .setTitle('🧘 Đả Tọa Nhập Định')
        .setDescription(
          `Đạo hữu vận chuyển công pháp, hấp thụ thiên địa linh khí!\n\n` +
          `• **Linh Lực Thu Được:** \`+${formatNumber(res.addedXp)}\` XP\n` +
          `• **Cảnh Giới:** \`${getRealmDisplay(res.player.realm_id, res.player.level)}\``
        );

      if (res.leveledUp) {
        embed.addFields({ name: '🎉 ĐỘT PHÁ TIỂU CẢNH GIỚI!', value: `Đã thăng lên **Cấp ${res.player.level}**!` });
      }
      if (res.breakthroughReady) {
        embed.addFields({ name: '⚡ ĐẠT ĐỈNH PHONG!', value: 'Dùng lệnh `/break` để độ kiếp tiến lên cảnh giới kế tiếp!' });
      }

        return await interaction.editReply({ embeds: [embed] });
      }

      if (interaction.customId === 'btn_claim_dongphu') {
        const res = await claimTuLinhTran(userId);
        if (!res.success) {
          return await interaction.editReply({ embeds: [createErrorEmbed('Chưa Thể Thu Hoạch', res.message)] });
        }

        const embed = createSuccessEmbed(
          '🌾 Thu Hoạch Tụ Linh Trận',
          `Động Phủ đã tích lũy trong **${res.elapsedMinutes} phút** qua:\n\n` +
          `• **Linh Lực:** \`+${formatNumber(res.xpGained)}\` XP\n` +
          `• **Ngân Lượng:** \`+${formatNumber(res.silverGained)}\` Bạc\n` +
          (res.helperName ? `• *Trợ Thủ Sinh Hoạt [${res.helperName}] tăng thêm +30% sản lượng!*\n` : ''),
          player.realm_id
        );

        return await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error(`Lỗi xử lý nút hồ sơ ${interaction.customId}:`, error);
      const errorEmbed = createErrorEmbed(
        'Đạo Tâm Gặp Trở Ngại!',
        'Không thể xử lý thao tác này lúc này. Vui lòng kiểm tra trạng thái nhân vật rồi thử lại.'
      );
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
      } catch (replyError) {
        console.error('Không thể gửi thông báo lỗi nút hồ sơ:', replyError);
      }
    }
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guildId) return;

  try {
    const prefix = await getPrefix(message.guildId);
    const fixedVerifyAlias = /^averify(?:\s|$)/i.exec(message.content);
    const spacedVerifyAlias = /^a\s+verify(?:\s|$)/i.exec(message.content);
    const verifyAlias = fixedVerifyAlias || spacedVerifyAlias;
    if (verifyAlias) {
      const cooldownRemaining = acquireCommandCooldown(message.author.id);
      if (cooldownRemaining > 0) {
        return message.reply(`Bạn cần đợi ${Math.ceil(cooldownRemaining / 1000)} giây trước khi dùng lệnh tiếp theo.`);
      }

      const args = tokenize(message.content.slice(verifyAlias[0].length).trim());
      const verifyCommand = client.commands.get('verify');
      return executePrefixCommand(message, verifyCommand, args, 'a');
    }

    const fixedDisableAlias = /^adisable(?:\s|$)/i.exec(message.content);
    const fixedPrefixAlias = /^aprefix(?:\s|$)/i.exec(message.content);
    if (!message.content.startsWith(prefix) && !fixedDisableAlias && !fixedPrefixAlias) return;

    if (!await isGuildWhitelisted(message.guildId)) {
      return message.reply(
        'Máy chủ này chưa được xác minh để sử dụng bot. Chủ bot cần chạy `/verify` hoặc `averify` trong máy chủ.'
      );
    }

    if (fixedDisableAlias) {
      const cooldownRemaining = acquireCommandCooldown(message.author.id);
      if (cooldownRemaining > 0) {
        return message.reply(`Bạn cần đợi ${Math.ceil(cooldownRemaining / 1000)} giây trước khi dùng lệnh tiếp theo.`);
      }

      const commandInput = message.content.slice(fixedDisableAlias[0].length).trim();
      const disableCommand = client.commands.get('disable');
      return disableCommand.executeAdisable({
        guildId: message.guildId,
        channelId: message.channelId,
        memberPermissions: message.member?.permissions,
        client,
        reply: payload => {
          const { ephemeral, ...messagePayload } = payload;
          return message.reply(messagePayload);
        }
      }, commandInput);
    }

    if (fixedPrefixAlias) {
      const cooldownRemaining = acquireCommandCooldown(message.author.id);
      if (cooldownRemaining > 0) {
        return message.reply(`Bạn cần đợi ${Math.ceil(cooldownRemaining / 1000)} giây trước khi dùng lệnh tiếp theo.`);
      }

      const prefixArgs = tokenize(message.content.slice(fixedPrefixAlias[0].length).trim());
      if (prefixArgs.length === 0) {
        return message.reply(`Prefix hiện tại là \`${prefix}\`. Đổi bằng \`/prefix value:<prefix>\` hoặc \`aprefix <prefix>\`.`);
      }
      if (prefixArgs.length !== 1) throw new Error('Dùng cú pháp `aprefix <prefix>` với một giá trị prefix.');
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply('Bạn cần quyền Quản lý Máy chủ để đổi prefix.');
      }
      const updatedPrefix = await setPrefix(message.guildId, prefixArgs[0]);
      return message.reply(`Đã đổi prefix thành \`${updatedPrefix}\`.`);
    }

    if (!message.content.startsWith(prefix)) return;

    const args = tokenize(message.content.slice(prefix.length).trim());
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) {
      return message.reply(`Dùng \`${prefix}<command>\` để chạy lệnh. Ví dụ: \`${prefix}profile\`.`);
    }

    if (commandName === 'prefix') {
      const cooldownRemaining = acquireCommandCooldown(message.author.id);
      if (cooldownRemaining > 0) {
        return message.reply(`Bạn cần đợi ${Math.ceil(cooldownRemaining / 1000)} giây trước khi dùng lệnh tiếp theo.`);
      }

      if (args.length === 0) {
        return message.reply(`Prefix hiện tại là \`${prefix}\`. Đổi bằng \`/prefix value:<prefix>\` hoặc \`${prefix}prefix <prefix>\`.`);
      }
      if (args.length !== 1) throw new Error(`Dùng cú pháp \`${prefix}prefix <prefix>\` với một giá trị prefix.`);
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply('Bạn cần quyền Quản lý Máy chủ để đổi prefix.');
      }
      const updatedPrefix = await setPrefix(message.guildId, args[0]);
      return message.reply(`Đã đổi prefix thành \`${updatedPrefix}\`.`);
    }

    const command = client.commands.get(commandName);
    if (!command) {
      return message.reply(`Không tìm thấy lệnh \`${commandName}\`. Dùng \`${prefix} help\` để xem hướng dẫn.`);
    }

    if (commandName !== 'disable' &&
      await isCommandDisabled(message.guildId, message.channelId, commandName)) {
      return message.reply(`Lệnh \`${commandName}\` đã bị tắt trong kênh này.`);
    }

    const cooldown = commandName === 'duel'
      ? acquireDuelCooldown(message.author.id)
      : { type: 'command', remaining: acquireCommandCooldown(message.author.id) };
    if (cooldown.remaining > 0) {
      const notice = cooldown.type === 'duel'
        ? `Bạn cần chờ ${Math.ceil(cooldown.remaining / 1000)} giây trước khi đấu pháp lần tiếp theo.`
        : `Bạn cần đợi ${Math.ceil(cooldown.remaining / 1000)} giây trước khi dùng lệnh tiếp theo.`;
      return message.reply(notice);
    }

    await executePrefixCommand(message, command, args, prefix);
  } catch (error) {
    console.error(`Lỗi thực thi prefix command trong guild ${message.guildId}:`, error);
    await message.reply(`Không thể thực hiện lệnh: ${error.message}`).catch(replyError => {
      console.error('Không thể gửi thông báo lỗi prefix command:', replyError);
    });
  }
});

async function startApplication() {
  if (process.env.START_ADMIN_WITH_BOT === 'true') {
    const { startAdminServer } = require('./admin/server');
    await startAdminServer();
  }
  await client.login(process.env.DISCORD_TOKEN);
}

startApplication().catch(error => {
  console.error('Không thể khởi chạy ứng dụng:', error);
  process.exitCode = 1;
});
