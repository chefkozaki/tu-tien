const { getDb } = require('../config/database');
const { getPlayer, addSilver, addXp } = require('./playerService');
const { getEquippedWeapon } = require('./weaponService');
const { getEquippedPets } = require('./petService');
const { getEquippedHelper } = require('./helperService');
const { getEquippedSkills } = require('./skillService');
const { getPetResonance } = require('./petConfigService');
const { calculateCombatStats, simulateCombat } = require('../utils/combat');
const { addItem } = require('./itemService');
const { REALMS, SPIRIT_GOLD_QUALITIES } = require('../config/constants');

const GOLD_PER_FLOOR_BY_QUALITY = new Map(
  REALMS.flatMap(realm => {
    const requirement = realm.breakthrough;
    return requirement?.spiritGoldQuality
      ? [[requirement.spiritGoldQuality, requirement.spiritGoldAmount / 10]]
      : [];
  })
);

function createTowerGuardianStats(playerStats, currentFloor) {
  const floorStage = Math.floor((currentFloor - 1) / 10);
  const floorMultiplier = 1 + floorStage * 0.05;
  const maxHp = Math.floor(
    (playerStats.atk * 4.5 + playerStats.maxHp * 0.15) * floorMultiplier
  );

  return {
    name: `Thủ Vệ Tháp Tầng ${currentFloor}`,
    race: 'nhan_toc',
    spiritRoot: 'kim',
    maxHp,
    hp: maxHp,
    atk: Math.floor(
      (playerStats.atk * 0.75 + playerStats.def * 0.5 + playerStats.maxHp * 0.02) * floorMultiplier
    ),
    def: Math.floor(
      (playerStats.atk * 0.3 + playerStats.maxHp * 0.015) * floorMultiplier
    ),
    speed: Math.floor(playerStats.speed * (0.9 + floorStage * 0.015)),
    crit: Math.min(0.15, 0.08 + floorStage * 0.005),
    critDmg: 1.5,
    lifesteal: 0,
    physResist: 0.05,
    ccResist: 0.1,
    trueDamage: false,
    activeResonance: null,
    helper: null,
    skills: [{ name: 'Trấn Tháp Quyền', damage_mult: 1.2 }]
  };
}

async function challengeTower(userId) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player) return { success: false, message: 'Đạo hữu chưa bước vào tu tiên!' };

  const currentFloor = player.tower_floor || 1;
  const weapon = await getEquippedWeapon(userId);
  const pets = await getEquippedPets(userId);
  const helper = await getEquippedHelper(userId);
  const skills = await getEquippedSkills(userId);

  const petResonance = await getPetResonance();
  const playerStats = calculateCombatStats(player, weapon, pets, helper, skills, petResonance);

  const guardianStats = createTowerGuardianStats(playerStats, currentFloor);
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

    // Mỗi chặng 10 tầng thưởng đúng lượng Linh Kim cần cho lần đột phá tương ứng.
    const goldIndex = Math.min(
      SPIRIT_GOLD_QUALITIES.length - 1,
      Math.floor((currentFloor - 1) / 10)
    );
    const goldQuality = SPIRIT_GOLD_QUALITIES[goldIndex].id;
    const goldAmount = GOLD_PER_FLOOR_BY_QUALITY.get(goldQuality);
    if (!Number.isInteger(goldAmount)) {
      throw new Error(`Missing tower reward configuration for spirit gold quality "${goldQuality}".`);
    }
    await addItem(userId, 'spirit_gold', goldQuality, `Linh Kim (Phẩm ${goldQuality})`, goldAmount);

    return {
      success: true,
      clearedFloor: currentFloor,
      nextFloor: currentFloor + 1,
      silverReward,
      xpReward,
      goldQuality,
      goldAmount,
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
  challengeTower,
  createTowerGuardianStats
};
