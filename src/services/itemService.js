const { getDb } = require('../config/database');
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

module.exports = {
  getInventory,
  getInventoryItemById,
  removeInventoryItemById,
  getItemAmount,
  addItem,
  removeItem
};
