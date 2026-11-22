const { getDb } = require('../config/database');
const { REALMS, RACES, SPIRIT_ROOTS } = require('../config/constants');
const { getXpRequired } = require('../utils/formatters');
const { withTransaction } = require('../utils/databaseTransaction');

async function getPlayer(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_players WHERE user_id = ?',
    args: [userId]
  });
  return res.rows[0] || null;
}

async function createPlayer(userId, username, raceKey = 'nhan_toc', rootKey = 'hoa', daoHieu = username) {
  const db = getDb();
  const existing = await getPlayer(userId);
  if (existing) return existing;

  const normalizedDaoHieu = daoHieu.trim();
  if (!normalizedDaoHieu || normalizedDaoHieu.length > 32) {
    throw new Error('Đạo hiệu phải có từ 1 đến 32 ký tự.');
  }

  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO tutien_players 
      (user_id, username, dao_hieu, race, spirit_root, realm_id, level, xp, silver, created_at, last_cultivate_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, '0', 5000, ?, ?)`,
    args: [userId, username, normalizedDaoHieu, raceKey, rootKey, now, now]
  });

  // Khởi tạo Động Phủ cho người chơi
  await db.execute({
    sql: `INSERT INTO tutien_dongphu 
      (user_id, array_level, last_claim_xp, afk_enabled, afk_started_at, alchemy_furnace_level, forge_level, garden_slots, garden_data)
      VALUES (?, 1, ?, 0, NULL, 1, 1, 3, '[]')`,
    args: [userId, now]
  });

  // Tặng tân thủ: 1 Linh Khí Phàm Phẩm, 1 Linh Giáp Phàm Phẩm, 1 Linh Thú Sơ Cấp, 15 Linh Kim Phàm
  await db.execute({
    sql: `INSERT INTO tutien_weapons 
      (user_id, name, tier, atk, def, effect_name, effect_desc, is_natal, is_equipped)
      VALUES (?, 'Thanh Phong Kiếm (Phàm)', 1, 50, 20, 'Kiếm Khí', 'Tăng 5% sát thương', 1, 1)`,
    args: [userId]
  });

  await db.execute({
    sql: `INSERT INTO tutien_armors
      (user_id, name, tier, hp, def, dmg_reduction, effect_name, effect_desc, is_natal, is_equipped)
      VALUES (?, 'Thanh Y Linh Giáp (Phàm)', 1, 200, 30, 0.05, 'Hộ Thể Sơ Cấp', 'Giáp tân thủ hộ thể, giảm 5% sát thương nhận vào', 1, 1)`,
    args: [userId]
  });

  await db.execute({
    sql: `INSERT INTO tutien_pets 
      (user_id, name, element, is_mythic, star, hp, atk, def, speed, crit, effect_desc, is_equipped, slot)
      VALUES (?, 'Hỏa Linh Điêu', 'Hỏa', 0, 1, 300, 40, 20, 25, 0.05, 'Tăng 5% sát thương Hỏa', 1, 1)`,
    args: [userId]
  });

  await db.execute({
    sql: `INSERT INTO tutien_inventory (user_id, item_type, item_key, item_name, amount)
      VALUES (?, 'spirit_gold', 'Phàm', 'Linh Kim (Phẩm Phàm)', 15)`,
    args: [userId]
  });

  // Tặng 1 kỹ năng khởi đầu
  await db.execute({
    sql: `INSERT INTO tutien_skills 
      (user_id, name, type, element, damage_mult, desc, is_equipped, slot)
      VALUES (?, 'Linh Khí Nhất Kích', 'active', 'Hỏa', 1.25, 'Tụ linh lực giáng một đòn chí mạng', 1, 1)`,
    args: [userId]
  });

  return await getPlayer(userId);
}

/**
 * Thêm Linh Lực (XP) cho người chơi, tự động tính toán nội tại Tộc và thăng cấp
 */
async function addXp(userId, rawAmount) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player) return { player: null, leveledUp: false, breakthroughReady: false };

  // Nhân Tộc Nội Tại: +15% XP
  let bonusMultiplier = 1;
  if (player.race === 'nhan_toc') {
    bonusMultiplier += RACES.nhan_toc.passive.xpBonus;
  }

  const finalAmount = Math.floor(rawAmount * bonusMultiplier);
  let currentXp = BigInt(player.xp || '0') + BigInt(finalAmount);
  let currentLevel = player.level;
  let realmId = player.realm_id;
  let leveledUp = false;
  let breakthroughReady = false;

  // Nếu đã đạt cảnh giới cuối Tối Thượng
  if (realmId === 8) {
    await db.execute({
      sql: 'UPDATE tutien_players SET xp = ? WHERE user_id = ?',
      args: [currentXp.toString(), userId]
    });
    return {
      player: await getPlayer(userId),
      addedXp: finalAmount,
      leveledUp: false,
      breakthroughReady: false
    };
  }

  // Tự động thăng cấp nếu chưa đạt cấp 10 (Đỉnh cấp)
  while (currentLevel < 10) {
    const requiredXp = BigInt(getXpRequired(realmId, currentLevel));
    if (currentXp >= requiredXp) {
      currentXp -= requiredXp;
      currentLevel++;
      leveledUp = true;
    } else {
      break;
    }
  }

  // Nếu đã đạt cấp 10 (Đỉnh cấp), tích lũy XP tối đa của cảnh giới đó để đột phá
  const peakRequiredXp = BigInt(getXpRequired(realmId, 10));
  if (currentLevel >= 10) {
    if (currentXp >= peakRequiredXp) {
      currentXp = peakRequiredXp;
      breakthroughReady = true;
    }
  }

  await db.execute({
    sql: 'UPDATE tutien_players SET xp = ?, level = ? WHERE user_id = ?',
    args: [currentXp.toString(), currentLevel, userId]
  });

  return {
    player: await getPlayer(userId),
    addedXp: finalAmount,
    leveledUp,
    breakthroughReady
  };
}

async function addSilver(userId, amount) {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE tutien_players SET silver = MAX(0, silver + ?) WHERE user_id = ?',
    args: [amount, userId]
  });
}

/**
 * Đột phá Cảnh Giới
 */
async function executeBreakthrough(userId, extraChoice = null) {
  const db = getDb();
  return withTransaction(db, tx => executeBreakthroughInTransaction(tx, userId, extraChoice));
}

async function executeBreakthroughInTransaction(tx, userId, extraChoice) {
  let transactionFinished = false;
  const fail = async message => {
    await tx.rollback();
    transactionFinished = true;
    return { success: false, message };
  };

  try {
    const playerResult = await tx.execute({
      sql: 'SELECT * FROM tutien_players WHERE user_id = ?',
      args: [userId]
    });
    const player = playerResult.rows[0];
    if (!player) return await fail('Đạo hữu chưa bước vào con đường tu tiên!');

    if (player.realm_id >= 8) {
      return await fail('Đạo hữu đã đạt đến cảnh giới Tối Thượng, không thể đột phá thêm!');
    }

    if (player.level < 10) {
      return await fail(`Đạo hữu cần đạt cấp 10 (Đỉnh cấp) mới có thể đột phá! Hiện tại mới cấp ${player.level}.`);
    }

    const currentRealm = REALMS[player.realm_id];
    const nextRealm = REALMS[player.realm_id + 1];
    if (!currentRealm || !nextRealm || !currentRealm.breakthrough) {
      return await fail('Dữ liệu cảnh giới không hợp lệ, vui lòng liên hệ quản trị viên.');
    }

    const requiredXp = BigInt(getXpRequired(player.realm_id, 10));
    const currentXp = BigInt(player.xp || '0');
    if (currentXp < requiredXp) {
      return await fail(
        `Đạo hữu cần tích lũy ${requiredXp.toLocaleString('vi-VN')} Linh Lực ở Cấp 10 mới có thể đột phá!`
      );
    }

    const req = currentRealm.breakthrough;
    const getInventoryRows = async (itemType, itemKey) => {
      const result = await tx.execute({
        sql: 'SELECT id, amount FROM tutien_inventory WHERE user_id = ? AND item_type = ? AND item_key = ? ORDER BY id',
        args: [userId, itemType, itemKey]
      });
      return result.rows;
    };
    const sumInventory = rows => rows.reduce((total, row) => total + BigInt(row.amount), 0n);
    const consumeInventory = async (rows, amount) => {
      let remaining = BigInt(amount);
      for (const row of rows) {
        if (remaining === 0n) break;
        const rowAmount = BigInt(row.amount);
        const consumed = rowAmount < remaining ? rowAmount : remaining;
        const result = await tx.execute({
          sql: 'UPDATE tutien_inventory SET amount = amount - ? WHERE id = ? AND amount >= ?',
          args: [Number(consumed), row.id, Number(consumed)]
        });
        if (result.rowsAffected !== 1) {
          throw new Error('Inventory changed while completing a breakthrough.');
        }
        remaining -= consumed;
      }
      if (remaining > 0n) {
        throw new Error('Insufficient inventory while completing a breakthrough.');
      }
    };

    const goldQuality = req.spiritGoldQuality;
    const goldAmount = req.spiritGoldAmount;
    const goldRows = await getInventoryRows('spirit_gold', goldQuality);
    const availableGold = sumInventory(goldRows);
    if (availableGold < BigInt(goldAmount)) {
      return await fail(
        `Đạo hữu không đủ Linh Kim! Cần **${goldAmount.toLocaleString()} Linh Kim (Phẩm ${goldQuality})**, hiện có **${availableGold.toLocaleString('vi-VN')}**.`
      );
    }

    let pillRows = [];
    if (req.pillRequired) {
      pillRows = await getInventoryRows('pill', req.pillRequired);
      const availablePills = sumInventory(pillRows);
      if (availablePills < BigInt(req.pillAmount)) {
        return await fail(
          `Đạo hữu thiếu đan dược đột phá: Cần **${req.pillAmount} ${req.pillName || req.pillRequired}**!`
        );
      }
    }

    if (req.weaponTierRequired) {
      const weaponCheck = await tx.execute({
        sql: 'SELECT tier FROM tutien_weapons WHERE user_id = ? AND is_equipped = 1',
        args: [userId]
      });
      const equippedTier = weaponCheck.rows[0] ? Number(weaponCheck.rows[0].tier) : 0;
      if (equippedTier < req.weaponTierRequired) {
        return await fail(
          'Đạo hữu cần trang bị Linh Khí bậc Tướng (Tier >= 3) để trấn áp linh lực khi đột phá!'
        );
      }
    }

    await consumeInventory(goldRows, goldAmount);
    if (req.pillRequired) {
      await consumeInventory(pillRows, req.pillAmount);
    }

    let ruleText = player.rule_enlightenment;
    if (req.type === 'quy_tac' && extraChoice) {
      ruleText = extraChoice;
    }

    await tx.execute({
      sql: `UPDATE tutien_players
        SET realm_id = ?, level = 1, xp = '0', rule_enlightenment = ?
        WHERE user_id = ?`,
      args: [player.realm_id + 1, ruleText, userId]
    });

    await tx.commit();
    transactionFinished = true;
    return {
      success: true,
      oldRealm: currentRealm.name,
      newRealm: nextRealm.name,
      ruleEnlightened: ruleText
    };
  } catch (error) {
    if (!transactionFinished) {
      await tx.rollback();
      transactionFinished = true;
    }
    throw error;
  }
}

module.exports = {
  getPlayer,
  createPlayer,
  addXp,
  addSilver,
  executeBreakthrough
};
