const { getDb } = require('../config/database');

async function getRealmLeaderboard(limit = 10) {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT user_id, dao_hieu AS username, race, realm_id, level, xp, silver, tower_floor, pvp_points 
      FROM tutien_players 
      ORDER BY realm_id DESC, level DESC, CAST(xp AS INTEGER) DESC 
      LIMIT ?`,
    args: [limit]
  });
  return res.rows;
}

async function getThanDienLeaderboard(limit = 10) {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT user_id, dao_hieu AS username, race, realm_id, xp, rule_enlightenment 
      FROM tutien_players 
      WHERE realm_id = 8 
      ORDER BY CAST(xp AS INTEGER) DESC 
      LIMIT ?`,
    args: [limit]
  });
  return res.rows;
}

async function getRichLeaderboard(limit = 10) {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT user_id, dao_hieu AS username, silver 
      FROM tutien_players 
      ORDER BY silver DESC 
      LIMIT ?`,
    args: [limit]
  });
  return res.rows;
}

async function getPvPLeaderboard(limit = 10) {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT user_id, dao_hieu AS username, pvp_points 
      FROM tutien_players 
      ORDER BY pvp_points DESC 
      LIMIT ?`,
    args: [limit]
  });
  return res.rows;
}

async function getTowerLeaderboard(limit = 10) {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT user_id, dao_hieu AS username, tower_floor 
      FROM tutien_players 
      ORDER BY tower_floor DESC 
      LIMIT ?`,
    args: [limit]
  });
  return res.rows;
}

module.exports = {
  getRealmLeaderboard,
  getThanDienLeaderboard,
  getRichLeaderboard,
  getPvPLeaderboard,
  getTowerLeaderboard
};
