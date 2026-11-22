const { RACES, SPIRIT_ROOTS, PET_RESONANCES } = require('../config/constants');

const ELEMENT_COUNTERS = Object.values(SPIRIT_ROOTS).reduce((acc, root) => {
  acc[root.element] = root.counters;
  return acc;
}, {});

const PVP_DAMAGE_MULTIPLIER = 0.65;
const PVP_SOFT_CAP_OVERFLOW_RATIO = 0.35;

/**
 * Giới hạn mềm (Soft Cap) cho chỉ số cộng thêm từ trang bị/linh thú/trợ thủ trong PvP:
 * - Phần dưới ngưỡng trần giữ nguyên 100%
 * - Phần vượt ngưỡng trần chỉ tính 35% để tránh mất cân bằng ở đầu game
 */
function applyPvpSoftCap(rawBonus, cap) {
  if (rawBonus <= 0) return 0;
  if (rawBonus <= cap) return Math.floor(rawBonus);
  return Math.floor(cap + (rawBonus - cap) * PVP_SOFT_CAP_OVERFLOW_RATIO);
}

/**
 * Tính toán chỉ số tổng hợp của người chơi bao gồm:
 * - Base stats theo Tộc & Cảnh giới & Level
 * - Chỉ số từ Linh Khí (Bản mệnh / Thường)
 * - Chỉ số từ 3 Linh Thú (kể cả cộng hưởng Trận Pháp)
 * - Trợ Thủ Chiến Đấu
 *
 * @param {object} options
 * @param {boolean} [options.isPvp=false] - Bật chuẩn hóa & soft cap cho PvP
 * @param {{ realm_id: number, level: number }} [options.equalizeRealm] - Chuẩn hóa cảnh giới/cấp độ cho chế độ Đồng Cảnh Giới
 */
function calculateCombatStats(player, weapon, pets = [], helper = null, skills = [], petResonance = null, options = {}) {
  const { isPvp = false, equalizeRealm = null } = options || {};
  const race = RACES[player.race] || RACES.nhan_toc;

  const effectiveRealmId = equalizeRealm ? equalizeRealm.realm_id : Number(player.realm_id || 0);
  const effectiveLevel = equalizeRealm ? equalizeRealm.level : Number(player.level || 1);

  // Trong PvP giảm độ dốc realmMultiplier (1.0/cảnh giới thay vì 1.5) để hạn chế one-shot khi lệch 1-2 cảnh giới
  const realmMultiplier = isPvp
    ? 1 + effectiveRealmId * 1.0 + (effectiveLevel - 1) * 0.10
    : 1 + effectiveRealmId * 1.5 + (effectiveLevel - 1) * 0.15;

  let hp = Math.floor(race.baseStats.hp * realmMultiplier);
  let atk = Math.floor(race.baseStats.atk * realmMultiplier);
  let def = Math.floor(race.baseStats.def * realmMultiplier);
  let speed = Math.floor(race.baseStats.speed * (1 + (effectiveRealmId * 0.05)));
  let crit = race.baseStats.crit;
  let critDmg = race.baseStats.critDmg;
  let lifesteal = 0;
  let physResist = 0;
  let ccResist = 0;
  const trueDamage = Boolean(race.talent?.trueDamage);

  // Race Passive Modifiers
  if (player.race === 'long_toc') {
    hp = Math.floor(hp * (1 + race.passive.hpBonus));
    physResist += race.passive.physResist;
  } else if (player.race === 'tien_toc') {
    atk = Math.floor(atk * (1 + race.passive.magicDmgBonus));
    speed = Math.floor(speed * (1 + race.passive.speedBonus));
  } else if (player.race === 'ma_toc') {
    crit += race.passive.critBonus;
    lifesteal += race.passive.lifesteal;
  } else if (player.race === 'ro_toc') {
    atk = Math.floor(atk * (1 + race.passive.atkBonus));
    ccResist += race.passive.ccResist;
  }

  // Lưu base stats sau Tộc & Cảnh giới để tính ngưỡng soft cap PvP
  const baseHp = hp;
  const baseAtk = atk;
  const baseDef = def;
  const baseSpeed = speed;

  let gearHp = 0;
  let gearAtk = 0;
  let gearDef = 0;
  let gearSpeed = 0;

  // Weapon Stats
  if (weapon) {
    let weaponAtk = weapon.atk;
    let weaponDef = weapon.def;
    if (weapon.is_natal) {
      // Bản mệnh linh khí tăng tiến theo cảnh giới chủ nhân
      const natalBonus = 1 + effectiveRealmId * (isPvp ? 0.22 : 0.3);
      weaponAtk = Math.floor(weaponAtk * natalBonus);
      weaponDef = Math.floor(weaponDef * natalBonus);
    }
    gearAtk += weaponAtk;
    gearDef += weaponDef;
  }

  // Pet Stats & Resonance (Trận Pháp Linh Thú)
  let activeResonance = null;
  if (pets && pets.length > 0) {
    for (const pet of pets) {
      const starBonus = 1 + (pet.star - 1) * 0.25;
      gearHp += Math.floor(pet.hp * starBonus);
      gearAtk += Math.floor(pet.atk * starBonus);
      gearDef += Math.floor(pet.def * starBonus);
      gearSpeed += Math.floor(pet.speed * starBonus);
      crit += pet.crit || 0.02;
    }

    // Kiểm tra Trận Pháp
    if (pets.length === 3) {
      const elements = pets.map(p => p.element);
      const isSameElement = elements.every(e => e === elements[0]);
      if (isSameElement) {
        const resonance = petResonance || PET_RESONANCES.same_element_3;
        activeResonance = {
          name: `${resonance.name} (${elements[0]})`,
          desc: resonance.desc,
          buff: resonance.buff
        };
      }
    }
  }

  // Helper (Trợ thủ chiến đấu)
  if (helper && helper.type === 'combat') {
    const helperTierBonus = 1 + (helper.tier - 1) * 0.3;
    gearAtk += Math.floor(100 * helperTierBonus);
    gearHp += Math.floor(600 * helperTierBonus);
    gearDef += Math.floor(50 * helperTierBonus);
  }

  // Trong PvP áp dụng Soft Cap theo cảnh giới cho tổng chỉ số từ Linh Khí + Linh Thú + Trợ Thủ
  if (isPvp) {
    const capScale = 1.2 + effectiveRealmId * 0.25;
    hp += applyPvpSoftCap(gearHp, baseHp * capScale);
    atk += applyPvpSoftCap(gearAtk, baseAtk * capScale);
    def += applyPvpSoftCap(gearDef, baseDef * capScale);
    speed += applyPvpSoftCap(gearSpeed, baseSpeed * 0.8);
  } else {
    hp += gearHp;
    atk += gearAtk;
    def += gearDef;
    speed += gearSpeed;
  }

  // Áp dụng buff Cộng Hưởng Trận Pháp Linh Thú
  if (activeResonance && activeResonance.buff) {
    hp = Math.floor(hp * activeResonance.buff.hpMultiplier);
    atk = Math.floor(atk * activeResonance.buff.atkMultiplier);
    def = Math.floor(def * activeResonance.buff.defMultiplier);
    speed = Math.floor(speed * activeResonance.buff.speedMultiplier);
    crit += activeResonance.buff.critBonus;
    physResist = Math.min(0.9, physResist + activeResonance.buff.physResistBonus);
  }

  return {
    name: player.dao_hieu || player.username,
    race: player.race,
    spiritRoot: player.spirit_root,
    maxHp: hp,
    hp: hp,
    atk: atk,
    def: def,
    speed: speed,
    crit: Math.min(crit, 0.85),
    critDmg: critDmg,
    lifesteal: lifesteal,
    physResist: physResist,
    ccResist: ccResist,
    trueDamage: trueDamage,
    activeResonance: activeResonance,
    helper: helper && helper.type === 'combat' ? helper : null,
    skills: skills || [],
    longUyTriggered: false,
    maKhiStacks: 0
  };
}

/**
 * Mô phỏng trận đấu theo lượt giữa 2 chiến binh (PvP hoặc PvE)
 * @param {object} options
 * @param {boolean} [options.isPvp=false] - Bật PvP Damage Reduction (65%)
 */
function simulateCombat(attackerStats, defenderStats, maxTurns = 20, options = {}) {
  const { isPvp = false } = options || {};
  const pvpDmgMult = isPvp ? PVP_DAMAGE_MULTIPLIER : 1;

  const logs = [];
  let a = { ...attackerStats };
  let d = { ...defenderStats };

  logs.push(`⚔️ **Trận Đấu Bắt Đầu!**${isPvp ? ' *(Chế độ PvP: Sát thương điều chỉnh 65%)*' : ''}`);
  logs.push(`• **${a.name}** [HP: ${a.maxHp.toLocaleString()} | Công: ${a.atk.toLocaleString()} | Thủ: ${a.def.toLocaleString()}]`);
  logs.push(`• **${d.name}** [HP: ${d.maxHp.toLocaleString()} | Công: ${d.atk.toLocaleString()} | Thủ: ${d.def.toLocaleString()}]`);

  if (a.activeResonance) {
    logs.push(`🔥 **${a.name}** kích hoạt trận pháp: **${a.activeResonance.name}**!`);
  }
  if (d.activeResonance) {
    logs.push(`🔥 **${d.name}** kích hoạt trận pháp: **${d.activeResonance.name}**!`);
  }

  // Khắc chế Linh Căn: +25% ST gây ra & -10% ST nhận vào từ đối thủ bị khắc
  const rootA = SPIRIT_ROOTS[a.spiritRoot];
  const rootD = SPIRIT_ROOTS[d.spiritRoot];
  let aElementalBonus = 1;
  let dElementalBonus = 1;
  let aElementalMitigation = 1;
  let dElementalMitigation = 1;

  if (rootA && rootD) {
    if (rootA.counters === rootD.element) {
      aElementalBonus = 1.25;
      aElementalMitigation = 0.90;
      logs.push(`🌟 **${a.name}** mang linh căn **${rootA.element}** tương khắc **${rootD.element}** của đối thủ (+25% ST & -10% ST nhận vào)!`);
    } else if (rootD.counters === rootA.element) {
      dElementalBonus = 1.25;
      dElementalMitigation = 0.90;
      logs.push(`🌟 **${d.name}** mang linh căn **${rootD.element}** tương khắc **${rootA.element}** của đối thủ (+25% ST & -10% ST nhận vào)!`);
    }
  }

  let turn = 1;
  while (a.hp > 0 && d.hp > 0 && turn <= maxTurns) {
    const isAFaster = a.speed >= d.speed;
    const first = isAFaster ? a : d;
    const second = isAFaster ? d : a;
    const firstBonus = isAFaster ? aElementalBonus : dElementalBonus;
    const secondBonus = isAFaster ? dElementalBonus : aElementalBonus;
    const firstTargetMitigation = isAFaster ? dElementalMitigation : aElementalMitigation;
    const secondTargetMitigation = isAFaster ? aElementalMitigation : dElementalMitigation;

    // First attacker turn
    executeTurnAction(first, second, firstBonus, firstTargetMitigation, pvpDmgMult, logs, turn);
    if (second.hp <= 0) break;

    // Second attacker turn
    executeTurnAction(second, first, secondBonus, secondTargetMitigation, pvpDmgMult, logs, turn);
    if (first.hp <= 0) break;

    // Hồi phục từ Cộng Hưởng Trận Pháp
    if (a.activeResonance && a.activeResonance.buff && a.activeResonance.buff.hpRegenTurn) {
      const heal = Math.floor(a.maxHp * a.activeResonance.buff.hpRegenTurn);
      a.hp = Math.min(a.maxHp, a.hp + heal);
    }
    if (d.activeResonance && d.activeResonance.buff && d.activeResonance.buff.hpRegenTurn) {
      const heal = Math.floor(d.maxHp * d.activeResonance.buff.hpRegenTurn);
      d.hp = Math.min(d.maxHp, d.hp + heal);
    }

    turn++;
  }

  const completedTurns = Math.min(turn, maxTurns);
  let winner = null;
  let isAttackerWin = false;
  let isDraw = false;

  if (a.hp > 0 && d.hp <= 0) {
    winner = a;
    isAttackerWin = true;
  } else if (d.hp > 0 && a.hp <= 0) {
    winner = d;
    isAttackerWin = false;
  } else {
    // Hết maxTurns mà cả 2 còn sống: xét thắng thua theo % HP còn lại
    const aHpRatio = a.maxHp > 0 ? a.hp / a.maxHp : 0;
    const dHpRatio = d.maxHp > 0 ? d.hp / d.maxHp : 0;
    const aPct = (aHpRatio * 100).toFixed(1);
    const dPct = (dHpRatio * 100).toFixed(1);

    if (Math.abs(aHpRatio - dHpRatio) < 0.0001) {
      isDraw = true;
      logs.push(`\n⚖️ **Kết Quả:** Hết ${completedTurns} hiệp — **HÒA NHAU!** (${a.name}: ${aPct}% HP vs ${d.name}: ${dPct}% HP)`);
    } else if (aHpRatio > dHpRatio) {
      winner = a;
      isAttackerWin = true;
      logs.push(`\n🏆 **Kết Quả:** Hết ${completedTurns} hiệp — **${a.name}** thắng nhờ % Sinh Lực cao hơn (${aPct}% vs ${dPct}%)!`);
    } else {
      winner = d;
      isAttackerWin = false;
      logs.push(`\n🏆 **Kết Quả:** Hết ${completedTurns} hiệp — **${d.name}** thắng nhờ % Sinh Lực cao hơn (${dPct}% vs ${aPct}%)!`);
    }
  }

  if (!isDraw && (a.hp <= 0 || d.hp <= 0)) {
    logs.push(`\n🏆 **Kết Quả:** **${winner.name}** giành chiến thắng oanh liệt! (Sau ${completedTurns} hiệp)`);
  }

  return {
    winner: winner ? winner.name : null,
    isAttackerWin,
    isDraw,
    turns: completedTurns,
    attackerRemainingHp: Math.max(0, a.hp),
    defenderRemainingHp: Math.max(0, d.hp),
    attackerHpPercent: a.maxHp > 0 ? Number(((Math.max(0, a.hp) / a.maxHp) * 100).toFixed(1)) : 0,
    defenderHpPercent: d.maxHp > 0 ? Number(((Math.max(0, d.hp) / d.maxHp) * 100).toFixed(1)) : 0,
    logs
  };
}

function executeTurnAction(attacker, defender, elementalBonus, targetElementalMitigation, pvpDmgMult, logs, turnNumber) {
  // Long Tộc: Long Uy (HP < 30%)
  if (attacker.race === 'long_toc' && !attacker.longUyTriggered && (attacker.hp / attacker.maxHp) <= 0.30) {
    attacker.longUyTriggered = true;
    attacker.atk = Math.floor(attacker.atk * 1.40);
    logs.push(`🐉 **${attacker.name}** gầm vang! Kích hoạt thiên phú **Long Uy** (+40% Sát thương)!`);
  }

  // Rợ Tộc: Cuồng Chiến
  let berserkMultiplier = 1;
  if (attacker.race === 'ro_toc') {
    const missingHpRatio = 1 - (attacker.hp / attacker.maxHp);
    berserkMultiplier = 1 + (missingHpRatio * 0.5);
  }

  // Thần thông / Kỹ năng thi triển ngẫu nhiên (xác định trước để xét khắc chế hệ công pháp)
  let skillUsed = null;
  let skillCountered = false;
  if (attacker.skills && attacker.skills.length > 0 && Math.random() < 0.4) {
    const randomSkill = attacker.skills[Math.floor(Math.random() * attacker.skills.length)];
    skillUsed = randomSkill;
  }

  // Xét tương khắc hệ: Công Pháp khác hệ có thể khắc chế ngược linh căn đối thủ!
  let effectiveElementalMult = elementalBonus * targetElementalMitigation;
  const defenderRoot = SPIRIT_ROOTS[defender.spiritRoot];
  if (skillUsed && skillUsed.element && defenderRoot) {
    if (ELEMENT_COUNTERS[skillUsed.element] === defenderRoot.element) {
      // Bỏ qua bất lợi giảm ST của linh căn và cộng thêm +20% khắc hệ chiêu thức
      effectiveElementalMult = Math.max(elementalBonus, 1) * 1.20;
      skillCountered = true;
    }
  }

  // Base Damage calculation
  let damage = attacker.atk * effectiveElementalMult * berserkMultiplier;

  // Giáp & Sát thương chuẩn
  if (attacker.trueDamage) {
    // Sát thương chuẩn: bỏ qua phòng thủ
  } else {
    damage = Math.max(damage * 0.2, damage - defender.def * 0.6);
    damage *= 1 - Math.min(0.9, Math.max(0, defender.physResist || 0));
  }

  // Bạo kích
  const isCrit = Math.random() < attacker.crit;
  if (isCrit) {
    damage *= attacker.critDmg;
  }

  // Hệ số kỹ năng
  if (skillUsed) {
    damage *= (skillUsed.damage_mult || 1.3);
  }

  // Điều chỉnh sát thương PvP
  damage = Math.max(1, Math.floor(damage * pvpDmgMult));
  defender.hp = Math.max(0, defender.hp - damage);

  let logMsg = `Hiệp ${turnNumber}: **${attacker.name}** `;
  if (skillUsed) {
    logMsg += `thi triển thần thông ⚡**[${skillUsed.name}]** `;
    if (skillCountered) {
      logMsg += `*(khắc chế hệ ${defenderRoot.element}!)* `;
    }
  } else {
    logMsg += `tung đòn tấn công `;
  }

  if (isCrit) {
    logMsg += `💥 **BẠO KÍCH!** Gây **${damage.toLocaleString()}** sát thương`;
  } else {
    logMsg += `gây **${damage.toLocaleString()}** sát thương`;
  }

  logMsg += ` lên **${defender.name}** (còn ${defender.hp.toLocaleString()} HP).`;
  logs.push(logMsg);

  // Hút máu (Ma Tộc hoặc hiệu ứng)
  if (attacker.lifesteal > 0) {
    const healed = Math.floor(damage * attacker.lifesteal);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + healed);
    logs.push(`🩸 **${attacker.name}** hút máu đối thủ, hồi phục **+${healed.toLocaleString()} HP**!`);
  }

  // Trợ thủ Hộ Đạo Giả trợ chiến
  if (attacker.helper && Math.random() < 0.35) {
    const helperDmg = Math.max(1, Math.floor(attacker.atk * 0.35 * pvpDmgMult));
    defender.hp = Math.max(0, defender.hp - helperDmg);
    logs.push(`🛡️ Hộ Đạo Giả **[${attacker.helper.name}]** xuất kích, chém thêm **${helperDmg.toLocaleString()}** sát thương!`);
  }
}

module.exports = {
  calculateCombatStats,
  simulateCombat,
  applyPvpSoftCap,
  PVP_DAMAGE_MULTIPLIER
};
