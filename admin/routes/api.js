const express = require('express');
const router = express.Router();
const { getDb, getCacheStatus, syncDatabase } = require('../../src/config/database');
const { REALMS, RACES, SPIRIT_ROOTS, SPIRIT_GOLD_QUALITIES } = require('../../src/config/constants');
const { getPlayer, createPlayer, executeBreakthrough, addSilver, addXp } = require('../../src/services/playerService');
const { addItem, removeItem, getInventory } = require('../../src/services/itemService');
const { getXpRequired } = require('../../src/utils/formatters');
const { withTransaction } = require('../../src/utils/databaseTransaction');
const { getPetSettings } = require('../../src/services/petConfigService');
const { announceBossSpawn } = require('../../src/services/bossAnnouncementService');
const {
  ITEM_PRESETS,
  PET_PRESETS,
  WEAPON_PRESETS,
  HELPER_PRESETS,
  SKILL_PRESETS,
  BOSS_PRESETS
} = require('../presets');
const {
  getGachaItems,
  getGachaItemById,
  createGachaItem,
  updateGachaItem,
  deleteGachaItem,
  toggleGachaItemActive,
  getGachaStats,
  simulateWish
} = require('../../src/services/gachaService');

// Helper serialize BigInt to string in JSON responses
function sanitizeRow(row) {
  if (!row) return row;
  const result = { ...row };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'bigint') {
      result[key] = result[key].toString();
    }
  }
  return result;
}

function sanitizeRows(rows) {
  return (rows || []).map(sanitizeRow);
}

function validateImageUrl(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (value.trim() === '') return null;

  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : false;
  } catch {
    return false;
  }
}

// ==========================================
// 1. DASHBOARD & SYSTEM STATS
// ==========================================
router.get('/stats', async (req, res) => {
  try {
    const db = getDb();
    
    // Players count & silver sum
    const pCountRes = await db.execute('SELECT COUNT(*) as count, SUM(silver) as total_silver FROM tutien_players');
    const totalPlayers = Number(pCountRes.rows[0]?.count || 0);
    const totalSilver = Number(pCountRes.rows[0]?.total_silver || 0);

    // Sects count
    const sCountRes = await db.execute('SELECT COUNT(*) as count FROM tutien_sects');
    const totalSects = Number(sCountRes.rows[0]?.count || 0);

    // Market active count
    const mCountRes = await db.execute("SELECT COUNT(*) as count FROM tutien_market WHERE status = 'active'");
    const totalMarketActive = Number(mCountRes.rows[0]?.count || 0);

    // Active boss
    const bossRes = await db.execute("SELECT * FROM tutien_world_boss WHERE status = 'alive' ORDER BY id DESC LIMIT 1");
    const activeBoss = bossRes.rows[0] ? sanitizeRow(bossRes.rows[0]) : null;

    // Mines count & occupied count
    const minesRes = await db.execute('SELECT COUNT(*) as total, SUM(CASE WHEN occupying_sect_id IS NOT NULL THEN 1 ELSE 0 END) as occupied FROM tutien_mines');
    const totalMines = Number(minesRes.rows[0]?.total || 0);
    const occupiedMines = Number(minesRes.rows[0]?.occupied || 0);

    // Realms breakdown
    const realmCountsRes = await db.execute('SELECT realm_id, COUNT(*) as count FROM tutien_players GROUP BY realm_id');
    const realmDistribution = REALMS.map(r => {
      const found = realmCountsRes.rows.find(row => Number(row.realm_id) === r.id);
      return {
        id: r.id,
        name: r.name,
        color: r.color,
        count: found ? Number(found.count) : 0
      };
    });

    // Top players (by realm & level, then silver, then pvp)
    const topRealmRes = await db.execute('SELECT user_id, COALESCE(dao_hieu, username) AS username, race, realm_id, level, silver, pvp_points FROM tutien_players ORDER BY realm_id DESC, level DESC, xp DESC LIMIT 5');
    const topSilverRes = await db.execute('SELECT user_id, COALESCE(dao_hieu, username) AS username, race, realm_id, level, silver FROM tutien_players ORDER BY silver DESC LIMIT 5');
    const topPvpRes = await db.execute('SELECT user_id, COALESCE(dao_hieu, username) AS username, race, realm_id, level, pvp_points FROM tutien_players ORDER BY pvp_points DESC LIMIT 5');

    res.json({
      success: true,
      data: {
        totalPlayers,
        totalSilver,
        totalSects,
        totalMarketActive,
        activeBoss,
        mines: { total: totalMines, occupied: occupiedMines },
        realmDistribution,
        leaderboards: {
          topRealm: sanitizeRows(topRealmRes.rows),
          topSilver: sanitizeRows(topSilverRes.rows),
          topPvp: sanitizeRows(topPvpRes.rows)
        }
      }
    });
  } catch (error) {
    console.error('API /stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. PLAYERS MANAGEMENT
// ==========================================
router.get('/players', async (req, res) => {
  try {
    const db = getDb();
    const { search, race, realm_id, sort = 'created_at', order = 'DESC' } = req.query;

    let sql = `
      SELECT p.*, s.name as sect_name 
      FROM tutien_players p 
      LEFT JOIN tutien_sects s ON p.sect_id = s.id 
      WHERE 1=1
    `;
    const args = [];

    if (search) {
      sql += ' AND (p.user_id LIKE ? OR p.username LIKE ? OR p.dao_hieu LIKE ?)';
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (race) {
      sql += ' AND p.race = ?';
      args.push(race);
    }

    if (realm_id !== undefined && realm_id !== '') {
      sql += ' AND p.realm_id = ?';
      args.push(Number(realm_id));
    }

    const allowedSort = ['user_id', 'username', 'dao_hieu', 'realm_id', 'level', 'silver', 'tower_floor', 'pvp_points', 'created_at'];
    const sortCol = allowedSort.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    sql += ` ORDER BY p.${sortCol} ${sortOrder}`;

    const result = await db.execute({ sql, args });
    res.json({ success: true, data: sanitizeRows(result.rows) });
  } catch (error) {
    console.error('API GET /players error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/players', async (req, res) => {
  try {
    const { user_id, username, dao_hieu, race = 'nhan_toc', spirit_root = 'hoa', realm_id = 0, level = 1, silver = 5000 } = req.body;
    const imageUrl = validateImageUrl(req.body.banner_image_url);
    if (imageUrl === false) {
      return res.status(400).json({ success: false, error: 'URL ảnh banner phải là URL HTTP(S) hợp lệ (tối đa 2048 ký tự).' });
    }
    const playerName = dao_hieu ?? username;
    if (!user_id) return res.status(400).json({ success: false, error: 'Thiếu user_id!' });
    if (typeof playerName !== 'string' || !playerName.trim() || playerName.trim().length > 32) {
      return res.status(400).json({ success: false, error: 'Đạo hiệu phải có từ 1 đến 32 ký tự.' });
    }

    const db = getDb();
    const existing = await getPlayer(user_id);
    if (existing) {
      return res.status(400).json({ success: false, error: 'User ID này đã tồn tại!' });
    }

    // Call service to initialize player & default equipment/dongphu
    await createPlayer(user_id, username || playerName, race, spirit_root, playerName.trim());
    if (imageUrl !== undefined) {
      await db.execute({
        sql: 'UPDATE tutien_players SET banner_image_url = ? WHERE user_id = ?',
        args: [imageUrl, user_id]
      });
    }

    // If custom realm or silver was specified, update them
    if (Number(realm_id) > 0 || Number(level) > 1 || Number(silver) !== 5000) {
      await db.execute({
        sql: 'UPDATE tutien_players SET realm_id = ?, level = ?, silver = ? WHERE user_id = ?',
        args: [Number(realm_id), Number(level), Number(silver), user_id]
      });
    }

    const created = await getPlayer(user_id);
    res.json({ success: true, data: sanitizeRow(created), message: 'Khởi tạo nhân vật thành công!' });
  } catch (error) {
    console.error('API POST /players error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/players/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const player = await getPlayer(id);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người chơi!' });
    }

    // Fetch related records
    const inventory = await db.execute({ sql: 'SELECT * FROM tutien_inventory WHERE user_id = ? ORDER BY id DESC', args: [id] });
    const pets = await db.execute({ sql: 'SELECT * FROM tutien_pets WHERE user_id = ? ORDER BY is_equipped DESC, id DESC', args: [id] });
    const weapons = await db.execute({ sql: 'SELECT * FROM tutien_weapons WHERE user_id = ? ORDER BY is_equipped DESC, id DESC', args: [id] });
    const helpers = await db.execute({ sql: 'SELECT * FROM tutien_helpers WHERE user_id = ? ORDER BY is_equipped DESC, id DESC', args: [id] });
    const skills = await db.execute({ sql: 'SELECT * FROM tutien_skills WHERE user_id = ? ORDER BY is_equipped DESC, id DESC', args: [id] });
    const dongphu = await db.execute({ sql: 'SELECT * FROM tutien_dongphu WHERE user_id = ?', args: [id] });

    let sect = null;
    if (player.sect_id) {
      const sectRes = await db.execute({ sql: 'SELECT * FROM tutien_sects WHERE id = ?', args: [player.sect_id] });
      sect = sectRes.rows[0] ? sanitizeRow(sectRes.rows[0]) : null;
    }

    res.json({
      success: true,
      data: {
        player: sanitizeRow(player),
        inventory: sanitizeRows(inventory.rows),
        pets: sanitizeRows(pets.rows),
        weapons: sanitizeRows(weapons.rows),
        helpers: sanitizeRows(helpers.rows),
        skills: sanitizeRows(skills.rows),
        dongphu: dongphu.rows[0] ? sanitizeRow(dongphu.rows[0]) : null,
        sect
      }
    });
  } catch (error) {
    console.error('API GET /players/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/players/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const existing = await getPlayer(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người chơi!' });
    }

    const {
      username,
      dao_hieu,
      banner_image_url,
      race,
      spirit_root,
      realm_id,
      level,
      xp,
      silver,
      tower_floor,
      pvp_points,
      rule_enlightenment,
      sect_role
    } = req.body;
    const updatedDaoHieu = dao_hieu !== undefined ? dao_hieu : username;
    const imageUrl = validateImageUrl(banner_image_url);
    if (imageUrl === false) {
      return res.status(400).json({ success: false, error: 'URL ảnh banner phải là URL HTTP(S) hợp lệ (tối đa 2048 ký tự).' });
    }
    if (updatedDaoHieu !== undefined && (typeof updatedDaoHieu !== 'string' || !updatedDaoHieu.trim() || updatedDaoHieu.trim().length > 32)) {
      return res.status(400).json({ success: false, error: 'Đạo hiệu phải có từ 1 đến 32 ký tự.' });
    }

    await db.execute({
      sql: `UPDATE tutien_players SET
        username = COALESCE(?, username),
        dao_hieu = COALESCE(?, dao_hieu),
        banner_image_url = CASE WHEN ? = 1 THEN ? ELSE banner_image_url END,
        race = COALESCE(?, race),
        spirit_root = COALESCE(?, spirit_root),
        realm_id = COALESCE(?, realm_id),
        level = COALESCE(?, level),
        xp = COALESCE(?, xp),
        silver = COALESCE(?, silver),
        tower_floor = COALESCE(?, tower_floor),
        pvp_points = COALESCE(?, pvp_points),
        rule_enlightenment = ?,
        sect_role = ?
        WHERE user_id = ?`,
      args: [
        username !== undefined ? username : null,
        updatedDaoHieu !== undefined ? updatedDaoHieu.trim() : null,
        banner_image_url !== undefined ? 1 : 0,
        imageUrl === undefined ? null : imageUrl,
        race !== undefined ? race : null,
        spirit_root !== undefined ? spirit_root : null,
        realm_id !== undefined ? Number(realm_id) : null,
        level !== undefined ? Number(level) : null,
        xp !== undefined ? xp.toString() : null,
        silver !== undefined ? Number(silver) : null,
        tower_floor !== undefined ? Number(tower_floor) : null,
        pvp_points !== undefined ? Number(pvp_points) : null,
        rule_enlightenment !== undefined ? rule_enlightenment : existing.rule_enlightenment,
        sect_role !== undefined ? sect_role : existing.sect_role,
        id
      ]
    });

    const updated = await getPlayer(id);
    res.json({ success: true, data: sanitizeRow(updated), message: 'Cập nhật thông tin tu tiên thành công!' });
  } catch (error) {
    console.error('API PUT /players/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Quick Action for a player
router.post('/players/:id/quick-action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, amount } = req.body;
    const db = getDb();
    const player = await getPlayer(id);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người chơi!' });
    }

    switch (action) {
      case 'level10': {
        const peakXp = getXpRequired(player.realm_id, 10);
        await db.execute({
          sql: 'UPDATE tutien_players SET level = 10, xp = ? WHERE user_id = ?',
          args: [peakXp.toString(), id]
        });
        return res.json({ success: true, message: `Đã đưa ${player.username} lên Cấp 10 (Đỉnh cấp)!` });
      }

      case 'breakthrough': {
        if (player.realm_id >= 8) {
          return res.status(400).json({ success: false, error: 'Đã đạt cảnh giới Tối Thượng, không thể tăng thêm!' });
        }
        const nextRealm = player.realm_id + 1;
        await db.execute({
          sql: "UPDATE tutien_players SET realm_id = ?, level = 1, xp = '0' WHERE user_id = ?",
          args: [nextRealm, id]
        });
        return res.json({ success: true, message: `Đột phá thần tốc lên ${REALMS[nextRealm].name} thành công!` });
      }

      case 'add-silver': {
        const addAmount = Number(amount) || 100000;
        await addSilver(id, addAmount);
        return res.json({ success: true, message: `Đã cộng ${addAmount.toLocaleString()} Ngân lượng cho ${player.username}!` });
      }

      case 'add-xp': {
        const addAmount = Number(amount) || 10000;
        const xpResult = await addXp(id, addAmount);
        return res.json({
          success: true,
          message: `Đã cộng ${xpResult.addedXp?.toLocaleString() || addAmount} XP cho ${player.username}!`
        });
      }

      case 'reset': {
        await db.execute({
          sql: "UPDATE tutien_players SET realm_id = 0, level = 1, xp = '0', silver = 5000, tower_floor = 1, pvp_points = 1000 WHERE user_id = ?",
          args: [id]
        });
        return res.json({ success: true, message: `Đã đặt lại cảnh giới và chỉ số của ${player.username} về Linh Sĩ cấp 1!` });
      }

      default:
        return res.status(400).json({ success: false, error: 'Hành động không hợp lệ!' });
    }
  } catch (error) {
    console.error('API /players/:id/quick-action error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/players/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Delete player cascade
    await db.batch([
      { sql: 'DELETE FROM tutien_players WHERE user_id = ?', args: [id] },
      { sql: 'DELETE FROM tutien_inventory WHERE user_id = ?', args: [id] },
      { sql: 'DELETE FROM tutien_pets WHERE user_id = ?', args: [id] },
      { sql: 'DELETE FROM tutien_weapons WHERE user_id = ?', args: [id] },
      { sql: 'DELETE FROM tutien_helpers WHERE user_id = ?', args: [id] },
      { sql: 'DELETE FROM tutien_skills WHERE user_id = ?', args: [id] },
      { sql: 'DELETE FROM tutien_dongphu WHERE user_id = ?', args: [id] },
      { sql: 'DELETE FROM tutien_market WHERE seller_id = ?', args: [id] }
    ]);

    res.json({ success: true, message: 'Đã xóa toàn bộ dữ liệu nhân vật thành công!' });
  } catch (error) {
    console.error('API DELETE /players/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// GIFT CODE MANAGEMENT
// ==========================================
router.get('/gift-codes', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute(`
      SELECT g.*, COUNT(c.id) AS claim_count
      FROM tutien_gift_codes g
      LEFT JOIN tutien_gift_code_claims c ON c.gift_code_id = g.id
      GROUP BY g.id
      ORDER BY g.created_at DESC
      LIMIT 200
    `);
    res.json({ success: true, data: sanitizeRows(result.rows) });
  } catch (error) {
    console.error('API GET /gift-codes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/gift-codes', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const item_type = typeof body.item_type === 'string' ? body.item_type.trim() : '';
    let item_key = typeof body.item_key === 'string' ? body.item_key.trim() : '';
    let item_name = typeof body.item_name === 'string' ? body.item_name.trim() : '';
    const amount = Number(body.amount);
    const expires_at = Number(body.expires_at);
    const allowedItemTypes = new Set(['silver', 'spirit_gold', 'pill', 'herb', 'seed', 'material', 'special']);

    if (item_type === 'silver') {
      item_key = 'silver';
      item_name = 'Ngân Lượng (Bạc)';
    }

    if (!/^[A-Z0-9_-]{3,64}$/.test(code)) {
      return res.status(400).json({ success: false, error: 'Mã chỉ gồm 3-64 ký tự chữ, số, gạch ngang hoặc gạch dưới.' });
    }
    if (!allowedItemTypes.has(item_type)
      || !item_key || item_key.length > 100
      || !item_name || item_name.length > 100) {
      return res.status(400).json({ success: false, error: 'Thông tin quà tặng không hợp lệ; hãy chọn loại vật phẩm hỗ trợ, mã và tên tối đa 100 ký tự.' });
    }
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2147483647) {
      return res.status(400).json({ success: false, error: 'Số lượng phải là số nguyên từ 1 đến 2.147.483.647.' });
    }
    if (!Number.isSafeInteger(expires_at) || expires_at <= Date.now()) {
      return res.status(400).json({ success: false, error: 'Thời điểm hết hạn phải ở tương lai.' });
    }

    const db = getDb();
    const result = await db.execute({
      sql: `INSERT INTO tutien_gift_codes
        (code, item_type, item_key, item_name, amount, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (code) DO NOTHING`,
      args: [code, item_type, item_key, item_name, amount, expires_at, Date.now()]
    });
    if (result.rowsAffected !== 1) {
      return res.status(409).json({ success: false, error: 'Mã quà tặng này đã tồn tại.' });
    }

    res.status(201).json({ success: true, message: `Đã tạo mã quà tặng ${code}.` });
  } catch (error) {
    console.error('API POST /gift-codes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. INVENTORY & ITEMS MANAGEMENT
// ==========================================
router.get('/inventory', async (req, res) => {
  try {
    const db = getDb();
    const { user_id, item_type, search } = req.query;

    let sql = `
      SELECT i.*, COALESCE(p.dao_hieu, p.username) AS username 
      FROM tutien_inventory i 
      LEFT JOIN tutien_players p ON i.user_id = p.user_id 
      WHERE 1=1
    `;
    const args = [];

    if (user_id) {
      sql += ' AND i.user_id = ?';
      args.push(user_id);
    }
    if (item_type) {
      sql += ' AND i.item_type = ?';
      args.push(item_type);
    }
    if (search) {
      sql += ' AND (i.item_name LIKE ? OR i.item_key LIKE ? OR p.username LIKE ? OR p.dao_hieu LIKE ?)';
      args.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY i.id DESC LIMIT 100';

    const result = await db.execute({ sql, args });
    res.json({ success: true, data: sanitizeRows(result.rows) });
  } catch (error) {
    console.error('API GET /inventory error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/inventory/presets', (req, res) => {
  res.json({ success: true, data: ITEM_PRESETS });
});

router.post('/inventory/give', async (req, res) => {
  try {
    const { target_user_id, item_type, item_key, item_name, amount = 1 } = req.body;
    if (!item_type || !item_key || !item_name) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin vật phẩm (item_type, item_key, item_name)!' });
    }

    const numAmount = Number(amount) || 1;
    if (numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Số lượng phải lớn hơn 0!' });
    }

    const db = getDb();

    // If target is "all", give to all players
    if (target_user_id === 'all') {
      const playersRes = await db.execute('SELECT user_id FROM tutien_players');
      for (const p of playersRes.rows) {
        await addItem(p.user_id, item_type, item_key, item_name, numAmount);
      }
      return res.json({
        success: true,
        message: `Đã airdrop ${numAmount}x "${item_name}" cho toàn bộ ${playersRes.rows.length} tu tiên giả!`
      });
    }

    if (!target_user_id) {
      return res.status(400).json({ success: false, error: 'Cần chọn người chơi nhận vật phẩm!' });
    }

    const player = await getPlayer(target_user_id);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người chơi này!' });
    }

    await addItem(target_user_id, item_type, item_key, item_name, numAmount);
    res.json({
      success: true,
      message: `Đã thêm ${numAmount}x "${item_name}" vào túi đồ của ${player.username}!`
    });
  } catch (error) {
    console.error('API POST /inventory/give error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, item_name } = req.body;
    const db = getDb();

    await db.execute({
      sql: 'UPDATE tutien_inventory SET amount = COALESCE(?, amount), item_name = COALESCE(?, item_name) WHERE id = ?',
      args: [amount !== undefined ? Number(amount) : null, item_name || null, Number(id)]
    });

    res.json({ success: true, message: 'Đã cập nhật vật phẩm trong túi đồ!' });
  } catch (error) {
    console.error('API PUT /inventory/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.execute({
      sql: 'DELETE FROM tutien_inventory WHERE id = ?',
      args: [Number(id)]
    });
    res.json({ success: true, message: 'Đã xóa vật phẩm khỏi túi đồ!' });
  } catch (error) {
    console.error('API DELETE /inventory/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. PETS MANAGEMENT
// ==========================================
router.get('/pet-config', async (req, res) => {
  try {
    const settings = await getPetSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('API GET /pet-config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/pet-elements', async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const icon = typeof req.body.icon === 'string' ? req.body.icon.trim() : '';
    if (!name || name.length > 32 || !icon || Array.from(icon).length > 8) {
      return res.status(400).json({ success: false, error: 'Tên hệ (tối đa 32 ký tự) và biểu tượng (tối đa 8 ký tự) là bắt buộc.' });
    }

    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT name FROM tutien_pet_elements WHERE LOWER(name) = LOWER(?)',
      args: [name]
    });
    if (existing.rows.length) {
      return res.status(409).json({ success: false, error: 'Hệ này đã tồn tại.' });
    }

    await db.execute({
      sql: 'INSERT INTO tutien_pet_elements (name, icon) VALUES (?, ?)',
      args: [name, icon]
    });
    res.json({ success: true, message: `Đã thêm hệ ${icon} ${name}.` });
  } catch (error) {
    console.error('API POST /pet-elements error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/pet-elements/:name', async (req, res) => {
  try {
    const name = req.params.name.trim();
    const db = getDb();
    const used = await db.execute({
      sql: `SELECT
          (SELECT COUNT(*) FROM tutien_pets WHERE element = ?) +
          (SELECT COUNT(*) FROM tutien_gacha_items WHERE item_type = 'pet' AND element = ?) AS count`,
      args: [name, name]
    });
    if (Number(used.rows[0]?.count || 0) > 0) {
      return res.status(409).json({ success: false, error: 'Không thể xóa hệ đang được dùng bởi linh thú hoặc vật phẩm gacha.' });
    }

    const result = await db.execute({
      sql: 'DELETE FROM tutien_pet_elements WHERE name = ?',
      args: [name]
    });
    if (Number(result.rowsAffected) === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy hệ cần xóa.' });
    }
    res.json({ success: true, message: `Đã xóa hệ ${name}.` });
  } catch (error) {
    console.error('API DELETE /pet-elements/:name error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/pet-resonance', async (req, res) => {
  try {
    const { name, description } = req.body;
    const fields = [
      'atk_bonus',
      'hp_bonus',
      'def_bonus',
      'speed_bonus',
      'crit_bonus',
      'phys_resist_bonus',
      'hp_regen_turn'
    ];
    const limits = {
      atk_bonus: 500,
      hp_bonus: 500,
      def_bonus: 500,
      speed_bonus: 500,
      crit_bonus: 100,
      phys_resist_bonus: 90,
      hp_regen_turn: 100
    };
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 64 ||
        typeof description !== 'string' || !description.trim() || description.trim().length > 500) {
      return res.status(400).json({ success: false, error: 'Tên và mô tả cộng hưởng không hợp lệ.' });
    }

    const values = {};
    for (const field of fields) {
      const value = Number(req.body[field]);
      if (!Number.isFinite(value) || value < 0 || value > limits[field]) {
        return res.status(400).json({ success: false, error: `Giá trị ${field} phải từ 0 đến ${limits[field]}.` });
      }
      values[field] = value;
    }

    const db = getDb();
    await db.execute({
      sql: `UPDATE tutien_pet_resonance SET
        name = ?, description = ?, atk_bonus = ?, hp_bonus = ?, def_bonus = ?,
        speed_bonus = ?, crit_bonus = ?, phys_resist_bonus = ?, hp_regen_turn = ?
        WHERE id = 1`,
      args: [
        name.trim(),
        description.trim(),
        ...fields.map(field => values[field])
      ]
    });
    res.json({ success: true, message: 'Đã cập nhật hiệu ứng Cộng Hưởng Trận Pháp.' });
  } catch (error) {
    console.error('API PUT /pet-resonance error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/pets', async (req, res) => {
  try {
    const db = getDb();
    const { user_id, element, is_mythic, search } = req.query;

    let sql = `
      SELECT pet.*, COALESCE(p.dao_hieu, p.username) AS username 
      FROM tutien_pets pet 
      LEFT JOIN tutien_players p ON pet.user_id = p.user_id 
      WHERE 1=1
    `;
    const args = [];

    if (user_id) {
      sql += ' AND pet.user_id = ?';
      args.push(user_id);
    }
    if (element) {
      sql += ' AND pet.element = ?';
      args.push(element);
    }
    if (is_mythic !== undefined && is_mythic !== '') {
      sql += ' AND pet.is_mythic = ?';
      args.push(Number(is_mythic));
    }
    if (search) {
      sql += ' AND (pet.name LIKE ? OR p.username LIKE ? OR p.dao_hieu LIKE ?)';
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY pet.id DESC LIMIT 100';
    const result = await db.execute({ sql, args });
    res.json({ success: true, data: sanitizeRows(result.rows) });
  } catch (error) {
    console.error('API GET /pets error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/pets/presets', async (req, res) => {
  try {
    const dbPets = await getGachaItems({ item_type: 'pet' });
    const formatted = dbPets.map(p => ({
      name: p.name,
      element: p.element,
      is_mythic: p.rarity === 5 || p.type_detail === 'mythic' ? 1 : 0,
      star: p.rarity,
      hp: p.hp,
      atk: p.atk,
      def: p.def,
      speed: p.speed,
      crit: p.crit,
      effect_desc: p.effect_desc,
      image_url: p.image_url
    }));
    const all = [...PET_PRESETS];
    for (const item of formatted) {
      if (!all.some(x => x.name === item.name)) all.push(item);
    }
    res.json({ success: true, data: all });
  } catch (e) {
    res.json({ success: true, data: PET_PRESETS });
  }
});

router.post('/pets', async (req, res) => {
  try {
    const {
      user_id,
      name,
      element = 'Hỏa',
      is_mythic = 0,
      star = 1,
      hp = 500,
      atk = 50,
      def = 30,
      speed = 30,
      crit = 0.05,
      effect_desc = 'Linh thú trợ chiến',
      image_url,
      is_equipped = 0,
      slot = 0
    } = req.body;
    const imageUrl = validateImageUrl(image_url);
    if (imageUrl === false) {
      return res.status(400).json({ success: false, error: 'URL ảnh linh thú phải là URL HTTP(S) hợp lệ (tối đa 2048 ký tự).' });
    }

    if (!user_id || !name) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc (user_id, name)!' });
    }

    const db = getDb();
    const player = await getPlayer(user_id);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người chơi!' });
    }
    const elementExists = await db.execute({
      sql: 'SELECT 1 FROM tutien_pet_elements WHERE name = ?',
      args: [element]
    });
    if (!elementExists.rows.length) {
      return res.status(400).json({ success: false, error: 'Hệ linh thú không tồn tại. Hãy tạo hệ trong mục Quản Lý Hệ Linh Thú trước.' });
    }

    await db.execute({
      sql: `INSERT INTO tutien_pets 
        (user_id, name, element, is_mythic, star, hp, atk, def, speed, crit, effect_desc, image_url, is_equipped, slot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        user_id,
        name,
        element,
        Number(is_mythic),
        Number(star),
        Number(hp),
        Number(atk),
        Number(def),
        Number(speed),
        Number(crit),
        effect_desc,
        imageUrl,
        Number(is_equipped),
        Number(slot)
      ]
    });

    res.json({ success: true, message: `Đã ban thưởng Linh Thú "${name}" cho ${player.dao_hieu || player.username}!` });
  } catch (error) {
    console.error('API POST /pets error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/pets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const {
      name,
      element,
      is_mythic,
      star,
      hp,
      atk,
      def,
      speed,
      crit,
      effect_desc,
      image_url,
      is_equipped,
      slot
    } = req.body;
    if (element) {
      const elementExists = await db.execute({
        sql: 'SELECT 1 FROM tutien_pet_elements WHERE name = ?',
        args: [element]
      });
      if (!elementExists.rows.length) {
        return res.status(400).json({ success: false, error: 'Hệ linh thú không tồn tại. Hãy tạo hệ trong mục Quản Lý Hệ Linh Thú trước.' });
      }
    }
    const imageUrl = validateImageUrl(image_url);
    if (imageUrl === false) {
      return res.status(400).json({ success: false, error: 'URL ảnh linh thú phải là URL HTTP(S) hợp lệ (tối đa 2048 ký tự).' });
    }

    await db.execute({
      sql: `UPDATE tutien_pets SET
        name = COALESCE(?, name),
        element = COALESCE(?, element),
        is_mythic = COALESCE(?, is_mythic),
        star = COALESCE(?, star),
        hp = COALESCE(?, hp),
        atk = COALESCE(?, atk),
        def = COALESCE(?, def),
        speed = COALESCE(?, speed),
        crit = COALESCE(?, crit),
        effect_desc = COALESCE(?, effect_desc),
        image_url = CASE WHEN ? = 1 THEN ? ELSE image_url END,
        is_equipped = COALESCE(?, is_equipped),
        slot = COALESCE(?, slot)
        WHERE id = ?`,
      args: [
        name || null,
        element || null,
        is_mythic !== undefined ? Number(is_mythic) : null,
        star !== undefined ? Number(star) : null,
        hp !== undefined ? Number(hp) : null,
        atk !== undefined ? Number(atk) : null,
        def !== undefined ? Number(def) : null,
        speed !== undefined ? Number(speed) : null,
        crit !== undefined ? Number(crit) : null,
        effect_desc || null,
        image_url !== undefined ? 1 : 0,
        imageUrl === undefined ? null : imageUrl,
        is_equipped !== undefined ? Number(is_equipped) : null,
        slot !== undefined ? Number(slot) : null,
        Number(id)
      ]
    });

    res.json({ success: true, message: 'Đã cập nhật Linh Thú!' });
  } catch (error) {
    console.error('API PUT /pets/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/pets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM tutien_pets WHERE id = ?', args: [Number(id)] });
    res.json({ success: true, message: 'Đã xóa Linh Thú!' });
  } catch (error) {
    console.error('API DELETE /pets/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. WEAPONS MANAGEMENT
// ==========================================
router.get('/weapons', async (req, res) => {
  try {
    const db = getDb();
    const { user_id, tier, search } = req.query;

    let sql = `
      SELECT w.*, COALESCE(p.dao_hieu, p.username) AS username 
      FROM tutien_weapons w 
      LEFT JOIN tutien_players p ON w.user_id = p.user_id 
      WHERE 1=1
    `;
    const args = [];

    if (user_id) {
      sql += ' AND w.user_id = ?';
      args.push(user_id);
    }
    if (tier) {
      sql += ' AND w.tier = ?';
      args.push(Number(tier));
    }
    if (search) {
      sql += ' AND (w.name LIKE ? OR p.username LIKE ? OR p.dao_hieu LIKE ?)';
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY w.id DESC LIMIT 100';
    const result = await db.execute({ sql, args });
    res.json({ success: true, data: sanitizeRows(result.rows) });
  } catch (error) {
    console.error('API GET /weapons error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/weapons/presets', async (req, res) => {
  try {
    const dbWeapons = await getGachaItems({ item_type: 'weapon' });
    const formatted = dbWeapons.map(w => ({
      name: w.name,
      tier: w.tier,
      atk: w.atk,
      def: w.def,
      effect_name: w.effect_name || 'Khí Linh',
      effect_desc: w.effect_desc,
      image_url: w.image_url,
      is_natal: w.rarity >= 5 ? 1 : 0
    }));
    const all = [...WEAPON_PRESETS];
    for (const item of formatted) {
      if (!all.some(x => x.name === item.name)) all.push(item);
    }
    res.json({ success: true, data: all });
  } catch (e) {
    res.json({ success: true, data: WEAPON_PRESETS });
  }
});

router.post('/weapons', async (req, res) => {
  try {
    const {
      user_id,
      name,
      tier = 1,
      atk = 50,
      def = 20,
      effect_name = 'Kiếm Khí',
      effect_desc = 'Tăng 5% sát thương',
      image_url,
      is_natal = 0,
      is_equipped = 0
    } = req.body;
    const imageUrl = validateImageUrl(image_url);
    if (imageUrl === false) {
      return res.status(400).json({ success: false, error: 'URL ảnh linh khí phải là URL HTTP(S) hợp lệ (tối đa 2048 ký tự).' });
    }

    if (!user_id || !name) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc (user_id, name)!' });
    }

    const db = getDb();
    const player = await getPlayer(user_id);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người chơi!' });
    }

    await db.execute({
      sql: `INSERT INTO tutien_weapons 
        (user_id, name, tier, atk, def, effect_name, effect_desc, image_url, is_natal, is_equipped)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        user_id,
        name,
        Number(tier),
        Number(atk),
        Number(def),
        effect_name,
        effect_desc,
        imageUrl,
        Number(is_natal),
        Number(is_equipped)
      ]
    });

    res.json({ success: true, message: `Đã ban thưởng Linh Khí "${name}" cho ${player.dao_hieu || player.username}!` });
  } catch (error) {
    console.error('API POST /weapons error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/weapons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const {
      name,
      tier,
      atk,
      def,
      effect_name,
      effect_desc,
      image_url,
      is_natal,
      is_equipped,
      devour_exp
    } = req.body;
    const imageUrl = validateImageUrl(image_url);
    if (imageUrl === false) {
      return res.status(400).json({ success: false, error: 'URL ảnh linh khí phải là URL HTTP(S) hợp lệ (tối đa 2048 ký tự).' });
    }

    await db.execute({
      sql: `UPDATE tutien_weapons SET
        name = COALESCE(?, name),
        tier = COALESCE(?, tier),
        atk = COALESCE(?, atk),
        def = COALESCE(?, def),
        effect_name = COALESCE(?, effect_name),
        effect_desc = COALESCE(?, effect_desc),
        image_url = CASE WHEN ? = 1 THEN ? ELSE image_url END,
        is_natal = COALESCE(?, is_natal),
        is_equipped = COALESCE(?, is_equipped),
        devour_exp = COALESCE(?, devour_exp)
        WHERE id = ?`,
      args: [
        name || null,
        tier !== undefined ? Number(tier) : null,
        atk !== undefined ? Number(atk) : null,
        def !== undefined ? Number(def) : null,
        effect_name || null,
        effect_desc || null,
        image_url !== undefined ? 1 : 0,
        imageUrl === undefined ? null : imageUrl,
        is_natal !== undefined ? Number(is_natal) : null,
        is_equipped !== undefined ? Number(is_equipped) : null,
        devour_exp !== undefined ? Number(devour_exp) : null,
        Number(id)
      ]
    });

    res.json({ success: true, message: 'Đã cập nhật Linh Khí!' });
  } catch (error) {
    console.error('API PUT /weapons/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/weapons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM tutien_weapons WHERE id = ?', args: [Number(id)] });
    res.json({ success: true, message: 'Đã xóa Linh Khí!' });
  } catch (error) {
    console.error('API DELETE /weapons/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 6. HELPERS MANAGEMENT
// ==========================================
router.get('/helpers', async (req, res) => {
  try {
    const db = getDb();
    const { user_id, type } = req.query;

    let sql = `
      SELECT h.*, COALESCE(p.dao_hieu, p.username) AS username 
      FROM tutien_helpers h 
      LEFT JOIN tutien_players p ON h.user_id = p.user_id 
      WHERE 1=1
    `;
    const args = [];

    if (user_id) {
      sql += ' AND h.user_id = ?';
      args.push(user_id);
    }
    if (type) {
      sql += ' AND h.type = ?';
      args.push(type);
    }

    sql += ' ORDER BY h.id DESC';
    const result = await db.execute({ sql, args });
    res.json({ success: true, data: sanitizeRows(result.rows) });
  } catch (error) {
    console.error('API GET /helpers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/helpers/presets', async (req, res) => {
  try {
    const dbHelpers = await getGachaItems({ item_type: 'helper' });
    const formatted = dbHelpers.map(h => ({
      name: h.name,
      type: h.type_detail || 'combat',
      tier: h.tier,
      effect_desc: h.effect_desc,
      image_url: h.image_url
    }));
    const all = [...HELPER_PRESETS];
    for (const item of formatted) {
      if (!all.some(x => x.name === item.name)) all.push(item);
    }
    res.json({ success: true, data: all });
  } catch (e) {
    res.json({ success: true, data: HELPER_PRESETS });
  }
});

router.post('/helpers', async (req, res) => {
  try {
    const { user_id, name, type = 'combat', tier = 1, effect_desc = '', image_url, is_equipped = 0 } = req.body;
    const imageUrl = validateImageUrl(image_url);
    if (imageUrl === false) {
      return res.status(400).json({ success: false, error: 'URL ảnh trợ thủ phải là URL HTTP(S) hợp lệ (tối đa 2048 ký tự).' });
    }
    if (!user_id || !name) {
      return res.status(400).json({ success: false, error: 'Thiếu user_id hoặc name!' });
    }

    const db = getDb();
    const player = await getPlayer(user_id);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người chơi!' });
    }

    await db.execute({
      sql: 'INSERT INTO tutien_helpers (user_id, name, type, tier, effect_desc, image_url, is_equipped) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [user_id, name, type, Number(tier), effect_desc, imageUrl, Number(is_equipped)]
    });

    res.json({ success: true, message: `Đã ban thưởng Trợ Thủ "${name}" cho ${player.dao_hieu || player.username}!` });
  } catch (error) {
    console.error('API POST /helpers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/helpers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, tier, effect_desc, image_url, is_equipped } = req.body;
    const imageUrl = validateImageUrl(image_url);
    if (imageUrl === false) {
      return res.status(400).json({ success: false, error: 'URL ảnh trợ thủ phải là URL HTTP(S) hợp lệ (tối đa 2048 ký tự).' });
    }
    const db = getDb();

    await db.execute({
      sql: `UPDATE tutien_helpers SET 
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        tier = COALESCE(?, tier),
        effect_desc = COALESCE(?, effect_desc),
        image_url = CASE WHEN ? = 1 THEN ? ELSE image_url END,
        is_equipped = COALESCE(?, is_equipped)
        WHERE id = ?`,
      args: [
        name || null,
        type || null,
        tier !== undefined ? Number(tier) : null,
        effect_desc || null,
        image_url !== undefined ? 1 : 0,
        imageUrl === undefined ? null : imageUrl,
        is_equipped !== undefined ? Number(is_equipped) : null,
        Number(id)
      ]
    });

    res.json({ success: true, message: 'Đã cập nhật Trợ Thủ!' });
  } catch (error) {
    console.error('API PUT /helpers/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/helpers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM tutien_helpers WHERE id = ?', args: [Number(id)] });
    res.json({ success: true, message: 'Đã xóa Trợ Thủ!' });
  } catch (error) {
    console.error('API DELETE /helpers/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 7. SKILLS MANAGEMENT
// ==========================================
router.get('/skills', async (req, res) => {
  try {
    const db = getDb();
    const { user_id } = req.query;

    let sql = `
      SELECT s.*, COALESCE(p.dao_hieu, p.username) AS username 
      FROM tutien_skills s 
      LEFT JOIN tutien_players p ON s.user_id = p.user_id 
      WHERE 1=1
    `;
    const args = [];

    if (user_id) {
      sql += ' AND s.user_id = ?';
      args.push(user_id);
    }

    sql += ' ORDER BY s.id DESC';
    const result = await db.execute({ sql, args });
    res.json({ success: true, data: sanitizeRows(result.rows) });
  } catch (error) {
    console.error('API GET /skills error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/skills/presets', (req, res) => {
  res.json({ success: true, data: SKILL_PRESETS });
});

router.post('/skills', async (req, res) => {
  try {
    const { user_id, name, type = 'active', element = 'Kim', damage_mult = 1.25, desc = '', is_equipped = 0, slot = 0 } = req.body;
    if (!user_id || !name) {
      return res.status(400).json({ success: false, error: 'Thiếu user_id hoặc name!' });
    }

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO tutien_skills (user_id, name, type, element, damage_mult, desc, is_equipped, slot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [user_id, name, type, element, Number(damage_mult), desc, Number(is_equipped), Number(slot)]
    });

    res.json({ success: true, message: `Đã truyền dạy Kỹ Năng / Công Pháp "${name}"!` });
  } catch (error) {
    console.error('API POST /skills error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/skills/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, element, damage_mult, desc, is_equipped, slot } = req.body;
    const db = getDb();

    await db.execute({
      sql: `UPDATE tutien_skills SET 
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        element = COALESCE(?, element),
        damage_mult = COALESCE(?, damage_mult),
        desc = COALESCE(?, desc),
        is_equipped = COALESCE(?, is_equipped),
        slot = COALESCE(?, slot)
        WHERE id = ?`,
      args: [
        name || null,
        type || null,
        element || null,
        damage_mult !== undefined ? Number(damage_mult) : null,
        desc || null,
        is_equipped !== undefined ? Number(is_equipped) : null,
        slot !== undefined ? Number(slot) : null,
        Number(id)
      ]
    });

    res.json({ success: true, message: 'Đã cập nhật Kỹ Năng!' });
  } catch (error) {
    console.error('API PUT /skills/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/skills/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM tutien_skills WHERE id = ?', args: [Number(id)] });
    res.json({ success: true, message: 'Đã xóa Kỹ Năng!' });
  } catch (error) {
    console.error('API DELETE /skills/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 8. DONG PHU MANAGEMENT
// ==========================================
router.get('/dongphu', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute(`
      SELECT dp.*, COALESCE(p.dao_hieu, p.username) AS username 
      FROM tutien_dongphu dp
      LEFT JOIN tutien_players p ON dp.user_id = p.user_id
      ORDER BY dp.array_level DESC
    `);
    res.json({ success: true, data: sanitizeRows(result.rows) });
  } catch (error) {
    console.error('API GET /dongphu error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/dongphu/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { array_level, alchemy_furnace_level, forge_level, garden_slots } = req.body;
    const db = getDb();

    await db.execute({
      sql: `UPDATE tutien_dongphu SET
        array_level = COALESCE(?, array_level),
        alchemy_furnace_level = COALESCE(?, alchemy_furnace_level),
        forge_level = COALESCE(?, forge_level),
        garden_slots = COALESCE(?, garden_slots)
        WHERE user_id = ?`,
      args: [
        array_level !== undefined ? Number(array_level) : null,
        alchemy_furnace_level !== undefined ? Number(alchemy_furnace_level) : null,
        forge_level !== undefined ? Number(forge_level) : null,
        garden_slots !== undefined ? Number(garden_slots) : null,
        userId
      ]
    });

    res.json({ success: true, message: 'Đã cập nhật Động Phủ!' });
  } catch (error) {
    console.error('API PUT /dongphu/:userId error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/dongphu/:userId/reset-cooldown', async (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDb();
    // Backdate AFK only when it is already active; this admin action must not start AFK.
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    // Also fast-forward all plants in garden to readyAt = now
    const dpRes = await db.execute({ sql: 'SELECT garden_data FROM tutien_dongphu WHERE user_id = ?', args: [userId] });
    if (dpRes.rows[0]) {
      let garden = [];
      try { garden = JSON.parse(dpRes.rows[0].garden_data || '[]'); } catch (_) {}
      const now = Date.now();
      garden.forEach(g => { g.readyAt = now - 1000; });

      await db.execute({
        sql: `UPDATE tutien_dongphu
          SET last_claim_xp = ?,
              afk_started_at = CASE WHEN afk_enabled = 1 THEN ? ELSE afk_started_at END,
              garden_data = ?
          WHERE user_id = ?`,
        args: [dayAgo, dayAgo, JSON.stringify(garden), userId]
      });
    }

    res.json({ success: true, message: 'Đã làm mới thời gian hồi chiêu Động Phủ & Linh Thảo có thể thu hoạch ngay!' });
  } catch (error) {
    console.error('API /dongphu/:userId/reset-cooldown error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 9. SECTS & MINES MANAGEMENT
// ==========================================
router.get('/sects', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute(`
      SELECT s.*, COALESCE(p.dao_hieu, p.username) as leader_name,
        (SELECT COUNT(*) FROM tutien_players WHERE sect_id = s.id) as member_count
      FROM tutien_sects s
      LEFT JOIN tutien_players p ON s.leader_id = p.user_id
      ORDER BY s.level DESC, s.fund_silver DESC
    `);
    res.json({ success: true, data: sanitizeRows(result.rows) });
  } catch (error) {
    console.error('API GET /sects error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sects', async (req, res) => {
  try {
    const { name, leader_id, level = 1, fund_silver = 50000, fund_spirit_gold = 100, sect_skill = 'Thiên Địa Khí Tụ Quyết', notice = 'Chào mừng đạo hữu!' } = req.body;
    if (!name || !leader_id) {
      return res.status(400).json({ success: false, error: 'Thiếu tên tông môn hoặc ID Chưởng Môn!' });
    }

    const db = getDb();
    const now = Date.now();
    const ins = await db.execute({
      sql: `INSERT INTO tutien_sects (name, leader_id, level, fund_silver, fund_spirit_gold, sect_skill, notice, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [name, leader_id, Number(level), Number(fund_silver), Number(fund_spirit_gold), sect_skill, notice, now]
    });

    const sectId = Number(ins.lastInsertRowid);
    await db.execute({
      sql: "UPDATE tutien_players SET sect_id = ?, sect_role = 'Chưởng Môn' WHERE user_id = ?",
      args: [sectId, leader_id]
    });

    res.json({ success: true, message: `Thành lập Tông Môn "${name}" thành công!` });
  } catch (error) {
    console.error('API POST /sects error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/sects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, level, fund_silver, fund_spirit_gold, sect_skill, notice, leader_id } = req.body;
    const db = getDb();

    await db.execute({
      sql: `UPDATE tutien_sects SET
        name = COALESCE(?, name),
        level = COALESCE(?, level),
        fund_silver = COALESCE(?, fund_silver),
        fund_spirit_gold = COALESCE(?, fund_spirit_gold),
        sect_skill = COALESCE(?, sect_skill),
        notice = COALESCE(?, notice),
        leader_id = COALESCE(?, leader_id)
        WHERE id = ?`,
      args: [
        name || null,
        level !== undefined ? Number(level) : null,
        fund_silver !== undefined ? Number(fund_silver) : null,
        fund_spirit_gold !== undefined ? Number(fund_spirit_gold) : null,
        sect_skill || null,
        notice || null,
        leader_id || null,
        Number(id)
      ]
    });

    res.json({ success: true, message: 'Đã cập nhật thông tin Tông Môn!' });
  } catch (error) {
    console.error('API PUT /sects/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/sects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Remove sect_id from members & reset occupying mines
    await db.batch([
      { sql: 'UPDATE tutien_players SET sect_id = NULL, sect_role = NULL WHERE sect_id = ?', args: [Number(id)] },
      { sql: 'UPDATE tutien_mines SET occupying_sect_id = NULL WHERE occupying_sect_id = ?', args: [Number(id)] },
      { sql: 'DELETE FROM tutien_sects WHERE id = ?', args: [Number(id)] }
    ]);

    res.json({ success: true, message: 'Đã giải tán Tông Môn thành công!' });
  } catch (error) {
    console.error('API DELETE /sects/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mines Management
router.get('/mines', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute(`
      SELECT m.*, s.name as sect_name 
      FROM tutien_mines m
      LEFT JOIN tutien_sects s ON m.occupying_sect_id = s.id
      ORDER BY m.id ASC
    `);
    res.json({ success: true, data: sanitizeRows(result.rows) });
  } catch (error) {
    console.error('API GET /mines error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/mines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { occupying_sect_id, daily_silver, daily_spirit_gold } = req.body;
    const db = getDb();

    await db.execute({
      sql: `UPDATE tutien_mines SET
        occupying_sect_id = ?,
        daily_silver = COALESCE(?, daily_silver),
        daily_spirit_gold = COALESCE(?, daily_spirit_gold)
        WHERE id = ?`,
      args: [
        occupying_sect_id !== undefined ? (occupying_sect_id ? Number(occupying_sect_id) : null) : null,
        daily_silver !== undefined ? Number(daily_silver) : null,
        daily_spirit_gold !== undefined ? Number(daily_spirit_gold) : null,
        Number(id)
      ]
    });

    res.json({ success: true, message: 'Đã cập nhật Mỏ Linh Mạch!' });
  } catch (error) {
    console.error('API PUT /mines/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 10. WORLD BOSS MANAGEMENT
// ==========================================
router.get('/boss', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute("SELECT * FROM tutien_world_boss WHERE status = 'alive' ORDER BY id DESC LIMIT 1");
    const boss = result.rows[0] ? sanitizeRow(result.rows[0]) : null;

    let damageData = {};
    if (boss && boss.damage_data) {
      try {
        damageData = JSON.parse(boss.damage_data);
      } catch (_) {}
    }

    res.json({
      success: true,
      data: boss,
      damageLeaderboard: damageData,
      presets: BOSS_PRESETS
    });
  } catch (error) {
    console.error('API GET /boss error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/boss/action', async (req, res) => {
  try {
    const { action, boss_name, max_hp, damage_amount } = req.body;
    const db = getDb();

    if (action === 'spawn') {
      const name = boss_name || 'Thôn Thiên Ma Thú (Thượng Cổ)';
      const hp = (max_hp || 50000000).toString();
      const now = Date.now();

      // Mark old bosses as defeated
      await db.execute({
        sql: "UPDATE tutien_world_boss SET status = 'defeated', defeated_at = COALESCE(defeated_at, ?) WHERE status = 'alive'",
        args: [now]
      });

      // Insert new
      await db.execute({
        sql: `INSERT INTO tutien_world_boss (name, current_hp, max_hp, status, spawn_time, damage_data)
          VALUES (?, ?, ?, 'alive', ?, '{}')`,
        args: [name, hp, hp, now]
      });

      await announceBossSpawn({ name, max_hp: hp, spawn_time: now });
      return res.json({ success: true, message: `Đã triệu hồi thành công Boss Thế Giới: ${name} (HP: ${Number(hp).toLocaleString()})!` });
    }

    // Actions on current alive boss
    const bossRes = await db.execute("SELECT * FROM tutien_world_boss WHERE status = 'alive' ORDER BY id DESC LIMIT 1");
    const boss = bossRes.rows[0];
    if (!boss) {
      return res.status(404).json({ success: false, error: 'Hiện không có Boss Thế Giới nào đang sống!' });
    }

    if (action === 'heal') {
      await db.execute({
        sql: 'UPDATE tutien_world_boss SET current_hp = max_hp WHERE id = ?',
        args: [boss.id]
      });
      return res.json({ success: true, message: 'Đã hồi phục 100% Khí Huyết cho Boss Thế Giới!' });
    }

    if (action === 'kill') {
      await db.execute({
        sql: "UPDATE tutien_world_boss SET current_hp = '0', status = 'defeated', defeated_at = ? WHERE id = ?",
        args: [Date.now(), boss.id]
      });
      return res.json({ success: true, message: 'Đã đánh bại Boss Thế Giới!' });
    }

    if (action === 'damage') {
      const dmg = BigInt(damage_amount || 1000000);
      let curr = BigInt(boss.current_hp);
      curr = curr > dmg ? curr - dmg : 0n;
      const status = curr === 0n ? 'defeated' : 'alive';

      await db.execute({
        sql: 'UPDATE tutien_world_boss SET current_hp = ?, status = ?, defeated_at = ? WHERE id = ?',
        args: [curr.toString(), status, curr === 0n ? Date.now() : null, boss.id]
      });
      return res.json({ success: true, message: `Đã giáng đòn trừ ${dmg.toString()} HP của Boss!` });
    }

    res.status(400).json({ success: false, error: 'Hành động Boss không hợp lệ!' });
  } catch (error) {
    console.error('API POST /boss/action error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 11. MARKETPLACE MANAGEMENT
// ==========================================
router.get('/market', async (req, res) => {
  try {
    const db = getDb();
    const { status, category } = req.query;

    let sql = 'SELECT * FROM tutien_market WHERE 1=1';
    const args = [];

    if (status) {
      sql += ' AND status = ?';
      args.push(status);
    }
    if (category) {
      sql += ' AND item_category = ?';
      args.push(category);
    }

    sql += ' ORDER BY id DESC LIMIT 50';
    const result = await db.execute({ sql, args });
    res.json({ success: true, data: sanitizeRows(result.rows) });
  } catch (error) {
    console.error('API GET /market error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/market/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const listingRes = await db.execute({
      sql: "SELECT * FROM tutien_market WHERE id = ? AND status = 'active'",
      args: [Number(id)]
    });
    const listing = listingRes.rows[0];
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tin rao bán này hoặc đã hết hạn!' });
    }

    // Return item to seller
    let itemData = {};
    try { itemData = JSON.parse(listing.item_data); } catch (_) {}

    if (itemData.itemKey && itemData.amount) {
      await addItem(listing.seller_id, listing.item_category, itemData.itemKey, itemData.itemName || listing.item_title, itemData.amount);
    }

    await db.execute({
      sql: "UPDATE tutien_market SET status = 'cancelled' WHERE id = ?",
      args: [Number(id)]
    });

    res.json({ success: true, message: `Đã hủy tin rao bán và hoàn trả vật phẩm cho ${listing.seller_name}!` });
  } catch (error) {
    console.error('API POST /market/:id/cancel error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/market/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM tutien_market WHERE id = ?', args: [Number(id)] });
    res.json({ success: true, message: 'Đã xóa tin đăng Chợ Đen!' });
  } catch (error) {
    console.error('API DELETE /market/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 12. TOOLS, SQL RUNNER & SYSTEM INFO
// ==========================================
router.post('/reset-player-resources', async (req, res) => {
  try {
    const db = getDb();
    const result = await withTransaction(db, async tx => {
      try {
        const players = await tx.execute(
          'SELECT COUNT(*) AS player_count, COALESCE(SUM(silver), 0) AS silver_removed FROM tutien_players'
        );
        const inventory = await tx.execute(
          'SELECT COALESCE(SUM(amount), 0) AS inventory_items FROM tutien_inventory'
        );
        await tx.execute('UPDATE tutien_players SET silver = 0');
        const deletedInventory = await tx.execute('DELETE FROM tutien_inventory');
        await tx.commit();
        return {
          playerCount: Number(players.rows[0]?.player_count || 0),
          silverRemoved: Number(players.rows[0]?.silver_removed || 0),
          inventoryRowsRemoved: deletedInventory.rowsAffected,
          inventoryItemsRemoved: Number(inventory.rows[0]?.inventory_items || 0)
        };
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    });

    res.json({
      success: true,
      data: result,
      message: `Đã reset Ngân Lượng và vật phẩm trong túi của ${result.playerCount} người chơi. Cấp độ, Linh Khí, Linh Thú và Trợ Thủ được giữ nguyên.`
    });
  } catch (error) {
    console.error('API POST /reset-player-resources error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reset-game-data', async (req, res) => {
  try {
    const db = getDb();
    const resetStatements = [
      { table: 'tutien_gift_code_claims', sql: 'DELETE FROM tutien_gift_code_claims' },
      { table: 'tutien_inventory', sql: 'DELETE FROM tutien_inventory' },
      { table: 'tutien_pets', sql: 'DELETE FROM tutien_pets' },
      { table: 'tutien_weapons', sql: 'DELETE FROM tutien_weapons' },
      { table: 'tutien_helpers', sql: 'DELETE FROM tutien_helpers' },
      { table: 'tutien_skills', sql: 'DELETE FROM tutien_skills' },
      { table: 'tutien_dongphu', sql: 'DELETE FROM tutien_dongphu' },
      { table: 'tutien_market', sql: 'DELETE FROM tutien_market' },
      { table: 'tutien_wish_pity', sql: 'DELETE FROM tutien_wish_pity' },
      { table: 'tutien_world_boss', sql: 'DELETE FROM tutien_world_boss' },
      { table: 'tutien_sects', sql: 'DELETE FROM tutien_sects' },
      { table: 'tutien_players', sql: 'DELETE FROM tutien_players' },
      {
        table: 'tutien_mines',
        sql: `UPDATE tutien_mines
          SET occupying_sect_id = NULL, occupied_at = 0, last_tax_collected = 0`
      }
    ];
    const results = await db.batch(resetStatements.map(({ sql }) => ({ sql })));
    const affectedRows = resetStatements.map(({ table }, index) => ({
      table,
      count: results[index].rowsAffected
    }));

    res.json({
      success: true,
      message: 'Đã reset dữ liệu người chơi và game. Cấu hình hệ thống được giữ nguyên.',
      affectedRows
    });
  } catch (error) {
    console.error('API POST /reset-game-data error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batch/airdrop', async (req, res) => {
  try {
    const { type, amount, item_type, item_key, item_name } = req.body;
    const db = getDb();
    const players = await db.execute('SELECT user_id FROM tutien_players');
    const count = players.rows.length;

    if (type === 'silver') {
      const silverAmount = Number(amount) || 10000;
      await db.execute({
        sql: 'UPDATE tutien_players SET silver = silver + ?',
        args: [silverAmount]
      });
      return res.json({
        success: true,
        message: `Đã thưởng ${silverAmount.toLocaleString()} Ngân lượng cho toàn bộ ${count} tu tiên giả!`
      });
    }

    if (type === 'item') {
      const itemAmount = Number(amount) || 1;
      for (const p of players.rows) {
        await addItem(p.user_id, item_type, item_key, item_name, itemAmount);
      }
      return res.json({
        success: true,
        message: `Đã ban phát ${itemAmount}x "${item_name}" cho toàn bộ ${count} tu tiên giả!`
      });
    }

    res.status(400).json({ success: false, error: 'Loại Airdrop không hợp lệ!' });
  } catch (error) {
    console.error('API POST /batch/airdrop error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute Direct SQL (Admin developer tool)
router.post('/sql', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ success: false, error: 'Thiếu câu lệnh SQL!' });
    }

    const trimmed = sql.trim();
    const db = getDb();
    const result = await db.execute(trimmed);

    res.json({
      success: true,
      columns: result.columns || [],
      rows: sanitizeRows(result.rows || []),
      rowsAffected: result.rowsAffected || 0
    });
  } catch (error) {
    console.error('API POST /sql error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// System info
router.get('/system/info', async (req, res) => {
  try {
    const mem = process.memoryUsage();
    const uptime = process.uptime();

    res.json({
      success: true,
      data: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.floor(uptime),
        memoryMB: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024)
        },
        databaseUrl: (process.env.TURSO_DATABASE_URL || '').replace(/:\/\/[^@]+@/, '://***@'),
        cache: getCacheStatus()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Turso Cache status and manual sync
router.get('/cache/status', async (req, res) => {
  try {
    res.json({ success: true, data: getCacheStatus() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cache/sync', async (req, res) => {
  try {
    const result = await syncDatabase({ silent: false, throwOnError: true });
    res.json({ success: true, data: result, status: getCacheStatus() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 13. GACHA & WISH SYSTEM MANAGEMENT (GENSHIN IMPACT FORMAT)
// ==========================================
router.get('/gacha/items', async (req, res) => {
  try {
    const { item_type, rarity, banner_type, is_active, search } = req.query;
    const items = await getGachaItems({ item_type, rarity, banner_type, is_active, search });
    res.json({ success: true, data: sanitizeRows(items) });
  } catch (error) {
    console.error('API GET /gacha/items error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/gacha/items/:id', async (req, res) => {
  try {
    const item = await getGachaItemById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Không tìm thấy vật phẩm' });
    res.json({ success: true, data: sanitizeRow(item) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/gacha/items', async (req, res) => {
  try {
    const imageUrl = validateImageUrl(req.body.image_url);
    if (imageUrl === false) {
      return res.status(400).json({ success: false, error: 'URL ảnh vật phẩm phải là URL HTTP(S) hợp lệ (tối đa 2048 ký tự).' });
    }
    if (imageUrl !== undefined) req.body.image_url = imageUrl;
    const created = await createGachaItem(req.body);
    res.json({ success: true, data: sanitizeRow(created), message: `Đã thêm "${created.name}" vào Bể Cầu Nguyện!` });
  } catch (error) {
    console.error('API POST /gacha/items error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/gacha/items/:id', async (req, res) => {
  try {
    const imageUrl = validateImageUrl(req.body.image_url);
    if (imageUrl === false) {
      return res.status(400).json({ success: false, error: 'URL ảnh vật phẩm phải là URL HTTP(S) hợp lệ (tối đa 2048 ký tự).' });
    }
    if (imageUrl !== undefined) req.body.image_url = imageUrl;
    const updated = await updateGachaItem(req.params.id, req.body);
    res.json({ success: true, data: sanitizeRow(updated), message: `Đã cập nhật chỉ số "${updated.name}" thành công!` });
  } catch (error) {
    console.error('API PUT /gacha/items error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/gacha/items/:id', async (req, res) => {
  try {
    await deleteGachaItem(req.params.id);
    res.json({ success: true, message: 'Đã xóa vật phẩm khỏi Bể Cầu Nguyện!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/gacha/items/:id/toggle', async (req, res) => {
  try {
    const resToggle = await toggleGachaItemActive(req.params.id);
    res.json({
      success: true,
      data: resToggle,
      message: resToggle.is_active ? 'Đã kích hoạt vật phẩm!' : 'Đã tạm ẩn vật phẩm khỏi Bể Cầu Nguyện!'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/gacha/stats', async (req, res) => {
  try {
    const stats = await getGachaStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/gacha/simulate', async (req, res) => {
  try {
    const { banner_type = 'standard', count = 10 } = req.body;
    const sim = await simulateWish(banner_type, Number(count) || 10);
    res.json({ success: true, data: sim });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Reference data constants (realms, races, spirit roots)
router.get('/constants', (req, res) => {
  res.json({
    success: true,
    data: {
      realms: REALMS,
      races: RACES,
      spiritRoots: SPIRIT_ROOTS,
      spiritGold: SPIRIT_GOLD_QUALITIES
    }
  });
});

module.exports = router;
