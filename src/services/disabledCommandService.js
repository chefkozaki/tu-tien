const { getDb } = require('../config/database');
const { withTransaction } = require('../utils/databaseTransaction');

let tableReady;

async function ensureDisabledCommandTable() {
  if (!tableReady) {
    tableReady = getDb().execute(
      `CREATE TABLE IF NOT EXISTS tutien_channel_disabled_commands (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        command_name TEXT NOT NULL,
        PRIMARY KEY (guild_id, channel_id, command_name)
      )`
    );
  }
  await tableReady;
}

async function isCommandDisabled(guildId, channelId, commandName) {
  if (!guildId || !channelId || !commandName) return false;
  await ensureDisabledCommandTable();
  const result = await getDb().execute({
    sql: `SELECT 1 FROM tutien_channel_disabled_commands
      WHERE guild_id = ? AND channel_id = ? AND command_name = ?`,
    args: [guildId, channelId, commandName.toLowerCase()]
  });
  return Boolean(result.rows[0]);
}

async function toggleCommandDisabled(guildId, channelId, commandName) {
  if (!guildId || !channelId || !commandName) {
    throw new Error('Lệnh này chỉ dùng được trong một kênh của máy chủ.');
  }
  await ensureDisabledCommandTable();
  const db = getDb();

  return withTransaction(db, async tx => {
    try {
      const result = await tx.execute({
        sql: `SELECT 1 FROM tutien_channel_disabled_commands
          WHERE guild_id = ? AND channel_id = ? AND command_name = ?`,
        args: [guildId, channelId, commandName.toLowerCase()]
      });
      const wasDisabled = Boolean(result.rows[0]);
      if (wasDisabled) {
        await tx.execute({
          sql: `DELETE FROM tutien_channel_disabled_commands
            WHERE guild_id = ? AND channel_id = ? AND command_name = ?`,
          args: [guildId, channelId, commandName.toLowerCase()]
        });
      } else {
        await tx.execute({
          sql: `INSERT INTO tutien_channel_disabled_commands (guild_id, channel_id, command_name)
            VALUES (?, ?, ?)`,
          args: [guildId, channelId, commandName.toLowerCase()]
        });
      }
      await tx.commit();
      return !wasDisabled;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

module.exports = { isCommandDisabled, toggleCommandDisabled };
