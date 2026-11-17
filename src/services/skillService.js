const { getDb } = require('../config/database');

async function getEquippedSkills(userId) {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM tutien_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY slot ASC, id ASC',
    args: [userId]
  });
  return result.rows;
}

module.exports = { getEquippedSkills };
