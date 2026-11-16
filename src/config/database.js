const { createClient } = require('@libsql/client');
const { PET_RESONANCES } = require('./constants');
require('dotenv').config();

let client = null;

function getDb() {
  if (!client) {
    if (!process.env.TURSO_DATABASE_URL) {
      throw new Error('TURSO_DATABASE_URL is not configured in .env');
    }
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });
  }
  return client;
}

async function initDatabase() {
  const db = getDb();

  // Create tables if not exist
  const schema = [
    `CREATE TABLE IF NOT EXISTS tutien_players (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      dao_hieu TEXT,
      banner_image_url TEXT,
      race TEXT NOT NULL DEFAULT 'nhan_toc',
      spirit_root TEXT NOT NULL DEFAULT 'hoa',
      realm_id INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      xp TEXT NOT NULL DEFAULT '0',
      silver INTEGER NOT NULL DEFAULT 5000,
      rule_enlightenment TEXT DEFAULT NULL,
      tower_floor INTEGER NOT NULL DEFAULT 1,
      pvp_points INTEGER NOT NULL DEFAULT 1000,
      sect_id INTEGER DEFAULT NULL,
      sect_role TEXT DEFAULT NULL,
      sect_contribution INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_cultivate_at INTEGER DEFAULT 0
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      element TEXT NOT NULL,
      is_mythic INTEGER NOT NULL DEFAULT 0,
      star INTEGER NOT NULL DEFAULT 1,
      hp INTEGER NOT NULL,
      atk INTEGER NOT NULL,
      def INTEGER NOT NULL,
      speed INTEGER NOT NULL,
      crit REAL NOT NULL DEFAULT 0.05,
      effect_desc TEXT NOT NULL,
      image_url TEXT,
      is_equipped INTEGER NOT NULL DEFAULT 0,
      slot INTEGER DEFAULT 0
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_pet_elements (
      name TEXT PRIMARY KEY,
      icon TEXT NOT NULL DEFAULT '✨'
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_pet_resonance (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      atk_bonus REAL NOT NULL DEFAULT 35,
      hp_bonus REAL NOT NULL DEFAULT 0,
      def_bonus REAL NOT NULL DEFAULT 0,
      speed_bonus REAL NOT NULL DEFAULT 0,
      crit_bonus REAL NOT NULL DEFAULT 0,
      phys_resist_bonus REAL NOT NULL DEFAULT 15,
      hp_regen_turn REAL NOT NULL DEFAULT 0
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_weapons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      tier INTEGER NOT NULL DEFAULT 1,
      atk INTEGER NOT NULL,
      def INTEGER NOT NULL,
      effect_name TEXT NOT NULL,
      effect_desc TEXT NOT NULL,
      image_url TEXT,
      is_natal INTEGER NOT NULL DEFAULT 0,
      devour_exp INTEGER NOT NULL DEFAULT 0,
      is_equipped INTEGER NOT NULL DEFAULT 0
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_helpers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      tier INTEGER NOT NULL DEFAULT 1,
      effect_desc TEXT NOT NULL,
      image_url TEXT,
      is_equipped INTEGER NOT NULL DEFAULT 0
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      element TEXT NOT NULL,
      damage_mult REAL NOT NULL DEFAULT 1.0,
      desc TEXT NOT NULL,
      is_equipped INTEGER NOT NULL DEFAULT 0,
      slot INTEGER DEFAULT 0
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_dongphu (
      user_id TEXT PRIMARY KEY,
      array_level INTEGER NOT NULL DEFAULT 1,
      last_claim_xp INTEGER NOT NULL,
      afk_enabled INTEGER NOT NULL DEFAULT 0,
      afk_started_at INTEGER DEFAULT NULL,
      alchemy_furnace_level INTEGER NOT NULL DEFAULT 1,
      forge_level INTEGER NOT NULL DEFAULT 1,
      garden_slots INTEGER NOT NULL DEFAULT 3,
      garden_data TEXT NOT NULL DEFAULT '[]'
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_sects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      leader_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      fund_silver INTEGER NOT NULL DEFAULT 0,
      fund_spirit_gold INTEGER NOT NULL DEFAULT 0,
      sect_skill TEXT DEFAULT 'Thiên Địa Khí Tụ Quyết',
      notice TEXT DEFAULT 'Chào mừng đạo hữu gia nhập tông môn!',
      created_at INTEGER NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_mines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tier_name TEXT NOT NULL,
      occupying_sect_id INTEGER DEFAULT NULL,
      occupied_at INTEGER DEFAULT 0,
      daily_silver INTEGER NOT NULL DEFAULT 5000,
      daily_spirit_gold INTEGER NOT NULL DEFAULT 10,
      last_tax_collected INTEGER DEFAULT 0
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_world_boss (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      current_hp TEXT NOT NULL,
      max_hp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'alive',
      spawn_time INTEGER NOT NULL,
      damage_data TEXT NOT NULL DEFAULT '{}'
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_market (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id TEXT NOT NULL,
      seller_name TEXT NOT NULL,
      item_category TEXT NOT NULL,
      item_title TEXT NOT NULL,
      item_data TEXT NOT NULL,
      price_silver INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_gacha_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      name TEXT NOT NULL,
      rarity INTEGER NOT NULL DEFAULT 3,
      banner_type TEXT NOT NULL DEFAULT 'all',
      rate_up INTEGER NOT NULL DEFAULT 0,
      element TEXT DEFAULT 'Hỏa',
      tier INTEGER NOT NULL DEFAULT 1,
      hp INTEGER NOT NULL DEFAULT 0,
      atk INTEGER NOT NULL DEFAULT 0,
      def INTEGER NOT NULL DEFAULT 0,
      speed INTEGER NOT NULL DEFAULT 0,
      crit REAL NOT NULL DEFAULT 0.05,
      effect_name TEXT DEFAULT '',
      effect_desc TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      type_detail TEXT DEFAULT 'combat',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS tutien_wish_pity (
      user_id TEXT PRIMARY KEY,
      weapon_pity_4 INTEGER NOT NULL DEFAULT 0,
      weapon_pity_5 INTEGER NOT NULL DEFAULT 0,
      pet_pity_4 INTEGER NOT NULL DEFAULT 0,
      pet_pity_5 INTEGER NOT NULL DEFAULT 0,
      helper_pity_4 INTEGER NOT NULL DEFAULT 0,
      helper_pity_5 INTEGER NOT NULL DEFAULT 0,
      pet_helper_pity_4 INTEGER NOT NULL DEFAULT 0,
      pet_helper_pity_5 INTEGER NOT NULL DEFAULT 0,
      standard_pity_4 INTEGER NOT NULL DEFAULT 0,
      standard_pity_5 INTEGER NOT NULL DEFAULT 0,
      total_wishes INTEGER NOT NULL DEFAULT 0,
      last_wish_at INTEGER DEFAULT 0
    );`
  ];

  for (const sql of schema) {
    await db.execute(sql);
  }

  const dongPhuColsRes = await db.execute('PRAGMA table_info(tutien_dongphu)');
  const dongPhuCols = dongPhuColsRes.rows.map(row => row.name);
  if (!dongPhuCols.includes('afk_enabled')) {
    await db.execute('ALTER TABLE tutien_dongphu ADD COLUMN afk_enabled INTEGER NOT NULL DEFAULT 0');
  }
  if (!dongPhuCols.includes('afk_started_at')) {
    await db.execute('ALTER TABLE tutien_dongphu ADD COLUMN afk_started_at INTEGER DEFAULT NULL');
  }

  const defaultElements = [
    ['Kim', '⚔️'],
    ['Mộc', '🌿'],
    ['Thủy', '💧'],
    ['Hỏa', '🔥'],
    ['Thổ', '🛡️'],
    ['Lôi', '⚡'],
    ['Phong', '🌪️'],
    ['Băng', '❄️']
  ];
  for (const [name, icon] of defaultElements) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO tutien_pet_elements (name, icon) VALUES (?, ?)',
      args: [name, icon]
    });
  }
  await db.execute(`UPDATE tutien_gacha_items
    SET is_active = 0, rate_up = 0
    WHERE item_type = 'pet'
      AND name IN (
        'Thanh Long (Thần Thoại)',
        'Bạch Hổ (Thần Thoại)',
        'Chu Tước (Thần Thoại)',
        'Huyền Vũ (Thần Thoại)'
      )`);
  await db.execute(`UPDATE tutien_gacha_items
    SET effect_desc = REPLACE(
      REPLACE(effect_desc, 'Treo Máy Động Phủ offline', 'AFK khi trạng thái AFK đang bật'),
      'Treo Máy offline',
      'AFK khi trạng thái AFK đang bật'
    )
    WHERE item_type = 'helper' AND effect_desc LIKE '%offline%'`);

  const defaultResonance = PET_RESONANCES.same_element_3;
  await db.execute({
    sql: `INSERT OR IGNORE INTO tutien_pet_resonance
      (id, name, description, atk_bonus, hp_bonus, def_bonus, speed_bonus, crit_bonus, phys_resist_bonus, hp_regen_turn)
      VALUES (1, ?, ?, ?, 0, 0, 0, 0, ?, 0)`,
    args: [
      defaultResonance.name,
      defaultResonance.desc,
      Math.round((defaultResonance.buff.atkMultiplier - 1) * 100),
      Math.round(defaultResonance.buff.physResistBonus * 100)
    ]
  });

  const playerColsRes = await db.execute('PRAGMA table_info(tutien_players)');
  const playerCols = playerColsRes.rows.map(r => r.name);
  if (!playerCols.includes('dao_hieu')) {
    await db.execute('ALTER TABLE tutien_players ADD COLUMN dao_hieu TEXT');
  }
  if (!playerCols.includes('banner_image_url')) {
    await db.execute('ALTER TABLE tutien_players ADD COLUMN banner_image_url TEXT');
  }
  await db.execute(
    "UPDATE tutien_players SET dao_hieu = username WHERE dao_hieu IS NULL OR TRIM(dao_hieu) = ''"
  );

  for (const [table, column] of [
    ['tutien_pets', 'image_url'],
    ['tutien_weapons', 'image_url'],
    ['tutien_helpers', 'image_url'],
    ['tutien_gacha_items', 'image_url']
  ]) {
    const columns = await db.execute(`PRAGMA table_info(${table})`);
    if (!columns.rows.some(row => row.name === column)) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`);
    }
  }

  // Nâng cấp schema cho tutien_wish_pity nếu là cơ sở dữ liệu cũ
  try {
    const pityColsRes = await db.execute('PRAGMA table_info(tutien_wish_pity)');
    const pityCols = pityColsRes.rows.map(r => r.name);
    if (!pityCols.includes('pet_pity_4')) {
      await db.execute('ALTER TABLE tutien_wish_pity ADD COLUMN pet_pity_4 INTEGER NOT NULL DEFAULT 0');
    }
    if (!pityCols.includes('pet_pity_5')) {
      await db.execute('ALTER TABLE tutien_wish_pity ADD COLUMN pet_pity_5 INTEGER NOT NULL DEFAULT 0');
    }
    if (!pityCols.includes('helper_pity_4')) {
      await db.execute('ALTER TABLE tutien_wish_pity ADD COLUMN helper_pity_4 INTEGER NOT NULL DEFAULT 0');
    }
    if (!pityCols.includes('helper_pity_5')) {
      await db.execute('ALTER TABLE tutien_wish_pity ADD COLUMN helper_pity_5 INTEGER NOT NULL DEFAULT 0');
    }

    // Tự động chuyển đổi tiến trình pity cũ (pet_helper) sang riêng biệt cho pet & helper
    if (pityCols.includes('pet_helper_pity_4')) {
      await db.execute(`UPDATE tutien_wish_pity 
        SET pet_pity_4 = pet_helper_pity_4, pet_pity_5 = pet_helper_pity_5, helper_pity_4 = pet_helper_pity_4, helper_pity_5 = pet_helper_pity_5 
        WHERE (pet_pity_4 = 0 AND pet_pity_5 = 0 AND helper_pity_4 = 0 AND helper_pity_5 = 0) 
          AND (pet_helper_pity_4 > 0 OR pet_helper_pity_5 > 0)`);
    }

    // Tách riêng banner_type cho các vật phẩm gacha hiện có
    await db.execute("UPDATE tutien_gacha_items SET banner_type = 'pet' WHERE banner_type = 'pet_helper' AND item_type = 'pet'");
    await db.execute("UPDATE tutien_gacha_items SET banner_type = 'helper' WHERE banner_type = 'pet_helper' AND item_type = 'helper'");
  } catch (err) {
    console.warn('⚠️ Lỗi kiểm tra / nâng cấp schema tutien_wish_pity:', err.message);
  }

  // Khởi tạo các mỏ linh mạch mặc định nếu chưa có
  const mineCheck = await db.execute('SELECT COUNT(*) as cnt FROM tutien_mines');
  if (Number(mineCheck.rows[0].cnt) === 0) {
    await db.batch([
      {
        sql: 'INSERT INTO tutien_mines (name, tier_name, daily_silver, daily_spirit_gold) VALUES (?, ?, ?, ?)',
        args: ['Mỏ Phàm Linh Thụ (Thanh Vân Sơn)', 'Phàm', 20000, 50]
      },
      {
        sql: 'INSERT INTO tutien_mines (name, tier_name, daily_silver, daily_spirit_gold) VALUES (?, ?, ?, ?)',
        args: ['Mỏ Huyền Thủy Động (Vô Lượng Hải)', 'Linh', 50000, 30]
      },
      {
        sql: 'INSERT INTO tutien_mines (name, tier_name, daily_silver, daily_spirit_gold) VALUES (?, ?, ?, ?)',
        args: ['Mỏ Viêm Ma Quật (Xích Hỏa Sơn)', 'Địa', 150000, 20]
      },
      {
        sql: 'INSERT INTO tutien_mines (name, tier_name, daily_silver, daily_spirit_gold) VALUES (?, ?, ?, ?)',
        args: ['Mỏ Côn Lôn Tiên Phong (Thông Thiên Đài)', 'Thiên', 500000, 15]
      },
      {
        sql: 'INSERT INTO tutien_mines (name, tier_name, daily_silver, daily_spirit_gold) VALUES (?, ?, ?, ?)',
        args: ['Mỏ Thần Khư Cổ Địa (Thái Sơ Chi Địa)', 'Thần', 2000000, 10]
      }
    ]);
  }

  // Khởi tạo danh mục Cầu Nguyện Gacha mặc định nếu chưa có
  const gachaCheck = await db.execute('SELECT COUNT(*) as cnt FROM tutien_gacha_items');
  if (Number(gachaCheck.rows[0].cnt) === 0) {
    const now = Date.now();
    const defaultGachaItems = [
      // === 5★ LINH KHÍ ===
      { item_type: 'weapon', name: 'Tru Tiên Cổ Kiếm', rarity: 5, banner_type: 'weapon', rate_up: 1, element: 'Kim', tier: 6, hp: 0, atk: 2800, def: 1200, speed: 0, crit: 0.15, effect_name: 'Tru Tiên Kiếm Khí', effect_desc: 'Tăng 40% sát thương bạo kích và bỏ qua 25% phòng thủ địch', type_detail: 'weapon' },
      { item_type: 'weapon', name: 'Hiên Viên Kiếm', rarity: 5, banner_type: 'weapon', rate_up: 1, element: 'Kim', tier: 7, hp: 0, atk: 6500, def: 3000, speed: 0, crit: 0.20, effect_name: 'Thánh Đạo Thần Uy', effect_desc: 'Áp chế toàn bộ tà ma, tăng 60% sát thương lên mọi đối thủ', type_detail: 'weapon' },
      { item_type: 'weapon', name: 'Bàn Cổ Khai Thiên Phủ', rarity: 5, banner_type: 'all', rate_up: 0, element: 'Thổ', tier: 7, hp: 0, atk: 15000, def: 8000, speed: 0, crit: 0.10, effect_name: 'Khai Thiên Tích Địa', effect_desc: 'Sát thương chuẩn phá tan mọi phòng ngự và kết giới', type_detail: 'weapon' },
      { item_type: 'weapon', name: 'Hỗn Độn Chung', rarity: 5, banner_type: 'standard', rate_up: 0, element: 'Hỏa', tier: 5, hp: 0, atk: 1200, def: 750, speed: 0, crit: 0.08, effect_name: 'Thần Chung Hộ Thể', effect_desc: 'Tạo lớp linh giáp hấp thụ 20% sát thương nhận vào', type_detail: 'weapon' },

      // === 4★ LINH KHÍ ===
      { item_type: 'weapon', name: 'Càn Khôn Hỗn Nguyên Xích', rarity: 4, banner_type: 'weapon', rate_up: 1, element: 'Thổ', tier: 4, hp: 0, atk: 600, def: 300, speed: 0, crit: 0.05, effect_name: 'Càn Khôn Định Vị', effect_desc: 'Tăng 20% khả năng chống đỡ đòn chí mạng', type_detail: 'weapon' },
      { item_type: 'weapon', name: 'Thái Hư Tru Thần Đao', rarity: 4, banner_type: 'weapon', rate_up: 1, element: 'Lôi', tier: 4, hp: 0, atk: 750, def: 350, speed: 0, crit: 0.12, effect_name: 'Tru Thần Trảm', effect_desc: 'Gây thêm 30% sát thương khi mục tiêu dưới 50% máu', type_detail: 'weapon' },
      { item_type: 'weapon', name: 'Huyền Thủy Trảm Long Thương', rarity: 4, banner_type: 'all', rate_up: 0, element: 'Thủy', tier: 3, hp: 0, atk: 320, def: 160, speed: 0, crit: 0.08, effect_name: 'Long Uy', effect_desc: 'Tăng 15% sát thương lên Linh Thú và Quái Bí Cảnh', type_detail: 'weapon' },

      // === 3★ LINH KHÍ ===
      { item_type: 'weapon', name: 'Xích Hỏa Đao', rarity: 3, banner_type: 'all', rate_up: 0, element: 'Hỏa', tier: 2, hp: 0, atk: 150, def: 70, speed: 0, crit: 0.05, effect_name: 'Hỏa Viêm', effect_desc: 'Đòn đánh kèm theo hiệu ứng thiêu đốt', type_detail: 'weapon' },
      { item_type: 'weapon', name: 'Thanh Phong Kiếm', rarity: 3, banner_type: 'all', rate_up: 0, element: 'Phong', tier: 1, hp: 0, atk: 50, def: 20, speed: 0, crit: 0.05, effect_name: 'Kiếm Khí', effect_desc: 'Tăng 5% sát thương cơ bản', type_detail: 'weapon' },
      { item_type: 'weapon', name: 'Thiết Linh Côn', rarity: 3, banner_type: 'all', rate_up: 0, element: 'Kim', tier: 1, hp: 0, atk: 65, def: 30, speed: 0, crit: 0.03, effect_name: 'Trấn Áp', effect_desc: 'Đòn đánh gia tăng sức nặng phá vỡ thế trận đối phương', type_detail: 'weapon' },

      // === 5★ LINH THÚ ===
      // === 4★ LINH THÚ ===
      { item_type: 'pet', name: 'Cửu Vĩ Thiên Hồ', rarity: 4, banner_type: 'pet', rate_up: 1, element: 'Hỏa', tier: 4, hp: 3200, atk: 620, def: 300, speed: 140, crit: 0.18, effect_name: 'Mị Hoặc', effect_desc: 'Mị hoặc thiên hạ: Giảm 25% công kích của đối phương trong 3 lượt đầu.', type_detail: 'normal' },
      { item_type: 'pet', name: 'Côn Bằng Cổ Thú', rarity: 4, banner_type: 'all', rate_up: 0, element: 'Phong', tier: 4, hp: 3800, atk: 700, def: 380, speed: 190, crit: 0.15, effect_name: 'Phù Diêu', effect_desc: 'Phù diêu cửu vạn dặm: Tăng cực đại tốc độ xuất chiêu và cơ hội né đòn.', type_detail: 'normal' },
      { item_type: 'pet', name: 'Tử Tiêu Lôi Điểu', rarity: 4, banner_type: 'pet', rate_up: 0, element: 'Lôi', tier: 4, hp: 2500, atk: 550, def: 250, speed: 155, crit: 0.22, effect_name: 'Lôi Đình', effect_desc: 'Lôi đình vạn quân: Đòn đánh có 25% tỷ lệ làm tê liệt đối thủ.', type_detail: 'normal' },
      { item_type: 'pet', name: 'Băng Sương Cự Long', rarity: 4, banner_type: 'all', rate_up: 0, element: 'Băng', tier: 4, hp: 2900, atk: 510, def: 360, speed: 125, crit: 0.10, effect_name: 'Cực Hàn', effect_desc: 'Cực hàn lĩnh vực: Làm chậm tốc độ đối thủ và giảm 15% bạo kích của địch.', type_detail: 'normal' },

      // === 3★ LINH THÚ ===
      { item_type: 'pet', name: 'Hỏa Linh Điêu', rarity: 3, banner_type: 'all', rate_up: 0, element: 'Hỏa', tier: 1, hp: 400, atk: 60, def: 30, speed: 35, crit: 0.05, effect_name: 'Hỏa Thứ', effect_desc: 'Linh thú sơ cấp đồng hành khởi đầu, tăng 5% sát thương Hỏa.', type_detail: 'normal' },
      { item_type: 'pet', name: 'Kim Giác Ngưu', rarity: 3, banner_type: 'all', rate_up: 0, element: 'Kim', tier: 1, hp: 550, atk: 50, def: 45, speed: 25, crit: 0.05, effect_name: 'Kim Thân', effect_desc: 'Kim Ngưu hộ thể, tăng 5% phòng thủ cho chủ nhân.', type_detail: 'normal' },
      { item_type: 'pet', name: 'Thanh Trúc Xà', rarity: 3, banner_type: 'all', rate_up: 0, element: 'Mộc', tier: 1, hp: 380, atk: 65, def: 25, speed: 40, crit: 0.08, effect_name: 'Trúc Độc', effect_desc: 'Nhanh nhẹn và linh hoạt, tăng 5% tốc độ xuất chiêu.', type_detail: 'normal' },

      // === 5★ TRỢ THỦ ===
      { item_type: 'helper', name: 'Cửu Kiếm Tôn Giả', rarity: 5, banner_type: 'helper', rate_up: 1, element: 'Kim', tier: 5, hp: 0, atk: 0, def: 0, speed: 0, crit: 0.05, effect_name: 'Cửu Kiếm Trảm', effect_desc: 'Khi chủ nhân vào trận, trợ thủ phóng xuất 9 luồng kiếm khí gây 150% sát thương diện rộng và tạo lá chắn kiếm khiên.', type_detail: 'combat' },
      { item_type: 'helper', name: 'Dao Trì Tiên Mẫu', rarity: 5, banner_type: 'all', rate_up: 0, element: 'Thủy', tier: 5, hp: 0, atk: 0, def: 0, speed: 0, crit: 0.05, effect_name: 'Tiên Mẫu Ban Phúc', effect_desc: 'Tăng 60% tài nguyên AFK khi trạng thái AFK đang bật, tăng 35% tỷ lệ luyện đan đại thành và giảm 30% giá Chợ Đen.', type_detail: 'life' },

      // === 4★ TRỢ THỦ ===
      { item_type: 'helper', name: 'Hắc Ám Ma Tôn', rarity: 4, banner_type: 'helper', rate_up: 1, element: 'Hỏa', tier: 4, hp: 0, atk: 0, def: 0, speed: 0, crit: 0.05, effect_name: 'Ma Thần Hộ Thể', effect_desc: 'Trực tiếp xuất chiến cùng chủ nhân, tăng 25% sát thương Hút Máu và làm suy yếu công kích đối thủ.', type_detail: 'combat' },
      { item_type: 'helper', name: 'Thanh Phong Đạo Đồng', rarity: 4, banner_type: 'helper', rate_up: 1, element: 'Phong', tier: 4, hp: 0, atk: 0, def: 0, speed: 0, crit: 0.05, effect_name: 'Tụ Khí Đạo Đồng', effect_desc: 'Tăng 40% tài nguyên AFK khi trạng thái AFK đang bật, tăng 20% tỷ lệ luyện đan và giảm 20% giá mua đồ Chợ Đen.', type_detail: 'life' },
      { item_type: 'helper', name: 'Tiên Giới Chân Quân', rarity: 4, banner_type: 'all', rate_up: 0, element: 'Kim', tier: 3, hp: 0, atk: 0, def: 0, speed: 0, crit: 0.05, effect_name: 'Chân Quân Trợ Trận', effect_desc: 'Hộ đạo hộ thể, hồi phục 15% sinh lực cho chủ nhân mỗi khi máu dưới 40%.', type_detail: 'combat' },
      { item_type: 'helper', name: 'Dược Linh Đồng Tử', rarity: 4, banner_type: 'all', rate_up: 0, element: 'Mộc', tier: 3, hp: 0, atk: 0, def: 0, speed: 0, crit: 0.05, effect_name: 'Dược Viên Linh Khí', effect_desc: 'Chăm sóc Dược Viên, giảm 30% thời gian trưởng thành của linh thảo và tăng 25% tỷ lệ đan dược đại thành.', type_detail: 'life' },

      // === 3★ TRỢ THỦ ===
      { item_type: 'helper', name: 'Luyện Khí Đồng Tử', rarity: 3, banner_type: 'all', rate_up: 0, element: 'Hỏa', tier: 2, hp: 0, atk: 0, def: 0, speed: 0, crit: 0.05, effect_name: 'Lò Rèn Phụ Tá', effect_desc: 'Phụ giúp rèn Linh Khí ở Lò Rèn, giảm 25% chi phí rèn và tăng tỷ lệ ra phẩm chất cao.', type_detail: 'life' },
      { item_type: 'helper', name: 'Ngoại Môn Chấp Sự', rarity: 3, banner_type: 'all', rate_up: 0, element: 'Kim', tier: 2, hp: 0, atk: 0, def: 0, speed: 0, crit: 0.05, effect_name: 'Ngoại Môn Trợ Oai', effect_desc: 'Hỗ trợ chủ nhân trong chiến đấu sơ cấp, tăng 5% công kích toàn đội.', type_detail: 'combat' },
      { item_type: 'helper', name: 'Thải Dược Tiểu Đồng', rarity: 3, banner_type: 'all', rate_up: 0, element: 'Mộc', tier: 1, hp: 0, atk: 0, def: 0, speed: 0, crit: 0.05, effect_name: 'Lượm Lặt Linh Thảo', effect_desc: 'Chăm chỉ tìm kiếm linh thảo sơ cấp, tăng 10% sản lượng Dược Viên.', type_detail: 'life' }
    ];

    const statements = defaultGachaItems.map(item => ({
      sql: `INSERT INTO tutien_gacha_items 
        (item_type, name, rarity, banner_type, rate_up, element, tier, hp, atk, def, speed, crit, effect_name, effect_desc, type_detail, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [
        item.item_type,
        item.name,
        item.rarity,
        item.banner_type,
        item.rate_up,
        item.element,
        item.tier,
        item.hp,
        item.atk,
        item.def,
        item.speed,
        item.crit,
        item.effect_name,
        item.effect_desc,
        item.type_detail,
        now
      ]
    }));

    await db.batch(statements);
    console.log(`✅ Đã khởi tạo thành công ${defaultGachaItems.length} vật phẩm mặc định vào Bể Cầu Nguyện Gacha!`);
  }

  console.log('✅ Turso Tu Tiên Database initialized successfully!');
}

module.exports = {
  getDb,
  initDatabase
};
