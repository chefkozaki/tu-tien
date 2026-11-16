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
  // 1. Xử lý Slash Command
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`Không tìm thấy lệnh: ${interaction.commandName}`);
      return;
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
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  // 2. Xử lý Quick Buttons từ Embed Hồ Sơ Tu Vi
  if (interaction.isButton()) {
    const userId = interaction.user.id;
    const player = await getPlayer(userId);

    if (!player) {
      return interaction.reply({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Đạo hữu hãy dùng `/start` trước!')],
        ephemeral: true
      });
    }

    // Nút Đả Tọa Tu Luyện
    if (interaction.customId === 'btn_cultivate') {
      const { REALMS } = require('./src/config/constants');
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

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Nút Đột Phá
    if (interaction.customId === 'btn_breakthrough') {
      const dotPhaCmd = client.commands.get('break');
      if (dotPhaCmd) {
        return dotPhaCmd.execute(interaction);
      }
    }

    // Nút Thu Hoạch Động Phủ (chỉ hoạt động khi AFK được bật)
    if (interaction.customId === 'btn_claim_dongphu') {
      const res = await claimTuLinhTran(userId);
      if (!res.success) {
        return interaction.reply({ embeds: [createErrorEmbed('Chưa Thể Thu Hoạch', res.message)], ephemeral: true });
      }

      const embed = createSuccessEmbed(
        '🌾 Thu Hoạch Tụ Linh Trận',
        `Động Phủ đã tích lũy trong **${res.elapsedMinutes} phút** qua:\n\n` +
        `• **Linh Lực:** \`+${formatNumber(res.xpGained)}\` XP\n` +
        `• **Ngân Lượng:** \`+${formatNumber(res.silverGained)}\` Bạc\n` +
        (res.helperName ? `• *Trợ Thủ Sinh Hoạt [${res.helperName}] tăng thêm +30% sản lượng!*\n` : ''),
        player.realm_id
      );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guildId) return;

  try {
    const prefix = await getPrefix(message.guildId);
    const fixedPrefixAlias = /^aprefix(?:\s|$)/i.exec(message.content);
    if (fixedPrefixAlias) {
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
