const { getDb } = require('../config/database');
const { getPlayer, addSilver } = require('./playerService');
const { removeItem, addItem } = require('./itemService');

async function getSectById(sectId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_sects WHERE id = ?',
    args: [sectId]
  });
  return res.rows[0] || null;
}

async function getSectByName(name) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_sects WHERE LOWER(name) = LOWER(?)',
    args: [name]
  });
  return res.rows[0] || null;
}

async function createSect(userId, sectName) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player) return { success: false, message: 'Chưa khởi tạo nhân vật!' };

  if (player.sect_id) {
    return { success: false, message: 'Đạo hữu đã có Tông Môn, hãy rời tông môn cũ trước!' };
  }

  const creationCost = 50000;
  if (player.silver < creationCost) {
    return { success: false, message: `Lập Tông Môn cần **${creationCost.toLocaleString()}** Ngân lượng!` };
  }

  const existing = await getSectByName(sectName);
  if (existing) {
    return { success: false, message: 'Tên Tông Môn này đã tồn tại trong thiên hạ!' };
  }

  await addSilver(userId, -creationCost);
  const now = Date.now();

  const insertRes = await db.execute({
    sql: `INSERT INTO tutien_sects (name, leader_id, level, fund_silver, fund_spirit_gold, created_at)
      VALUES (?, ?, 1, 0, 0, ?)`,
    args: [sectName, userId, now]
  });

  const sectId = Number(insertRes.lastInsertRowid);
  await db.execute({
    sql: `UPDATE tutien_players 
      SET sect_id = ?, sect_role = 'Chưởng Môn', sect_contribution = 1000 
      WHERE user_id = ?`,
    args: [sectId, userId]
  });

  return {
    success: true,
    sectId,
    sectName,
    message: `🎉 Chúc mừng đạo hữu khai tông lập phái, thành lập **${sectName}** thành công!`
  };
}

async function joinSect(userId, sectId) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (player.sect_id) return { success: false, message: 'Đạo hữu đã ở trong một Tông Môn!' };

  const sect = await getSectById(sectId);
  if (!sect) return { success: false, message: 'Không tìm thấy Tông Môn này!' };

  await db.execute({
    sql: `UPDATE tutien_players 
      SET sect_id = ?, sect_role = 'Đệ Tử', sect_contribution = 0 
      WHERE user_id = ?`,
    args: [sectId, userId]
  });

  return {
    success: true,
    message: `Đạo hữu đã chính thức gia nhập **${sect.name}**!`
  };
}

async function contributeSect(userId, silverAmount = 0, spiritGoldAmount = 0, spiritGoldQuality = 'Phàm') {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player.sect_id) return { success: false, message: 'Đạo hữu chưa gia nhập Tông Môn nào!' };

  let addedContribution = 0;

  if (silverAmount > 0) {
    if (player.silver < silverAmount) {
      return { success: false, message: 'Đạo hữu không đủ Ngân lượng để cống hiến!' };
    }
    await addSilver(userId, -silverAmount);
    addedContribution += Math.floor(silverAmount / 100);
    await db.execute({
      sql: 'UPDATE tutien_sects SET fund_silver = fund_silver + ? WHERE id = ?',
      args: [silverAmount, player.sect_id]
    });
  }

  if (spiritGoldAmount > 0) {
    const hasGold = await removeItem(userId, 'spirit_gold', spiritGoldQuality, spiritGoldAmount);
    if (!hasGold) {
      return { success: false, message: `Đạo hữu không đủ ${spiritGoldAmount} Linh Kim (${spiritGoldQuality})!` };
    }
    addedContribution += spiritGoldAmount * 50;
    await db.execute({
      sql: 'UPDATE tutien_sects SET fund_spirit_gold = fund_spirit_gold + ? WHERE id = ?',
      args: [spiritGoldAmount, player.sect_id]
    });
  }

  await db.execute({
    sql: 'UPDATE tutien_players SET sect_contribution = sect_contribution + ? WHERE user_id = ?',
    args: [addedContribution, userId]
  });

  // Tăng cấp Tông Môn nếu quỹ dồi dào
  const sect = await getSectById(player.sect_id);
  const nextLevelCost = sect.level * 200000;
  if (sect.fund_silver >= nextLevelCost && sect.level < 10) {
    await db.execute({
      sql: 'UPDATE tutien_sects SET level = level + 1, fund_silver = fund_silver - ? WHERE id = ?',
      args: [nextLevelCost, sect.id]
    });
  }

  return {
    success: true,
    addedContribution,
    message: `Cống hiến thành công! Nhận được **+${addedContribution.toLocaleString()} điểm cống hiến** Tông Môn.`
  };
}

async function getMines() {
  const db = getDb();
  const res = await db.execute(`
    SELECT m.*, s.name as sect_name 
    FROM tutien_mines m 
    LEFT JOIN tutien_sects s ON m.occupying_sect_id = s.id 
    ORDER BY m.id ASC
  `);
  return res.rows;
}

async function captureMine(userId, mineId) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player.sect_id) return { success: false, message: 'Đạo hữu cần có Tông Môn để đánh chiếm Mỏ Linh Mạch!' };

  const sect = await getSectById(player.sect_id);
  const mineRes = await db.execute({
    sql: 'SELECT * FROM tutien_mines WHERE id = ?',
    args: [mineId]
  });
  const mine = mineRes.rows[0];
  if (!mine) return { success: false, message: 'Mỏ Linh Mạch không tồn tại!' };

  if (mine.occupying_sect_id === player.sect_id) {
    return { success: false, message: 'Tông Môn của đạo hữu đã đang chiếm giữ mỏ này!' };
  }

  // Cập nhật chiếm đóng
  const now = Date.now();
  await db.execute({
    sql: 'UPDATE tutien_mines SET occupying_sect_id = ?, occupied_at = ?, last_tax_collected = ? WHERE id = ?',
    args: [player.sect_id, now, now, mineId]
  });

  return {
    success: true,
    mineName: mine.name,
    sectName: sect.name,
    message: `⚔️ Tông Môn **${sect.name}** đã xuất sắc đánh chiếm thành công **${mine.name}**! Thuế khoáng sản sẽ thuộc về tông môn mỗi ngày!`
  };
}

async function claimMineTax(userId, mineId) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player.sect_id) return { success: false, message: 'Đạo hữu không ở trong Tông Môn nào!' };

  const mineRes = await db.execute({
    sql: 'SELECT * FROM tutien_mines WHERE id = ?',
    args: [mineId]
  });
  const mine = mineRes.rows[0];
  if (!mine || mine.occupying_sect_id !== player.sect_id) {
    return { success: false, message: 'Tông Môn của đạo hữu không chiếm giữ mỏ này!' };
  }

  const now = Date.now();
  const hoursPassed = Math.floor((now - Number(mine.last_tax_collected || 0)) / (3600 * 1000));
  if (hoursPassed < 1) {
    return { success: false, message: 'Mỏ khoáng sản chưa tích đủ tài nguyên mới! Hãy đợi thêm.' };
  }

  const taxSilver = Math.floor((mine.daily_silver / 24) * hoursPassed);
  const taxGold = Math.max(1, Math.floor((mine.daily_spirit_gold / 24) * hoursPassed));

  await db.execute({
    sql: 'UPDATE tutien_sects SET fund_silver = fund_silver + ?, fund_spirit_gold = fund_spirit_gold + ? WHERE id = ?',
    args: [taxSilver, taxGold, player.sect_id]
  });

  await db.execute({
    sql: 'UPDATE tutien_mines SET last_tax_collected = ? WHERE id = ?',
    args: [now, mineId]
  });

  return {
    success: true,
    taxSilver,
    taxGold,
    message: `Đã thu thuế mỏ: Nhập quỹ Tông Môn **+${taxSilver.toLocaleString()} Ngân lượng** và **+${taxGold} Linh Kim (${mine.tier_name})**!`
  };
}

module.exports = {
  getSectById,
  getSectByName,
  createSect,
  joinSect,
  contributeSect,
  getMines,
  captureMine,
  claimMineTax
};
