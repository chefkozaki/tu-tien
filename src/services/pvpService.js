const { getDb } = require('../config/database');
const { getPlayer, addSilver } = require('./playerService');
const { getEquippedWeapon } = require('./weaponService');
const { getEquippedPets } = require('./petService');
const { getEquippedHelper } = require('./helperService');
const { getPetResonance } = require('./petConfigService');
const { calculateCombatStats, simulateCombat } = require('../utils/combat');

async function duelPlayers(challengerId, targetId) {
  if (challengerId === targetId) {
    return { success: false, message: 'Đạo hữu không thể tự đấu pháp với chính mình!' };
  }

  const p1 = await getPlayer(challengerId);
  const p2 = await getPlayer(targetId);

  if (!p1) return { success: false, message: 'Đạo hữu chưa bước vào tu tiên! Dùng `/start` trước.' };
  if (!p2) return { success: false, message: 'Đối thủ chưa bước vào con đường tu tiên!' };

  const [w1, w2] = await Promise.all([getEquippedWeapon(challengerId), getEquippedWeapon(targetId)]);
  const [pets1, pets2] = await Promise.all([getEquippedPets(challengerId), getEquippedPets(targetId)]);
  const [h1, h2] = await Promise.all([getEquippedHelper(challengerId), getEquippedHelper(targetId)]);

  const petResonance = await getPetResonance();
  const p1Stats = calculateCombatStats(p1, w1, pets1, h1, [], petResonance);
  const p2Stats = calculateCombatStats(p2, w2, pets2, h2, [], petResonance);

  const result = simulateCombat(p1Stats, p2Stats);
  const db = getDb();

  const winnerId = result.isAttackerWin ? challengerId : targetId;
  const loserId = result.isAttackerWin ? targetId : challengerId;

  // Cập nhật điểm Đấu Pháp Đài
  await db.execute({
    sql: 'UPDATE tutien_players SET pvp_points = pvp_points + 25 WHERE user_id = ?',
    args: [winnerId]
  });
  await db.execute({
    sql: 'UPDATE tutien_players SET pvp_points = MAX(0, pvp_points - 15) WHERE user_id = ?',
    args: [loserId]
  });

  // Thưởng bạc người thắng
  await addSilver(winnerId, 10000);

  return {
    success: true,
    winnerName: result.winner,
    isChallengerWin: result.isAttackerWin,
    challengerName: p1.dao_hieu || p1.username,
    targetName: p2.dao_hieu || p2.username,
    logs: result.logs
  };
}

module.exports = {
  duelPlayers
};
