const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPlayer } = require('../services/playerService');
const { getEquippedWeapon } = require('../services/weaponService');
const { getEquippedArmor } = require('../services/armorService');
const { getEquippedPets, checkResonance } = require('../services/petService');
const { getEquippedHelper } = require('../services/helperService');
const { getEquippedSkills, getMaxSkillSlots, getTierInfo } = require('../services/skillService');
const { getDongPhu } = require('../services/dongPhuService');
const { getPetResonance } = require('../services/petConfigService');
const { RACES, SPIRIT_ROOTS, REALMS } = require('../config/constants');
const { getRealmDisplay, getXpRequired, createProgressBar, formatNumber } = require('../utils/formatters');
const { createTuTienEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { calculateCombatStats } = require('../utils/combat');

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Xem hồ sơ tu tiên, cảnh giới, trang bị, linh thú và động phủ')
    .addUserOption(opt => 
      opt.setName('user')
        .setDescription('Xem tu vi của đạo hữu khác (để trống để xem chính mình)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    await interaction.deferReply({ ephemeral: true });

    const player = await getPlayer(targetUser.id);
    if (!player) {
      if (targetUser.id === interaction.user.id) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Chưa Bước Vào Tu Tiên', 'Đạo hữu chưa thức tỉnh! Hãy dùng `/start` để bắt đầu.')]
        });
      } else {
        return interaction.editReply({
          embeds: [createErrorEmbed('Không Tìm Thấy Đạo Hữu', `**${targetUser.username}** chưa bước chân vào con đường tu tiên.`)]
        });
      }
    }

    const race = RACES[player.race] || RACES.nhan_toc;
    const root = SPIRIT_ROOTS[player.spirit_root] || SPIRIT_ROOTS.hoa;
    const realmDisplay = getRealmDisplay(player.realm_id, player.level);
    const xpCurrent = Number(player.xp || 0);
    const xpMax = getXpRequired(player.realm_id, player.level);
    const xpBar = createProgressBar(xpCurrent, xpMax);

    // Lấy thông tin trang bị
    const [weapon, armor, pets, resonance, helper, skills, dongPhu, petResonance] = await Promise.all([
      getEquippedWeapon(player.user_id),
      getEquippedArmor(player.user_id),
      getEquippedPets(player.user_id),
      checkResonance(player.user_id),
      getEquippedHelper(player.user_id),
      getEquippedSkills(player.user_id),
      getDongPhu(player.user_id),
      getPetResonance()
    ]);
    const combatStats = calculateCombatStats(player, weapon, pets, helper, skills, petResonance, { armor });
    const maxSkillSlots = getMaxSkillSlots(player);

    const embed = createTuTienEmbed(player.realm_id)
      .setTitle(`📜 Hồ Sơ Tu Tiên • ${player.dao_hieu || player.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: '🥋 Cảnh Giới & Tu Vi',
          value: `• **Cảnh Giới:** \`${realmDisplay}\`\n` +
                 `• **Linh Lực (XP):** \`${formatNumber(xpCurrent)} / ${formatNumber(xpMax)}\`\n` +
                 `• **Tiến Độ:** ${xpBar}\n` +
                 `• **Ngân Lượng:** \`${formatNumber(player.silver)}\` Bạc`,
          inline: false
        },
        {
          name: '🧬 Chủng Tộc & Linh Căn',
          value: `• **Tộc:** ${race.icon} **${race.name}**\n` +
                 `• **Linh Căn:** ${root.icon} **${root.name}** (${root.bonusDesc})\n` +
                 (player.rule_enlightenment ? `• **Quy Tắc Lĩnh Ngộ:** 🌌 **${player.rule_enlightenment}**\n` : ''),
          inline: true
        },
        {
          name: '🏯 Động Phủ & Khiêu Chiến',
          value: `• **Tụ Linh Trận:** Cấp ${dongPhu ? dongPhu.array_level : 1} (${2 * (dongPhu ? dongPhu.array_level : 1)} XP/phút)\n` +
                 `• **AFK:** ${dongPhu && Number(dongPhu.afk_enabled) === 1 ? '🌙 Đang bật' : '💤 Đang tắt'}\n` +
                 `• **Thí Luyện Tháp:** Tầng ${player.tower_floor || 1}\n` +
                 `• **Điểm Đấu Pháp:** ${player.pvp_points || 1000} Điểm`,
          inline: true
        },
        {
          name: '📊 Chỉ Số Chiến Đấu',
          value: `• **HP:** ${formatNumber(combatStats.maxHp)}\n` +
                 `• **Công:** ${formatNumber(combatStats.atk)} | **Thủ:** ${formatNumber(combatStats.def)}\n` +
                 `• **Tốc độ:** ${formatNumber(combatStats.speed)}\n` +
                 `• **Bạo kích:** ${(combatStats.crit * 100).toFixed(1)}% | **ST bạo kích:** x${combatStats.critDmg.toFixed(2)}\n` +
                 `• **Giảm ST nhận vào (Giáp):** ${((combatStats.dmgReduction || 0) * 100).toFixed(1)}% | **Kháng ST vật lý:** ${(combatStats.physResist * 100).toFixed(1)}% | **Kháng khống chế:** ${(combatStats.ccResist * 100).toFixed(1)}%`,
          inline: false
        },
        {
          name: '⚔️ Linh Khí (Tối đa 1)',
          value: weapon 
            ? `**${String(weapon.name).slice(0, 100)}** [Bậc ${weapon.tier}] ${weapon.is_natal ? '🌟 *(Bản Mệnh)*' : ''}\n  • Công +${weapon.atk} | Thủ +${weapon.def}\n  • *${String(weapon.effect_desc || '').slice(0, 300)}*`
            : '*Chưa trang bị Linh Khí*',
          inline: false
        },
        {
          name: '🛡️ Linh Giáp (Tối đa 1)',
          value: armor
            ? `**${String(armor.name).slice(0, 100)}** [Bậc ${armor.tier}] ${armor.is_natal ? '🌟 *(Bản Mệnh)*' : ''}\n  • HP +${formatNumber(armor.hp)} | Thủ +${formatNumber(armor.def)} | Giảm ST **${(Number(armor.dmg_reduction || 0) * 100).toFixed(1)}%**\n  • *${String(armor.effect_desc || '').slice(0, 300)}*`
            : '*Chưa trang bị Linh Giáp (`/armor equip` hoặc `/wish pull banner:armor`)*',
          inline: false
        },
        {
          name: `📜 Công Pháp & Thần Thông (${skills.length}/${maxSkillSlots})`,
          value: skills.length > 0
            ? skills.map((s, idx) => `**Ô ${idx + 1}:** [${s.type === 'active' ? '⚡ Chủ Động' : '🧘 Bị Động'}] **${String(s.name).slice(0, 60)}** (${getTierInfo(s.tier || 1).name} • Tầng ${s.level || 1})`).join('\n')
            : '*Chưa trang bị Công Pháp (`/skills library` & `/skills equip`)*',
          inline: false
        },
        {
          name: `🐾 Linh Thú Xuất Trận (${pets.length}/3)`,
          value: pets.length > 0
            ? pets.map((p, idx) => `**Ô ${idx + 1}:** ${String(p.name).slice(0, 100)} [${String(p.element).slice(0, 30)}] (${p.star}⭐) - Công +${p.atk}, HP +${p.hp}`).join('\n') +
              `\n• **Trận Pháp:** ${resonance.active ? `🔥 **${String(resonance.name).slice(0, 100)}**\n  *(${String(resonance.desc).slice(0, 300)})*` : `*${String(resonance.message).slice(0, 300)}*`}`
            : '*Chưa trang bị Linh Thú nào*',
          inline: false
        },
        {
          name: '🤝 Trợ Thủ (Tối đa 1)',
          value: helper
            ? `**${String(helper.name).slice(0, 100)}** [${helper.type === 'combat' ? '⚔️ Hộ Đạo Giả (Chiến Đấu)' : '🌾 Đạo Đồng (Sinh Hoạt)'}]\n  • *${String(helper.effect_desc || '').slice(0, 300)}*`
            : '*Chưa trang bị Trợ Thủ*',
          inline: false
        }
      );
    if (isHttpUrl(player.banner_image_url)) {
      embed.setImage(player.banner_image_url);
    }

    // Nút bấm tương tác chỉ dành cho chính chủ
    if (targetUser.id === interaction.user.id) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_cultivate')
          .setLabel('Tọa Thiền Tu Luyện')
          .setEmoji('🧘')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('btn_breakthrough')
          .setLabel('Đột Phá Cảnh Giới')
          .setEmoji('⚡')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('btn_claim_dongphu')
          .setLabel('Thu Hoạch Động Phủ')
          .setEmoji('🌾')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    return interaction.editReply({ embeds: [embed] });
  }
};
