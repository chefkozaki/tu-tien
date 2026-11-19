const { getDb } = require('../config/database');
const { withTransaction } = require('../utils/databaseTransaction');

const disabledCommands = new Set();
let tableReady;
let cacheInitialized = false;

function getCommandKey(guildId, channelId, commandName) {
  return `${guildId}\0${channelId}\0${commandName.toLowerCase()}`;
}

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

async function loadDisabledCommandCache() {
  await ensureDisabledCommandTable();
  const result = await getDb().execute(
    'SELECT guild_id, channel_id, command_name FROM tutien_channel_disabled_commands'
  );
  disabledCommands.clear();
  for (const row of result.rows) {
    disabledCommands.add(getCommandKey(row.guild_id, row.channel_id, row.command_name));
  }
  cacheInitialized = true;
}

async function isCommandDisabled(guildId, channelId, commandName) {
  if (!guildId || !channelId || !commandName) return false;
  const key = getCommandKey(guildId, channelId, commandName);
  if (cacheInitialized) return disabledCommands.has(key);

  await ensureDisabledCommandTable();
  const result = await getDb().execute({
    sql: `SELECT 1 FROM tutien_channel_disabled_commands
      WHERE guild_id = ? AND channel_id = ? AND command_name = ?`,
    args: [guildId, channelId, commandName.toLowerCase()]
  });
  const isDisabled = Boolean(result.rows[0]);
  if (isDisabled) disabledCommands.add(key);
  return isDisabled;
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
      const key = getCommandKey(guildId, channelId, commandName);
      if (wasDisabled) {
        disabledCommands.delete(key);
      } else {
        disabledCommands.add(key);
      }
      return !wasDisabled;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

module.exports = {
  isCommandDisabled,
  toggleCommandDisabled,
  loadDisabledCommandCache
};
