const { getDb } = require('../config/database');
const { PILL_RECIPES } = require('./dongPhuService');
const { SPIRIT_GOLD_QUALITIES } = require('../config/constants');
const { withTransaction } = require('../utils/databaseTransaction');

const SCARCITY_FLOOR = 0.65;
const SCARCITY_CEILING = 2.5;
const WEALTH_FLOOR = 0.5;
const WEALTH_CEILING = 5;

const SHOP_ITEMS = [
  ...Object.entries(PILL_RECIPES).map(([key, recipe]) => ({
    key,
    type: 'pill',
    name: recipe.name,
    basePrice: recipe.silverCost * 4,
    targetPerPlayer: key === 'TuLinhDan' ? 5 : key === 'TrucCoDan' ? 2 : 1,
    description: recipe.desc
  })),
  ...SPIRIT_GOLD_QUALITIES.map(quality => ({
    key: quality.id,
    type: 'spirit_gold',
    name: quality.name,
    basePrice: quality.price * 5,
    targetPerPlayer: quality.id === 'Phàm' ? 5 : quality.id === 'Tinh' ? 3 : 1,
    description: `Nguyên liệu đột phá: ${quality.realmTarget}`
  }))
];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function calculatePrice(item, averageSilver, playerCount, stock) {
  const wealthMultiplier = clamp(Math.sqrt(averageSilver / 5000), WEALTH_FLOOR, WEALTH_CEILING);
  const targetStock = Math.max(1, playerCount * item.targetPerPlayer);
  const scarcityMultiplier = clamp(
    Math.sqrt(targetStock / (stock + targetStock * 0.1)),
    SCARCITY_FLOOR,
    SCARCITY_CEILING
  );
  const unitPrice = Math.max(1, Math.ceil(item.basePrice * wealthMultiplier * scarcityMultiplier));
  return {
    ...item,
    stock,
    targetStock,
    unitPrice,
    wealthMultiplier,
    scarcityMultiplier
  };
}

async function getMarketSnapshot(executor) {
  const [playersResult, stockResult] = await Promise.all([
    executor.execute('SELECT silver FROM tutien_players'),
    executor.execute(`SELECT item_type, item_key, amount
      FROM tutien_inventory
      WHERE amount > 0 AND item_type IN ('pill', 'spirit_gold')`)
  ]);
  const totalSilver = playersResult.rows.reduce(
    (total, player) => total + BigInt(player.silver || 0),
    0n
  );
  const playerCount = playersResult.rows.length;
  const averageSilver = playerCount
    ? Number(totalSilver / BigInt(playerCount))
    : 5000;
  const stockByItem = new Map();
  for (const row of stockResult.rows) {
    const itemKey = `${row.item_type}:${row.item_key}`;
    stockByItem.set(itemKey, (stockByItem.get(itemKey) || 0n) + BigInt(row.amount));
  }
  return { playerCount, averageSilver, stockByItem };
}

async function getShopCatalog() {
  const db = getDb();
  const snapshot = await getMarketSnapshot(db);
  return SHOP_ITEMS.map(item => calculatePrice(
    item,
    snapshot.averageSilver,
    snapshot.playerCount,
    Number(snapshot.stockByItem.get(`${item.type}:${item.key}`) || 0n)
  ));
}

async function buyShopItem(userId, itemKey, amount) {
  const item = SHOP_ITEMS.find(product => product.key === itemKey);
  if (!item) return { success: false, message: 'Vật phẩm này không có trong cửa hàng!' };
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100) {
    return { success: false, message: 'Số lượng mua phải từ 1 đến 100!' };
  }

  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      const playerResult = await tx.execute({
        sql: 'SELECT silver FROM tutien_players WHERE user_id = ?',
        args: [userId]
      });
      const player = playerResult.rows[0];
      if (!player) {
        await tx.rollback();
        return { success: false, message: 'Đạo hữu chưa bước vào con đường tu tiên!' };
      }

      const snapshot = await getMarketSnapshot(tx);
      const price = calculatePrice(
        item,
        snapshot.averageSilver,
        snapshot.playerCount,
        Number(snapshot.stockByItem.get(`${item.type}:${item.key}`) || 0n)
      );
      const totalPrice = price.unitPrice * amount;
      if (!Number.isSafeInteger(totalPrice)) {
        throw new Error(`Shop purchase total is outside the safe integer range: ${totalPrice}`);
      }

      if (Number(player.silver) < totalPrice) {
        await tx.rollback();
        return {
          success: false,
          unitPrice: price.unitPrice,
          totalPrice,
          message: `Đạo hữu không đủ Ngân Lượng! Cần **${totalPrice.toLocaleString('vi-VN')}**, ` +
            `hiện có **${Number(player.silver).toLocaleString('vi-VN')}**. Giá mỗi món hiện tại: **${price.unitPrice.toLocaleString('vi-VN')}**.`
        };
      }

      const debit = await tx.execute({
        sql: 'UPDATE tutien_players SET silver = silver - ? WHERE user_id = ? AND silver >= ?',
        args: [totalPrice, userId, totalPrice]
      });
      if (debit.rowsAffected !== 1) {
        await tx.rollback();
        return { success: false, message: 'Số dư đã thay đổi; vui lòng kiểm tra lại Ngân Lượng rồi thử lại!' };
      }

      const existing = await tx.execute({
        sql: `SELECT id FROM tutien_inventory
          WHERE user_id = ? AND item_type = ? AND item_key = ?
          ORDER BY id LIMIT 1`,
        args: [userId, item.type, item.key]
      });
      if (existing.rows[0]) {
        await tx.execute({
          sql: 'UPDATE tutien_inventory SET amount = amount + ? WHERE id = ?',
          args: [amount, existing.rows[0].id]
        });
      } else {
        await tx.execute({
          sql: `INSERT INTO tutien_inventory (user_id, item_type, item_key, item_name, amount)
            VALUES (?, ?, ?, ?, ?)`,
          args: [userId, item.type, item.key, item.name, amount]
        });
      }

      await tx.commit();
      return {
        success: true,
        itemName: item.name,
        amount,
        unitPrice: price.unitPrice,
        totalPrice,
        message: `Đã mua **${amount}x ${item.name}** với giá **${totalPrice.toLocaleString('vi-VN')} Ngân Lượng** ` +
          `(${price.unitPrice.toLocaleString('vi-VN')}/món).`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

module.exports = {
  getShopCatalog,
  buyShopItem
};
