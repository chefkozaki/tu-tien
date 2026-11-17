const { getDb } = require('../config/database');
const { getEquippedHelper } = require('./helperService');
const { withTransaction } = require('../utils/databaseTransaction');

async function getMarketListings(category = null) {
  const db = getDb();
  let query = "SELECT * FROM tutien_market WHERE status = 'active'";
  const args = [];
  if (category) {
    query += ' AND item_category = ?';
    args.push(category);
  }
  query += ' ORDER BY id DESC LIMIT 25';

  const res = await db.execute({ sql: query, args });
  return res.rows;
}

async function removeInventoryItems(tx, userId, itemCategory, itemKey, amount) {
  const inventory = await tx.execute({
    sql: `SELECT id, amount FROM tutien_inventory
      WHERE user_id = ? AND item_type = ? AND item_key = ? ORDER BY id`,
    args: [userId, itemCategory, itemKey]
  });
  let remaining = BigInt(amount);
  const available = inventory.rows.reduce((total, row) => total + BigInt(row.amount), 0n);
  if (available < remaining) return false;

  for (const row of inventory.rows) {
    if (remaining === 0n) break;
    const rowAmount = BigInt(row.amount);
    const consumed = rowAmount < remaining ? rowAmount : remaining;
    const result = await tx.execute({
      sql: 'UPDATE tutien_inventory SET amount = amount - ? WHERE id = ? AND amount >= ?',
      args: [Number(consumed), row.id, Number(consumed)]
    });
    if (result.rowsAffected !== 1) {
      throw new Error('Inventory changed while listing a market item.');
    }
    remaining -= consumed;
  }
  return true;
}

async function addInventoryItems(tx, userId, itemCategory, itemKey, itemName, amount) {
  const existing = await tx.execute({
    sql: `SELECT id FROM tutien_inventory
      WHERE user_id = ? AND item_type = ? AND item_key = ? ORDER BY id LIMIT 1`,
    args: [userId, itemCategory, itemKey]
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
      args: [userId, itemCategory, itemKey, itemName, amount]
    });
  }
}

async function listItem(sellerId, sellerName, itemCategory, itemKey, itemName, amount, priceSilver) {
  const db = getDb();
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { success: false, message: 'Số lượng đăng bán phải là số nguyên lớn hơn 0!' };
  }
  if (!Number.isSafeInteger(priceSilver) || priceSilver <= 0) {
    return { success: false, message: 'Giá bán phải là số nguyên lớn hơn 0!' };
  }

  const now = Date.now();
  const itemData = JSON.stringify({ itemKey, itemName, amount });

  return withTransaction(db, async tx => {
    try {
      const removed = await removeInventoryItems(tx, sellerId, itemCategory, itemKey, amount);
      if (!removed) {
        await tx.rollback();
        return { success: false, message: `Đạo hữu không đủ ${amount}x ${itemName} để đăng bán!` };
      }

      await tx.execute({
        sql: `INSERT INTO tutien_market (seller_id, seller_name, item_category, item_title, item_data, price_silver, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
        args: [sellerId, sellerName, itemCategory, `${amount}x ${itemName}`, itemData, priceSilver, now]
      });
      await tx.commit();
      return {
        success: true,
        message: `Đã đăng bán **${amount}x ${itemName}** lên Chợ Đen với giá **${priceSilver.toLocaleString()}** Ngân lượng!`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

async function buyMarketItem(buyerId, listingId) {
  const db = getDb();
  const helper = await getEquippedHelper(buyerId);

  return withTransaction(db, async tx => {
    try {
      const listingRes = await tx.execute({
        sql: "SELECT * FROM tutien_market WHERE id = ? AND status = 'active'",
        args: [listingId]
      });
      const listing = listingRes.rows[0];
      if (!listing) {
        await tx.rollback();
        return { success: false, message: 'Vật phẩm này không còn tồn tại hoặc đã được bán!' };
      }
      if (String(listing.seller_id) === String(buyerId)) {
        await tx.rollback();
        return { success: false, message: 'Không thể tự mua vật phẩm của chính mình!' };
      }

      const playerRes = await tx.execute({
        sql: 'SELECT silver FROM tutien_players WHERE user_id = ?',
        args: [buyerId]
      });
      const buyer = playerRes.rows[0];
      if (!buyer) {
        await tx.rollback();
        return { success: false, message: 'Đạo hữu chưa bước vào con đường tu tiên!' };
      }

      const originalPrice = Number(listing.price_silver);
      const finalPrice = helper?.type === 'life' ? Math.floor(originalPrice * 0.85) : originalPrice;
      if (Number(buyer.silver) < finalPrice) {
        await tx.rollback();
        return {
          success: false,
          message: `Đạo hữu không đủ Ngân lượng! Cần **${finalPrice.toLocaleString()}**, hiện có **${Number(buyer.silver).toLocaleString()}**.`
        };
      }

      const claimResult = await tx.execute({
        sql: "UPDATE tutien_market SET status = 'sold' WHERE id = ? AND status = 'active'",
        args: [listingId]
      });
      if (claimResult.rowsAffected !== 1) {
        await tx.rollback();
        return { success: false, message: 'Vật phẩm này vừa được mua bởi một đạo hữu khác!' };
      }

      const debitResult = await tx.execute({
        sql: 'UPDATE tutien_players SET silver = silver - ? WHERE user_id = ? AND silver >= ?',
        args: [finalPrice, buyerId, finalPrice]
      });
      if (debitResult.rowsAffected !== 1) {
        await tx.rollback();
        return { success: false, message: 'Ngân lượng vừa thay đổi; hãy kiểm tra số dư rồi thử lại!' };
      }

      await tx.execute({
        sql: 'UPDATE tutien_players SET silver = silver + ? WHERE user_id = ?',
        args: [originalPrice, listing.seller_id]
      });
      const itemData = JSON.parse(listing.item_data);
      await addInventoryItems(
        tx,
        buyerId,
        listing.item_category,
        itemData.itemKey,
        itemData.itemName,
        itemData.amount
      );
      await tx.commit();

      return {
        success: true,
        itemTitle: listing.item_title,
        paidPrice: finalPrice,
        originalPrice,
        discounted: finalPrice < originalPrice,
        message: `🎉 Giao dịch thành công! Đạo hữu đã mua **${listing.item_title}** với giá **${finalPrice.toLocaleString()}** Ngân lượng!`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

async function cancelListing(sellerId, listingId) {
  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      const listingRes = await tx.execute({
        sql: "SELECT * FROM tutien_market WHERE id = ? AND seller_id = ? AND status = 'active'",
        args: [listingId, sellerId]
      });
      const listing = listingRes.rows[0];
      if (!listing) {
        await tx.rollback();
        return { success: false, message: 'Không tìm thấy vật phẩm hoặc bạn không có quyền hủy!' };
      }

      const cancelResult = await tx.execute({
        sql: "UPDATE tutien_market SET status = 'cancelled' WHERE id = ? AND seller_id = ? AND status = 'active'",
        args: [listingId, sellerId]
      });
      if (cancelResult.rowsAffected !== 1) {
        await tx.rollback();
        return { success: false, message: 'Tin đăng vừa được xử lý; hãy làm mới danh sách chợ!' };
      }

      const itemData = JSON.parse(listing.item_data);
      await addInventoryItems(
        tx,
        sellerId,
        listing.item_category,
        itemData.itemKey,
        itemData.itemName,
        itemData.amount
      );
      await tx.commit();
      return {
        success: true,
        message: `Đã hủy bán **${listing.item_title}**! Vật phẩm đã được hoàn về túi trữ vật.`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

module.exports = {
  getMarketListings,
  listItem,
  buyMarketItem,
  cancelListing
};
