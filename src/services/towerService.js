const { getDb } = require('../config/database');
const { getPlayer, addSilver, addXp } = require('./playerService');
const { getEquippedWeapon } = require('./weaponService');
const { getEquippedPets } = require('./petService');
const { getEquippedHelper } = require('./helperService');
const { getPetResonance } = require('./petConfigService');
const { calculateCombatStats, simulateCombat } = require('../utils/combat');
const { addItem } = require('./itemService');
const { SPIRIT_GOLD_QUALITIES } = require('../config/constants');

async function challengeTower(userId) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player) return { success: false, message: 'Đạo hữu chưa bước vào tu tiên!' };

  const currentFloor = player.tower_floor || 1;
  const weapon = await getEquippedWeapon(userId);
  const pets = await getEquippedPets(userId);
  const helper = await getEquippedHelper(userId);

  const petResonance = await getPetResonance();
  const playerStats = calculateCombatStats(player, weapon, pets, helper, [], petResonance);

  // Guardian stats based on tower floor
  const floorMultiplier = 1 + (currentFloor - 1) * 0.25;
  const guardianStats = {
    name: `Thủ Vệ Tháp Tầng ${currentFloor}`,
    race: 'nhan_toc',
    spiritRoot: 'kim',
    maxHp: Math.floor(800 * floorMultiplier),
    hp: Math.floor(800 * floorMultiplier),
    atk: Math.floor(100 * floorMultiplier),
    def: Math.floor(60 * floorMultiplier),
    speed: Math.floor(90 * (1 + currentFloor * 0.02)),
    crit: 0.05,
    critDmg: 1.5,
    lifesteal: 0,
    physResist: 0.05,
    ccResist: 0.1,
    trueDamage: false,
    activeResonance: null,
    helper: null,
    skills: [{ name: 'Trấn Tháp Quyền', damage_mult: 1.2 }]
  };

  const battleResult = simulateCombat(playerStats, guardianStats);

  if (battleResult.isAttackerWin) {
    // Thăng tầng tháp
    await db.execute({
      sql: 'UPDATE tutien_players SET tower_floor = tower_floor + 1 WHERE user_id = ?',
      args: [userId]
    });

    // Phần thưởng
    const silverReward = 3000 + currentFloor * 1000;
    const xpReward = 1000 + currentFloor * 800;
    await addSilver(userId, silverReward);
    await addXp(userId, xpReward);

    // Thưởng Linh Kim dựa theo tầng
    const goldIndex = Math.min(SPIRIT_GOLD_QUALITIES.length - 1, Math.floor(currentFloor / 10));
    const goldQuality = SPIRIT_GOLD_QUALITIES[goldIndex].id;
    await addItem(userId, 'spirit_gold', goldQuality, `Linh Kim (Phẩm ${goldQuality})`, 2 + Math.floor(currentFloor / 5));

    return {
      success: true,
      clearedFloor: currentFloor,
      nextFloor: currentFloor + 1,
      silverReward,
      xpReward,
      goldQuality,
      goldAmount: 2 + Math.floor(currentFloor / 5),
      logs: battleResult.logs
    };
  } else {
    return {
      success: false,
      failedFloor: currentFloor,
      logs: battleResult.logs
    };
  }
}

module.exports = {
  challengeTower
};
