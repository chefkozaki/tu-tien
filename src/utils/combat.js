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
 * @param {boolean} [options.isPvp=false] - Đánh dấu ngữ cảnh PvP
 * @param {{ realm_id: number, level: number }} [options.equalizeRealm] - Chuẩn hóa cảnh giới/cấp độ cho chế độ Đồng Cảnh Giới
 * @param {object|null} [options.armor] - Linh giáp đang trang bị
 * @param {boolean} [options.useFairScaling] - Bật chuẩn hóa & soft cap cho chế độ Đồng Cảnh Giới
 */
function calculateCombatStats(player, weapon, pets = [], helper = null, skills = [], petResonance = null, options = {}) {
  const {
    isPvp = false,
    equalizeRealm = null,
    armor = null,
    useFairScaling = Boolean(isPvp && equalizeRealm)
  } = options || {};
  const race = RACES[player.race] || RACES.nhan_toc;

  const effectiveRealmId = equalizeRealm ? equalizeRealm.realm_id : Number(player.realm_id || 0);
  const effectiveLevel = equalizeRealm ? equalizeRealm.level : Number(player.level || 1);

  // Trong chế độ Đồng Cảnh Giới (Fair) giảm độ dốc realmMultiplier để so tài build cân bằng hơn
  const realmMultiplier = useFairScaling
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
  let dmgReduction = 0;
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
      const natalBonus = 1 + effectiveRealmId * (useFairScaling ? 0.22 : 0.3);
      weaponAtk = Math.floor(weaponAtk * natalBonus);
      weaponDef = Math.floor(weaponDef * natalBonus);
    }
    gearAtk += weaponAtk;
    gearDef += weaponDef;
  }

  // Armor Stats (Linh Giáp: tăng HP + Thủ + Giảm Sát Thương nhận vào)
  if (armor) {
    let armorHp = Number(armor.hp || 0);
    let armorDef = Number(armor.def || 0);
    if (armor.is_natal) {
      const natalBonus = 1 + effectiveRealmId * (useFairScaling ? 0.22 : 0.3);
      armorHp = Math.floor(armorHp * natalBonus);
      armorDef = Math.floor(armorDef * natalBonus);
    }
    gearHp += armorHp;
    gearDef += armorDef;
    dmgReduction = Math.min(0.50, Math.max(0, dmgReduction + Number(armor.dmg_reduction || 0)));
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

  // Trong chế độ Đồng Cảnh Giới (Fair) áp dụng Soft Cap theo cảnh giới cho tổng chỉ số từ Linh Khí + Linh Thú + Trợ Thủ
  if (useFairScaling) {
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

  // Áp dụng Công Pháp Bị Động (type === 'passive')
  const allSkills = Array.isArray(skills) ? skills : [];
  const passiveSkills = allSkills.filter(s => s.type === 'passive');
  const activeSkills = allSkills
    .filter(s => s.type !== 'passive')
    .slice()
    .sort((x, y) => (Number(x.slot || 99) - Number(y.slot || 99)) || (Number(x.id || 0) - Number(y.id || 0)));
  let passiveRegen = 0;

  for (const ps of passiveSkills) {
    const val = Math.max(0, Number(ps.effect_value || 0));
    if (val <= 0) continue;
    // Trong chế độ Đồng Cảnh Giới (Fair) giới hạn nhẹ hệ số tăng từ tâm pháp (80%) để tránh chồng quá cao
    const effVal = useFairScaling ? val * 0.8 : val;
    switch (ps.effect_type) {
      case 'stat_hp':
        hp = Math.floor(hp * (1 + effVal));
        break;
      case 'stat_atk':
        atk = Math.floor(atk * (1 + effVal));
        break;
      case 'stat_def':
        def = Math.floor(def * (1 + effVal));
        break;
      case 'stat_crit':
        crit += effVal;
        break;
      case 'stat_lifesteal':
        lifesteal = Math.min(0.50, lifesteal + effVal);
        break;
      case 'stat_dmg_reduction':
        dmgReduction = Math.min(0.50, dmgReduction + effVal);
        break;
      case 'stat_regen':
        passiveRegen = Math.min(0.15, passiveRegen + effVal);
        break;
    }
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
    dmgReduction: dmgReduction,
    passiveRegen: passiveRegen,
    ccResist: ccResist,
    trueDamage: trueDamage,
    activeResonance: activeResonance,
    helper: helper && helper.type === 'combat' ? helper : null,
    skills: activeSkills,
    passiveSkills: passiveSkills,
    longUyTriggered: false,
    maKhiStacks: 0
  };
}

/**
 * Mô phỏng trận đấu theo lượt giữa 2 chiến binh (PvP hoặc PvE)
 * @param {object} options
 * @param {boolean} [options.isPvp=false] - Bật PvP Damage Reduction (65%) và cơ chế công bằng (không RNG)
 * @param {boolean} [options.isFairMode=false] - Chế độ Đồng Cảnh Giới
 */
function simulateCombat(attackerStats, defenderStats, maxTurns = 20, options = {}) {
  const { isPvp = false, isFairMode = false } = options || {};
  const pvpDmgMult = isPvp ? PVP_DAMAGE_MULTIPLIER : 1;

  const logs = [];
  const initRuntime = stats => ({
    ...stats,
    shieldHp: 0,
    burnTurns: 0,
    burnPct: 0,
    stunned: false,
    stunImmunityTurns: 0,
    ccImmuneTurns: 0,
    armorBreakTurns: 0,
    armorBreakPct: 0,
    helperGauge: 0.30,
    stunGauge: 0,
    skillCooldowns: {}
  });
  let a = initRuntime(attackerStats);
  let d = initRuntime(defenderStats);

  const pvpSubtitle = isPvp
    ? (isFairMode
        ? ' *(Đồng Cảnh Giới: Chuẩn hóa cảnh giới • Chí mạng & Kỹ năng cố định • Nhịp độ ST 65%)*'
        : ' *(Đấu Xếp Hạng: 100% chỉ số gốc • Chí mạng & Kỹ năng cố định • Nhịp độ ST 65%)*')
    : '';
  logs.push(`⚔️ **Trận Đấu Bắt Đầu!**${pvpSubtitle}`);
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
    const isAFaster = a.speed > d.speed
      ? true
      : (a.speed < d.speed ? false : (isPvp ? turn % 2 === 1 : true));
    const first = isAFaster ? a : d;
    const second = isAFaster ? d : a;
    const firstBonus = isAFaster ? aElementalBonus : dElementalBonus;
    const secondBonus = isAFaster ? dElementalBonus : aElementalBonus;
    const firstTargetMitigation = isAFaster ? dElementalMitigation : aElementalMitigation;
    const secondTargetMitigation = isAFaster ? aElementalMitigation : dElementalMitigation;

    // First attacker turn
    executeTurnAction(first, second, firstBonus, firstTargetMitigation, pvpDmgMult, logs, turn, isPvp);
    if (second.hp <= 0) break;

    // Second attacker turn
    executeTurnAction(second, first, secondBonus, secondTargetMitigation, pvpDmgMult, logs, turn, isPvp);
    if (first.hp <= 0) break;

    // Hồi phục từ Cộng Hưởng Trận Pháp & Công Pháp Bị Động (stat_regen) + sát thương Thiêu Đốt (burn)
    for (const fighter of [a, d]) {
      if (fighter.hp <= 0) continue;
      const resonanceRegen = fighter.activeResonance?.buff?.hpRegenTurn || 0;
      const totalRegen = resonanceRegen + (fighter.passiveRegen || 0);
      if (totalRegen > 0) {
        const heal = Math.floor(fighter.maxHp * totalRegen);
        fighter.hp = Math.min(fighter.maxHp, fighter.hp + heal);
      }
      if (fighter.burnTurns > 0) {
        const burnDmg = Math.max(1, Math.floor(fighter.maxHp * (fighter.burnPct || 0.04) * pvpDmgMult));
        fighter.hp = Math.max(0, fighter.hp - burnDmg);
        fighter.burnTurns--;
        logs.push(`🔥 **${fighter.name}** chịu thiêu đốt mất **${burnDmg.toLocaleString()} HP** (còn ${fighter.hp.toLocaleString()} HP).`);
      }
      if (fighter.armorBreakTurns > 0) {
        fighter.armorBreakTurns--;
        if (fighter.armorBreakTurns === 0) fighter.armorBreakPct = 0;
      }
      if (fighter.ccImmuneTurns > 0) {
        fighter.ccImmuneTurns--;
      }
      for (const k of Object.keys(fighter.skillCooldowns)) {
        if (fighter.skillCooldowns[k] > 0) fighter.skillCooldowns[k]--;
      }
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

function applyDamageToDefender(defender, rawDamage) {
  let remaining = Math.max(0, Math.floor(rawDamage));
  let absorbed = 0;
  if (defender.shieldHp > 0 && remaining > 0) {
    absorbed = Math.min(defender.shieldHp, remaining);
    defender.shieldHp -= absorbed;
    remaining -= absorbed;
  }
  defender.hp = Math.max(0, defender.hp - remaining);
  return { hpDamage: remaining, absorbed };
}

function executeTurnAction(attacker, defender, elementalBonus, targetElementalMitigation, pvpDmgMult, logs, turnNumber, isPvp = false) {
  // Long Tộc: Long Uy (HP < 30%)
  if (attacker.race === 'long_toc' && !attacker.longUyTriggered && (attacker.hp / attacker.maxHp) <= 0.30) {
    attacker.longUyTriggered = true;
    attacker.atk = Math.floor(attacker.atk * 1.40);
    attacker.ccImmuneTurns = 5;
    attacker.stunned = false;
    logs.push(`🐉 **${attacker.name}** gầm vang! Kích hoạt thiên phú **Long Uy** (+40% Sát thương & Miễn khống chế 5 hiệp)!`);
  }

  // Kiểm tra trạng thái Choáng (Stun)
  if (attacker.stunned) {
    attacker.stunned = false;
    if (isPvp) attacker.stunImmunityTurns = 1;
    logs.push(`Hiệp ${turnNumber}: ⚡ **${attacker.name}** đang bị choáng, bỏ lỡ lượt xuất chiêu!`);
    return;
  }
  if (attacker.stunImmunityTurns > 0) {
    attacker.stunImmunityTurns--;
  }

  // Rợ Tộc: Cuồng Chiến
  let berserkMultiplier = 1;
  if (attacker.race === 'ro_toc') {
    const missingHpRatio = 1 - (attacker.hp / attacker.maxHp);
    berserkMultiplier = 1 + (missingHpRatio * 0.5);
  }

  // Thần thông Chủ Động (chỉ chọn chiêu đã hết cooldown)
  let skillUsed = null;
  let skillCountered = false;
  let skillResonated = false;
  const activeSkills = (attacker.skills || [])
    .filter(s => s.type !== 'passive')
    .slice()
    .sort((x, y) => (Number(x.slot || 99) - Number(y.slot || 99)) || (Number(x.id || 0) - Number(y.id || 0)));
  const readySkills = activeSkills.filter(s => {
    const key = String(s.id || s.name);
    return (attacker.skillCooldowns?.[key] || 0) <= 0;
  });
  if (readySkills.length > 0) {
    if (isPvp) {
      skillUsed = readySkills[0];
    } else if (Math.random() < 0.45) {
      skillUsed = readySkills[Math.floor(Math.random() * readySkills.length)];
    }
    if (skillUsed && attacker.skillCooldowns) {
      const key = String(skillUsed.id || skillUsed.name);
      attacker.skillCooldowns[key] = Math.max(1, Number(skillUsed.cooldown || 2));
    }
  }

  // Xét tương khắc hệ & đồng điệu Linh Căn
  let effectiveElementalMult = elementalBonus * targetElementalMitigation;
  const attackerRoot = SPIRIT_ROOTS[attacker.spiritRoot];
  const defenderRoot = SPIRIT_ROOTS[defender.spiritRoot];
  if (skillUsed && skillUsed.element) {
    if (attackerRoot && skillUsed.element === attackerRoot.element) {
      effectiveElementalMult *= 1.10;
      skillResonated = true;
    }
    if (defenderRoot && ELEMENT_COUNTERS[skillUsed.element] === defenderRoot.element) {
      // Bỏ qua bất lợi giảm ST của linh căn và cộng thêm +20% khắc hệ chiêu thức
      effectiveElementalMult = Math.max(elementalBonus, 1) * 1.20 * (skillResonated ? 1.10 : 1);
      skillCountered = true;
    }
  }

  // Base Damage calculation
  let damage = attacker.atk * effectiveElementalMult * berserkMultiplier;

  // Giáp & Sát thương chuẩn (từ tộc hoặc chiêu thức true_dmg)
  const isTrueDmg = attacker.trueDamage || (skillUsed && skillUsed.effect_type === 'true_dmg');
  if (!isTrueDmg) {
    const effectiveDef = defender.def * (1 - Math.min(0.6, Math.max(0, defender.armorBreakPct || 0)));
    damage = Math.max(damage * 0.2, damage - effectiveDef * 0.6);
    damage *= 1 - Math.min(0.9, Math.max(0, defender.physResist || 0));
  }

  // Bạo kích
  let isCrit = false;
  if (isPvp) {
    const pvpCritMult = 1 + Math.max(0, Number(attacker.crit || 0)) * Math.max(0, Number(attacker.critDmg || 1.5) - 1);
    damage *= pvpCritMult;
  } else {
    isCrit = Math.random() < attacker.crit;
    if (isCrit) {
      damage *= attacker.critDmg;
    }
  }

  // Hệ số kỹ năng
  if (skillUsed) {
    damage *= (skillUsed.damage_mult || 1.3);
  }

  // Điều chỉnh sát thương PvP & Giảm Sát Thương từ Linh Giáp
  const armorMitigation = 1 - Math.min(0.50, Math.max(0, defender.dmgReduction || 0));
  damage = Math.max(1, Math.floor(damage * pvpDmgMult * armorMitigation));
  const { hpDamage, absorbed } = applyDamageToDefender(defender, damage);

  let logMsg = `Hiệp ${turnNumber}: **${attacker.name}** `;
  if (skillUsed) {
    logMsg += `thi triển thần thông ⚡**[${skillUsed.name}]** `;
    if (skillCountered) {
      logMsg += `*(khắc chế hệ ${defenderRoot.element}!)* `;
    } else if (skillResonated) {
      logMsg += `*(đồng điệu linh căn +10%)* `;
    }
  } else {
    logMsg += `tung đòn tấn công `;
  }

  if (isCrit) {
    logMsg += `💥 **BẠO KÍCH!** Gây **${damage.toLocaleString()}** sát thương`;
  } else {
    logMsg += `gây **${damage.toLocaleString()}** sát thương`;
  }

  if (absorbed > 0) {
    logMsg += ` *(khiên đỡ ${absorbed.toLocaleString()})*`;
  }
  logMsg += ` lên **${defender.name}** (còn ${defender.hp.toLocaleString()} HP).`;
  logs.push(logMsg);

  // Hiệu ứng đặc biệt của Thần Thông Chủ Động
  if (skillUsed && skillUsed.effect_type && skillUsed.effect_type !== 'none') {
    const effVal = Number(skillUsed.effect_value || 0);
    if (skillUsed.effect_type === 'burn' && defender.hp > 0) {
      defender.burnTurns = 2;
      defender.burnPct = Math.max(defender.burnPct || 0, effVal || 0.04);
      logs.push(`🔥 **${defender.name}** bị thiêu đốt trong 2 hiệp!`);
    } else if (skillUsed.effect_type === 'armor_break' && defender.hp > 0) {
      defender.armorBreakTurns = 2;
      defender.armorBreakPct = Math.max(defender.armorBreakPct || 0, effVal || 0.25);
      logs.push(`💥 **${defender.name}** bị phá giáp (-${Math.round(defender.armorBreakPct * 100)}% Thủ trong 2 hiệp)!`);
    } else if (skillUsed.effect_type === 'stun' && defender.hp > 0) {
      const stunChance = Math.max(0, (effVal || 0.25) * (1 - Math.min(0.8, defender.ccResist || 0)));
      const isTargetCcImmune = defender.stunned || (defender.ccImmuneTurns || 0) > 0 || (defender.stunImmunityTurns || 0) > 0;
      if (!isTargetCcImmune && stunChance > 0) {
        let shouldStun = false;
        if (isPvp) {
          attacker.stunGauge = (attacker.stunGauge || 0) + stunChance;
          if (attacker.stunGauge >= 1.0) {
            attacker.stunGauge -= 1.0;
            shouldStun = true;
          }
        } else {
          shouldStun = Math.random() < stunChance;
        }
        if (shouldStun) {
          defender.stunned = true;
          logs.push(`⚡ **${defender.name}** bị choáng, mất lượt hành động kế tiếp!`);
        }
      }
    } else if (skillUsed.effect_type === 'lifesteal' && hpDamage > 0) {
      const skillHeal = Math.floor(hpDamage * (effVal || 0.25));
      if (skillHeal > 0) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + skillHeal);
        logs.push(`🩸 Thần thông hút huyết hồi **+${skillHeal.toLocaleString()} HP** cho **${attacker.name}**!`);
      }
    } else if (skillUsed.effect_type === 'shield') {
      const shieldGain = Math.floor(attacker.maxHp * (effVal || 0.12));
      if (shieldGain > 0) {
        attacker.shieldHp += shieldGain;
        logs.push(`🛡️ **${attacker.name}** dựng hộ thuẫn hấp thụ **${shieldGain.toLocaleString()} ST**!`);
      }
    }
  }

  // Hút máu (Ma Tộc hoặc Tâm Pháp Huyết Ma)
  if (attacker.lifesteal > 0 && hpDamage > 0) {
    const healed = Math.floor(hpDamage * attacker.lifesteal);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + healed);
    logs.push(`🩸 **${attacker.name}** hút máu đối thủ, hồi phục **+${healed.toLocaleString()} HP**!`);
  }

  // Trợ thủ Hộ Đạo Giả trợ chiến
  if (attacker.helper && defender.hp > 0) {
    let shouldHelperStrike = false;
    if (isPvp) {
      attacker.helperGauge = (attacker.helperGauge || 0) + 0.35;
      if (attacker.helperGauge >= 1.0) {
        attacker.helperGauge -= 1.0;
        shouldHelperStrike = true;
      }
    } else {
      shouldHelperStrike = Math.random() < 0.35;
    }
    if (shouldHelperStrike) {
      const helperDmg = Math.max(1, Math.floor(attacker.atk * 0.35 * pvpDmgMult * armorMitigation));
      applyDamageToDefender(defender, helperDmg);
      logs.push(`🛡️ Hộ Đạo Giả **[${attacker.helper.name}]** xuất kích, chém thêm **${helperDmg.toLocaleString()}** sát thương!`);
    }
  }
}

module.exports = {
  calculateCombatStats,
  simulateCombat,
  applyPvpSoftCap,
  PVP_DAMAGE_MULTIPLIER
};
