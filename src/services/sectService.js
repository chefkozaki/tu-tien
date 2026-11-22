const { getDb } = require('../config/database');
const { getPlayer, addSilver } = require('./playerService');
const { removeItem, addItem } = require('./itemService');
const { withTransaction } = require('../utils/databaseTransaction');
const { calculateCombatStats } = require('../utils/combat');
const { PET_RESONANCES } = require('../config/constants');

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

async function getSectMembers(sectId) {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT user_id, username, dao_hieu, sect_role, sect_contribution, realm_id, level
      FROM tutien_players
      WHERE sect_id = ?
      ORDER BY CASE WHEN sect_role = 'Chưởng Môn' THEN 0 ELSE 1 END,
        sect_contribution DESC, dao_hieu COLLATE NOCASE ASC`,
    args: [sectId]
  });
  return res.rows;
}

async function createSect(userId, sectName) {
  const db = getDb();
  const player = await getPlayer(userId);
  if (!player) return { success: false, message: 'Chưa khởi tạo nhân vật!' };

  if (player.sect_id) {
    return { success: false, message: 'Đạo hữu đã có Tông Môn, hãy rời tông môn cũ trước!' };
  }

  if (Number(player.realm_id) < 3) {
    return { success: false, message: 'Cần đạt cảnh giới **Linh Tướng** mới có thể lập Tông Môn!' };
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
  return withTransaction(db, async tx => {
    try {
      const playerResult = await tx.execute({
        sql: 'SELECT sect_id FROM tutien_players WHERE user_id = ?',
        args: [userId]
      });
      const player = playerResult.rows[0];
      if (!player) {
        await tx.rollback();
        return { success: false, message: 'Chưa khởi tạo nhân vật! Hãy dùng `/start` trước.' };
      }
      if (player.sect_id) {
        await tx.rollback();
        return { success: false, message: 'Đạo hữu đã ở trong một Tông Môn!' };
      }

      const sectResult = await tx.execute({
        sql: 'SELECT name FROM tutien_sects WHERE id = ?',
        args: [sectId]
      });
      const sect = sectResult.rows[0];
      if (!sect) {
        await tx.rollback();
        return { success: false, message: 'Không tìm thấy Tông Môn này!' };
      }

      const pendingResult = await tx.execute({
        sql: `SELECT id FROM tutien_sect_applications
          WHERE applicant_id = ? AND status = 'pending'`,
        args: [userId]
      });
      if (pendingResult.rows[0]) {
        await tx.rollback();
        return { success: false, message: `Đạo hữu đã có đơn gia nhập đang chờ duyệt (mã đơn #${pendingResult.rows[0].id})!` };
      }

      const now = Date.now();
      const application = await tx.execute({
        sql: `INSERT INTO tutien_sect_applications (sect_id, applicant_id, created_at)
          VALUES (?, ?, ?)`,
        args: [sectId, userId, now]
      });
      await tx.commit();
      return {
        success: true,
        applicationId: Number(application.lastInsertRowid),
        message: `Đơn gia nhập **${sect.name}** đã được gửi và đang chờ Chưởng Môn chấp nhận. Đạo hữu chỉ chính thức gia nhập sau khi đơn được duyệt.`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

async function getSectApplications(leaderId) {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT a.id, a.applicant_id, a.created_at, p.username, p.dao_hieu, s.name AS sect_name
      FROM tutien_sect_applications a
      JOIN tutien_sects s ON s.id = a.sect_id
      JOIN tutien_players p ON p.user_id = a.applicant_id
      WHERE s.leader_id = ? AND a.status = 'pending'
      ORDER BY a.created_at ASC, a.id ASC`,
    args: [leaderId]
  });
  return res.rows;
}

async function resolveSectApplication(leaderId, applicationId, decision) {
  if (decision !== 'accept' && decision !== 'reject') {
    throw new Error(`Invalid sect application decision: ${decision}`);
  }

  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      const applicationResult = await tx.execute({
        sql: `SELECT a.id, a.sect_id, a.applicant_id, s.name AS sect_name
          FROM tutien_sect_applications a
          JOIN tutien_sects s ON s.id = a.sect_id
          WHERE a.id = ? AND s.leader_id = ? AND a.status = 'pending'`,
        args: [applicationId, leaderId]
      });
      const application = applicationResult.rows[0];
      if (!application) {
        await tx.rollback();
        return { success: false, message: 'Không tìm thấy đơn đang chờ duyệt của Tông Môn này!' };
      }

      if (decision === 'reject') {
        const update = await tx.execute({
          sql: `UPDATE tutien_sect_applications SET status = 'rejected'
            WHERE id = ? AND status = 'pending'`,
          args: [applicationId]
        });
        if (update.rowsAffected !== 1) {
          await tx.rollback();
          return { success: false, message: 'Đơn này đã được xử lý trước đó!' };
        }
        await tx.commit();
        return {
          success: true,
          message: `Đã từ chối đơn gia nhập Tông Môn của <@${application.applicant_id}>.`
        };
      }

      const memberUpdate = await tx.execute({
        sql: `UPDATE tutien_players
          SET sect_id = ?, sect_role = 'Đệ Tử', sect_contribution = 0
          WHERE user_id = ? AND sect_id IS NULL`,
        args: [application.sect_id, application.applicant_id]
      });
      if (memberUpdate.rowsAffected !== 1) {
        await tx.rollback();
        return {
          success: false,
          message: 'Người nộp đơn không còn là tán tu hoặc chưa khởi tạo nhân vật; đơn vẫn đang chờ để Chưởng Môn xử lý.'
        };
      }

      const applicationUpdate = await tx.execute({
        sql: `UPDATE tutien_sect_applications SET status = 'accepted'
          WHERE id = ? AND status = 'pending'`,
        args: [applicationId]
      });
      if (applicationUpdate.rowsAffected !== 1) {
        throw new Error(`Sect application ${applicationId} changed while being accepted.`);
      }

      await tx.commit();
      return {
        success: true,
        message: `Đã chấp nhận đơn gia nhập của <@${application.applicant_id}>. Đạo hữu đã trở thành thành viên **${application.sect_name}**!`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

async function recruitSectMember(leaderId, memberId) {
  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      const sectResult = await tx.execute({
        sql: 'SELECT id, name FROM tutien_sects WHERE leader_id = ?',
        args: [leaderId]
      });
      const sect = sectResult.rows[0];
      if (!sect) {
        await tx.rollback();
        return { success: false, message: 'Chỉ Chưởng Môn mới có thể tuyển thành viên cho Tông Môn!' };
      }
      if (leaderId === memberId) {
        await tx.rollback();
        return { success: false, message: 'Chưởng Môn đã là thành viên của Tông Môn!' };
      }

      const memberResult = await tx.execute({
        sql: 'SELECT sect_id FROM tutien_players WHERE user_id = ?',
        args: [memberId]
      });
      const member = memberResult.rows[0];
      if (!member) {
        await tx.rollback();
        return { success: false, message: 'Người được tuyển chưa khởi tạo nhân vật. Họ cần dùng `/start` trước!' };
      }
      if (member.sect_id) {
        await tx.rollback();
        return { success: false, message: 'Người này đã gia nhập một Tông Môn!' };
      }

      const update = await tx.execute({
        sql: `UPDATE tutien_players
          SET sect_id = ?, sect_role = 'Đệ Tử', sect_contribution = 0
          WHERE user_id = ? AND sect_id IS NULL`,
        args: [sect.id, memberId]
      });
      if (update.rowsAffected !== 1) {
        await tx.rollback();
        return { success: false, message: 'Không thể tuyển thành viên lúc này. Hãy thử lại!' };
      }

      await tx.commit();
      return {
        success: true,
        sectName: sect.name,
        message: `Đã tuyển thành công <@${memberId}> vào Tông Môn **${sect.name}**!`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
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

async function getSectCombatPower(tx, sectId) {
  const memberResult = await tx.execute({
    sql: 'SELECT * FROM tutien_players WHERE sect_id = ?',
    args: [sectId]
  });
  const members = memberResult.rows;
  if (members.length === 0) return 0;

  const [weaponResult, armorResult, petResult, helperResult, skillResult, resonanceResult] = await Promise.all([
    tx.execute({
      sql: `SELECT w.* FROM tutien_weapons w
        JOIN tutien_players p ON p.user_id = w.user_id
        WHERE p.sect_id = ? AND w.is_equipped = 1`,
      args: [sectId]
    }),
    tx.execute({
      sql: `SELECT a.* FROM tutien_armors a
        JOIN tutien_players p ON p.user_id = a.user_id
        WHERE p.sect_id = ? AND a.is_equipped = 1`,
      args: [sectId]
    }),
    tx.execute({
      sql: `SELECT pet.* FROM tutien_pets pet
        JOIN tutien_players p ON p.user_id = pet.user_id
        WHERE p.sect_id = ? AND pet.is_equipped = 1
        ORDER BY pet.slot ASC`,
      args: [sectId]
    }),
    tx.execute({
      sql: `SELECT h.* FROM tutien_helpers h
        JOIN tutien_players p ON p.user_id = h.user_id
        WHERE p.sect_id = ? AND h.is_equipped = 1`,
      args: [sectId]
    }),
    tx.execute({
      sql: `SELECT s.* FROM tutien_skills s
        JOIN tutien_players p ON p.user_id = s.user_id
        WHERE p.sect_id = ? AND s.is_equipped = 1
        ORDER BY s.slot ASC, s.id ASC`,
      args: [sectId]
    }),
    tx.execute('SELECT * FROM tutien_pet_resonance WHERE id = 1')
  ]);
  const byUser = rows => rows.reduce((grouped, row) => {
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, []);
    grouped.get(row.user_id).push(row);
    return grouped;
  }, new Map());
  const weapons = byUser(weaponResult.rows);
  const armors = byUser(armorResult.rows);
  const pets = byUser(petResult.rows);
  const helpers = byUser(helperResult.rows);
  const skills = byUser(skillResult.rows);
  const resonance = resonanceResult.rows[0];
  const petResonance = resonance ? {
    name: resonance.name,
    desc: resonance.description,
    buff: {
      atkMultiplier: 1 + Number(resonance.atk_bonus) / 100,
      hpMultiplier: 1 + Number(resonance.hp_bonus) / 100,
      defMultiplier: 1 + Number(resonance.def_bonus) / 100,
      speedMultiplier: 1 + Number(resonance.speed_bonus) / 100,
      critBonus: Number(resonance.crit_bonus) / 100,
      physResistBonus: Number(resonance.phys_resist_bonus) / 100,
      hpRegenTurn: Number(resonance.hp_regen_turn) / 100
    }
  } : PET_RESONANCES.same_element_3;

  return members.reduce((total, member) => {
    const stats = calculateCombatStats(
      member,
      (weapons.get(member.user_id) || [])[0] || null,
      pets.get(member.user_id) || [],
      (helpers.get(member.user_id) || [])[0] || null,
      skills.get(member.user_id) || [],
      petResonance,
      { armor: (armors.get(member.user_id) || [])[0] || null }
    );
    const equippedSkills = skills.get(member.user_id) || [];
    const averageSkillBonus = equippedSkills.length
      ? equippedSkills.reduce((sum, skill) => sum + Number(skill.damage_mult || 1), 0) / equippedSkills.length - 1
      : 0;
    return total + stats.maxHp + stats.atk * (1 + averageSkillBonus * 0.4) + stats.def + stats.speed;
  }, 0);
}

async function captureMine(userId, mineId) {
  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      const playerResult = await tx.execute({
        sql: 'SELECT * FROM tutien_players WHERE user_id = ?',
        args: [userId]
      });
      const player = playerResult.rows[0];
      if (!player?.sect_id) {
        await tx.rollback();
        return { success: false, message: 'Đạo hữu cần có Tông Môn để đánh chiếm Mỏ Linh Mạch!' };
      }

      const [sectResult, mineResult] = await Promise.all([
        tx.execute({
          sql: 'SELECT * FROM tutien_sects WHERE id = ?',
          args: [player.sect_id]
        }),
        tx.execute({
          sql: 'SELECT * FROM tutien_mines WHERE id = ?',
          args: [mineId]
        })
      ]);
      const sect = sectResult.rows[0];
      const mine = mineResult.rows[0];
      if (!sect) {
        await tx.rollback();
        return { success: false, message: 'Không tìm thấy Tông Môn của đạo hữu!' };
      }
      if (!mine) {
        await tx.rollback();
        return { success: false, message: 'Mỏ Linh Mạch không tồn tại!' };
      }

      if (String(mine.occupying_sect_id) === String(player.sect_id)) {
        await tx.rollback();
        return { success: false, message: 'Tông Môn của đạo hữu đã đang chiếm giữ mỏ này!' };
      }

      let attackerPower = 0;
      let defenderPower = 0;
      let defenderName = null;
      if (mine.occupying_sect_id !== null && mine.occupying_sect_id !== undefined) {
        const defenderResult = await tx.execute({
          sql: 'SELECT name FROM tutien_sects WHERE id = ?',
          args: [mine.occupying_sect_id]
        });
        defenderName = defenderResult.rows[0]?.name || 'Tông Môn thủ mỏ';
        [attackerPower, defenderPower] = await Promise.all([
          getSectCombatPower(tx, player.sect_id),
          getSectCombatPower(tx, mine.occupying_sect_id)
        ]);

        if (attackerPower <= defenderPower) {
          await tx.rollback();
          return {
            success: false,
            attackerPower,
            defenderPower,
            message: `⚔️ Công chiếm thất bại! **${defenderName}** thủ thành thành công.\n` +
              `• Tổng lực chiến **${sect.name}**: **${attackerPower.toLocaleString('vi-VN')}**\n` +
              `• Tổng lực chiến **${defenderName}**: **${defenderPower.toLocaleString('vi-VN')}**\n` +
              `Tông Môn công chiếm cần có tổng lực chiến cao hơn bên thủ mỏ.`
          };
        }
      }

      const now = Date.now();
      await tx.execute({
        sql: 'UPDATE tutien_mines SET occupying_sect_id = ?, occupied_at = ?, last_tax_collected = ? WHERE id = ?',
        args: [player.sect_id, now, now, mineId]
      });
      await tx.commit();

      return {
        success: true,
        mineName: mine.name,
        sectName: sect.name,
        attackerPower,
        defenderPower,
        message: `⚔️ Tông Môn **${sect.name}** đã xuất sắc đánh chiếm thành công **${mine.name}**!` +
          (defenderName
            ? `\nTổng lực chiến: **${attackerPower.toLocaleString('vi-VN')}** vs **${defenderPower.toLocaleString('vi-VN')}** của **${defenderName}**.`
            : '') +
          '\nThuế khoáng sản sẽ thuộc về tông môn mỗi ngày!'
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

async function claimMineTax(userId, mineId) {
  const db = getDb();
  return withTransaction(db, async tx => {
    try {
      const playerResult = await tx.execute({
        sql: 'SELECT sect_id FROM tutien_players WHERE user_id = ?',
        args: [userId]
      });
      const player = playerResult.rows[0];
      if (!player?.sect_id) {
        await tx.rollback();
        return { success: false, message: 'Đạo hữu không ở trong Tông Môn nào!' };
      }

      const mineResult = await tx.execute({
        sql: 'SELECT * FROM tutien_mines WHERE id = ?',
        args: [mineId]
      });
      const mine = mineResult.rows[0];
      if (!mine || String(mine.occupying_sect_id) !== String(player.sect_id)) {
        await tx.rollback();
        return { success: false, message: 'Tông Môn của đạo hữu không chiếm giữ mỏ này!' };
      }

      const now = Date.now();
      const previousCollectedAt = Number(mine.last_tax_collected || 0);
      const hoursPassed = Math.floor((now - previousCollectedAt) / (3600 * 1000));
      if (hoursPassed < 1) {
        await tx.rollback();
        return { success: false, message: 'Mỏ khoáng sản chưa tích đủ tài nguyên mới! Hãy đợi thêm.' };
      }

      const taxSilver = Math.floor((mine.daily_silver / 24) * hoursPassed);
      const taxGold = Math.max(1, Math.floor((mine.daily_spirit_gold / 24) * hoursPassed));
      const claimResult = await tx.execute({
        sql: `UPDATE tutien_mines SET last_tax_collected = ?
          WHERE id = ? AND occupying_sect_id = ? AND last_tax_collected = ?`,
        args: [now, mineId, player.sect_id, previousCollectedAt]
      });
      if (claimResult.rowsAffected !== 1) {
        await tx.rollback();
        return { success: false, message: 'Thuế mỏ vừa được một thành viên khác thu; hãy làm mới trạng thái mỏ!' };
      }

      await tx.execute({
        sql: 'UPDATE tutien_sects SET fund_silver = fund_silver + ?, fund_spirit_gold = fund_spirit_gold + ? WHERE id = ?',
        args: [taxSilver, taxGold, player.sect_id]
      });
      await tx.commit();
      return {
        success: true,
        taxSilver,
        taxGold,
        message: `Đã thu thuế mỏ: Nhập quỹ Tông Môn **+${taxSilver.toLocaleString()} Ngân lượng** và **+${taxGold} Linh Kim (${mine.tier_name})**!`
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });
}

module.exports = {
  getSectById,
  getSectByName,
  getSectMembers,
  createSect,
  joinSect,
  getSectApplications,
  resolveSectApplication,
  recruitSectMember,
  contributeSect,
  getMines,
  captureMine,
  claimMineTax
};
