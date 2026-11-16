const { getDb } = require('../config/database');
const { getPlayer } = require('./playerService');

const BANNER_CONFIG = {
  weapon: {
    id: 'weapon',
    name: 'Thần Binh Vạn Khí',
    subtitle: 'Cầu Nguyện Linh Khí Cực Phẩm',
    desc: 'Tăng cực lớn tỷ lệ xuất hiện các Linh Khí & Thần Khí 4★ - 5★',
    featuredType: 'weapon',
    icon: '⚔️',
    primaryRate: 0.85
  },
  pet: {
    id: 'pet',
    name: 'Vạn Thú Quy Tông',
    subtitle: 'Cầu Nguyện Linh Thú Thượng Cổ',
    desc: 'Tăng cực lớn tỷ lệ xuất hiện Linh Thú & Dị Thú 4★ - 5★',
    featuredType: 'pet',
    icon: '🐾',
    primaryRate: 0.85
  },
  helper: {
    id: 'helper',
    name: 'Hộ Đạo Tiên Duyên',
    subtitle: 'Cầu Nguyện Trợ Thủ & Hộ Đạo Giả',
    desc: 'Tăng cực lớn tỷ lệ chiêu mộ Hộ Đạo Giả & Tiên Đồng Phụ Tá 4★ - 5★',
    featuredType: 'helper',
    icon: '🤝',
    primaryRate: 0.85
  },
  standard: {
    id: 'standard',
    name: 'Thiên Mệnh Thần Cơ',
    subtitle: 'Cầu Nguyện Thường Cố Định',
    desc: 'Cầu nguyện vạn vật, tỷ lệ đồng đều giữa Linh Khí, Linh Thú và Trợ Thủ',
    featuredType: 'all',
    icon: '🌌',
    primaryRate: 0.33
  }
};

const WISH_COST_SINGLE = 1600; // 1,600 Bạc / 1 lượt quay
const WISH_COST_TEN = 16000;   // 16,000 Bạc / 10 lượt quay

/**
 * Lấy danh sách vật phẩm trong bể Cầu Nguyện
 */
async function getGachaItems(filters = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM tutien_gacha_items WHERE 1=1';
  const args = [];

  if (filters.item_type) {
    sql += ' AND item_type = ?';
    args.push(filters.item_type);
  }
  if (filters.rarity) {
    sql += ' AND rarity = ?';
    args.push(Number(filters.rarity));
  }
  if (filters.banner_type) {
    if (filters.banner_type === 'weapon') {
      sql += " AND (banner_type = 'weapon' OR (item_type = 'weapon' AND banner_type = 'all'))";
    } else if (filters.banner_type === 'pet') {
      sql += " AND (banner_type = 'pet' OR (item_type = 'pet' AND banner_type = 'all'))";
    } else if (filters.banner_type === 'helper') {
      sql += " AND (banner_type = 'helper' OR (item_type = 'helper' AND banner_type = 'all'))";
    } else if (filters.banner_type === 'standard') {
      sql += " AND (banner_type = 'standard' OR banner_type = 'all')";
    } else if (filters.banner_type === 'all') {
      sql += " AND banner_type = 'all'";
    } else {
      sql += ' AND banner_type = ?';
      args.push(filters.banner_type);
    }
  }
  if (filters.is_active !== undefined && filters.is_active !== '') {
    sql += ' AND is_active = ?';
    args.push(Number(filters.is_active));
  }
  if (filters.search) {
    sql += ' AND name LIKE ?';
    args.push(`%${filters.search}%`);
  }

  sql += ' ORDER BY rarity DESC, rate_up DESC, tier DESC, id DESC';
  const res = await db.execute({ sql, args });
  return res.rows;
}

/**
 * Lấy 1 vật phẩm gacha theo ID
 */
async function getGachaItemById(id) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_gacha_items WHERE id = ?',
    args: [Number(id)]
  });
  return res.rows[0] || null;
}

/**
 * Thêm vật phẩm mới vào Bể Cầu Nguyện (Admin toàn quyền quyết định chỉ số)
 */
async function createGachaItem(itemData) {
  const db = getDb();
  const {
    item_type,
    name,
    rarity = 3,
    banner_type = 'all',
    rate_up = 0,
    element = 'Hỏa',
    tier = 1,
    hp = 0,
    atk = 0,
    def = 0,
    speed = 0,
    crit = 0.05,
    effect_name = '',
    effect_desc = '',
    image_url = null,
    type_detail = 'combat',
    is_active = 1
  } = itemData;

  if (!item_type || !name) {
    throw new Error('Thiếu thông tin bắt buộc: Loại (item_type) và Tên (name)!');
  }

  const validTypes = ['weapon', 'pet', 'helper'];
  if (!validTypes.includes(item_type)) {
    throw new Error(`Loại vật phẩm không hợp lệ: ${item_type}. Chỉ chấp nhận: weapon, pet, helper!`);
  }

  const parsedRarity = Math.min(5, Math.max(3, Number(rarity) || 3));
  const now = Date.now();

  const res = await db.execute({
    sql: `INSERT INTO tutien_gacha_items 
      (item_type, name, rarity, banner_type, rate_up, element, tier, hp, atk, def, speed, crit, effect_name, effect_desc, image_url, type_detail, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      item_type,
      name.trim(),
      parsedRarity,
      banner_type || 'all',
      Number(rate_up) ? 1 : 0,
      element || 'Hỏa',
      Number(tier) || 1,
      Number(hp) || 0,
      Number(atk) || 0,
      Number(def) || 0,
      Number(speed) || 0,
      Number(crit) || 0.05,
      (effect_name || '').trim(),
      (effect_desc || '').trim(),
      image_url || null,
      type_detail || 'combat',
      Number(is_active) ? 1 : 0,
      now
    ]
  });

  return { id: Number(res.lastInsertRowid), ...itemData };
}

/**
 * Sửa chỉ số vật phẩm trong Bể Cầu Nguyện (Admin Update)
 */
async function updateGachaItem(id, itemData) {
  const db = getDb();
  const existing = await getGachaItemById(id);
  if (!existing) {
    throw new Error(`Không tìm thấy vật phẩm Gacha ID: ${id}`);
  }

  const {
    item_type = existing.item_type,
    name = existing.name,
    rarity = existing.rarity,
    banner_type = existing.banner_type,
    rate_up = existing.rate_up,
    element = existing.element,
    tier = existing.tier,
    hp = existing.hp,
    atk = existing.atk,
    def = existing.def,
    speed = existing.speed,
    crit = existing.crit,
    effect_name = existing.effect_name,
    effect_desc = existing.effect_desc,
    image_url = existing.image_url,
    type_detail = existing.type_detail,
    is_active = existing.is_active
  } = itemData;

  const parsedRarity = Math.min(5, Math.max(3, Number(rarity) || 3));

  await db.execute({
    sql: `UPDATE tutien_gacha_items SET
      item_type = ?,
      name = ?,
      rarity = ?,
      banner_type = ?,
      rate_up = ?,
      element = ?,
      tier = ?,
      hp = ?,
      atk = ?,
      def = ?,
      speed = ?,
      crit = ?,
      effect_name = ?,
      effect_desc = ?,
      image_url = ?,
      type_detail = ?,
      is_active = ?
      WHERE id = ?`,
    args: [
      item_type,
      name.trim(),
      parsedRarity,
      banner_type,
      Number(rate_up) ? 1 : 0,
      element,
      Number(tier) || 1,
      Number(hp) || 0,
      Number(atk) || 0,
      Number(def) || 0,
      Number(speed) || 0,
      Number(crit) || 0.05,
      (effect_name || '').trim(),
      (effect_desc || '').trim(),
      image_url || null,
      type_detail,
      Number(is_active) ? 1 : 0,
      Number(id)
    ]
  });

  return await getGachaItemById(id);
}

/**
 * Xóa vật phẩm khỏi Bể Cầu Nguyện
 */
async function deleteGachaItem(id) {
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM tutien_gacha_items WHERE id = ?',
    args: [Number(id)]
  });
  return true;
}

/**
 * Bật/tắt trạng thái kích hoạt vật phẩm
 */
async function toggleGachaItemActive(id) {
  const db = getDb();
  const item = await getGachaItemById(id);
  if (!item) throw new Error('Không tìm thấy vật phẩm');

  const newActive = item.is_active ? 0 : 1;
  await db.execute({
    sql: 'UPDATE tutien_gacha_items SET is_active = ? WHERE id = ?',
    args: [newActive, Number(id)]
  });

  return { id, is_active: newActive };
}

/**
 * Thống kê tổng quan Bể Cầu Nguyện cho Admin
 */
async function getGachaStats() {
  const db = getDb();
  const totalItemsRes = await db.execute('SELECT COUNT(*) as cnt FROM tutien_gacha_items');
  const rarityRes = await db.execute(`
    SELECT rarity, COUNT(*) as cnt 
    FROM tutien_gacha_items 
    GROUP BY rarity 
    ORDER BY rarity DESC
  `);
  const typeRes = await db.execute(`
    SELECT item_type, COUNT(*) as cnt 
    FROM tutien_gacha_items 
    GROUP BY item_type
  `);
  const bannerRes = await db.execute(`
    SELECT banner_type, COUNT(*) as cnt 
    FROM tutien_gacha_items 
    GROUP BY banner_type
  `);
  const wishesRes = await db.execute('SELECT SUM(total_wishes) as total FROM tutien_wish_pity');

  return {
    totalItems: Number(totalItemsRes.rows[0]?.cnt || 0),
    rarities: rarityRes.rows,
    types: typeRes.rows,
    banners: bannerRes.rows,
    totalWishesPulled: Number(wishesRes.rows[0]?.total || 0)
  };
}

/**
 * Lấy hoặc tạo thông tin Bảo Hiểm (Pity) của người chơi
 */
async function getUserPity(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_wish_pity WHERE user_id = ?',
    args: [userId]
  });

  if (res.rows.length > 0) {
    const row = res.rows[0];
    return {
      user_id: row.user_id,
      weapon_pity_4: Number(row.weapon_pity_4 || 0),
      weapon_pity_5: Number(row.weapon_pity_5 || 0),
      pet_pity_4: Number(row.pet_pity_4 ?? row.pet_helper_pity_4 ?? 0),
      pet_pity_5: Number(row.pet_pity_5 ?? row.pet_helper_pity_5 ?? 0),
      helper_pity_4: Number(row.helper_pity_4 ?? row.pet_helper_pity_4 ?? 0),
      helper_pity_5: Number(row.helper_pity_5 ?? row.pet_helper_pity_5 ?? 0),
      standard_pity_4: Number(row.standard_pity_4 || 0),
      standard_pity_5: Number(row.standard_pity_5 || 0),
      total_wishes: Number(row.total_wishes || 0),
      last_wish_at: Number(row.last_wish_at || 0)
    };
  }

  // Khởi tạo dòng pity mới
  await db.execute({
    sql: `INSERT INTO tutien_wish_pity 
      (user_id, weapon_pity_4, weapon_pity_5, pet_pity_4, pet_pity_5, helper_pity_4, helper_pity_5, pet_helper_pity_4, pet_helper_pity_5, standard_pity_4, standard_pity_5, total_wishes, last_wish_at)
      VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`,
    args: [userId]
  });

  return {
    user_id: userId,
    weapon_pity_4: 0,
    weapon_pity_5: 0,
    pet_pity_4: 0,
    pet_pity_5: 0,
    helper_pity_4: 0,
    helper_pity_5: 0,
    standard_pity_4: 0,
    standard_pity_5: 0,
    total_wishes: 0,
    last_wish_at: 0
  };
}

/**
 * Thuật toán roll 1 lượt với cơ chế bảo hiểm phẩm chất
 * - Tỷ lệ 5★ cơ bản: 0.6%
 * - Soft pity từ lần 74: tăng dần tỷ lệ 5★
 * - Hard pity 90: chắc chắn ra 5★
 * - Tỷ lệ 4★ cơ bản: 5.1%
 * - Hard pity 10: nếu 9 lần chưa có 4★/5★, lần 10 chắc chắn ra 4★+
 */
function rollSingleWish(pity4, pity5, poolByRarity, bannerType) {
  let determinedRarity = 3;

  // 1. Tính toán xác suất 5★
  let rate5 = 0.006;
  if (pity5 >= 89) {
    rate5 = 1.0; // Hard pity 90
  } else if (pity5 >= 73) {
    // Soft pity: mỗi lần sau 73 tăng thêm 6% xác suất
    rate5 = 0.006 + (pity5 - 73) * 0.06;
  }

  const roll5 = Math.random();
  if (roll5 < rate5) {
    determinedRarity = 5;
  } else {
    // 2. Tính toán xác suất 4★
    let rate4 = 0.051;
    if (pity4 >= 9) {
      rate4 = 1.0; // Bảo hiểm 4★ sau 10 lượt
    }

    const roll4 = Math.random();
    if (roll4 < rate4) {
      determinedRarity = 4;
    } else {
      determinedRarity = 3;
    }
  }

  // 3. Chọn vật phẩm từ pool của rarity đó theo Banner
  const candidatePool = poolByRarity[determinedRarity] || [];
  if (candidatePool.length === 0) {
    throw new Error(`Bể Cầu Nguyện chưa có vật phẩm phẩm chất ${determinedRarity}★ khả dụng!`);
  }

  let selectedItem = null;

  // Banner chuyên biệt từng loại:
  // - weapon: Chuyên Linh Khí
  // - pet: Chuyên Linh Thú
  // - helper: Chuyên Trợ Thủ
  // - standard: Bể tổng hợp chia đều
  let targetType = null;
  if (bannerType === 'weapon') targetType = 'weapon';
  else if (bannerType === 'pet') targetType = 'pet';
  else if (bannerType === 'helper') targetType = 'helper';

  if (targetType) {
    const matchingItems = candidatePool.filter(i => i.item_type === targetType);
    const rateUpItems = matchingItems.filter(i => i.rate_up === 1);

    // Ở mốc 5★ trên banner chuyên biệt: 100% ra đúng loại của banner
    // Ở mốc 4★: 85% ra đúng loại của banner, 15% ra từ candidatePool
    // Ở mốc 3★: 85% ra đúng loại của banner, 15% ra từ candidatePool
    const isTargetHit = (determinedRarity === 5) ? true : (Math.random() < 0.85);

    if (matchingItems.length > 0 && isTargetHit) {
      // 50% ra món Rate-Up tiêu điểm của banner (nếu có)
      if (rateUpItems.length > 0 && Math.random() < 0.50) {
        selectedItem = rateUpItems[Math.floor(Math.random() * rateUpItems.length)];
      } else {
        selectedItem = matchingItems[Math.floor(Math.random() * matchingItems.length)];
      }
    }
  } else if (bannerType === 'pet_helper') {
    // Hỗ trợ ngược cho banner kết hợp cũ
    const petHelpers = candidatePool.filter(i => i.item_type === 'pet' || i.item_type === 'helper');
    const rateUpItems = petHelpers.filter(i => i.rate_up === 1);

    if (petHelpers.length > 0 && Math.random() < 0.85) {
      if (rateUpItems.length > 0 && Math.random() < 0.50) {
        selectedItem = rateUpItems[Math.floor(Math.random() * rateUpItems.length)];
      } else {
        selectedItem = petHelpers[Math.floor(Math.random() * petHelpers.length)];
      }
    }
  }

  // Nếu chưa chọn được, random đều trong candidatePool
  if (!selectedItem) {
    selectedItem = candidatePool[Math.floor(Math.random() * candidatePool.length)];
  }

  // Cập nhật pity
  let nextPity4 = pity4 + 1;
  let nextPity5 = pity5 + 1;

  if (determinedRarity === 5) {
    nextPity5 = 0;
  } else if (determinedRarity === 4) {
    nextPity4 = 0;
  }

  return {
    item: selectedItem,
    rarity: determinedRarity,
    nextPity4,
    nextPity5
  };
}

/**
 * Thực hiện Cầu Nguyện (Wish) cho người chơi
 * @param {string} userId - Discord ID người chơi
 * @param {string} bannerType - 'weapon' | 'pet_helper' | 'standard'
 * @param {number} count - 1 hoặc 10
 */
async function performWish(userId, bannerType = 'standard', count = 1) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player) {
    return { success: false, message: 'Đạo hữu chưa bước vào con đường Tu Tiên! Hãy dùng `/start` trước.' };
  }

  const wishCount = count === 10 ? 10 : 1;
  const totalCost = wishCount === 10 ? WISH_COST_TEN : WISH_COST_SINGLE;

  if (player.silver < totalCost) {
    return {
      success: false,
      message: `Ngân lượng không đủ! Cần **${totalCost.toLocaleString('vi-VN')}** Bạc để Cầu Nguyện ${wishCount} lần (Hiện có: **${player.silver.toLocaleString('vi-VN')}** Bạc).`
    };
  }

  // Lấy toàn bộ item active
  const activeItems = await getGachaItems({ is_active: 1 });
  if (activeItems.length === 0) {
    return { success: false, message: 'Bể Cầu Nguyện hiện đang đóng để các vị Chân Tiên điều chỉnh! Hãy quay lại sau.' };
  }

  // Gom nhóm theo Rarity
  const poolByRarity = {
    3: activeItems.filter(i => i.rarity === 3),
    4: activeItems.filter(i => i.rarity === 4),
    5: activeItems.filter(i => i.rarity === 5)
  };

  // Đảm bảo có ít nhất item ở các bậc
  if (!poolByRarity[3].length || !poolByRarity[4].length || !poolByRarity[5].length) {
    return { success: false, message: 'Bể Cầu Nguyện chưa đủ vật phẩm 3★, 4★, 5★ khả dụng!' };
  }

  // Lấy Pity hiện tại của người chơi
  const userPity = await getUserPity(userId);
  let currentPity4 = 0;
  let currentPity5 = 0;

  if (bannerType === 'weapon') {
    currentPity4 = userPity.weapon_pity_4 || 0;
    currentPity5 = userPity.weapon_pity_5 || 0;
  } else if (bannerType === 'pet') {
    currentPity4 = userPity.pet_pity_4 || 0;
    currentPity5 = userPity.pet_pity_5 || 0;
  } else if (bannerType === 'helper') {
    currentPity4 = userPity.helper_pity_4 || 0;
    currentPity5 = userPity.helper_pity_5 || 0;
  } else if (bannerType === 'pet_helper') {
    currentPity4 = userPity.pet_pity_4 || userPity.pet_helper_pity_4 || 0;
    currentPity5 = userPity.pet_pity_5 || userPity.pet_helper_pity_5 || 0;
  } else {
    currentPity4 = userPity.standard_pity_4 || 0;
    currentPity5 = userPity.standard_pity_5 || 0;
  }

  // Thực hiện các lần quay
  const results = [];
  let highestRarity = 3;
  let totalBonusSilver = 0;
  const insertStatements = [];

  for (let i = 0; i < wishCount; i++) {
    const roll = rollSingleWish(currentPity4, currentPity5, poolByRarity, bannerType);
    currentPity4 = roll.nextPity4;
    currentPity5 = roll.nextPity5;

    if (roll.rarity > highestRarity) {
      highestRarity = roll.rarity;
    }

    const item = roll.item;
    let bonusSilver = 0;
    if (item.rarity === 5) bonusSilver = 30000;
    else if (item.rarity === 4) bonusSilver = 5000;
    else bonusSilver = 500;

    totalBonusSilver += bonusSilver;

    results.push({
      ...item,
      bonusSilver
    });

    // Tạo câu lệnh insert tương ứng vào bảng đồ đạc người chơi
    if (item.item_type === 'weapon') {
      insertStatements.push({
        sql: `INSERT INTO tutien_weapons 
          (user_id, name, tier, atk, def, effect_name, effect_desc, image_url, is_natal, devour_exp, is_equipped)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
        args: [
          userId,
          item.name,
          item.tier || 1,
          item.atk || 0,
          item.def || 0,
          item.effect_name || 'Khí Linh',
          item.effect_desc || '',
          item.image_url || null
        ]
      });
    } else if (item.item_type === 'pet') {
      const isMythic = item.rarity === 5 || item.type_detail === 'mythic' ? 1 : 0;
      insertStatements.push({
        sql: `INSERT INTO tutien_pets 
          (user_id, name, element, is_mythic, star, hp, atk, def, speed, crit, effect_desc, image_url, is_equipped, slot)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        args: [
          userId,
          item.name,
          item.element || 'Hỏa',
          isMythic,
          item.rarity,
          item.hp || 500,
          item.atk || 50,
          item.def || 30,
          item.speed || 30,
          item.crit || 0.05,
          item.effect_desc || '',
          item.image_url || null
        ]
      });
    } else if (item.item_type === 'helper') {
      insertStatements.push({
        sql: `INSERT INTO tutien_helpers 
          (user_id, name, type, tier, effect_desc, image_url, is_equipped)
          VALUES (?, ?, ?, ?, ?, ?, 0)`,
        args: [
          userId,
          item.name,
          item.type_detail || 'combat',
          item.tier || 1,
          item.effect_desc || '',
          item.image_url || null
        ]
      });
    }
  }

  // Trừ bạc chi phí, cộng bạc bonus hồi đáp
  const netSilverChange = totalBonusSilver - totalCost;
  insertStatements.push({
    sql: 'UPDATE tutien_players SET silver = silver + ? WHERE user_id = ?',
    args: [netSilverChange, userId]
  });

  // Cập nhật Pity vào tutien_wish_pity
  let updatePitySql = '';
  const pityArgs = [];

  if (bannerType === 'weapon') {
    updatePitySql = `UPDATE tutien_wish_pity 
      SET weapon_pity_4 = ?, weapon_pity_5 = ?, total_wishes = total_wishes + ?, last_wish_at = ? 
      WHERE user_id = ?`;
    pityArgs.push(currentPity4, currentPity5, wishCount, Date.now(), userId);
  } else if (bannerType === 'pet') {
    updatePitySql = `UPDATE tutien_wish_pity 
      SET pet_pity_4 = ?, pet_pity_5 = ?, total_wishes = total_wishes + ?, last_wish_at = ? 
      WHERE user_id = ?`;
    pityArgs.push(currentPity4, currentPity5, wishCount, Date.now(), userId);
  } else if (bannerType === 'helper') {
    updatePitySql = `UPDATE tutien_wish_pity 
      SET helper_pity_4 = ?, helper_pity_5 = ?, total_wishes = total_wishes + ?, last_wish_at = ? 
      WHERE user_id = ?`;
    pityArgs.push(currentPity4, currentPity5, wishCount, Date.now(), userId);
  } else if (bannerType === 'pet_helper') {
    updatePitySql = `UPDATE tutien_wish_pity 
      SET pet_pity_4 = ?, pet_pity_5 = ?, helper_pity_4 = ?, helper_pity_5 = ?, pet_helper_pity_4 = ?, pet_helper_pity_5 = ?, total_wishes = total_wishes + ?, last_wish_at = ? 
      WHERE user_id = ?`;
    pityArgs.push(currentPity4, currentPity5, currentPity4, currentPity5, currentPity4, currentPity5, wishCount, Date.now(), userId);
  } else {
    updatePitySql = `UPDATE tutien_wish_pity 
      SET standard_pity_4 = ?, standard_pity_5 = ?, total_wishes = total_wishes + ?, last_wish_at = ? 
      WHERE user_id = ?`;
    pityArgs.push(currentPity4, currentPity5, wishCount, Date.now(), userId);
  }

  insertStatements.push({ sql: updatePitySql, args: pityArgs });

  // Thực thi batch an toàn
  await db.batch(insertStatements);

  const updatedPlayer = await getPlayer(userId);

  return {
    success: true,
    banner: BANNER_CONFIG[bannerType] || BANNER_CONFIG.standard,
    bannerType,
    wishCount,
    totalCost,
    totalBonusSilver,
    highestRarity,
    results,
    newPity4: currentPity4,
    newPity5: currentPity5,
    remainingSilver: updatedPlayer.silver
  };
}

/**
 * Giả lập Cầu Nguyện cho Admin Panel test và kiểm thử thuật toán
 */
async function simulateWish(bannerType = 'standard', count = 10) {
  const activeItems = await getGachaItems({ is_active: 1 });
  if (activeItems.length === 0) {
    throw new Error('Chưa có vật phẩm khả dụng trong bể Gacha!');
  }

  const poolByRarity = {
    3: activeItems.filter(i => i.rarity === 3),
    4: activeItems.filter(i => i.rarity === 4),
    5: activeItems.filter(i => i.rarity === 5)
  };

  let pity4 = 0;
  let pity5 = 0;
  const results = [];
  let highestRarity = 3;

  for (let i = 0; i < count; i++) {
    const roll = rollSingleWish(pity4, pity5, poolByRarity, bannerType);
    pity4 = roll.nextPity4;
    pity5 = roll.nextPity5;
    if (roll.rarity > highestRarity) highestRarity = roll.rarity;
    results.push(roll.item);
  }

  return {
    bannerType,
    count,
    highestRarity,
    results,
    finalPity4: pity4,
    finalPity5: pity5
  };
}

module.exports = {
  BANNER_CONFIG,
  WISH_COST_SINGLE,
  WISH_COST_TEN,
  getGachaItems,
  getGachaItemById,
  createGachaItem,
  updateGachaItem,
  deleteGachaItem,
  toggleGachaItemActive,
  getGachaStats,
  getUserPity,
  performWish,
  simulateWish
};
