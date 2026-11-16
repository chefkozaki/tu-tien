const { getDb } = require('../config/database');

let tableReady;

async function ensurePrefixTable() {
  if (!tableReady) {
    tableReady = getDb().execute(
      `CREATE TABLE IF NOT EXISTS tutien_guild_prefixes (
        guild_id TEXT PRIMARY KEY,
        prefix TEXT NOT NULL
      )`
    );
  }
  await tableReady;
}

function isValidPrefix(prefix) {
  return typeof prefix === 'string' &&
    prefix.length > 0 &&
    prefix.length <= 5 &&
    !/\s/.test(prefix) &&
    prefix.toLowerCase() !== 'aprefix';
}

async function getPrefix(guildId) {
  if (!guildId) return 'a';
  await ensurePrefixTable();
  const result = await getDb().execute({
    sql: 'SELECT prefix FROM tutien_guild_prefixes WHERE guild_id = ?',
    args: [guildId]
  });
  return result.rows[0]?.prefix || 'a';
}

async function setPrefix(guildId, prefix) {
  if (!guildId) {
    throw new Error('Prefix chỉ có thể được thiết lập trong máy chủ Discord.');
  }
  if (!isValidPrefix(prefix)) {
    throw new Error('Prefix phải dài từ 1 đến 5 ký tự, không chứa khoảng trắng và không được là `aprefix`.');
  }

  await ensurePrefixTable();
  await getDb().execute({
    sql: `INSERT INTO tutien_guild_prefixes (guild_id, prefix) VALUES (?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET prefix = excluded.prefix`,
    args: [guildId, prefix]
  });
  return prefix;
}

module.exports = { getPrefix, setPrefix, isValidPrefix };
