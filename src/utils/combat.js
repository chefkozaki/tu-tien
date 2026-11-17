const { RACES, SPIRIT_ROOTS, PET_RESONANCES } = require('../config/constants');

/**
 * Tính toán chỉ số tổng hợp của người chơi bao gồm:
 * - Base stats theo Tộc & Cảnh giới & Level
 * - Chỉ số từ Linh Khí (Bản mệnh / Thường)
 * - Chỉ số từ 3 Linh Thú (kể cả cộng hưởng Trận Pháp)
 * - Trợ Thủ Chiến Đấu
 */
function calculateCombatStats(player, weapon, pets = [], helper = null, skills = [], petResonance = null) {
  const race = RACES[player.race] || RACES.nhan_toc;
  const realmMultiplier = 1 + player.realm_id * 1.5 + (player.level - 1) * 0.15;

  let hp = Math.floor(race.baseStats.hp * realmMultiplier);
  let atk = Math.floor(race.baseStats.atk * realmMultiplier);
  let def = Math.floor(race.baseStats.def * realmMultiplier);
  let speed = Math.floor(race.baseStats.speed * (1 + (player.realm_id * 0.05)));
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

  // Weapon Stats
  if (weapon) {
    let weaponAtk = weapon.atk;
    let weaponDef = weapon.def;
    if (weapon.is_natal) {
      // Bản mệnh linh khí tăng tiến theo cảnh giới chủ nhân
      const natalBonus = 1 + player.realm_id * 0.3;
      weaponAtk = Math.floor(weaponAtk * natalBonus);
      weaponDef = Math.floor(weaponDef * natalBonus);
    }
    atk += weaponAtk;
    def += weaponDef;
  }

  // Pet Stats & Resonance (Trận Pháp Linh Thú)
  let activeResonance = null;
  if (pets && pets.length > 0) {
    for (const pet of pets) {
      const starBonus = 1 + (pet.star - 1) * 0.25;
      hp += Math.floor(pet.hp * starBonus);
      atk += Math.floor(pet.atk * starBonus);
      def += Math.floor(pet.def * starBonus);
      speed += Math.floor(pet.speed * starBonus);
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
        hp = Math.floor(hp * activeResonance.buff.hpMultiplier);
        atk = Math.floor(atk * activeResonance.buff.atkMultiplier);
        def = Math.floor(def * activeResonance.buff.defMultiplier);
        speed = Math.floor(speed * activeResonance.buff.speedMultiplier);
        crit += activeResonance.buff.critBonus;
        physResist = Math.min(0.9, physResist + activeResonance.buff.physResistBonus);
      }
    }
  }

  // Helper (Trợ thủ chiến đấu)
  if (helper && helper.type === 'combat') {
    const helperTierBonus = 1 + (helper.tier - 1) * 0.3;
    atk += Math.floor(100 * helperTierBonus);
    hp += Math.floor(600 * helperTierBonus);
    def += Math.floor(50 * helperTierBonus);
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
 */
function simulateCombat(attackerStats, defenderStats, maxTurns = 20) {
  const logs = [];
  let a = { ...attackerStats };
  let d = { ...defenderStats };

  logs.push(`⚔️ **Trận Đấu Bắt Đầu!**`);
  logs.push(`• **${a.name}** [HP: ${a.maxHp.toLocaleString()} | Công: ${a.atk.toLocaleString()} | Thủ: ${a.def.toLocaleString()}]`);
  logs.push(`• **${d.name}** [HP: ${d.maxHp.toLocaleString()} | Công: ${d.atk.toLocaleString()} | Thủ: ${d.def.toLocaleString()}]`);

  if (a.activeResonance) {
    logs.push(`🔥 **${a.name}** kích hoạt trận pháp: **${a.activeResonance.name}**!`);
  }
  if (d.activeResonance) {
    logs.push(`🔥 **${d.name}** kích hoạt trận pháp: **${d.activeResonance.name}**!`);
  }

  // Khắc chế Linh Căn
  const rootA = SPIRIT_ROOTS[a.spiritRoot];
  const rootD = SPIRIT_ROOTS[d.spiritRoot];
  let aElementalBonus = 1;
  let dElementalBonus = 1;

  if (rootA && rootD) {
    if (rootA.counters === rootD.element) {
      aElementalBonus = 1.25;
      logs.push(`🌟 **${a.name}** mang linh căn **${rootA.element}** tương khắc **${rootD.element}** của đối thủ (+25% ST)!`);
    } else if (rootD.counters === rootA.element) {
      dElementalBonus = 1.25;
      logs.push(`🌟 **${d.name}** mang linh căn **${rootD.element}** tương khắc **${rootA.element}** của đối thủ (+25% ST)!`);
    }
  }

  let turn = 1;
  while (a.hp > 0 && d.hp > 0 && turn <= maxTurns) {
    const isAFaster = a.speed >= d.speed;
    const first = isAFaster ? a : d;
    const second = isAFaster ? d : a;
    const firstBonus = isAFaster ? aElementalBonus : dElementalBonus;
    const secondBonus = isAFaster ? dElementalBonus : aElementalBonus;

    // First attacker turns
    executeTurnAction(first, second, firstBonus, logs, turn);
    if (second.hp <= 0) break;

    // Second attacker turns
    executeTurnAction(second, first, secondBonus, logs, turn);
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

  const winner = a.hp > 0 && d.hp <= 0 ? a : (d.hp > 0 && a.hp <= 0 ? d : (a.hp >= d.hp ? a : d));
  const isAttackerWin = winner === a;

  logs.push(`\n🏆 **Kết Quả:** **${winner.name}** giành chiến thắng oanh liệt! (Sau ${Math.min(turn, maxTurns)} hiệp)`);

  return {
    winner: winner.name,
    isAttackerWin,
    turns: Math.min(turn, maxTurns),
    attackerRemainingHp: Math.max(0, a.hp),
    defenderRemainingHp: Math.max(0, d.hp),
    logs
  };
}

function executeTurnAction(attacker, defender, elementalBonus, logs, turnNumber) {
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

  // Base Damage calculation
  let damage = attacker.atk * elementalBonus * berserkMultiplier;

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

  // Thần thông / Kỹ năng thi triển ngẫu nhiên
  let skillUsed = null;
  if (attacker.skills && attacker.skills.length > 0 && Math.random() < 0.4) {
    const randomSkill = attacker.skills[Math.floor(Math.random() * attacker.skills.length)];
    skillUsed = randomSkill;
    damage *= (randomSkill.damage_mult || 1.3);
  }

  damage = Math.floor(damage);
  defender.hp = Math.max(0, defender.hp - damage);

  let logMsg = `Hiệp ${turnNumber}: **${attacker.name}** `;
  if (skillUsed) {
    logMsg += `thi triển thần thông ⚡**[${skillUsed.name}]** `;
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
    const helperDmg = Math.floor(attacker.atk * 0.35);
    defender.hp = Math.max(0, defender.hp - helperDmg);
    logs.push(`🛡️ Hộ Đạo Giả **[${attacker.helper.name}]** xuất kích, chém thêm **${helperDmg.toLocaleString()}** sát thương!`);
  }
}

module.exports = {
  calculateCombatStats,
  simulateCombat
};
