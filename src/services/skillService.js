const { getDb } = require('../config/database');
const { SKILL_TIERS, SKILL_CATALOG } = require('../config/constants');
const { getPlayer } = require('./playerService');
const { getItemAmount } = require('./itemService');
const { withTransaction } = require('../utils/databaseTransaction');

const COMPREHEND_COST_SINGLE = 3000;
const COMPREHEND_COST_FIVE = 13500;
const SKILL_SCROLL_TYPE = 'material';
const SKILL_SCROLL_KEY = 'skill_scroll';
const SKILL_SCROLL_NAME = 'Tàn Quyển Công Pháp';

function getMaxSkillSlots(player) {
  return player?.race === 'nhan_toc' ? 4 : 3;
}

function getTierInfo(tier) {
  return SKILL_TIERS[Number(tier)] || SKILL_TIERS[1];
}

function getUpgradeCost(skill) {
  const tier = Number(skill.tier || 1);
  const level = Number(skill.level || 1);
  const silverCost = Math.floor((1500 + tier * 1500) * level);
  const scrollCost = Math.max(1, Math.floor(tier * level));
  return { silverCost, scrollCost };
}

async function getSkillScrollCount(userId) {
  return getItemAmount(userId, SKILL_SCROLL_TYPE, SKILL_SCROLL_KEY);
}

async function getUserSkills(userId) {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM tutien_skills WHERE user_id = ? ORDER BY is_equipped DESC, slot ASC, tier DESC, level DESC, id ASC',
    args: [userId]
  });
  return result.rows;
}

async function getEquippedSkills(userId) {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM tutien_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY slot ASC, id ASC',
    args: [userId]
  });
  return result.rows;
}

async function addScrollsInTx(tx, userId, amount) {
  if (amount <= 0) return;
  const existing = await tx.execute({
    sql: 'SELECT id FROM tutien_inventory WHERE user_id = ? AND item_type = ? AND item_key = ? ORDER BY id LIMIT 1',
    args: [userId, SKILL_SCROLL_TYPE, SKILL_SCROLL_KEY]
  });
  if (existing.rows[0]) {
    await tx.execute({
      sql: 'UPDATE tutien_inventory SET amount = amount + ? WHERE id = ?',
      args: [amount, existing.rows[0].id]
    });
  } else {
    await tx.execute({
      sql: 'INSERT INTO tutien_inventory (user_id, item_type, item_key, item_name, amount) VALUES (?, ?, ?, ?, ?)',
      args: [userId, SKILL_SCROLL_TYPE, SKILL_SCROLL_KEY, SKILL_SCROLL_NAME, amount]
    });
  }
}

async function deductScrollsInTx(tx, userId, needed) {
  const rows = await tx.execute({
    sql: 'SELECT id, amount FROM tutien_inventory WHERE user_id = ? AND item_type = ? AND item_key = ? AND amount > 0 ORDER BY id',
    args: [userId, SKILL_SCROLL_TYPE, SKILL_SCROLL_KEY]
  });
  const total = rows.rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  if (total < needed) return { ok: false, available: total };

  let remaining = needed;
  for (const row of rows.rows) {
    if (remaining <= 0) break;
    const take = Math.min(Number(row.amount), remaining);
    await tx.execute({
      sql: 'UPDATE tutien_inventory SET amount = amount - ? WHERE id = ? AND amount >= ?',
      args: [take, row.id, take]
    });
    remaining -= take;
  }
  return { ok: true, available: total - needed };
}

async function equipSkill(userId, skillId) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player) return { success: false, message: 'Chưa Tu Tiên! Hãy dùng `/start` trước.' };

  const maxSlots = getMaxSkillSlots(player);

  return withTransaction(db, async tx => {
    try {
      const targetRes = await tx.execute({
        sql: 'SELECT * FROM tutien_skills WHERE id = ? AND user_id = ?',
        args: [Number(skillId), userId]
      });
      const target = targetRes.rows[0];
      if (!target) {
        await tx.rollback();
        return { success: false, message: 'Không tìm thấy Công Pháp này trong kho!' };
      }
      if (Number(target.is_equipped) === 1) {
        await tx.rollback();
        return { success: false, message: `**${target.name}** đã được trang bị sẵn rồi!` };
      }

      const equippedRes = await tx.execute({
        sql: 'SELECT * FROM tutien_skills WHERE user_id = ? AND is_equipped = 1 ORDER BY slot ASC',
        args: [userId]
      });
      const equipped = equippedRes.rows;

      if (equipped.some(s => s.name === target.name)) {
        await tx.rollback();
        return { success: false, message: `Đạo hữu đã trang bị một bản **${target.name}** khác rồi, không thể trang bị trùng tên!` };
      }

      if (equipped.length >= maxSlots) {
        await tx.rollback();
        return {
          success: false,
          message: `Đã đầy **${maxSlots}/${maxSlots}** ô Công Pháp! Hãy dùng \`/skills unequip\` tháo bớt 1 công pháp trước.`
        };
      }

      const usedSlots = new Set(equipped.map(s => Number(s.slot || 0)));
      let nextSlot = 1;
      while (usedSlots.has(nextSlot) && nextSlot <= maxSlots) nextSlot++;

      await tx.execute({
        sql: 'UPDATE tutien_skills SET is_equipped = 1, slot = ? WHERE id = ? AND user_id = ?',
        args: [nextSlot, Number(skillId), userId]
      });

      await tx.commit();
      return {
        success: true,
        message: `Đã trang bị **${target.name}** [${getTierInfo(target.tier).name} • Tầng ${target.level || 1}] vào **Ô ${nextSlot}/${maxSlots}**!`
      };
    } catch (error) {
      try { await tx.rollback(); } catch (_) {}
      throw error;
    }
  });
}

async function unequipSkill(userId, skillId) {
  const db = getDb();
  const targetRes = await db.execute({
    sql: 'SELECT * FROM tutien_skills WHERE id = ? AND user_id = ?',
    args: [Number(skillId), userId]
  });
  const target = targetRes.rows[0];
  if (!target) return { success: false, message: 'Không tìm thấy Công Pháp này!' };
  if (Number(target.is_equipped) !== 1) {
    return { success: false, message: `**${target.name}** hiện không được trang bị.` };
  }

  await db.execute({
    sql: 'UPDATE tutien_skills SET is_equipped = 0, slot = 0 WHERE id = ? AND user_id = ?',
    args: [Number(skillId), userId]
  });

  return { success: true, message: `Đã tháo **${target.name}** về kho Tàng Kinh Các!` };
}

async function buyLibrarySkill(userId, catalogKey) {
  const db = getDb();
  const template = SKILL_CATALOG.find(s => s.key === catalogKey);
  if (!template) return { success: false, message: 'Không tìm thấy bí tịch này trong Tàng Kinh Các!' };

  const tierInfo = getTierInfo(template.tier);
  if (!tierInfo.buyPrice) {
    return { success: false, message: `**${template.name}** thuộc **${tierInfo.name}**, chỉ có thể nhận qua **Lĩnh Ngộ**, Tháp hoặc Boss Thế Giới!` };
  }

  return withTransaction(db, async tx => {
    try {
      const playerRes = await tx.execute({ sql: 'SELECT silver FROM tutien_players WHERE user_id = ?', args: [userId] });
      const player = playerRes.rows[0];
      if (!player) {
        await tx.rollback();
        return { success: false, message: 'Chưa Tu Tiên! Hãy dùng `/start` trước.' };
      }

      const ownedRes = await tx.execute({
        sql: 'SELECT id FROM tutien_skills WHERE user_id = ? AND name = ? LIMIT 1',
        args: [userId, template.name]
      });
      if (ownedRes.rows[0]) {
        await tx.rollback();
        return { success: false, message: `Đạo hữu đã sở hữu **${template.name}** rồi! Hãy dùng \`/skills upgrade\` để nâng tầng.` };
      }

      if (Number(player.silver) < tierInfo.buyPrice) {
        await tx.rollback();
        return {
          success: false,
          message: `Không đủ Ngân Lượng! Mua **${template.name}** cần **${tierInfo.buyPrice.toLocaleString('vi-VN')} Bạc** (Hiện có: **${Number(player.silver).toLocaleString('vi-VN')} Bạc**).`
        };
      }

      await tx.execute({
        sql: 'UPDATE tutien_players SET silver = silver - ? WHERE user_id = ? AND silver >= ?',
        args: [tierInfo.buyPrice, userId, tierInfo.buyPrice]
      });

      await tx.execute({
        sql: `INSERT INTO tutien_skills
          (user_id, name, type, element, tier, level, max_level, damage_mult, effect_type, effect_value, cooldown, desc, is_equipped, slot)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 0, 0)`,
        args: [
          userId,
          template.name,
          template.type,
          template.element,
          template.tier,
          tierInfo.maxLevel,
          template.damage_mult,
          template.effect_type,
          template.effect_value,
          template.cooldown,
          template.desc
        ]
      });

      await tx.commit();
      return {
        success: true,
        skill: template,
        cost: tierInfo.buyPrice,
        message: `Đã thỉnh thành công bí tịch **${template.name}** [${tierInfo.name}] với giá **${tierInfo.buyPrice.toLocaleString('vi-VN')} Bạc**!`
      };
    } catch (error) {
      try { await tx.rollback(); } catch (_) {}
      throw error;
    }
  });
}

function rollCatalogSkill(minTier = 1, maxTier = 6) {
  const candidates = SKILL_CATALOG.filter(s => s.tier >= minTier && s.tier <= maxTier);
  const byTier = new Map();
  for (const s of candidates) {
    if (!byTier.has(s.tier)) byTier.set(s.tier, []);
    byTier.get(s.tier).push(s);
  }
  const tiers = Array.from(byTier.keys());
  const totalWeight = tiers.reduce((sum, t) => sum + (getTierInfo(t).comprehendWeight || 1), 0);
  let r = Math.random() * totalWeight;
  let chosenTier = tiers[0];
  for (const t of tiers) {
    r -= (getTierInfo(t).comprehendWeight || 1);
    if (r <= 0) {
      chosenTier = t;
      break;
    }
  }
  const pool = byTier.get(chosenTier);
  return pool[Math.floor(Math.random() * pool.length)];
}

async function comprehendSkill(userId, count = 1) {
  const db = getDb();
  const pullCount = count === 5 ? 5 : 1;
  const totalCost = pullCount === 5 ? COMPREHEND_COST_FIVE : COMPREHEND_COST_SINGLE;

  return withTransaction(db, async tx => {
    try {
      const playerRes = await tx.execute({ sql: 'SELECT silver FROM tutien_players WHERE user_id = ?', args: [userId] });
      const player = playerRes.rows[0];
      if (!player) {
        await tx.rollback();
        return { success: false, message: 'Chưa Tu Tiên! Hãy dùng `/start` trước.' };
      }

      if (Number(player.silver) < totalCost) {
        await tx.rollback();
        return {
          success: false,
          message: `Ngân lượng không đủ! Lĩnh Ngộ x${pullCount} cần **${totalCost.toLocaleString('vi-VN')} Bạc** (Hiện có: **${Number(player.silver).toLocaleString('vi-VN')} Bạc**).`
        };
      }

      await tx.execute({
        sql: 'UPDATE tutien_players SET silver = silver - ? WHERE user_id = ? AND silver >= ?',
        args: [totalCost, userId, totalCost]
      });

      const ownedRes = await tx.execute({
        sql: 'SELECT name FROM tutien_skills WHERE user_id = ?',
        args: [userId]
      });
      const ownedNames = new Set(ownedRes.rows.map(r => r.name));

      const results = [];
      let totalScrollsGained = 0;

      for (let i = 0; i < pullCount; i++) {
        // Lĩnh ngộ x5 bảo đảm ít nhất 1 bí tịch Huyền Giai (Tier 3+) ở lượt cuối nếu chưa có
        const forceRare = pullCount === 5 && i === 4 && !results.some(r => r.skill.tier >= 3);
        const picked = rollCatalogSkill(forceRare ? 3 : 1, 6);
        const tierInfo = getTierInfo(picked.tier);

        if (ownedNames.has(picked.name)) {
          const scrolls = tierInfo.salvageScrolls;
          totalScrollsGained += scrolls;
          results.push({ skill: picked, tierInfo, isDuplicate: true, scrollsConverted: scrolls });
        } else {
          ownedNames.add(picked.name);
          await tx.execute({
            sql: `INSERT INTO tutien_skills
              (user_id, name, type, element, tier, level, max_level, damage_mult, effect_type, effect_value, cooldown, desc, is_equipped, slot)
              VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 0, 0)`,
            args: [
              userId,
              picked.name,
              picked.type,
              picked.element,
              picked.tier,
              tierInfo.maxLevel,
              picked.damage_mult,
              picked.effect_type,
              picked.effect_value,
              picked.cooldown,
              picked.desc
            ]
          });
          results.push({ skill: picked, tierInfo, isDuplicate: false, scrollsConverted: 0 });
        }
      }

      if (totalScrollsGained > 0) {
        await addScrollsInTx(tx, userId, totalScrollsGained);
      }

      await tx.commit();
      return {
        success: true,
        count: pullCount,
        totalCost,
        totalScrollsGained,
        remainingSilver: Number(player.silver) - totalCost,
        results
      };
    } catch (error) {
      try { await tx.rollback(); } catch (_) {}
      throw error;
    }
  });
}

async function upgradeSkill(userId, skillId) {
  const db = getDb();

  return withTransaction(db, async tx => {
    try {
      const skillRes = await tx.execute({
        sql: 'SELECT * FROM tutien_skills WHERE id = ? AND user_id = ?',
        args: [Number(skillId), userId]
      });
      const skill = skillRes.rows[0];
      if (!skill) {
        await tx.rollback();
        return { success: false, message: 'Không tìm thấy Công Pháp này!' };
      }

      const curLevel = Number(skill.level || 1);
      const maxLevel = Number(skill.max_level || getTierInfo(skill.tier).maxLevel);
      if (curLevel >= maxLevel) {
        await tx.rollback();
        return { success: false, message: `**${skill.name}** đã đạt tầng tối đa (**Tầng ${maxLevel}/${maxLevel}**)!` };
      }

      const { silverCost, scrollCost } = getUpgradeCost(skill);

      const playerRes = await tx.execute({ sql: 'SELECT silver FROM tutien_players WHERE user_id = ?', args: [userId] });
      const player = playerRes.rows[0];
      if (!player || Number(player.silver) < silverCost) {
        await tx.rollback();
        return {
          success: false,
          message: `Không đủ Ngân Lượng! Nâng **${skill.name}** lên Tầng ${curLevel + 1} cần **${silverCost.toLocaleString('vi-VN')} Bạc** & **${scrollCost} ${SKILL_SCROLL_NAME}**.`
        };
      }

      const scrollCheck = await deductScrollsInTx(tx, userId, scrollCost);
      if (!scrollCheck.ok) {
        await tx.rollback();
        return {
          success: false,
          message: `Không đủ **${SKILL_SCROLL_NAME}**! Cần **${scrollCost}** quyển (Hiện có: **${scrollCheck.available}** quyển). Hãy Lĩnh Ngộ thêm hoặc phân giải bí tịch dư thừa!`
        };
      }

      await tx.execute({
        sql: 'UPDATE tutien_players SET silver = silver - ? WHERE user_id = ? AND silver >= ?',
        args: [silverCost, userId, silverCost]
      });

      const newLevel = curLevel + 1;
      const tier = Number(skill.tier || 1);
      const curDmgMult = Number(skill.damage_mult || 1.0);
      const curEffectVal = Number(skill.effect_value || 0);

      let newDmgMult = curDmgMult;
      let newEffectVal = curEffectVal;

      if (skill.type === 'active') {
        newDmgMult = Number((curDmgMult + 0.08 + tier * 0.02).toFixed(2));
        if (curEffectVal > 0 && skill.effect_type !== 'true_dmg') {
          newEffectVal = Number(Math.min(0.75, curEffectVal + 0.015).toFixed(3));
        }
      } else {
        // Passive: tăng giá trị buff theo từng tầng
        const step = Math.max(0.01, Number((curEffectVal * 0.14).toFixed(3)));
        newEffectVal = Number(Math.min(0.45, curEffectVal + step).toFixed(3));
      }

      await tx.execute({
        sql: 'UPDATE tutien_skills SET level = ?, damage_mult = ?, effect_value = ? WHERE id = ? AND user_id = ?',
        args: [newLevel, newDmgMult, newEffectVal, Number(skillId), userId]
      });

      await tx.commit();
      return {
        success: true,
        skillName: skill.name,
        oldLevel: curLevel,
        newLevel,
        maxLevel,
        oldDmgMult: curDmgMult,
        newDmgMult,
        oldEffectVal: curEffectVal,
        newEffectVal,
        silverCost,
        scrollCost,
        remainingScrolls: scrollCheck.available
      };
    } catch (error) {
      try { await tx.rollback(); } catch (_) {}
      throw error;
    }
  });
}

async function salvageSkill(userId, skillId) {
  const db = getDb();

  return withTransaction(db, async tx => {
    try {
      const skillRes = await tx.execute({
        sql: 'SELECT * FROM tutien_skills WHERE id = ? AND user_id = ?',
        args: [Number(skillId), userId]
      });
      const skill = skillRes.rows[0];
      if (!skill) {
        await tx.rollback();
        return { success: false, message: 'Không tìm thấy Công Pháp này!' };
      }
      if (Number(skill.is_equipped) === 1) {
        await tx.rollback();
        return { success: false, message: 'Không thể phân giải Công Pháp đang trang bị! Hãy tháo ra trước.' };
      }

      const scrollsGained = getTierInfo(skill.tier).salvageScrolls + Math.max(0, Number(skill.level || 1) - 1);
      await tx.execute({
        sql: 'DELETE FROM tutien_skills WHERE id = ? AND user_id = ? AND COALESCE(is_equipped, 0) = 0',
        args: [Number(skillId), userId]
      });
      await addScrollsInTx(tx, userId, scrollsGained);

      await tx.commit();
      return {
        success: true,
        scrollsGained,
        message: `Đã phân giải **${skill.name}** [${getTierInfo(skill.tier).name}] thành **+${scrollsGained} ${SKILL_SCROLL_NAME}**!`
      };
    } catch (error) {
      try { await tx.rollback(); } catch (_) {}
      throw error;
    }
  });
}

async function grantSkillScrolls(userId, amount) {
  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      await addScrollsInTx(tx, userId, Number(amount) || 0);
      await tx.commit();
    } catch (error) {
      try { await tx.rollback(); } catch (_) {}
      throw error;
    }
  });
}

module.exports = {
  COMPREHEND_COST_SINGLE,
  COMPREHEND_COST_FIVE,
  SKILL_SCROLL_TYPE,
  SKILL_SCROLL_KEY,
  SKILL_SCROLL_NAME,
  getMaxSkillSlots,
  getTierInfo,
  getUpgradeCost,
  getSkillScrollCount,
  getUserSkills,
  getEquippedSkills,
  equipSkill,
  unequipSkill,
  buyLibrarySkill,
  comprehendSkill,
  upgradeSkill,
  salvageSkill,
  grantSkillScrolls
};
