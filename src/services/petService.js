const { getDb } = require('../config/database');
const { getPetResonance } = require('./petConfigService');
const { removeItem, getItemAmount } = require('./itemService');

async function getUserPets(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_pets WHERE user_id = ? ORDER BY is_equipped DESC, star DESC, id DESC',
    args: [userId]
  });
  return res.rows;
}

async function getEquippedPets(userId) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM tutien_pets WHERE user_id = ? AND is_equipped = 1 ORDER BY slot ASC',
    args: [userId]
  });
  return res.rows;
}

async function equipPet(userId, petId, targetSlot) {
  const db = getDb();
  if (targetSlot < 1 || targetSlot > 3) return { success: false, message: 'Chỉ có thể trang bị tối đa 3 Linh Thú (Ô 1, 2, 3)!' };

  // Kiểm tra pet thuộc sở hữu
  const petRes = await db.execute({
    sql: 'SELECT * FROM tutien_pets WHERE id = ? AND user_id = ?',
    args: [petId, userId]
  });
  const pet = petRes.rows[0];
  if (!pet) return { success: false, message: 'Không tìm thấy Linh Thú!' };

  // Gỡ con đang ở slot đó nếu có
  await db.execute({
    sql: 'UPDATE tutien_pets SET is_equipped = 0, slot = 0 WHERE user_id = ? AND slot = ?',
    args: [userId, targetSlot]
  });

  // Trang bị con mới
  await db.execute({
    sql: 'UPDATE tutien_pets SET is_equipped = 1, slot = ? WHERE id = ?',
    args: [targetSlot, petId]
  });

  return { success: true, message: `Đã trang bị **${pet.name}** vào ô thứ ${targetSlot}!` };
}

async function unequipPet(userId, petId) {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE tutien_pets SET is_equipped = 0, slot = 0 WHERE id = ? AND user_id = ?',
    args: [petId, userId]
  });
  return { success: true, message: 'Đã tháo Linh Thú!' };
}

/**
 * Kiểm tra hiệu ứng Trận Pháp của 3 Linh Thú đang trang bị
 */
async function checkResonance(userId) {
  const equipped = await getEquippedPets(userId);
  if (equipped.length < 3) {
    return {
      active: false,
      message: `Hiện trang bị ${equipped.length}/3 Linh Thú. Cần trang bị đủ 3 Linh Thú để kích hoạt Trận Pháp!`
    };
  }

  const elements = equipped.map(p => p.element);
  const isSameElement = elements.every(e => e === elements[0]);
  if (isSameElement) {
    const resonance = await getPetResonance();
    return {
      active: true,
      name: `${resonance.name} (${elements[0]})`,
      desc: resonance.desc
    };
  }

  return {
    active: false,
    message: 'Cần trang bị 3 Linh Thú cùng hệ để kích hoạt Cộng Hưởng Trận Pháp.'
  };
}

/**
 * Tiến hóa Linh Thú bằng cách nuốt linh thú khác hoặc Linh Kim
 */
async function evolvePetWithPet(userId, targetPetId, sacrificePetId) {
  const db = getDb();
  if (targetPetId === sacrificePetId) return { success: false, message: 'Không thể tự nuốt chính mình!' };

  const targetRes = await db.execute({
    sql: 'SELECT * FROM tutien_pets WHERE id = ? AND user_id = ?',
    args: [targetPetId, userId]
  });
  const sacrificeRes = await db.execute({
    sql: 'SELECT * FROM tutien_pets WHERE id = ? AND user_id = ?',
    args: [sacrificePetId, userId]
  });

  const target = targetRes.rows[0];
  const sacrifice = sacrificeRes.rows[0];

  if (!target || !sacrifice) return { success: false, message: 'Không tìm thấy Linh Thú chỉ định!' };
  if (target.star >= 5) return { success: false, message: 'Linh Thú đã đạt phẩm chất tối đa 5 Sao!' };

  // Xóa linh thú hiến tế
  await db.execute({
    sql: 'DELETE FROM tutien_pets WHERE id = ?',
    args: [sacrificePetId]
  });

  // Tăng sao và chỉ số cho linh thú chính
  const newStar = target.star + 1;
  const hpBonus = Math.floor(target.hp * 0.35);
  const atkBonus = Math.floor(target.atk * 0.35);
  const defBonus = Math.floor(target.def * 0.35);

  await db.execute({
    sql: `UPDATE tutien_pets 
      SET star = ?, hp = hp + ?, atk = atk + ?, def = def + ? 
      WHERE id = ?`,
    args: [newStar, hpBonus, atkBonus, defBonus, targetPetId]
  });

  return {
    success: true,
    message: `Tiến hóa thành công! **${target.name}** đã đạt **${newStar}⭐** (+${hpBonus} HP, +${atkBonus} Công, +${defBonus} Thủ)!`
  };
}

module.exports = {
  getUserPets,
  getEquippedPets,
  equipPet,
  unequipPet,
  checkResonance,
  evolvePetWithPet
};
