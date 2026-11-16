const { getDb } = require('../config/database');

async function getInventory(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_inventory WHERE user_id = ? AND amount > 0 ORDER BY item_type, id',
    args: [userId]
  });
  return res.rows;
}

async function getItemAmount(userId, itemType, itemKey) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT amount FROM tutien_inventory WHERE user_id = ? AND item_type = ? AND item_key = ?',
    args: [userId, itemType, itemKey]
  });
  return res.rows[0] ? Number(res.rows[0].amount) : 0;
}

async function addItem(userId, itemType, itemKey, itemName, amount = 1) {
  const db = getDb();
  const existing = await getItemAmount(userId, itemType, itemKey);
  if (existing > 0) {
    await db.execute({
      sql: 'UPDATE tutien_inventory SET amount = amount + ? WHERE user_id = ? AND item_type = ? AND item_key = ?',
      args: [amount, userId, itemType, itemKey]
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO tutien_inventory (user_id, item_type, item_key, item_name, amount) VALUES (?, ?, ?, ?, ?)',
      args: [userId, itemType, itemKey, itemName, amount]
    });
  }
}

async function removeItem(userId, itemType, itemKey, amount = 1) {
  const current = await getItemAmount(userId, itemType, itemKey);
  if (current < amount) return false;
  const db = getDb();
  await db.execute({
    sql: 'UPDATE tutien_inventory SET amount = amount - ? WHERE user_id = ? AND item_type = ? AND item_key = ?',
    args: [amount, userId, itemType, itemKey]
  });
  return true;
}

module.exports = {
  getInventory,
  getItemAmount,
  addItem,
  removeItem
};
