const { getDb } = require('../config/database');
const { addXp, addSilver, getPlayer } = require('./playerService');
const { addItem, removeItem, getItemAmount } = require('./itemService');
const { getEquippedHelper } = require('./helperService');

const XP_PER_MINUTE_PER_LEVEL = 2;
const SILVER_PER_MINUTE_PER_LEVEL = 1;
const MAX_AFK_MINUTES = 1440;

// Công thức Đan Dược
const PILL_RECIPES = {
  TrucCoDan: {
    name: 'Trúc Cơ Đan',
    desc: 'Đan dược tất yếu để đột phá từ Linh Úy lên Linh Tá.',
    requiredHerbs: { LinhThao: 3, TrucCoThao: 2 },
    silverCost: 1000,
    baseSuccess: 0.75
  },
  TuLinhDan: {
    name: 'Tụ Linh Đan',
    desc: 'Uống vào tức thì nhận lượng lớn Linh Lực tu vi.',
    requiredHerbs: { LinhThao: 5 },
    silverCost: 500,
    baseSuccess: 0.85,
    xpReward: 5000
  },
  TayTuyDan: {
    name: 'Tẩy Tủy Đan',
    desc: 'Tẩy đổi Linh Căn hiện tại, có cơ hội ngộ ra Dị Linh Căn cực phẩm.',
    requiredHerbs: { LinhThao: 5, ThienLinhThao: 2 },
    silverCost: 5000,
    baseSuccess: 0.65
  },
  BachHoaKimDan: {
    name: 'Bách Hóa Kim Đan',
    desc: 'Đan dược hộ thể, tăng 30% tỷ lệ sống sót khi Độ Kiếp Lôi Kiếp.',
    requiredHerbs: { TrucCoThao: 4, ThienLinhThao: 3 },
    silverCost: 15000,
    baseSuccess: 0.60
  }
};

// Loại hạt giống
const SEEDS = {
  HatGiongLinhThao: { name: 'Hạt Giống Linh Thảo', herbKey: 'LinhThao', herbName: 'Linh Thảo', growMinutes: 10, cost: 200 },
  HatGiongTrucCoThao: { name: 'Hạt Giống Trúc Cơ Thảo', herbKey: 'TrucCoThao', herbName: 'Trúc Cơ Thảo', growMinutes: 30, cost: 600 },
  HatGiongThienLinhThao: { name: 'Hạt Giống Thiên Linh Thảo', herbKey: 'ThienLinhThao', herbName: 'Thiên Linh Thảo', growMinutes: 60, cost: 2000 }
};

async function getDongPhu(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_dongphu WHERE user_id = ?',
    args: [userId]
  });
  return res.rows[0] || null;
}

/**
 * Nâng cấp Tụ Linh Trận
 */
async function upgradeTuLinhTran(userId, requestedLevels = 1) {
  const db = getDb();
  let dongPhu = await getDongPhu(userId);
  let player = await getPlayer(userId);
  if (!dongPhu || !player) return { success: false, message: 'Chưa có thông tin Động Phủ!' };

  const currentLevel = Number(dongPhu.array_level);
  const levels = Number(requestedLevels);
  if (!Number.isInteger(levels) || levels < 1) {
    return { success: false, message: 'Số cấp nâng phải là số nguyên lớn hơn 0!' };
  }
  if (currentLevel >= 50) return { success: false, message: 'Tụ Linh Trận đã đạt cấp tối đa (Cấp 50)!' };
  if (currentLevel + levels > 50) {
    return {
      success: false,
      message: `Chỉ có thể nâng tối đa ${50 - currentLevel} cấp từ cấp hiện tại (${currentLevel}) để không vượt quá cấp 50.`
    };
  }

  if (Number(dongPhu.afk_enabled) === 1) {
    const settlement = await settleAfk(userId, { allowZeroMinutes: true });
    if (!settlement.success) return settlement;
    dongPhu = await getDongPhu(userId);
    player = await getPlayer(userId);
  }

  const cost = 2000 * (levels * currentLevel + (levels * (levels - 1)) / 2);
  if (player.silver < cost) {
    return {
      success: false,
      message: `Không đủ Ngân lượng để nâng ${levels} cấp! Cần **${cost.toLocaleString()}**, hiện có **${Number(player.silver).toLocaleString()}**.`
    };
  }

  await addSilver(userId, -cost);
  await db.execute({
    sql: 'UPDATE tutien_dongphu SET array_level = array_level + ? WHERE user_id = ?',
    args: [levels, userId]
  });

  const newLevel = currentLevel + levels;
  const xpPerMinute = XP_PER_MINUTE_PER_LEVEL * newLevel;
  return {
    success: true,
    previousLevel: currentLevel,
    newLevel,
    levels,
    cost,
    xpPerMinute,
    message: `Nâng cấp Tụ Linh Trận từ **Cấp ${currentLevel}** lên **Cấp ${newLevel}** thành công (+${levels} cấp)! Tốc độ AFK tăng từ **${XP_PER_MINUTE_PER_LEVEL * currentLevel}** lên **${xpPerMinute} XP/phút**. Đã dùng **${cost.toLocaleString()} Ngân Lượng**.`
  };
}

async function getAfkRewardRates(userId, dongPhu) {
  const helper = await getEquippedHelper(userId);
  const helperBonus = helper && helper.type === 'life' ? 1.30 : 1;
  return {
    helper,
    helperBonus,
    xpPerMinute: XP_PER_MINUTE_PER_LEVEL * Number(dongPhu.array_level),
    silverPerMinute: SILVER_PER_MINUTE_PER_LEVEL * Number(dongPhu.array_level)
  };
}

async function startAfk(userId) {
  const db = getDb();
  const dongPhu = await getDongPhu(userId);
  if (!dongPhu) return { success: false, message: 'Chưa mở Động Phủ!' };
  if (Number(dongPhu.afk_enabled) === 1) {
    return { success: false, message: 'Trạng thái AFK đang bật. Dùng `/afk` lần nữa để kết thúc AFK.' };
  }

  const rates = await getAfkRewardRates(userId, dongPhu);
  const now = Date.now();
  const result = await db.execute({
    sql: `UPDATE tutien_dongphu
      SET afk_enabled = 1, afk_started_at = ?, last_claim_xp = ?
      WHERE user_id = ? AND afk_enabled = 0`,
    args: [now, now, userId]
  });
  if (Number(result.rowsAffected) === 0) {
    return { success: false, message: 'Trạng thái AFK vừa được thay đổi. Hãy kiểm tra lại bằng `/afk`.' };
  }

  return {
    success: true,
    active: true,
    xpPerMinute: Math.floor(rates.xpPerMinute * rates.helperBonus),
    message: `Đã bật AFK. Động Phủ bắt đầu tích lũy từ bây giờ với tốc độ **${Math.floor(rates.xpPerMinute * rates.helperBonus)} XP/phút**.`
  };
}

async function settleAfk(userId, { stop = false, allowZeroMinutes = false } = {}) {
  const db = getDb();
  const dongPhu = await getDongPhu(userId);
  if (!dongPhu) return { success: false, message: 'Chưa mở Động Phủ!' };
  if (Number(dongPhu.afk_enabled) !== 1 || !dongPhu.afk_started_at) {
    return { success: false, message: 'AFK hiện đang tắt. Dùng `/afk` để bắt đầu tính thời gian.' };
  }

  const now = Date.now();
  const startedAt = Number(dongPhu.afk_started_at);
  const elapsedMinutes = Math.min(MAX_AFK_MINUTES, Math.max(0, Math.floor((now - startedAt) / 60000)));
  if (elapsedMinutes < 1 && !allowZeroMinutes) {
    return { success: false, message: 'AFK cần tích lũy ít nhất 1 phút trước khi thu hoạch.' };
  }

  const rates = await getAfkRewardRates(userId, dongPhu);
  const xpGained = Math.floor(elapsedMinutes * rates.xpPerMinute * rates.helperBonus);
  const silverEarned = Math.floor(elapsedMinutes * rates.silverPerMinute * rates.helperBonus);

  const updated = await db.execute({
    sql: `UPDATE tutien_dongphu
      SET afk_enabled = ?, afk_started_at = ?, last_claim_xp = ?
      WHERE user_id = ? AND afk_enabled = 1 AND afk_started_at = ?`,
    args: [stop ? 0 : 1, stop ? null : now, now, userId, startedAt]
  });
  if (Number(updated.rowsAffected) === 0) {
    return { success: false, message: 'Trạng thái AFK vừa được thay đổi. Hãy kiểm tra lại bằng `/afk`.' };
  }

  let xpResult = { addedXp: 0, leveledUp: false, breakthroughReady: false };
  if (xpGained > 0) {
    xpResult = await addXp(userId, xpGained);
    await addSilver(userId, silverEarned);
  }

  const helperName = rates.helper && rates.helper.type === 'life' ? rates.helper.name : null;
  return {
    success: true,
    active: !stop,
    elapsedMinutes,
    xpGained: xpResult.addedXp,
    silverGained: silverEarned,
    leveledUp: xpResult.leveledUp,
    breakthroughReady: xpResult.breakthroughReady,
    helperName
  };
}

/**
 * Thu thập Linh Lực nhàn rỗi từ Tụ Linh Trận
 */
async function claimTuLinhTran(userId) {
  return settleAfk(userId);
}

async function toggleAfk(userId) {
  const dongPhu = await getDongPhu(userId);
  if (!dongPhu) return { success: false, message: 'Chưa mở Động Phủ!' };
  if (Number(dongPhu.afk_enabled) !== 1) return startAfk(userId);
  return settleAfk(userId, { stop: true, allowZeroMinutes: true });
}

/**
 * Trồng hạt giống vào Dược Viên
 */
async function plantSeed(userId, seedKey) {
  const db = getDb();
  const dongPhu = await getDongPhu(userId);
  if (!dongPhu) return { success: false, message: 'Chưa mở Dược Viên!' };

  const seedConfig = SEEDS[seedKey];
  if (!seedConfig) return { success: false, message: 'Hạt giống không hợp lệ!' };

  const seedCount = await getItemAmount(userId, 'seed', seedKey);
  if (seedCount < 1) return { success: false, message: `Đạo hữu không có **${seedConfig.name}** trong túi trữ vật!` };

  let garden = JSON.parse(dongPhu.garden_data || '[]');
  if (garden.length >= dongPhu.garden_slots) {
    return { success: false, message: `Dược Viên đã đầy (${garden.length}/${dongPhu.garden_slots} ô đất)! Hãy thu hoạch trước.` };
  }

  await removeItem(userId, 'seed', seedKey, 1);
  const now = Date.now();
  const readyAt = now + seedConfig.growMinutes * 60 * 1000;

  garden.push({
    seedKey,
    herbKey: seedConfig.herbKey,
    herbName: seedConfig.herbName,
    plantedAt: now,
    readyAt
  });

  await db.execute({
    sql: 'UPDATE tutien_dongphu SET garden_data = ? WHERE user_id = ?',
    args: [JSON.stringify(garden), userId]
  });

  return {
    success: true,
    message: `Đã gieo trồng **${seedConfig.name}**! Dự kiến thu hoạch sau **${seedConfig.growMinutes} phút**.`
  };
}

/**
 * Thu hoạch Dược Viên
 */
async function harvestGarden(userId) {
  const db = getDb();
  const dongPhu = await getDongPhu(userId);
  if (!dongPhu) return { success: false, message: 'Chưa mở Dược Viên!' };

  const garden = JSON.parse(dongPhu.garden_data || '[]');
  if (garden.length === 0) return { success: false, message: 'Dược Viên hiện đang để trống, chưa gieo trồng linh thảo nào!' };

  const now = Date.now();
  const remainingGarden = [];
  const harvested = {};

  for (const plant of garden) {
    if (now >= plant.readyAt) {
      harvested[plant.herbKey] = (harvested[plant.herbKey] || 0) + 1;
      await addItem(userId, 'herb', plant.herbKey, plant.herbName, 1);
    } else {
      remainingGarden.push(plant);
    }
  }

  if (Object.keys(harvested).length === 0) {
    return { success: false, message: 'Chưa có linh thảo nào chín tới! Đạo hữu hãy kiên nhẫn đợi thêm chút nữa.' };
  }

  await db.execute({
    sql: 'UPDATE tutien_dongphu SET garden_data = ? WHERE user_id = ?',
    args: [JSON.stringify(remainingGarden), userId]
  });

  const harvestDetails = Object.entries(harvested)
    .map(([k, v]) => `• ${v}x ${k}`)
    .join('\n');

  return {
    success: true,
    harvestDetails,
    message: `Thu hoạch thành công:\n${harvestDetails}`
  };
}

/**
 * Luyện Đan Dược
 */
async function refinePill(userId, recipeKey) {
  const recipe = PILL_RECIPES[recipeKey];
  if (!recipe) return { success: false, message: 'Phương thức đan dược không tồn tại!' };

  const player = await getPlayer(userId);
  if (player.silver < recipe.silverCost) {
    return { success: false, message: `Không đủ Ngân lượng để đốt Lò Luyện Đan! Cần **${recipe.silverCost.toLocaleString()}** Ngân lượng.` };
  }

  // Kiểm tra nguyên liệu
  for (const [herbKey, needed] of Object.entries(recipe.requiredHerbs)) {
    const count = await getItemAmount(userId, 'herb', herbKey);
    if (count < needed) {
      return { success: false, message: `Thiếu nguyên liệu: Cần **${needed}x ${herbKey}**, hiện chỉ có **${count}**.` };
    }
  }

  // Trừ nguyên liệu & bạc
  await addSilver(userId, -recipe.silverCost);
  for (const [herbKey, needed] of Object.entries(recipe.requiredHerbs)) {
    await removeItem(userId, 'herb', herbKey, needed);
  }

  // Tính tỷ lệ thành công
  let successRate = recipe.baseSuccess;
  const helper = await getEquippedHelper(userId);
  if (helper && helper.type === 'life') {
    successRate += 0.15; // +15% tỷ lệ luyện đan
  }

  const roll = Math.random();
  if (roll <= successRate) {
    await addItem(userId, 'pill', recipeKey, recipe.name, 1);
    return {
      success: true,
      pillName: recipe.name,
      message: `🔥 Đan thành! Đạo hữu đã luyện chế thành công **1x ${recipe.name}**!`
    };
  } else {
    return {
      success: false,
      message: `💥 Lò luyện đan phát nổ bốc khói đen kịt! Luyện chế thất bại, nguyên liệu đã hóa thành tro tàn.`
    };
  }
}

/**
 * Rèn Linh Khí ở Lò Rèn
 */
async function forgeWeapon(userId) {
  const player = await getPlayer(userId);
  const forgeCost = 5000 + player.realm_id * 5000;
  if (player.silver < forgeCost) {
    return { success: false, message: `Cần **${forgeCost.toLocaleString()}** Ngân lượng để rèn Linh Khí!` };
  }

  await addSilver(userId, -forgeCost);

  const weaponTiers = ['Phàm', 'Tinh', 'Linh', 'Địa', 'Thiên', 'Thánh', 'Thần'];
  const weaponNames = [
    'Thanh Sương Kiếm', 'Xích Hỏa Đao', 'Huyền Băng Thương', 'Tử Tiêu Cung', 
    'Càn Khôn Xích', 'Hỗn Độn Chung', 'Cửu Long Phục Ma Đỉnh'
  ];

  const tier = Math.min(7, Math.max(1, player.realm_id + 1));
  const randomName = weaponNames[Math.floor(Math.random() * weaponNames.length)] + ` (${weaponTiers[tier - 1]})`;
  const baseAtk = 60 * tier + Math.floor(Math.random() * 30);
  const baseDef = 30 * tier + Math.floor(Math.random() * 15);

  const db = getDb();
  await db.execute({
    sql: `INSERT INTO tutien_weapons (user_id, name, tier, atk, def, effect_name, effect_desc, is_natal, is_equipped)
      VALUES (?, ?, ?, ?, ?, 'Khí Linh Tụ Hóa', 'Gia tăng uy lực khi thi triển kỹ năng', 0, 0)`,
    args: [userId, randomName, tier, baseAtk, baseDef]
  });

  return {
    success: true,
    weaponName: randomName,
    tier,
    atk: baseAtk,
    def: baseDef,
    message: `⚒️ Lò Rèn lóe sáng! Đạo hữu rèn thành công **${randomName}** [Bậc ${tier}] (+${baseAtk} Công, +${baseDef} Thủ)!`
  };
}

module.exports = {
  PILL_RECIPES,
  SEEDS,
  getDongPhu,
  startAfk,
  toggleAfk,
  upgradeTuLinhTran,
  claimTuLinhTran,
  plantSeed,
  harvestGarden,
  refinePill,
  forgeWeapon
};
