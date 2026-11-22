const { getDb } = require('../config/database');
const { REALMS } = require('../config/constants');
const { getPlayer, addSilver } = require('./playerService');
const { getEquippedWeapon } = require('./weaponService');
const { getEquippedPets } = require('./petService');
const { getEquippedHelper } = require('./helperService');
const { getEquippedSkills } = require('./skillService');
const { getPetResonance } = require('./petConfigService');
const { calculateCombatStats, simulateCombat } = require('../utils/combat');

const MAX_REALM_DIFF = 2;
const ELO_K_FACTOR = 45;
const REALM_ELO_WEIGHT = 120;

/**
 * Tính điểm Elo cộng/trừ và thưởng Bạc dựa theo chênh lệch thực lực (pvp_points + realm_id)
 */
function calculateEloDelta(winner, loser, isFairMode = false) {
  const winnerPoints = Number(winner.pvp_points ?? 1000);
  const loserPoints = Number(loser.pvp_points ?? 1000);
  const realmDiff = isFairMode ? 0 : (Number(winner.realm_id || 0) - Number(loser.realm_id || 0));

  const winnerRating = winnerPoints + (isFairMode ? 0 : Number(winner.realm_id || 0) * REALM_ELO_WEIGHT);
  const loserRating = loserPoints + (isFairMode ? 0 : Number(loser.realm_id || 0) * REALM_ELO_WEIGHT);
  const ratingDiff = winnerRating - loserRating;

  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const rawGain = Math.round(ELO_K_FACTOR * (1 - expectedWinner));

  // Chống farm người yếu hơn quá nhiều
  if (ratingDiff >= 600) {
    return { winnerGain: 0, loserLoss: 0, silverReward: 0 };
  }

  if (ratingDiff >= 350 || (!isFairMode && realmDiff >= 2)) {
    return {
      winnerGain: Math.min(5, Math.max(1, rawGain)),
      loserLoss: 5,
      silverReward: 3000
    };
  }

  const winnerGain = Math.max(5, Math.min(45, rawGain));
  // Nếu người thua yếu hơn nhiều so với người thắng, giảm lượng điểm bị trừ (chỉ mất 5-10 điểm)
  const loserLoss = Math.max(5, Math.min(25, Math.round(winnerGain * 0.65)));
  const silverReward = isFairMode ? 6000 : 10000;

  return { winnerGain, loserLoss, silverReward };
}

async function duelPlayers(challengerId, targetId, mode = 'rank') {
  if (challengerId === targetId) {
    return { success: false, message: 'Đạo hữu không thể tự đấu pháp với chính mình!' };
  }

  const normalizedMode = String(mode || 'rank').trim().toLowerCase() === 'fair' ? 'fair' : 'rank';
  const isFairMode = normalizedMode === 'fair';

  const p1 = await getPlayer(challengerId);
  const p2 = await getPlayer(targetId);

  if (!p1) return { success: false, message: 'Đạo hữu chưa bước vào tu tiên! Dùng `/start` trước.' };
  if (!p2) return { success: false, message: 'Đối thủ chưa bước vào con đường tu tiên!' };

  // Kiểm tra giới hạn chênh lệch cảnh giới ở chế độ Xếp Hạng
  const realmDiff = Math.abs(Number(p1.realm_id || 0) - Number(p2.realm_id || 0));
  if (!isFairMode && realmDiff > MAX_REALM_DIFF) {
    const r1 = REALMS[p1.realm_id]?.name || `Cảnh giới ${p1.realm_id}`;
    const r2 = REALMS[p2.realm_id]?.name || `Cảnh giới ${p2.realm_id}`;
    return {
      success: false,
      message:
        `Chênh lệch cảnh giới quá lớn (**${r1}** vs **${r2}**, lệch **${realmDiff}** cảnh giới; giới hạn Đấu Xếp Hạng là **±${MAX_REALM_DIFF}** cảnh giới).\n` +
        `👉 Hãy chọn đối thủ ngang tầm hoặc dùng \`/duel target:@user mode:fair\` (hoặc \`aduel @user fair\`) để luận bàn **Đồng Cảnh Giới**!`
    };
  }

  const [w1, w2] = await Promise.all([getEquippedWeapon(challengerId), getEquippedWeapon(targetId)]);
  const [pets1, pets2] = await Promise.all([getEquippedPets(challengerId), getEquippedPets(targetId)]);
  const [h1, h2] = await Promise.all([getEquippedHelper(challengerId), getEquippedHelper(targetId)]);
  const [skills1, skills2] = await Promise.all([getEquippedSkills(challengerId), getEquippedSkills(targetId)]);

  const petResonance = await getPetResonance();

  const equalizeRealm = isFairMode
    ? {
        realm_id: Math.round((Number(p1.realm_id || 0) + Number(p2.realm_id || 0)) / 2),
        level: 5
      }
    : null;

  const combatStatOptions = { isPvp: true, equalizeRealm };
  const p1Stats = calculateCombatStats(p1, w1, pets1, h1, skills1, petResonance, combatStatOptions);
  const p2Stats = calculateCombatStats(p2, w2, pets2, h2, skills2, petResonance, combatStatOptions);

  const result = simulateCombat(p1Stats, p2Stats, 20, { isPvp: true });
  const db = getDb();

  let winnerGain = 0;
  let loserLoss = 0;
  let silverReward = 0;

  if (!result.isDraw) {
    const winnerPlayer = result.isAttackerWin ? p1 : p2;
    const loserPlayer = result.isAttackerWin ? p2 : p1;
    const winnerId = result.isAttackerWin ? challengerId : targetId;
    const loserId = result.isAttackerWin ? targetId : challengerId;

    const elo = calculateEloDelta(winnerPlayer, loserPlayer, isFairMode);
    winnerGain = elo.winnerGain;
    loserLoss = elo.loserLoss;
    silverReward = elo.silverReward;

    if (winnerGain > 0) {
      await db.execute({
        sql: 'UPDATE tutien_players SET pvp_points = pvp_points + ? WHERE user_id = ?',
        args: [winnerGain, winnerId]
      });
    }
    if (loserLoss > 0) {
      await db.execute({
        sql: 'UPDATE tutien_players SET pvp_points = MAX(0, pvp_points - ?) WHERE user_id = ?',
        args: [loserLoss, loserId]
      });
    }
    if (silverReward > 0) {
      await addSilver(winnerId, silverReward);
    }
  }

  return {
    success: true,
    mode: normalizedMode,
    equalizeRealm,
    winnerName: result.winner,
    isChallengerWin: result.isAttackerWin,
    isDraw: result.isDraw,
    winnerGain,
    loserLoss,
    silverReward,
    challengerName: p1.dao_hieu || p1.username,
    targetName: p2.dao_hieu || p2.username,
    challengerHpPercent: result.attackerHpPercent,
    targetHpPercent: result.defenderHpPercent,
    logs: result.logs
  };
}

module.exports = {
  duelPlayers,
  calculateEloDelta,
  MAX_REALM_DIFF
};
