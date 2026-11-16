const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPlayer } = require('../services/playerService');
const { getEquippedWeapon } = require('../services/weaponService');
const { getEquippedPets, checkResonance } = require('../services/petService');
const { getEquippedHelper } = require('../services/helperService');
const { getDongPhu } = require('../services/dongPhuService');
const { RACES, SPIRIT_ROOTS, REALMS } = require('../config/constants');
const { getRealmDisplay, getXpRequired, createProgressBar, formatNumber } = require('../utils/formatters');
const { createTuTienEmbed, createErrorEmbed } = require('../utils/embedBuilder');

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
    const player = await getPlayer(targetUser.id);

    if (!player) {
      if (targetUser.id === interaction.user.id) {
        return interaction.reply({
          embeds: [createErrorEmbed('Chưa Bước Vào Tu Tiên', 'Đạo hữu chưa thức tỉnh! Hãy dùng `/start` để bắt đầu.')],
          ephemeral: true
        });
      } else {
        return interaction.reply({
          embeds: [createErrorEmbed('Không Tìm Thấy Đạo Hữu', `**${targetUser.username}** chưa bước chân vào con đường tu tiên.`)],
          ephemeral: true
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
    const [weapon, pets, resonance, helper, dongPhu] = await Promise.all([
      getEquippedWeapon(player.user_id),
      getEquippedPets(player.user_id),
      checkResonance(player.user_id),
      getEquippedHelper(player.user_id),
      getDongPhu(player.user_id)
    ]);

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
          name: '⚔️ Linh Khí (Tối đa 1)',
          value: weapon 
            ? `**${weapon.name}** [Bậc ${weapon.tier}] ${weapon.is_natal ? '🌟 *(Bản Mệnh)*' : ''}\n  • Công +${weapon.atk} | Thủ +${weapon.def}\n  • *${weapon.effect_desc}*`
            : '*Chưa trang bị Linh Khí*',
          inline: false
        },
        {
          name: `🐾 Linh Thú Xuất Trận (${pets.length}/3)`,
          value: pets.length > 0
            ? pets.map((p, idx) => `**Ô ${idx + 1}:** ${p.name} [${p.element}] (${p.star}⭐) - Công +${p.atk}, HP +${p.hp}`).join('\n') +
              `\n• **Trận Pháp:** ${resonance.active ? `🔥 **${resonance.name}**\n  *(${resonance.desc})*` : `*${resonance.message}*`}`
            : '*Chưa trang bị Linh Thú nào*',
          inline: false
        },
        {
          name: '🤝 Trợ Thủ (Tối đa 1)',
          value: helper
            ? `**${helper.name}** [${helper.type === 'combat' ? '⚔️ Hộ Đạo Giả (Chiến Đấu)' : '🌾 Đạo Đồng (Sinh Hoạt)'}]\n  • *${helper.effect_desc}*`
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

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    return interaction.reply({ embeds: [embed] });
  }
};
