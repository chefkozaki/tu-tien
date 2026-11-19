const { getDb } = require('../config/database');

const whitelistedGuilds = new Set();
let cacheInitialized = false;

async function loadGuildWhitelistCache() {
  const result = await getDb().execute('SELECT guild_id FROM tutien_guild_whitelist');
  whitelistedGuilds.clear();
  for (const row of result.rows) {
    whitelistedGuilds.add(row.guild_id);
  }
  cacheInitialized = true;
}

async function isGuildWhitelisted(guildId) {
  if (!guildId) return false;
  if (cacheInitialized) return whitelistedGuilds.has(guildId);

  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT 1 FROM tutien_guild_whitelist WHERE guild_id = ?',
    args: [guildId]
  });
  const isWhitelisted = result.rows.length > 0;
  if (isWhitelisted) whitelistedGuilds.add(guildId);
  return isWhitelisted;
}

async function whitelistGuild(guildId, verifiedBy) {
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO tutien_guild_whitelist (guild_id, verified_by, verified_at)
      VALUES (?, ?, ?)
      ON CONFLICT (guild_id) DO NOTHING`,
    args: [guildId, verifiedBy, Date.now()]
  });
  whitelistedGuilds.add(guildId);
  return result.rowsAffected === 1;
}

module.exports = {
  isGuildWhitelisted,
  whitelistGuild,
  loadGuildWhitelistCache
};
