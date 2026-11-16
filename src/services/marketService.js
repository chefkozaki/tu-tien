const { getDb } = require('../config/database');
const { getPlayer, addSilver } = require('./playerService');
const { removeItem, addItem } = require('./itemService');
const { getEquippedHelper } = require('./helperService');

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

/**
 * Đăng bán Linh Kim hoặc Đan Dược
 */
async function listItem(sellerId, sellerName, itemCategory, itemKey, itemName, amount, priceSilver) {
  const db = getDb();
  if (priceSilver <= 0) return { success: false, message: 'Giá bán phải lớn hơn 0!' };

  // Trừ vật phẩm từ túi đồ người bán
  const removed = await removeItem(sellerId, itemCategory, itemKey, amount);
  if (!removed) {
    return { success: false, message: `Đạo hữu không đủ ${amount}x ${itemName} để đăng bán!` };
  }

  const now = Date.now();
  const itemData = JSON.stringify({ itemKey, itemName, amount });

  await db.execute({
    sql: `INSERT INTO tutien_market (seller_id, seller_name, item_category, item_title, item_data, price_silver, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
    args: [sellerId, sellerName, itemCategory, `${amount}x ${itemName}`, itemData, priceSilver, now]
  });

  return {
    success: true,
    message: `Đã đăng bán **${amount}x ${itemName}** lên Chợ Đen với giá **${priceSilver.toLocaleString()}** Ngân lượng!`
  };
}

/**
 * Mua vật phẩm từ Chợ Đen
 */
async function buyMarketItem(buyerId, listingId) {
  const db = getDb();
  const buyer = await getPlayer(buyerId);
  if (!buyer) return { success: false, message: 'Đạo hữu chưa bước vào con đường tu tiên!' };

  const listingRes = await db.execute({
    sql: "SELECT * FROM tutien_market WHERE id = ? AND status = 'active'",
    args: [listingId]
  });
  const listing = listingRes.rows[0];
  if (!listing) return { success: false, message: 'Vật phẩm này không còn tồn tại hoặc đã được bán!' };

  if (listing.seller_id === buyerId) {
    return { success: false, message: 'Không thể tự mua vật phẩm của chính mình!' };
  }

  let finalPrice = Number(listing.price_silver);

  // Trợ Thủ Sinh Hoạt: Giảm giá mua đồ 15%
  const helper = await getEquippedHelper(buyerId);
  if (helper && helper.type === 'life') {
    finalPrice = Math.floor(finalPrice * 0.85);
  }

  if (buyer.silver < finalPrice) {
    return { success: false, message: `Đạo hữu không đủ Ngân lượng! Cần **${finalPrice.toLocaleString()}**, hiện có **${buyer.silver.toLocaleString()}**.` };
  }

  // Chuyển tiền từ người mua sang người bán
  await addSilver(buyerId, -finalPrice);
  await addSilver(listing.seller_id, Number(listing.price_silver));

  // Trao vật phẩm cho người mua
  const itemData = JSON.parse(listing.item_data);
  await addItem(buyerId, listing.item_category, itemData.itemKey, itemData.itemName, itemData.amount);

  // Cập nhật trạng thái niêm yết
  await db.execute({
    sql: "UPDATE tutien_market SET status = 'sold' WHERE id = ?",
    args: [listingId]
  });

  return {
    success: true,
    itemTitle: listing.item_title,
    paidPrice: finalPrice,
    originalPrice: listing.price_silver,
    discounted: finalPrice < Number(listing.price_silver),
    message: `🎉 Giao dịch thành công! Đạo hữu đã mua **${listing.item_title}** với giá **${finalPrice.toLocaleString()}** Ngân lượng!`
  };
}

/**
 * Hủy bài đăng bán trên Chợ Đen
 */
async function cancelListing(sellerId, listingId) {
  const db = getDb();
  const listingRes = await db.execute({
    sql: "SELECT * FROM tutien_market WHERE id = ? AND seller_id = ? AND status = 'active'",
    args: [listingId, sellerId]
  });
  const listing = listingRes.rows[0];
  if (!listing) return { success: false, message: 'Không tìm thấy vật phẩm hoặc bạn không có quyền hủy!' };

  const itemData = JSON.parse(listing.item_data);
  await addItem(sellerId, listing.item_category, itemData.itemKey, itemData.itemName, itemData.amount);

  await db.execute({
    sql: "UPDATE tutien_market SET status = 'cancelled' WHERE id = ?",
    args: [listingId]
  });

  return {
    success: true,
    message: `Đã hủy bán **${listing.item_title}**! Vật phẩm đã được hoàn về túi trữ vật.`
  };
}

module.exports = {
  getMarketListings,
  listItem,
  buyMarketItem,
  cancelListing
};
