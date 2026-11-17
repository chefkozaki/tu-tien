const { getDb } = require('../config/database');

async function isGuildWhitelisted(guildId) {
  if (!guildId) return false;
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT 1 FROM tutien_guild_whitelist WHERE guild_id = ?',
    args: [guildId]
  });
  return result.rows.length > 0;
}

async function whitelistGuild(guildId, verifiedBy) {
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO tutien_guild_whitelist (guild_id, verified_by, verified_at)
      VALUES (?, ?, ?)
      ON CONFLICT (guild_id) DO NOTHING`,
    args: [guildId, verifiedBy, Date.now()]
  });
  return result.rowsAffected === 1;
}

module.exports = {
  isGuildWhitelisted,
  whitelistGuild
};
