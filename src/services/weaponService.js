const { getDb } = require('../config/database');

async function getUserWeapons(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_weapons WHERE user_id = ? ORDER BY is_equipped DESC, is_natal DESC, tier DESC, id DESC',
    args: [userId]
  });
  return res.rows;
}

async function getEquippedWeapon(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_weapons WHERE user_id = ? AND is_equipped = 1',
    args: [userId]
  });
  return res.rows[0] || null;
}

async function equipWeapon(userId, weaponId) {
  const db = getDb();
  const weaponRes = await db.execute({
    sql: 'SELECT * FROM tutien_weapons WHERE id = ? AND user_id = ?',
    args: [weaponId, userId]
  });
  const weapon = weaponRes.rows[0];
  if (!weapon) return { success: false, message: 'Không tìm thấy Linh Khí này!' };

  // Tháo vũ khí cũ
  await db.execute({
    sql: 'UPDATE tutien_weapons SET is_equipped = 0 WHERE user_id = ?',
    args: [userId]
  });

  // Trang bị vũ khí mới
  await db.execute({
    sql: 'UPDATE tutien_weapons SET is_equipped = 1 WHERE id = ?',
    args: [weaponId]
  });

  return { success: true, message: `Đã trang bị **${weapon.name}**!` };
}

async function setNatalWeapon(userId, weaponId) {
  const db = getDb();
  const weaponRes = await db.execute({
    sql: 'SELECT * FROM tutien_weapons WHERE id = ? AND user_id = ?',
    args: [weaponId, userId]
  });
  const weapon = weaponRes.rows[0];
  if (!weapon) return { success: false, message: 'Không tìm thấy Linh Khí này!' };

  // Hủy bản mệnh cũ
  await db.execute({
    sql: 'UPDATE tutien_weapons SET is_natal = 0 WHERE user_id = ?',
    args: [userId]
  });

  // Phong làm Bản Mệnh Linh Khí
  await db.execute({
    sql: 'UPDATE tutien_weapons SET is_natal = 1 WHERE id = ?',
    args: [weaponId]
  });

  return {
    success: true,
    message: `Đã tế luyện **${weapon.name}** thành **Bản Mệnh Linh Khí**! Vũ khí này sẽ đồng hành và mạnh lên theo cảnh giới của chủ nhân!`
  };
}

/**
 * Bản Mệnh Linh Khí nuốt linh khí rác để tăng cấp và chỉ số
 */
async function devourWeapon(userId, natalWeaponId, foodWeaponId) {
  const db = getDb();
  if (natalWeaponId === foodWeaponId) return { success: false, message: 'Không thể tự nuốt chính mình!' };

  const natalRes = await db.execute({
    sql: 'SELECT * FROM tutien_weapons WHERE id = ? AND user_id = ?',
    args: [natalWeaponId, userId]
  });
  const foodRes = await db.execute({
    sql: 'SELECT * FROM tutien_weapons WHERE id = ? AND user_id = ?',
    args: [foodWeaponId, userId]
  });

  const natal = natalRes.rows[0];
  const food = foodRes.rows[0];

  if (!natal || !food) return { success: false, message: 'Không tìm thấy Linh Khí!' };
  if (!natal.is_natal) return { success: false, message: 'Chỉ Bản Mệnh Linh Khí mới có khả năng thôn phệ linh khí khác!' };

  // Xóa vũ khí làm thức ăn
  await db.execute({
    sql: 'DELETE FROM tutien_weapons WHERE id = ?',
    args: [foodWeaponId]
  });

  const gainedAtk = Math.max(10, Math.floor(food.atk * 0.4));
  const gainedDef = Math.max(5, Math.floor(food.def * 0.4));
  const newExp = (natal.devour_exp || 0) + (food.tier * 50);

  // Thăng phẩm nếu exp đạt mốc
  let newTier = natal.tier;
  if (newExp >= newTier * 200 && newTier < 8) {
    newTier++;
  }

  await db.execute({
    sql: `UPDATE tutien_weapons 
      SET atk = atk + ?, def = def + ?, devour_exp = ?, tier = ? 
      WHERE id = ?`,
    args: [gainedAtk, gainedDef, newExp, newTier, natalWeaponId]
  });

  return {
    success: true,
    message: `Bản Mệnh Linh Khí **${natal.name}** đã thôn phệ thành công! Nhận **+${gainedAtk} Công, +${gainedDef} Thủ**! (Bậc hiện tại: Tier ${newTier})`
  };
}

module.exports = {
  getUserWeapons,
  getEquippedWeapon,
  equipWeapon,
  setNatalWeapon,
  devourWeapon
};
