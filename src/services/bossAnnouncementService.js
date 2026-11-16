const { EmbedBuilder } = require('discord.js');
const { getDb } = require('../config/database');

let discordClient = null;
let tableReady;

function setBossAnnouncementClient(client) {
  discordClient = client;
}

async function ensureAnnouncementTable() {
  if (!tableReady) {
    tableReady = getDb().execute(
      `CREATE TABLE IF NOT EXISTS tutien_boss_announcement_channels (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL
      )`
    );
  }
  await tableReady;
}

async function getBossAnnouncementChannel(guildId) {
  await ensureAnnouncementTable();
  const result = await getDb().execute({
    sql: 'SELECT channel_id FROM tutien_boss_announcement_channels WHERE guild_id = ?',
    args: [guildId]
  });
  return result.rows[0]?.channel_id || null;
}

async function setBossAnnouncementChannel(guildId, channelId) {
  await ensureAnnouncementTable();
  await getDb().execute({
    sql: `INSERT INTO tutien_boss_announcement_channels (guild_id, channel_id) VALUES (?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id`,
    args: [guildId, channelId]
  });
}

async function clearBossAnnouncementChannel(guildId) {
  await ensureAnnouncementTable();
  await getDb().execute({
    sql: 'DELETE FROM tutien_boss_announcement_channels WHERE guild_id = ?',
    args: [guildId]
  });
}

async function announceBossSpawn(boss) {
  if (!discordClient) {
    console.error('Không thể thông báo Boss Thế Giới: Discord client chưa được thiết lập.');
    return;
  }

  let result;
  try {
    await ensureAnnouncementTable();
    result = await getDb().execute('SELECT guild_id, channel_id FROM tutien_boss_announcement_channels');
  } catch (error) {
    console.error('Không thể tải cấu hình kênh thông báo Boss Thế Giới:', error);
    return;
  }
  if (result.rows.length === 0) return;

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('👹 Boss Thế Giới Mới Xuất Hiện!')
    .setDescription(`**${boss.name}** đã giáng lâm!\nToàn thể tu sĩ hãy hợp lực thảo phạt bằng lệnh \`/boss atk\`.`)
    .addFields({ name: 'Sinh lực', value: `${Number(boss.max_hp).toLocaleString()} HP` })
    .setTimestamp(new Date(Number(boss.spawn_time)));

  for (const { guild_id: guildId, channel_id: channelId } of result.rows) {
    try {
      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) {
        console.error(`Không thể thông báo Boss Thế Giới: bot không có trong máy chủ ${guildId}.`);
        continue;
      }

      const channel = await guild.channels.fetch(channelId);
      if (!channel?.isTextBased() || typeof channel.send !== 'function') {
        console.error(`Không thể thông báo Boss Thế Giới: kênh ${channelId} trong máy chủ ${guildId} không phải kênh văn bản hợp lệ.`);
        continue;
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(`Không thể gửi thông báo Boss Thế Giới tới kênh ${channelId} trong máy chủ ${guildId}:`, error);
    }
  }
}

module.exports = {
  setBossAnnouncementClient,
  getBossAnnouncementChannel,
  setBossAnnouncementChannel,
  clearBossAnnouncementChannel,
  announceBossSpawn
};
