const { getDb } = require('../config/database');
const { getPlayer } = require('./playerService');
const { getEquippedWeapon } = require('./weaponService');
const { getEquippedPets } = require('./petService');
const { getEquippedHelper } = require('./helperService');
const { getEquippedSkills } = require('./skillService');
const { getPetResonance } = require('./petConfigService');
const { calculateCombatStats } = require('../utils/combat');
const { announceBossSpawn } = require('./bossAnnouncementService');
const { withTransaction } = require('../utils/databaseTransaction');

const BOSS_LIST = [
  { name: 'Thôn Thiên Ma Thú (Thượng Cổ)', baseHp: 50000000 },
  { name: 'Cửu Đầu Thao Thiết', baseHp: 150000000 },
  { name: 'Viễn Cổ Hắc Long', baseHp: 500000000 },
  { name: 'Thái Sơ Hỗn Độn Ma Viên', baseHp: 2000000000 }
];

async function getActiveBoss() {
  const db = getDb();
  let res = await db.execute("SELECT * FROM tutien_world_boss WHERE status = 'alive' ORDER BY id DESC LIMIT 1");
  if (res.rows[0]) return res.rows[0];

  const result = await withTransaction(db, async tx => {
    try {
      const activeResult = await tx.execute(
        "SELECT * FROM tutien_world_boss WHERE status = 'alive' ORDER BY id DESC LIMIT 1"
      );
      if (activeResult.rows[0]) {
        await tx.commit();
        return { boss: activeResult.rows[0], created: false };
      }

      const template = BOSS_LIST[Math.floor(Math.random() * BOSS_LIST.length)];
      const now = Date.now();
      await tx.execute({
        sql: `INSERT INTO tutien_world_boss (name, current_hp, max_hp, status, spawn_time, damage_data)
          VALUES (?, ?, ?, 'alive', ?, '{}')`,
        args: [template.name, template.baseHp.toString(), template.baseHp.toString(), now]
      });
      const createdResult = await tx.execute(
        "SELECT * FROM tutien_world_boss WHERE status = 'alive' ORDER BY id DESC LIMIT 1"
      );
      await tx.commit();
      return { boss: createdResult.rows[0], created: true };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });

  if (result.created) await announceBossSpawn(result.boss);
  return result.boss;
}

async function attackBoss(userId) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player) return { success: false, message: 'Đạo hữu chưa bước vào con đường tu tiên!' };

  const boss = await getActiveBoss();
  const weapon = await getEquippedWeapon(userId);
  const pets = await getEquippedPets(userId);
  const helper = await getEquippedHelper(userId);
  const skills = await getEquippedSkills(userId);

  const petResonance = await getPetResonance();
  const combatStats = calculateCombatStats(player, weapon, pets, helper, skills, petResonance);

  // Tính sát thương 5 hiệp đánh boss
  let totalDmg = 0;
  for (let round = 1; round <= 5; round++) {
    let roundDmg = combatStats.atk * (0.8 + Math.random() * 0.4);
    if (Math.random() < combatStats.crit) {
      roundDmg *= combatStats.critDmg;
    }
    if (combatStats.skills.length > 0 && Math.random() < 0.4) {
      const skill = combatStats.skills[Math.floor(Math.random() * combatStats.skills.length)];
      roundDmg *= skill.damage_mult || 1.3;
    }
    totalDmg += Math.floor(roundDmg);
  }

  return withTransaction(db, async tx => {
    try {
      const activeBossResult = await tx.execute({
        sql: "SELECT * FROM tutien_world_boss WHERE id = ? AND status = 'alive'",
        args: [boss.id]
      });
      const activeBoss = activeBossResult.rows[0];
      if (!activeBoss) {
        await tx.rollback();
        return { success: false, message: 'Boss đã bị đánh bại. Hãy gọi lại lệnh để khiêu chiến boss mới!' };
      }

      const currentHp = BigInt(activeBoss.current_hp);
      const dealtDamage = BigInt(totalDmg) < currentHp ? BigInt(totalDmg) : currentHp;
      const remainingHp = currentHp - dealtDamage;
      const isDefeated = remainingHp === 0n;
      const damageMap = JSON.parse(activeBoss.damage_data || '{}');
      damageMap[userId] = Number(damageMap[userId] || 0) + Number(dealtDamage);

      const updateResult = await tx.execute({
        sql: `UPDATE tutien_world_boss SET current_hp = ?, status = ?, damage_data = ?
          WHERE id = ? AND status = 'alive'`,
        args: [remainingHp.toString(), isDefeated ? 'defeated' : 'alive', JSON.stringify(damageMap), boss.id]
      });
      if (updateResult.rowsAffected !== 1) {
        await tx.rollback();
        return { success: false, message: 'Boss vừa bị đánh bại bởi một đạo hữu khác. Hãy gọi lại lệnh để khiêu chiến boss mới!' };
      }

      const damageDealt = Number(dealtDamage);
      const silverReward = Math.floor(damageDealt * 0.1);
      await tx.execute({
        sql: 'UPDATE tutien_players SET silver = MAX(0, silver + ?) WHERE user_id = ?',
        args: [silverReward, userId]
      });

      let rewardSummary = null;
      if (isDefeated) {
        rewardSummary = await distributeBossRewardsInTransaction(tx, damageMap);
      }

      await tx.commit();
      return {
        success: true,
        bossName: activeBoss.name,
        damageDealt,
        remainingHp: remainingHp.toString(),
        maxHp: activeBoss.max_hp,
        isDefeated,
        silverReward,
        rewardSummary
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

async function addInventoryItem(tx, userId, itemKey, itemName, amount) {
  const result = await tx.execute({
    sql: `SELECT id FROM tutien_inventory
      WHERE user_id = ? AND item_type = 'spirit_gold' AND item_key = ?
      ORDER BY id LIMIT 1`,
    args: [userId, itemKey]
  });
  if (result.rows[0]) {
    await tx.execute({
      sql: 'UPDATE tutien_inventory SET amount = amount + ? WHERE id = ?',
      args: [amount, result.rows[0].id]
    });
  } else {
    await tx.execute({
      sql: `INSERT INTO tutien_inventory (user_id, item_type, item_key, item_name, amount)
        VALUES (?, 'spirit_gold', ?, ?, ?)`,
      args: [userId, itemKey, itemName, amount]
    });
  }
}

async function distributeBossRewardsInTransaction(tx, damageMap) {
  // Sắp xếp top sát thương
  const sorted = Object.entries(damageMap).sort((a, b) => Number(b[1]) - Number(a[1]));
  const rewardsLog = [];

  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const [uid] = sorted[i];
    const rank = i + 1;
    let goldTier = rank === 1 ? 'Thiên' : (rank <= 3 ? 'Địa' : 'Linh');
    let goldAmount = rank === 1 ? 50 : (rank <= 3 ? 30 : 15);
    let silverBonus = rank === 1 ? 100000 : 50000;

    await addInventoryItem(tx, uid, goldTier, `Linh Kim (Phẩm ${goldTier})`, goldAmount);
    await tx.execute({
      sql: 'UPDATE tutien_players SET silver = MAX(0, silver + ?) WHERE user_id = ?',
      args: [silverBonus, uid]
    });

    // Thưởng thêm linh thú cho top 1 nếu may mắn
    if (rank === 1 && Math.random() < 0.5) {
      await tx.execute({
        sql: `INSERT INTO tutien_pets (user_id, name, element, is_mythic, star, hp, atk, def, speed, crit, effect_desc)
          VALUES (?, 'Hắc Long Chi Hồn (Thần Thoại)', 'Lôi', 1, 2, 2500, 350, 180, 140, 0.12, 'Tăng 20% sát thương bạo kích và kháng khống chế')`,
        args: [uid]
      });
      rewardsLog.push(`🏆 Hạng ${rank}: Nhận ${goldAmount} Linh Kim (${goldTier}) + ${silverBonus.toLocaleString()} Bạc + 🐉 **Hắc Long Chi Hồn (Thần Thoại)**!`);
    } else {
      rewardsLog.push(`🎖️ Hạng ${rank}: Nhận ${goldAmount} Linh Kim (${goldTier}) + ${silverBonus.toLocaleString()} Bạc!`);
    }
  }

  return rewardsLog.join('\n');
}

module.exports = {
  getActiveBoss,
  attackBoss
};
