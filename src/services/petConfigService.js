const { getDb } = require('../config/database');

async function getPetElements() {
  const db = getDb();
  const result = await db.execute('SELECT name, icon FROM tutien_pet_elements ORDER BY name');
  return result.rows;
}

async function getPetResonance() {
  const db = getDb();
  const result = await db.execute('SELECT * FROM tutien_pet_resonance WHERE id = 1');
  const row = result.rows[0];
  if (!row) {
    throw new Error('Chưa khởi tạo cấu hình cộng hưởng linh thú.');
  }

  return {
    name: row.name,
    desc: row.description,
    atk_bonus: Number(row.atk_bonus),
    hp_bonus: Number(row.hp_bonus),
    def_bonus: Number(row.def_bonus),
    speed_bonus: Number(row.speed_bonus),
    crit_bonus: Number(row.crit_bonus),
    phys_resist_bonus: Number(row.phys_resist_bonus),
    hp_regen_turn: Number(row.hp_regen_turn),
    buff: {
      atkMultiplier: 1 + Number(row.atk_bonus) / 100,
      hpMultiplier: 1 + Number(row.hp_bonus) / 100,
      defMultiplier: 1 + Number(row.def_bonus) / 100,
      speedMultiplier: 1 + Number(row.speed_bonus) / 100,
      critBonus: Number(row.crit_bonus) / 100,
      physResistBonus: Number(row.phys_resist_bonus) / 100,
      hpRegenTurn: Number(row.hp_regen_turn) / 100
    }
  };
}

async function getPetSettings() {
  const [elements, resonance] = await Promise.all([
    getPetElements(),
    getPetResonance()
  ]);
  return { elements, resonance };
}

module.exports = {
  getPetElements,
  getPetResonance,
  getPetSettings
};
