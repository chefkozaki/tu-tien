const { getDb } = require('../config/database');
const { withTransaction } = require('../utils/databaseTransaction');

const MAX_BULK_DEVOUR_ARMORS = 50;
const MAX_ARMOR_DMG_REDUCTION = 0.45;

async function getUserArmors(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_armors WHERE user_id = ? ORDER BY is_equipped DESC, is_natal DESC, tier DESC, id DESC',
    args: [userId]
  });
  return res.rows;
}

async function getEquippedArmor(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_armors WHERE user_id = ? AND is_equipped = 1',
    args: [userId]
  });
  return res.rows[0] || null;
}

async function equipArmor(userId, armorId) {
  const db = getDb();
  const armorRes = await db.execute({
    sql: 'SELECT * FROM tutien_armors WHERE id = ? AND user_id = ?',
    args: [armorId, userId]
  });
  const armor = armorRes.rows[0];
  if (!armor) return { success: false, message: 'Không tìm thấy Linh Giáp này!' };

  // Tháo giáp cũ
  await db.execute({
    sql: 'UPDATE tutien_armors SET is_equipped = 0 WHERE user_id = ?',
    args: [userId]
  });

  // Trang bị giáp mới
  await db.execute({
    sql: 'UPDATE tutien_armors SET is_equipped = 1 WHERE id = ?',
    args: [armorId]
  });

  return { success: true, message: `Đã trang bị Linh Giáp **${armor.name}**!` };
}

async function setNatalArmor(userId, armorId) {
  const db = getDb();
  const armorRes = await db.execute({
    sql: 'SELECT * FROM tutien_armors WHERE id = ? AND user_id = ?',
    args: [armorId, userId]
  });
  const armor = armorRes.rows[0];
  if (!armor) return { success: false, message: 'Không tìm thấy Linh Giáp này!' };

  await db.execute({
    sql: 'UPDATE tutien_armors SET is_natal = 0 WHERE user_id = ?',
    args: [userId]
  });

  await db.execute({
    sql: 'UPDATE tutien_armors SET is_natal = 1 WHERE id = ?',
    args: [armorId]
  });

  return {
    success: true,
    message: `Đã tế luyện **${armor.name}** thành **Bản Mệnh Linh Giáp**! Giáp này sẽ đồng hành và tăng tiến HP, Thủ theo cảnh giới của chủ nhân!`
  };
}

/**
 * Bản Mệnh Linh Giáp nuốt linh giáp khác để tăng HP, Thủ, Giảm ST và bậc
 */
async function devourArmor(userId, natalArmorId, foodArmorId) {
  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      if (Number(natalArmorId) === Number(foodArmorId)) {
        await tx.rollback();
        return { success: false, message: 'Không thể tự thôn phệ chính mình!' };
      }

      const natalRes = await tx.execute({
        sql: 'SELECT * FROM tutien_armors WHERE id = ? AND user_id = ?',
        args: [natalArmorId, userId]
      });
      const foodRes = await tx.execute({
        sql: 'SELECT * FROM tutien_armors WHERE id = ? AND user_id = ?',
        args: [foodArmorId, userId]
      });
      const natal = natalRes.rows[0];
      const food = foodRes.rows[0];

      if (!natal || !food) {
        await tx.rollback();
        return { success: false, message: 'Không tìm thấy Linh Giáp!' };
      }
      if (Number(natal.is_natal) !== 1) {
        await tx.rollback();
        return { success: false, message: 'Chỉ Bản Mệnh Linh Giáp mới có khả năng thôn phệ linh giáp khác!' };
      }
      if (Number(food.is_natal) === 1) {
        await tx.rollback();
        return { success: false, message: 'Không thể dùng Bản Mệnh Linh Giáp làm nguyên liệu thôn phệ!' };
      }
      if (Number(food.is_equipped) === 1) {
        await tx.rollback();
        return { success: false, message: 'Không thể thôn phệ Linh Giáp đang trang bị!' };
      }

      const deleted = await tx.execute({
        sql: 'DELETE FROM tutien_armors WHERE id = ? AND user_id = ? AND COALESCE(is_natal, 0) = 0 AND COALESCE(is_equipped, 0) = 0',
        args: [foodArmorId, userId]
      });
      if (deleted.rowsAffected !== 1) {
        throw new Error('Linh Giáp nguyên liệu đã thay đổi hoặc không còn hợp lệ.');
      }

      const gainedHp = Math.max(50, Math.floor(Number(food.hp || 0) * 0.4));
      const gainedDef = Math.max(10, Math.floor(Number(food.def || 0) * 0.4));
      const currentReduction = Number(natal.dmg_reduction || 0);
      const gainedReduction = Math.min(
        Math.max(0, MAX_ARMOR_DMG_REDUCTION - currentReduction),
        Number((Number(food.dmg_reduction || 0) * 0.08).toFixed(4))
      );
      const newReduction = Number(Math.min(MAX_ARMOR_DMG_REDUCTION, currentReduction + gainedReduction).toFixed(4));
      const newExp = Number(natal.devour_exp || 0) + Number(food.tier || 1) * 50;
      let newTier = Number(natal.tier || 1);
      if (newExp >= newTier * 200 && newTier < 8) newTier++;

      const updated = await tx.execute({
        sql: `UPDATE tutien_armors
          SET hp = hp + ?, def = def + ?, dmg_reduction = ?, devour_exp = ?, tier = ?
          WHERE id = ? AND user_id = ? AND is_natal = 1`,
        args: [gainedHp, gainedDef, newReduction, newExp, newTier, natalArmorId, userId]
      });
      if (updated.rowsAffected !== 1) {
        throw new Error('Không thể cập nhật Bản Mệnh Linh Giáp.');
      }

      await tx.commit();
      return {
        success: true,
        message:
          `Bản Mệnh Linh Giáp **${natal.name}** đã thôn phệ thành công! ` +
          `Nhận **+${gainedHp.toLocaleString('vi-VN')} HP, +${gainedDef.toLocaleString('vi-VN')} Thủ` +
          `${gainedReduction > 0 ? `, +${(gainedReduction * 100).toFixed(2)}% Giảm ST` : ''}**! ` +
          `(Giảm ST hiện tại: **${(newReduction * 100).toFixed(1)}%** • Bậc: Tier ${newTier})`
      };
    } catch (error) {
      try {
        await tx.rollback();
      } catch (_) {}
      throw error;
    }
  });
}

async function devourAllArmors(userId) {
  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      const natalRes = await tx.execute({
        sql: 'SELECT * FROM tutien_armors WHERE user_id = ? AND is_natal = 1 LIMIT 1',
        args: [userId]
      });
      const natal = natalRes.rows[0];
      if (!natal) {
        await tx.rollback();
        return { success: false, message: 'Đạo hữu cần tế luyện 1 **Bản Mệnh Linh Giáp** trước bằng `/armor bond`!' };
      }

      const foodRes = await tx.execute({
        sql: `SELECT * FROM tutien_armors
          WHERE user_id = ? AND id != ? AND COALESCE(is_natal, 0) = 0 AND COALESCE(is_equipped, 0) = 0
          ORDER BY tier ASC, id ASC
          LIMIT ?`,
        args: [userId, natal.id, MAX_BULK_DEVOUR_ARMORS]
      });
      const foods = foodRes.rows;
      if (foods.length === 0) {
        await tx.rollback();
        return { success: false, message: 'Không có Linh Giáp dư thừa nào (không trang bị) để thôn phệ!' };
      }

      const ids = foods.map(f => f.id);
      const placeholders = ids.map(() => '?').join(', ');
      const delRes = await tx.execute({
        sql: `DELETE FROM tutien_armors WHERE user_id = ? AND id IN (${placeholders}) AND COALESCE(is_natal, 0) = 0 AND COALESCE(is_equipped, 0) = 0`,
        args: [userId, ...ids]
      });
      if (delRes.rowsAffected !== foods.length) {
        throw new Error('Danh sách Linh Giáp đã thay đổi trong quá trình thôn phệ.');
      }

      let totalHp = 0;
      let totalDef = 0;
      let totalExp = 0;
      let rawReductionGain = 0;
      for (const food of foods) {
        totalHp += Math.max(50, Math.floor(Number(food.hp || 0) * 0.4));
        totalDef += Math.max(10, Math.floor(Number(food.def || 0) * 0.4));
        totalExp += Number(food.tier || 1) * 50;
        rawReductionGain += Number(food.dmg_reduction || 0) * 0.08;
      }

      const currentReduction = Number(natal.dmg_reduction || 0);
      const newReduction = Number(Math.min(MAX_ARMOR_DMG_REDUCTION, currentReduction + rawReductionGain).toFixed(4));
      const actualReductionGain = Number(Math.max(0, newReduction - currentReduction).toFixed(4));

      const newExp = Number(natal.devour_exp || 0) + totalExp;
      let newTier = Number(natal.tier || 1);
      while (newExp >= newTier * 200 && newTier < 8) {
        newTier++;
      }

      await tx.execute({
        sql: `UPDATE tutien_armors
          SET hp = hp + ?, def = def + ?, dmg_reduction = ?, devour_exp = ?, tier = ?
          WHERE id = ? AND user_id = ? AND is_natal = 1`,
        args: [totalHp, totalDef, newReduction, newExp, newTier, natal.id, userId]
      });

      await tx.commit();
      return {
        success: true,
        count: foods.length,
        message:
          `Bản Mệnh Linh Giáp **${natal.name}** đã thôn phệ **${foods.length}** Linh Giáp dư thừa!\n` +
          `• Tăng **+${totalHp.toLocaleString('vi-VN')} HP**, **+${totalDef.toLocaleString('vi-VN')} Thủ**` +
          `${actualReductionGain > 0 ? `, **+${(actualReductionGain * 100).toFixed(2)}% Giảm ST**` : ''}\n` +
          `• Giảm ST hiện tại: **${(newReduction * 100).toFixed(1)}%** • Bậc: **Tier ${newTier}**`
      };
    } catch (error) {
      try {
        await tx.rollback();
      } catch (_) {}
      throw error;
    }
  });
}

module.exports = {
  getUserArmors,
  getEquippedArmor,
  equipArmor,
  setNatalArmor,
  devourArmor,
  devourAllArmors,
  MAX_ARMOR_DMG_REDUCTION
};
