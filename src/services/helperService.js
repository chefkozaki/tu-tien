const { getDb } = require('../config/database');

async function getUserHelpers(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_helpers WHERE user_id = ? ORDER BY is_equipped DESC, tier DESC, id DESC',
    args: [userId]
  });
  return res.rows;
}

async function getEquippedHelper(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_helpers WHERE user_id = ? AND is_equipped = 1',
    args: [userId]
  });
  return res.rows[0] || null;
}

async function equipHelper(userId, helperId) {
  const db = getDb();
  const helperRes = await db.execute({
    sql: 'SELECT * FROM tutien_helpers WHERE id = ? AND user_id = ?',
    args: [helperId, userId]
  });
  const helper = helperRes.rows[0];
  if (!helper) return { success: false, message: 'Không tìm thấy Trợ Thủ này!' };

  // Tháo trợ thủ cũ
  await db.execute({
    sql: 'UPDATE tutien_helpers SET is_equipped = 0 WHERE user_id = ?',
    args: [userId]
  });

  // Trang bị trợ thủ mới
  await db.execute({
    sql: 'UPDATE tutien_helpers SET is_equipped = 1 WHERE id = ?',
    args: [helperId]
  });

  const typeDesc = helper.type === 'combat' ? '⚔️ Hộ Đạo Giả (Chiến Đấu)' : '🌾 Đạo Đồng (Sinh Hoạt / Treo Máy)';
  return {
    success: true,
    message: `Đã xuất chiến Trợ Thủ **${helper.name}** [${typeDesc}]!`
  };
}

async function unequipHelper(userId, helperId) {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE tutien_helpers SET is_equipped = 0 WHERE id = ? AND user_id = ?',
    args: [helperId, userId]
  });
  return { success: true, message: 'Đã cho Trợ Thủ về nghỉ ngơi!' };
}

module.exports = {
  getUserHelpers,
  getEquippedHelper,
  equipHelper,
  unequipHelper
};
