const { getDb } = require('../config/database');
const { SPIRIT_GOLD_QUALITIES } = require('../config/constants');
const { getPlayer } = require('./playerService');
const { withTransaction } = require('../utils/databaseTransaction');

async function getInventory(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_inventory WHERE user_id = ? AND amount > 0 ORDER BY item_type, id',
    args: [userId]
  });
  return res.rows;
}

async function getInventoryItemById(userId, itemId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_inventory WHERE id = ? AND user_id = ? AND amount > 0',
    args: [itemId, userId]
  });
  return res.rows[0] || null;
}

async function removeInventoryItemById(userId, itemId, amount = 1) {
  const db = getDb();
  const res = await db.execute({
    sql: 'UPDATE tutien_inventory SET amount = amount - ? WHERE id = ? AND user_id = ? AND amount >= ?',
    args: [amount, itemId, userId, amount]
  });
  return res.rowsAffected > 0;
}

async function getItemAmount(userId, itemType, itemKey) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT COALESCE(SUM(amount), 0) AS amount FROM tutien_inventory WHERE user_id = ? AND item_type = ? AND item_key = ?',
    args: [userId, itemType, itemKey]
  });
  return res.rows[0] ? Number(res.rows[0].amount) : 0;
}

async function addItem(userId, itemType, itemKey, itemName, amount = 1) {
  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      const existing = await tx.execute({
        sql: 'SELECT id FROM tutien_inventory WHERE user_id = ? AND item_type = ? AND item_key = ? ORDER BY id LIMIT 1',
        args: [userId, itemType, itemKey]
      });

      if (existing.rows[0]) {
        await tx.execute({
          sql: 'UPDATE tutien_inventory SET amount = amount + ? WHERE id = ?',
          args: [amount, existing.rows[0].id]
        });
      } else {
        await tx.execute({
          sql: 'INSERT INTO tutien_inventory (user_id, item_type, item_key, item_name, amount) VALUES (?, ?, ?, ?, ?)',
          args: [userId, itemType, itemKey, itemName, amount]
        });
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

async function removeItem(userId, itemType, itemKey, amount = 1) {
  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      const inventory = await tx.execute({
        sql: 'SELECT id, amount FROM tutien_inventory WHERE user_id = ? AND item_type = ? AND item_key = ? ORDER BY id',
        args: [userId, itemType, itemKey]
      });
      const available = inventory.rows.reduce((total, row) => total + BigInt(row.amount), 0n);
      const requested = BigInt(amount);
      if (available < requested) {
        await tx.rollback();
        return false;
      }

      let remaining = requested;
      for (const row of inventory.rows) {
        if (remaining === 0n) break;
        const rowAmount = BigInt(row.amount);
        const consumed = rowAmount < remaining ? rowAmount : remaining;
        const result = await tx.execute({
          sql: 'UPDATE tutien_inventory SET amount = amount - ? WHERE id = ? AND amount >= ?',
          args: [Number(consumed), row.id, Number(consumed)]
        });
        if (result.rowsAffected !== 1) {
          throw new Error('Inventory changed while removing an item.');
        }
        remaining -= consumed;
      }

      await tx.commit();
      return true;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

function normalizeKey(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function findSpiritGoldQualityIndex(key) {
  if (!key) return -1;
  const raw = String(key).trim();
  const cleaned = raw
    .replace(/^linh\s*kim\s*(\(?phẩm\s*(chất\s*)?|\(?pham\s*(chat\s*)?)?/i, '')
    .replace(/^\(?phẩm\s+(chất\s*)?/i, '')
    .replace(/^\(?pham\s+(chat\s*)?/i, '')
    .replace(/\)$/, '')
    .trim();

  const normCleaned = normalizeKey(cleaned);
  const normRaw = normalizeKey(raw);

  // 1. Direct match on cleaned ID
  let idx = SPIRIT_GOLD_QUALITIES.findIndex(q => q.id === cleaned);
  if (idx !== -1) return idx;

  // 2. Case-insensitive match on cleaned ID
  idx = SPIRIT_GOLD_QUALITIES.findIndex(q => q.id.toLowerCase() === cleaned.toLowerCase());
  if (idx !== -1) return idx;

  // 3. Diacritic-insensitive match on cleaned ID
  idx = SPIRIT_GOLD_QUALITIES.findIndex(q => normalizeKey(q.id) === normCleaned);
  if (idx !== -1) return idx;

  // 4. Match full name
  idx = SPIRIT_GOLD_QUALITIES.findIndex(q =>
    q.name.toLowerCase() === raw.toLowerCase() ||
    normalizeKey(q.name) === normRaw
  );
  if (idx !== -1) return idx;

  return -1;
}

async function convertSpiritGold(userId, fromQualityKey, requestedAmount = 1) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player) {
    return {
      success: false,
      reason: 'no_player',
      message: 'Chưa Tu Tiên! Hãy dùng `/start` trước.'
    };
  }

  const fromIndex = findSpiritGoldQualityIndex(fromQualityKey);
  if (fromIndex === -1) {
    return {
      success: false,
      reason: 'invalid_quality',
      message: `Phẩm chất Linh Kim \`${fromQualityKey}\` không hợp lệ. Hãy chọn: Phàm, Tinh, Linh, Địa, Thiên, Thánh hoặc Thần.`
    };
  }

  if (fromIndex >= SPIRIT_GOLD_QUALITIES.length - 1) {
    return {
      success: false,
      reason: 'max_tier',
      message: `**${SPIRIT_GOLD_QUALITIES[fromIndex].name}** đã là phẩm chất cao nhất, không thể đổi lên bậc cao hơn!`
    };
  }

  const fromQuality = SPIRIT_GOLD_QUALITIES[fromIndex];
  const toQuality = SPIRIT_GOLD_QUALITIES[fromIndex + 1];

  return withTransaction(db, async tx => {
    try {
      const inventory = await tx.execute({
        sql: 'SELECT id, amount FROM tutien_inventory WHERE user_id = ? AND item_type = ? AND item_key = ? AND amount > 0 ORDER BY id',
        args: [userId, 'spirit_gold', fromQuality.id]
      });

      const available = inventory.rows.reduce((total, row) => total + BigInt(row.amount), 0n);

      let targetAmount;
      if (typeof requestedAmount === 'string' && requestedAmount.trim().toLowerCase() === 'all') {
        targetAmount = available / 100n;
        if (targetAmount < 1n) {
          await tx.rollback();
          return {
            success: false,
            reason: 'insufficient_items',
            message: `Đạo hữu cần ít nhất **100** viên **${fromQuality.name}** để đổi thành 1 viên **${toQuality.name}**, hiện chỉ có **${available.toLocaleString('vi-VN')}** viên.`
          };
        }
      } else {
        const parsed = Number(requestedAmount);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          await tx.rollback();
          return {
            success: false,
            reason: 'invalid_amount',
            message: 'Số lượng muốn đổi phải là số nguyên dương hoặc `all`.'
          };
        }
        targetAmount = BigInt(parsed);
      }

      const needed = targetAmount * 100n;
      if (available < needed) {
        await tx.rollback();
        return {
          success: false,
          reason: 'insufficient_items',
          message: `Đạo hữu không đủ Linh Kim! Đổi **${targetAmount.toLocaleString('vi-VN')}x ${toQuality.name}** cần **${needed.toLocaleString('vi-VN')}x ${fromQuality.name}**, hiện chỉ có **${available.toLocaleString('vi-VN')}** viên.`
        };
      }

      let remainingToDeduct = needed;
      for (const row of inventory.rows) {
        if (remainingToDeduct === 0n) break;
        const rowAmount = BigInt(row.amount);
        const consumed = rowAmount < remainingToDeduct ? rowAmount : remainingToDeduct;
        const result = await tx.execute({
          sql: 'UPDATE tutien_inventory SET amount = amount - ? WHERE id = ? AND amount >= ?',
          args: [Number(consumed), row.id, Number(consumed)]
        });
        if (result.rowsAffected !== 1) {
          throw new Error('Inventory changed while converting spirit gold.');
        }
        remainingToDeduct -= consumed;
      }

      if (remainingToDeduct > 0n) {
        throw new Error('Could not deduct all required spirit gold.');
      }

      const existingTarget = await tx.execute({
        sql: 'SELECT id FROM tutien_inventory WHERE user_id = ? AND item_type = ? AND item_key = ? ORDER BY id LIMIT 1',
        args: [userId, 'spirit_gold', toQuality.id]
      });

      if (existingTarget.rows[0]) {
        await tx.execute({
          sql: 'UPDATE tutien_inventory SET amount = amount + ? WHERE id = ?',
          args: [Number(targetAmount), existingTarget.rows[0].id]
        });
      } else {
        await tx.execute({
          sql: 'INSERT INTO tutien_inventory (user_id, item_type, item_key, item_name, amount) VALUES (?, ?, ?, ?, ?)',
          args: [userId, 'spirit_gold', toQuality.id, toQuality.name, Number(targetAmount)]
        });
      }

      await tx.commit();

      const remainingLower = available - needed;

      return {
        success: true,
        fromQuality,
        toQuality,
        consumedAmount: Number(needed),
        receivedAmount: Number(targetAmount),
        remainingLowerAmount: Number(remainingLower),
        message: `Đã đổi thành công **${needed.toLocaleString('vi-VN')}x ${fromQuality.name}** ➔ **+${targetAmount.toLocaleString('vi-VN')}x ${toQuality.name}**!`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

module.exports = {
  getInventory,
  getInventoryItemById,
  removeInventoryItemById,
  getItemAmount,
  addItem,
  removeItem,
  convertSpiritGold
};
