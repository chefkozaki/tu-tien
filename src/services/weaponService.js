const { getDb } = require('../config/database');
const { withTransaction } = require('../utils/databaseTransaction');

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
  return withTransaction(db, async tx => {
    try {
      if (Number(natalWeaponId) === Number(foodWeaponId)) {
        await tx.rollback();
        return { success: false, message: 'Không thể tự nuốt chính mình!' };
      }

      const natalRes = await tx.execute({
        sql: 'SELECT * FROM tutien_weapons WHERE id = ? AND user_id = ?',
        args: [natalWeaponId, userId]
      });
      const foodRes = await tx.execute({
        sql: 'SELECT * FROM tutien_weapons WHERE id = ? AND user_id = ?',
        args: [foodWeaponId, userId]
      });
      const natal = natalRes.rows[0];
      const food = foodRes.rows[0];

      if (!natal || !food) {
        await tx.rollback();
        return { success: false, message: 'Không tìm thấy Linh Khí!' };
      }
      if (Number(natal.is_natal) !== 1) {
        await tx.rollback();
        return { success: false, message: 'Chỉ Bản Mệnh Linh Khí mới có khả năng thôn phệ linh khí khác!' };
      }
      if (Number(food.is_natal) === 1) {
        await tx.rollback();
        return { success: false, message: 'Không thể dùng Bản Mệnh Linh Khí làm nguyên liệu thôn phệ!' };
      }
      if (Number(food.is_equipped) === 1) {
        await tx.rollback();
        return { success: false, message: 'Không thể thôn phệ Linh Khí đang trang bị!' };
      }

      const deleted = await tx.execute({
        sql: 'DELETE FROM tutien_weapons WHERE id = ? AND user_id = ? AND COALESCE(is_natal, 0) = 0 AND COALESCE(is_equipped, 0) = 0',
        args: [foodWeaponId, userId]
      });
      if (deleted.rowsAffected !== 1) {
        throw new Error('Linh Khí nguyên liệu đã thay đổi hoặc không còn hợp lệ.');
      }

      const gainedAtk = Math.max(10, Math.floor(Number(food.atk) * 0.4));
      const gainedDef = Math.max(5, Math.floor(Number(food.def) * 0.4));
      const newExp = Number(natal.devour_exp || 0) + Number(food.tier) * 50;
      let newTier = Number(natal.tier);
      if (newExp >= newTier * 200 && newTier < 8) newTier++;

      const updated = await tx.execute({
        sql: `UPDATE tutien_weapons
          SET atk = atk + ?, def = def + ?, devour_exp = ?, tier = ?
          WHERE id = ? AND user_id = ? AND is_natal = 1`,
        args: [gainedAtk, gainedDef, newExp, newTier, natalWeaponId, userId]
      });
      if (updated.rowsAffected !== 1) {
        throw new Error('Không thể cập nhật Bản Mệnh Linh Khí.');
      }

      await tx.commit();
      return {
        success: true,
        message: `Bản Mệnh Linh Khí **${natal.name}** đã thôn phệ thành công! Nhận **+${gainedAtk} Công, +${gainedDef} Thủ**! (Bậc hiện tại: Tier ${newTier})`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

async function devourAllWeapons(userId) {
  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      const natalRes = await tx.execute({
        sql: 'SELECT * FROM tutien_weapons WHERE user_id = ? AND is_natal = 1 LIMIT 1',
        args: [userId]
      });
      const natal = natalRes.rows[0];
      if (!natal) {
        await tx.rollback();
        return { success: false, message: 'Chưa có Bản Mệnh Linh Khí để thôn phệ.' };
      }

      const foodRes = await tx.execute({
        sql: `SELECT id, tier, atk, def FROM tutien_weapons
          WHERE user_id = ? AND id != ?
            AND COALESCE(is_natal, 0) = 0
            AND COALESCE(is_equipped, 0) = 0
          ORDER BY id`,
        args: [userId, natal.id]
      });
      if (foodRes.rows.length === 0) {
        await tx.rollback();
        return { success: false, message: 'Không có Linh Khí dư thừa không trang bị để thôn phệ.' };
      }

      let gainedAtk = 0;
      let gainedDef = 0;
      let newExp = Number(natal.devour_exp || 0);
      let newTier = Number(natal.tier);

      for (const food of foodRes.rows) {
        const deleted = await tx.execute({
          sql: 'DELETE FROM tutien_weapons WHERE id = ? AND user_id = ? AND COALESCE(is_natal, 0) = 0 AND COALESCE(is_equipped, 0) = 0',
          args: [food.id, userId]
        });
        if (deleted.rowsAffected !== 1) {
          throw new Error(`Linh Khí nguyên liệu ${food.id} đã thay đổi hoặc không còn hợp lệ.`);
        }

        gainedAtk += Math.max(10, Math.floor(Number(food.atk) * 0.4));
        gainedDef += Math.max(5, Math.floor(Number(food.def) * 0.4));
        newExp += Number(food.tier) * 50;
        if (newExp >= newTier * 200 && newTier < 8) newTier++;
      }

      const updated = await tx.execute({
        sql: `UPDATE tutien_weapons
          SET atk = atk + ?, def = def + ?, devour_exp = ?, tier = ?
          WHERE id = ? AND user_id = ? AND is_natal = 1`,
        args: [gainedAtk, gainedDef, newExp, newTier, natal.id, userId]
      });
      if (updated.rowsAffected !== 1) {
        throw new Error('Không thể cập nhật Bản Mệnh Linh Khí.');
      }

      await tx.commit();
      return {
        success: true,
        count: foodRes.rows.length,
        message: `Bản Mệnh Linh Khí **${natal.name}** đã thôn phệ **${foodRes.rows.length}** Linh Khí dư thừa, nhận **+${gainedAtk} Công, +${gainedDef} Thủ**! (Bậc hiện tại: Tier ${newTier})`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

module.exports = {
  getUserWeapons,
  getEquippedWeapon,
  equipWeapon,
  setNatalWeapon,
  devourWeapon,
  devourAllWeapons
};
