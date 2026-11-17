const { getDb } = require('../config/database');
const { withTransaction } = require('../utils/databaseTransaction');

async function redeemGiftCode(userId, inputCode) {
  const code = typeof inputCode === 'string' ? inputCode.trim().toUpperCase() : '';
  if (!code) {
    return { success: false, reason: 'invalid', message: 'Hãy nhập mã quà tặng cần đổi.' };
  }

  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      const codeResult = await tx.execute({
        sql: 'SELECT * FROM tutien_gift_codes WHERE code = ?',
        args: [code]
      });
      const giftCode = codeResult.rows[0];
      if (!giftCode) {
        await tx.rollback();
        return { success: false, reason: 'invalid', message: 'Mã quà tặng không tồn tại.' };
      }

      const now = Date.now();
      if (Number(giftCode.expires_at) <= now) {
        await tx.rollback();
        return { success: false, reason: 'expired', message: 'Mã quà tặng này đã hết hạn.' };
      }

      const player = await tx.execute({
        sql: 'SELECT user_id FROM tutien_players WHERE user_id = ?',
        args: [userId]
      });
      if (!player.rows[0]) {
        await tx.rollback();
        return { success: false, reason: 'no_player', message: 'Hãy dùng `/start` để tạo nhân vật trước khi đổi mã.' };
      }

      const claim = await tx.execute({
        sql: `INSERT INTO tutien_gift_code_claims (gift_code_id, user_id, redeemed_at)
          VALUES (?, ?, ?)
          ON CONFLICT (gift_code_id, user_id) DO NOTHING`,
        args: [giftCode.id, userId, now]
      });
      if (claim.rowsAffected !== 1) {
        await tx.rollback();
        return { success: false, reason: 'claimed', message: 'Đạo hữu đã đổi mã quà tặng này rồi.' };
      }

      if (giftCode.item_type === 'silver') {
        await tx.execute({
          sql: 'UPDATE tutien_players SET silver = silver + ? WHERE user_id = ?',
          args: [giftCode.amount, userId]
        });
      } else {
        const inventory = await tx.execute({
          sql: `SELECT id FROM tutien_inventory
            WHERE user_id = ? AND item_type = ? AND item_key = ?
            ORDER BY id LIMIT 1`,
          args: [userId, giftCode.item_type, giftCode.item_key]
        });
        if (inventory.rows[0]) {
          await tx.execute({
            sql: 'UPDATE tutien_inventory SET amount = amount + ? WHERE id = ?',
            args: [giftCode.amount, inventory.rows[0].id]
          });
        } else {
          await tx.execute({
            sql: `INSERT INTO tutien_inventory (user_id, item_type, item_key, item_name, amount)
              VALUES (?, ?, ?, ?, ?)`,
            args: [userId, giftCode.item_type, giftCode.item_key, giftCode.item_name, giftCode.amount]
          });
        }
      }

      await tx.commit();
      return {
        success: true,
        code,
        itemName: giftCode.item_name,
        amount: Number(giftCode.amount)
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

module.exports = { redeemGiftCode };
