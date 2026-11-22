const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const { getPlayer } = require('../services/playerService');
const {
  COMPREHEND_COST_SINGLE,
  COMPREHEND_COST_FIVE,
  SKILL_SCROLL_NAME,
  getMaxSkillSlots,
  getTierInfo,
  getUpgradeCost,
  getSkillScrollCount,
  getUserSkills,
  equipSkill,
  unequipSkill,
  buyLibrarySkill,
  comprehendSkill,
  upgradeSkill,
  salvageSkill
} = require('../services/skillService');
const { SPIRIT_ROOTS, SKILL_CATALOG, SKILL_EFFECT_LABELS } = require('../config/constants');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { createTextEmbedPages, replyWithEmbedPages } = require('../utils/embedPagination');
const { formatNumber } = require('../utils/formatters');
const { onComponentCollect, runComponentAction } = require('../utils/componentAction');

function formatSkillLine(s, idx = null) {
  const tierName = getTierInfo(s.tier || 1).name;
  const typeTag = s.type === 'active' ? '⚡ Chủ Động' : '🧘 Bị Động';
  const lvl = Number(s.level || 1);
  const maxLvl = Number(s.max_level || getTierInfo(s.tier || 1).maxLevel);
  const statStr = s.type === 'active'
    ? `Uy lực x${Number(s.damage_mult || 1).toFixed(2)} | CD: ${s.cooldown || 2} lượt`
    : `Hiệu lực: +${(Number(s.effect_value || 0) * 100).toFixed(1)}%`;
  const effectNote = s.effect_type && s.effect_type !== 'none'
    ? ` • ${SKILL_EFFECT_LABELS[s.effect_type]?.split(' (')[0] || s.effect_type}`
    : '';
  const prefix = idx !== null ? `**Ô ${idx + 1}:** ` : `• \`#${s.id}\` `;
  return `${prefix}[${typeTag}] **${String(s.name).slice(0, 80)}** [${tierName} • Tầng ${lvl}/${maxLvl}] (Hệ ${s.element})\n  ${statStr}${effectNote}\n  *${String(s.desc || '').slice(0, 200)}*`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skills')
    .setDescription('Tàng Kinh Các • Quản lý, Lĩnh Ngộ và Tu Luyện Công Pháp & Thần Thông')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Xem Công Pháp đang trang bị, kho bí tịch và số Tàn Quyển hiện có')
    )
    .addSubcommand(sub =>
      sub.setName('equip')
        .setDescription('Trang bị Công Pháp Bị Động hoặc Thần Thông Chủ Động vào ô xuất chiến')
    )
    .addSubcommand(sub =>
      sub.setName('unequip')
        .setDescription('Tháo Công Pháp đang trang bị về kho Tàng Kinh Các')
    )
    .addSubcommand(sub =>
      sub.setName('library')
        .setDescription('Vào Tàng Kinh Các: Thỉnh bí tịch cơ bản hoặc Lĩnh Ngộ tìm bí tịch hiếm')
    )
    .addSubcommand(sub =>
      sub.setName('upgrade')
        .setDescription('Tu luyện nâng tầng Công Pháp bằng Bạc và Tàn Quyển Công Pháp')
    )
    .addSubcommand(sub =>
      sub.setName('salvage')
        .setDescription('Phân giải Công Pháp dư thừa không dùng thành Tàn Quyển Công Pháp')
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const player = await getPlayer(userId);
    if (!player) {
      return interaction.reply({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Hãy dùng `/start` trước!')],
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();
    const maxSlots = getMaxSkillSlots(player);

    // 1. LIST
    if (sub === 'list') {
      const [skills, scrollCount] = await Promise.all([
        getUserSkills(userId),
        getSkillScrollCount(userId)
      ]);
      const root = SPIRIT_ROOTS[player.spirit_root] || SPIRIT_ROOTS.hoa;
      const equippedSkills = skills.filter(s => Number(s.is_equipped) === 1);
      const unequippedSkills = skills.filter(s => Number(s.is_equipped) !== 1);

      const description =
        `• **Linh Căn Chủ Đạo:** ${root.icon} **${root.name}** *(Thần thông cùng hệ +10% uy lực)*\n` +
        `• **Số Ô Công Pháp:** **${equippedSkills.length}/${maxSlots} Ô** ${player.race === 'nhan_toc' ? '*(Nhân Tộc: +1 Ô)*' : ''}\n` +
        `• **${SKILL_SCROLL_NAME}:** \`${formatNumber(scrollCount)}\` quyển\n\n` +
        `⚡ **Đang Trang Bị (${equippedSkills.length}/${maxSlots}):**\n` +
        (equippedSkills.length > 0
          ? equippedSkills.map((s, i) => formatSkillLine(s, i)).join('\n\n')
          : '*Chưa trang bị công pháp nào! Dùng `/skills library` để thỉnh bí tịch và `/skills equip` để trang bị.*') +
        `\n\n📚 **Kho Bí Tịch (${unequippedSkills.length}):**\n` +
        (unequippedSkills.length > 0
          ? unequippedSkills.map(s => formatSkillLine(s)).join('\n\n')
          : '*Không còn bí tịch dự phòng.*');

      return replyWithEmbedPages(interaction, createTextEmbedPages(description, {
        title: `📜 Tàng Kinh Các • Công Pháp Của ${player.dao_hieu || player.username}`,
        realmId: player.realm_id
      }), { customIdPrefix: 'skills_page' });
    }

    // 2. LIBRARY (TÀNG KINH CÁC: MUA BÍ TỊCH CƠ BẢN + LĨNH NGỘ X1 / X5)
    if (sub === 'library') {
      const scrollCount = await getSkillScrollCount(userId);
      const buyableSkills = SKILL_CATALOG.filter(s => getTierInfo(s.tier).buyPrice);

      const buyableListText = buyableSkills.map(s => {
        const tierInfo = getTierInfo(s.tier);
        const tag = s.type === 'active' ? '⚡ Chủ Động' : '🧘 Bị Động';
        return `• **[${tierInfo.name}] ${s.name}** (${tag} • Hệ ${s.element}) — **${formatNumber(tierInfo.buyPrice)} Bạc**\n  *${s.desc}*`;
      }).join('\n');

      const buildLibraryEmbed = (currentPlayer, currentScrolls) => createTuTienEmbed(currentPlayer.realm_id)
        .setTitle('🏛️ Tàng Kinh Các • Bí Tịch & Lĩnh Ngộ Thần Thông')
        .setDescription(
          `👤 **Đạo Hữu:** \`${currentPlayer.dao_hieu || currentPlayer.username}\` | 💰 **Ngân Lượng:** \`${formatNumber(currentPlayer.silver)}\` Bạc | 📜 **Tàn Quyển:** \`${formatNumber(currentScrolls)}\`\n\n` +
          `✨ **Lĩnh Ngộ Ngẫu Nhiên (Tìm Bí Tịch Phàm ➔ Tiên Giai):**\n` +
          `• **Lĩnh Ngộ x1:** \`${formatNumber(COMPREHEND_COST_SINGLE)}\` Bạc\n` +
          `• **Lĩnh Ngộ x5:** \`${formatNumber(COMPREHEND_COST_FIVE)}\` Bạc *(giảm 10%, bảo đảm ít nhất 1 bí tịch **Huyền Giai+**)*\n` +
          `• *Trùng công pháp đã sở hữu sẽ tự động hóa thành **${SKILL_SCROLL_NAME}** để nâng tầng!*\n\n` +
          `📚 **Bí Tịch Cơ Bản Bán Trực Tiếp (Phàm – Hoàng Giai):**\n${buyableListText}`
        );

      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('skills_comprehend_1')
          .setLabel(`Lĩnh Ngộ x1 (${formatNumber(COMPREHEND_COST_SINGLE)} Bạc)`)
          .setEmoji('✨')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('skills_comprehend_5')
          .setLabel(`Lĩnh Ngộ x5 (${formatNumber(COMPREHEND_COST_FIVE)} Bạc)`)
          .setEmoji('🌟')
          .setStyle(ButtonStyle.Success)
      );

      const buyMenu = new StringSelectMenuBuilder()
        .setCustomId('skills_library_buy')
        .setPlaceholder('Thỉnh (mua) bí tịch Phàm / Hoàng Giai bằng Bạc...')
        .addOptions(
          buyableSkills.slice(0, 25).map(s => {
            const tierInfo = getTierInfo(s.tier);
            return {
              label: `[${tierInfo.name}] ${s.name} (${formatNumber(tierInfo.buyPrice)} Bạc)`.slice(0, 100),
              description: `${s.type === 'active' ? 'Chủ Động' : 'Bị Động'} • Hệ ${s.element} • ${s.desc}`.slice(0, 100),
              value: s.key
            };
          })
        );
      const rowSelect = new ActionRowBuilder().addComponents(buyMenu);

      const msg = await interaction.reply({
        embeds: [buildLibraryEmbed(player, scrollCount)],
        components: [rowButtons, rowSelect]
      });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === userId,
        time: 120000
      });

      onComponentCollect(collector, async i => {
        if (i.isStringSelectMenu() && i.customId === 'skills_library_buy') {
          const catalogKey = i.values[0];
          await runComponentAction(
            i,
            async () => {
              const res = await buyLibrarySkill(userId, catalogKey);
              const [freshPlayer, freshScrolls] = await Promise.all([getPlayer(userId), getSkillScrollCount(userId)]);
              if (!res.success) {
                await i.followUp({ embeds: [createErrorEmbed('Không Thể Thỉnh Bí Tịch', res.message)], ephemeral: true });
                return { embeds: [buildLibraryEmbed(freshPlayer || player, freshScrolls)], components: [rowButtons, rowSelect] };
              }
              return {
                embeds: [createSuccessEmbed('📚 Thỉnh Bí Tịch Thành Công', `${res.message}\n\n👉 Dùng \`/skills equip\` để trang bị ngay!`, player.realm_id)],
                components: [rowButtons, rowSelect]
              };
            },
            () => ({ embeds: [createErrorEmbed('Lỗi', 'Không thể thỉnh bí tịch lúc này.')], components: [] }),
            'thỉnh bí tịch'
          );
          return;
        }

        if (i.isButton() && (i.customId === 'skills_comprehend_1' || i.customId === 'skills_comprehend_5')) {
          const count = i.customId === 'skills_comprehend_5' ? 5 : 1;
          await runComponentAction(
            i,
            async () => {
              const res = await comprehendSkill(userId, count);
              if (!res.success) {
                await i.followUp({ embeds: [createErrorEmbed('Lĩnh Ngộ Thất Bại', res.message)], ephemeral: true });
                const [freshPlayer, freshScrolls] = await Promise.all([getPlayer(userId), getSkillScrollCount(userId)]);
                return { embeds: [buildLibraryEmbed(freshPlayer || player, freshScrolls)], components: [rowButtons, rowSelect] };
              }

              const lines = res.results.map((r, idx) => {
                const typeTag = r.skill.type === 'active' ? '⚡ Chủ Động' : '🧘 Bị Động';
                const dupNote = r.isDuplicate
                  ? ` *(Trùng ➔ +${r.scrollsConverted} Tàn Quyển)*`
                  : ' 🆕 **[MỚI]**';
                return `**${idx + 1}.** [${r.tierInfo.name}] **${r.skill.name}** (${typeTag} • Hệ ${r.skill.element})${dupNote}`;
              }).join('\n');

              const resultEmbed = createSuccessEmbed(
                `🌟 Kết Quả Lĩnh Ngộ x${res.count} • Tàng Kinh Các`,
                `${lines}\n\n` +
                `• **Chi phí:** \`-${formatNumber(res.totalCost)}\` Bạc | **Còn lại:** \`${formatNumber(res.remainingSilver)}\` Bạc\n` +
                (res.totalScrollsGained > 0 ? `• **Tàn Quyển quy đổi:** \`+${res.totalScrollsGained}\` quyển\n` : '') +
                `👉 Dùng \`/skills equip\` để trang bị hoặc \`/skills upgrade\` để nâng tầng!`,
                player.realm_id
              );

              return { embeds: [resultEmbed], components: [rowButtons, rowSelect] };
            },
            () => ({ embeds: [createErrorEmbed('Lỗi', 'Không thể lĩnh ngộ lúc này.')], components: [] }),
            'lĩnh ngộ công pháp'
          );
        }
      }, 'Tàng Kinh Các');

      collector.on('end', () => {
        msg.edit({ components: [] }).catch(() => {});
      });
      return;
    }

    // 3. EQUIP
    if (sub === 'equip') {
      const skills = await getUserSkills(userId);
      const unequipped = skills.filter(s => Number(s.is_equipped) !== 1);
      if (unequipped.length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Có Bí Tịch Dự Phòng', 'Không có Công Pháp nào chưa trang bị! Hãy dùng `/skills library` để thỉnh hoặc lĩnh ngộ bí tịch mới.')],
          ephemeral: true
        });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_skill_equip')
        .setPlaceholder('Chọn Công Pháp muốn trang bị...')
        .addOptions(
          unequipped.slice(0, 25).map(s => ({
            label: `[${getTierInfo(s.tier).name}] ${s.name} (Tầng ${s.level || 1})`.slice(0, 100),
            description: `${s.type === 'active' ? 'Chủ Động' : 'Bị Động'} • Hệ ${s.element} • ${s.desc}`.slice(0, 100),
            value: s.id.toString()
          }))
        );

      const msg = await interaction.reply({
        content: `Chọn Công Pháp để trang bị (Tối đa **${maxSlots}** ô):`,
        components: [new ActionRowBuilder().addComponents(menu)]
      });

      const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });
      onComponentCollect(collector, async i => {
        if (i.customId === 'select_skill_equip') {
          collector.stop();
          await runComponentAction(
            i,
            async () => {
              const res = await equipSkill(userId, Number(i.values[0]));
              return {
                content: null,
                embeds: [res.success
                  ? createSuccessEmbed('Trang Bị Công Pháp Thành Công', res.message, player.realm_id)
                  : createErrorEmbed('Trang Bị Thất Bại', res.message)],
                components: []
              };
            },
            () => ({ embeds: [createErrorEmbed('Lỗi', 'Không thể trang bị công pháp lúc này.')], components: [] }),
            'trang bị công pháp'
          );
        }
      });
      return;
    }

    // 4. UNEQUIP
    if (sub === 'unequip') {
      const skills = await getUserSkills(userId);
      const equipped = skills.filter(s => Number(s.is_equipped) === 1);
      if (equipped.length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed('Trống', 'Đạo hữu chưa trang bị Công Pháp nào!')],
          ephemeral: true
        });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_skill_unequip')
        .setPlaceholder('Chọn Công Pháp muốn tháo...')
        .addOptions(
          equipped.slice(0, 25).map(s => ({
            label: `Ô ${s.slot || '?'} • ${s.name} (Tầng ${s.level || 1})`.slice(0, 100),
            description: `${s.type === 'active' ? 'Chủ Động' : 'Bị Động'} • Hệ ${s.element}`.slice(0, 100),
            value: s.id.toString()
          }))
        );

      const msg = await interaction.reply({
        content: 'Chọn Công Pháp muốn tháo về kho:',
        components: [new ActionRowBuilder().addComponents(menu)]
      });

      const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });
      onComponentCollect(collector, async i => {
        if (i.customId === 'select_skill_unequip') {
          collector.stop();
          await runComponentAction(
            i,
            async () => {
              const res = await unequipSkill(userId, Number(i.values[0]));
              return {
                content: null,
                embeds: [res.success
                  ? createSuccessEmbed('Đã Tháo Công Pháp', res.message, player.realm_id)
                  : createErrorEmbed('Thất Bại', res.message)],
                components: []
              };
            },
            () => ({ embeds: [createErrorEmbed('Lỗi', 'Không thể tháo công pháp lúc này.')], components: [] }),
            'tháo công pháp'
          );
        }
      });
      return;
    }

    // 5. UPGRADE
    if (sub === 'upgrade') {
      const [skills, scrollCount] = await Promise.all([getUserSkills(userId), getSkillScrollCount(userId)]);
      const upgradable = skills.filter(s => Number(s.level || 1) < Number(s.max_level || getTierInfo(s.tier).maxLevel));
      if (upgradable.length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Thể Nâng Tầng', 'Chưa có Công Pháp nào có thể nâng tầng (hoặc tất cả đã đạt tầng tối đa)!')],
          ephemeral: true
        });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_skill_upgrade')
        .setPlaceholder('Chọn Công Pháp muốn tu luyện nâng tầng...')
        .addOptions(
          upgradable.slice(0, 25).map(s => {
            const { silverCost, scrollCost } = getUpgradeCost(s);
            const maxLvl = Number(s.max_level || getTierInfo(s.tier).maxLevel);
            return {
              label: `${s.name} (Tầng ${s.level || 1} ➔ ${(s.level || 1) + 1}/${maxLvl})`.slice(0, 100),
              description: `Cần ${formatNumber(silverCost)} Bạc + ${scrollCost} Tàn Quyển`.slice(0, 100),
              value: s.id.toString()
            };
          })
        );

      const msg = await interaction.reply({
        content: `📜 **${SKILL_SCROLL_NAME} hiện có:** \`${formatNumber(scrollCount)}\` | 💰 **Bạc:** \`${formatNumber(player.silver)}\`\nChọn Công Pháp muốn tu luyện nâng tầng:`,
        components: [new ActionRowBuilder().addComponents(menu)]
      });

      const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });
      onComponentCollect(collector, async i => {
        if (i.customId === 'select_skill_upgrade') {
          collector.stop();
          await runComponentAction(
            i,
            async () => {
              const res = await upgradeSkill(userId, Number(i.values[0]));
              if (!res.success) {
                return { content: null, embeds: [createErrorEmbed('Tu Luyện Thất Bại', res.message)], components: [] };
              }
              return {
                content: null,
                embeds: [createSuccessEmbed(
                  '⬆️ Đột Phá Tầng Công Pháp Thành Công!',
                  `Công pháp **${res.skillName}** đã tiến cấp **Tầng ${res.oldLevel} ➔ Tầng ${res.newLevel}/${res.maxLevel}**!\n\n` +
                  `• **Uy lực:** \`x${res.oldDmgMult.toFixed(2)}\` ➔ \`x${res.newDmgMult.toFixed(2)}\`\n` +
                  `• **Hiệu lực nội tại/hiệu ứng:** \`${(res.oldEffectVal * 100).toFixed(1)}%\` ➔ \`${(res.newEffectVal * 100).toFixed(1)}%\`\n` +
                  `• **Tiêu hao:** \`-${formatNumber(res.silverCost)}\` Bạc, \`-${res.scrollCost}\` Tàn Quyển *(Còn ${formatNumber(res.remainingScrolls)} quyển)*`,
                  player.realm_id
                )],
                components: []
              };
            },
            () => ({ embeds: [createErrorEmbed('Lỗi', 'Không thể nâng tầng công pháp lúc này.')], components: [] }),
            'nâng tầng công pháp'
          );
        }
      });
      return;
    }

    // 6. SALVAGE
    if (sub === 'salvage') {
      const skills = await getUserSkills(userId);
      const salvageable = skills.filter(s => Number(s.is_equipped) !== 1);
      if (salvageable.length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed('Trống', 'Không có Công Pháp dự phòng nào (chưa trang bị) để phân giải!')],
          ephemeral: true
        });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_skill_salvage')
        .setPlaceholder('Chọn Công Pháp dư thừa để phân giải thành Tàn Quyển...')
        .addOptions(
          salvageable.slice(0, 25).map(s => {
            const scrolls = getTierInfo(s.tier).salvageScrolls + Math.max(0, Number(s.level || 1) - 1);
            return {
              label: `#${s.id} [${getTierInfo(s.tier).name}] ${s.name} (Tầng ${s.level || 1})`.slice(0, 100),
              description: `Phân giải nhận +${scrolls} Tàn Quyển Công Pháp`.slice(0, 100),
              value: s.id.toString()
            };
          })
        );

      const msg = await interaction.reply({
        content: 'Chọn Công Pháp muốn phân giải thành **Tàn Quyển Công Pháp**:',
        components: [new ActionRowBuilder().addComponents(menu)]
      });

      const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });
      onComponentCollect(collector, async i => {
        if (i.customId === 'select_skill_salvage') {
          collector.stop();
          await runComponentAction(
            i,
            async () => {
              const res = await salvageSkill(userId, Number(i.values[0]));
              return {
                content: null,
                embeds: [res.success
                  ? createSuccessEmbed('📜 Phân Giải Thành Công', res.message, player.realm_id)
                  : createErrorEmbed('Phân Giải Thất Bại', res.message)],
                components: []
              };
            },
            () => ({ embeds: [createErrorEmbed('Lỗi', 'Không thể phân giải công pháp lúc này.')], components: [] }),
            'phân giải công pháp'
          );
        }
      });
    }
  }
};
