const { getDb } = require('../config/database');
const { getPlayer, addSilver, addXp } = require('./playerService');
const { getEquippedWeapon } = require('./weaponService');
const { getEquippedArmor } = require('./armorService');
const { getEquippedPets } = require('./petService');
const { getEquippedHelper } = require('./helperService');
const { getEquippedSkills, grantSkillScrolls } = require('./skillService');
const { getPetResonance } = require('./petConfigService');
const { calculateCombatStats, simulateCombat } = require('../utils/combat');
const { addItem } = require('./itemService');
const { REALMS, SPIRIT_GOLD_QUALITIES } = require('../config/constants');

const GOLD_PER_FLOOR_BY_QUALITY = new Map(
  REALMS.flatMap(realm => {
    const requirement = realm.breakthrough;
    return requirement?.spiritGoldQuality
      ? [[requirement.spiritGoldQuality, Math.max(1, Math.floor(requirement.spiritGoldAmount / 100))]]
      : [];
  })
);

const TOWER_GUARDIAN_BASE = Object.freeze({
  maxHp: 1200,
  atk: 120,
  def: 60,
  speed: 85
});

function createTowerGuardianStats(currentFloor) {
  const safeFloor = Math.max(1, Math.floor(Number(currentFloor) || 1));
  const stageIndex = Math.floor((safeFloor - 1) / 10);
  const floorInStage = (safeFloor - 1) % 10;
  const stageMultiplier = Math.pow(1.18, stageIndex);
  const floorMultiplier = Math.pow(1.025, floorInStage);
  const maxHp = Math.floor(TOWER_GUARDIAN_BASE.maxHp * stageMultiplier * floorMultiplier);
  const atk = Math.floor(TOWER_GUARDIAN_BASE.atk * stageMultiplier * floorMultiplier);
  const def = Math.floor(TOWER_GUARDIAN_BASE.def * stageMultiplier * floorMultiplier);

  return {
    name: `Thủ Vệ Tháp Tầng ${safeFloor}`,
    race: 'nhan_toc',
    spiritRoot: 'kim',
    maxHp,
    hp: maxHp,
    atk,
    def,
    speed: TOWER_GUARDIAN_BASE.speed + stageIndex * 8 + floorInStage,
    crit: Math.min(0.25, 0.08 + stageIndex * 0.008 + floorInStage * 0.002),
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
  const armor = await getEquippedArmor(userId);
  const pets = await getEquippedPets(userId);
  const helper = await getEquippedHelper(userId);
  const skills = await getEquippedSkills(userId);

  const petResonance = await getPetResonance();
  const playerStats = calculateCombatStats(player, weapon, pets, helper, skills, petResonance, { armor });

  const guardianStats = createTowerGuardianStats(currentFloor);
  const battleResult = simulateCombat(playerStats, guardianStats);

  if (battleResult.isAttackerWin) {
    // Thăng tầng tháp
    await db.execute({
      sql: 'UPDATE tutien_players SET tower_floor = tower_floor + 1 WHERE user_id = ?',
      args: [userId]
    });

    // Phần thưởng
    const silverReward = 1500 + currentFloor * 500;
    const xpReward = 500 + currentFloor * 400;
    await addSilver(userId, silverReward);
    await addXp(userId, xpReward);

    // Mỗi tầng thưởng 1% Linh Kim đột phá, làm tròn xuống và tối thiểu 1 viên.
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

    // Mốc mỗi 10 tầng thưởng thêm Tàn Quyển Công Pháp
    let skillScrollReward = 0;
    if (currentFloor % 10 === 0) {
      skillScrollReward = 2 + Math.floor(currentFloor / 10);
      await grantSkillScrolls(userId, skillScrollReward);
    }

    return {
      success: true,
      clearedFloor: currentFloor,
      nextFloor: currentFloor + 1,
      silverReward,
      xpReward,
      goldQuality,
      goldAmount,
      skillScrollReward,
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
