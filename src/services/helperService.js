const { getDb } = require('../config/database');
const { withTransaction } = require('../utils/databaseTransaction');

const HELPER_UPGRADE_COSTS = [20000, 50000, 100000, 200000, 400000, 800000];

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

async function upgradeHelper(userId, targetHelperId, sacrificeHelperId) {
  const db = getDb();
  if (targetHelperId === sacrificeHelperId) {
    return { success: false, message: 'Không thể tự dùng chính Trợ Thủ làm nguyên liệu!' };
  }

  return withTransaction(db, async tx => {
    try {
      const targetRes = await tx.execute({
        sql: 'SELECT * FROM tutien_helpers WHERE id = ? AND user_id = ?',
        args: [targetHelperId, userId]
      });
      const sacrificeRes = await tx.execute({
        sql: 'SELECT * FROM tutien_helpers WHERE id = ? AND user_id = ?',
        args: [sacrificeHelperId, userId]
      });
      const playerRes = await tx.execute({
        sql: 'SELECT silver FROM tutien_players WHERE user_id = ?',
        args: [userId]
      });

      const target = targetRes.rows[0];
      const sacrifice = sacrificeRes.rows[0];
      const player = playerRes.rows[0];
      if (!target || !sacrifice) {
        await tx.rollback();
        return { success: false, message: 'Không tìm thấy Trợ Thủ chỉ định!' };
      }
      if (target.tier >= 7) {
        await tx.rollback();
        return { success: false, message: 'Trợ Thủ đã đạt Bậc tối đa 7!' };
      }
      if (sacrifice.is_equipped === 1) {
        await tx.rollback();
        return { success: false, message: 'Không thể hiến tế Trợ Thủ đang xuất chiến. Hãy thu hồi Trợ Thủ trước.' };
      }

      const cost = HELPER_UPGRADE_COSTS[Math.max(0, target.tier - 1)] || HELPER_UPGRADE_COSTS.at(-1);
      if (!player || Number(player.silver) < cost) {
        await tx.rollback();
        return { success: false, message: `Cần **${cost.toLocaleString()}** Ngân Lượng để nâng Bậc Trợ Thủ!` };
      }

      await tx.execute({
        sql: 'UPDATE tutien_players SET silver = silver - ? WHERE user_id = ?',
        args: [cost, userId]
      });
      await tx.execute({
        sql: 'DELETE FROM tutien_helpers WHERE id = ? AND user_id = ?',
        args: [sacrificeHelperId, userId]
      });
      await tx.execute({
        sql: 'UPDATE tutien_helpers SET tier = tier + 1 WHERE id = ? AND user_id = ?',
        args: [targetHelperId, userId]
      });
      await tx.commit();

      return {
        success: true,
        cost,
        newTier: target.tier + 1,
        message: `Nâng cấp thành công! **${target.name}** đã đạt **Bậc ${target.tier + 1}**. Chiến Đấu: +30% chỉ số mỗi Bậc; Sinh Hoạt: hiệu quả hỗ trợ tăng theo Bậc.`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

module.exports = {
  getUserHelpers,
  getEquippedHelper,
  equipHelper,
  unequipHelper,
  upgradeHelper
};
