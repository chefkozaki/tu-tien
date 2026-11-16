const { getDb } = require('../config/database');
const { getPlayer, addSilver } = require('./playerService');
const { getEquippedWeapon } = require('./weaponService');
const { getEquippedPets } = require('./petService');
const { getEquippedHelper } = require('./helperService');
const { getPetResonance } = require('./petConfigService');
const { calculateCombatStats } = require('../utils/combat');
const { addItem } = require('./itemService');

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

  // Nếu chưa có boss sống, triệu hồi con mới
  const template = BOSS_LIST[Math.floor(Math.random() * BOSS_LIST.length)];
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO tutien_world_boss (name, current_hp, max_hp, status, spawn_time, damage_data)
      VALUES (?, ?, ?, 'alive', ?, '{}')`,
    args: [template.name, template.baseHp.toString(), template.baseHp.toString(), now]
  });

  res = await db.execute("SELECT * FROM tutien_world_boss WHERE status = 'alive' ORDER BY id DESC LIMIT 1");
  return res.rows[0];
}

async function attackBoss(userId) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player) return { success: false, message: 'Đạo hữu chưa bước vào con đường tu tiên!' };

  const boss = await getActiveBoss();
  const weapon = await getEquippedWeapon(userId);
  const pets = await getEquippedPets(userId);
  const helper = await getEquippedHelper(userId);

  const petResonance = await getPetResonance();
  const combatStats = calculateCombatStats(player, weapon, pets, helper, [], petResonance);

  // Tính sát thương 5 hiệp đánh boss
  let totalDmg = 0;
  for (let round = 1; round <= 5; round++) {
    let roundDmg = combatStats.atk * (0.8 + Math.random() * 0.4);
    if (Math.random() < combatStats.crit) {
      roundDmg *= combatStats.critDmg;
    }
    totalDmg += Math.floor(roundDmg);
  }

  let currentHp = BigInt(boss.current_hp);
  let dealDmg = BigInt(totalDmg);
  let isDefeated = false;

  if (dealDmg >= currentHp) {
    dealDmg = currentHp;
    currentHp = 0n;
    isDefeated = true;
  } else {
    currentHp -= dealDmg;
  }

  // Cập nhật bảng xếp hạng sát thương
  const damageMap = JSON.parse(boss.damage_data || '{}');
  damageMap[userId] = (damageMap[userId] || 0) + Number(dealDmg);

  await db.execute({
    sql: 'UPDATE tutien_world_boss SET current_hp = ?, status = ?, damage_data = ? WHERE id = ?',
    args: [currentHp.toString(), isDefeated ? 'defeated' : 'alive', JSON.stringify(damageMap), boss.id]
  });

  // Thưởng bạc và XP tức thời
  const silverReward = Math.floor(totalDmg * 0.1);
  await addSilver(userId, silverReward);

  // Nếu boss bị hạ gục, phát thưởng xếp hạng cho người chơi
  let rewardSummary = null;
  if (isDefeated) {
    rewardSummary = await distributeBossRewards(boss.id, damageMap);
  }

  return {
    success: true,
    bossName: boss.name,
    damageDealt: Number(dealDmg),
    remainingHp: currentHp.toString(),
    maxHp: boss.max_hp,
    isDefeated,
    silverReward,
    rewardSummary
  };
}

async function distributeBossRewards(bossId, damageMap) {
  // Sắp xếp top sát thương
  const sorted = Object.entries(damageMap).sort((a, b) => b[1] - a[1]);
  const rewardsLog = [];

  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const [uid, dmg] = sorted[i];
    const rank = i + 1;
    let goldTier = rank === 1 ? 'Thiên' : (rank <= 3 ? 'Địa' : 'Linh');
    let goldAmount = rank === 1 ? 50 : (rank <= 3 ? 30 : 15);
    let silverBonus = rank === 1 ? 100000 : 50000;

    await addItem(uid, 'spirit_gold', goldTier, `Linh Kim (Phẩm ${goldTier})`, goldAmount);
    await addSilver(uid, silverBonus);

    // Thưởng thêm linh thú cho top 1 nếu may mắn
    if (rank === 1 && Math.random() < 0.5) {
      const db = getDb();
      await db.execute({
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
