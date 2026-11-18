const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { 
  getDongPhu, 
  claimTuLinhTran, 
  upgradeTuLinhTran, 
  plantSeed, 
  harvestGarden, 
  refinePill, 
  forgeWeapon,
  PILL_RECIPES,
  SEEDS
} = require('../services/dongPhuService');
const { getPlayer } = require('../services/playerService');
const { getEquippedHelper } = require('../services/helperService');
const { createTuTienEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { formatNumber } = require('../utils/formatters');
const { onComponentCollect, runComponentAction } = require('../utils/componentAction');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('base')
    .setDescription('Hệ thống Động Phủ: AFK, nâng cấp Tụ Linh Trận, Dược Viên, Lò Luyện Đan & Lò Rèn')
    .addSubcommand(sub =>
      sub.setName('harvest')
        .setDescription('Thu hoạch XP và Ngân Lượng AFK; trạng thái AFK vẫn tiếp tục')
    )
    .addSubcommand(sub =>
      sub.setName('upgrade')
        .setDescription('Nâng cấp Tụ Linh Trận nhiều cấp trong một lần bằng Ngân Lượng')
        .addStringOption(opt =>
          opt.setName('levels')
            .setDescription('Số cấp muốn nâng hoặc all để nâng tối đa bằng bạc có')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('garden')
        .setDescription('Xem tình trạng Dược Viên, gieo trồng hoặc thu hoạch linh thảo')
    )
    .addSubcommand(sub =>
      sub.setName('brew')
        .setDescription('Luyện chế Đan Dược từ linh thảo thu hoạch')
    )
    .addSubcommand(sub =>
      sub.setName('forge')
        .setDescription('Rèn Linh Khí mới tại Lò Rèn')
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();
    const isUpgrade = sub === 'upgrade';
    const replyOrEdit = payload => isUpgrade
      ? interaction.editReply(payload)
      : interaction.reply(payload);

    if (isUpgrade) {
      await interaction.deferReply({ ephemeral: true });
    }

    const player = await getPlayer(userId);
    if (!player) {
      return replyOrEdit({
        embeds: [createErrorEmbed('Chưa Tu Tiên', 'Hãy dùng `/start` trước!')],
        ephemeral: true
      });
    }

    // 1. Thu Hoạch Tụ Linh Trận (Idle)
    if (sub === 'harvest') {
      const res = await claimTuLinhTran(userId);
      if (!res.success) {
        return interaction.reply({
          embeds: [createErrorEmbed('Chưa Thể Thu Hoạch', res.message)],
          ephemeral: true
        });
      }

      const embed = createSuccessEmbed(
        '🌾 Thu Hoạch Tụ Linh Trận Thành Công',
        `AFK vẫn đang bật; Động Phủ đã tích lũy trong **${res.elapsedMinutes} phút** qua:\n\n` +
        `• **Linh Lực Thu Được:** \`+${formatNumber(res.xpGained)}\` XP\n` +
        `• **Ngân Lượng Thu Được:** \`+${formatNumber(res.silverGained)}\` Bạc\n` +
        (res.helperName ? `• *Trợ Thủ Sinh Hoạt [${res.helperName}] tăng thêm +30% sản lượng!*\n` : '') +
        (res.leveledUp ? `\n🎉 **Chúc mừng đạo hữu đã đột phá thăng cấp!**` : '') +
        (res.breakthroughReady ? `\n⚡ **Linh lực đã đạt đỉnh phong! Hãy dùng \`/break\` ngay!**` : ''),
        player.realm_id
      );

      return interaction.reply({ embeds: [embed] });
    }

    // 2. Nâng cấp Tụ Linh Trận
    if (sub === 'upgrade') {
      const levelsInput = interaction.options.getString('levels') || '1';
      const levels = /^all$/i.test(levelsInput) ? 'all' : Number(levelsInput);
      const res = await upgradeTuLinhTran(userId, levels);
      if (!res.success) {
        return replyOrEdit({
          embeds: [createErrorEmbed('Nâng Cấp Thất Bại', res.message)],
          ephemeral: true
        });
      }

      return replyOrEdit({
        embeds: [createSuccessEmbed('Tụ Linh Trận Thăng Cấp', res.message, player.realm_id)]
      });
    }

    // 3. Dược Viên
    if (sub === 'garden') {
      const dongPhu = await getDongPhu(userId);
      const garden = JSON.parse(dongPhu.garden_data || '[]');
      const now = Date.now();

      let gardenStatus = garden.length === 0 
        ? '*Dược viên hiện đang để trống, chưa gieo trồng.*' 
        : garden.map((p, idx) => {
            const isReady = now >= p.readyAt;
            const remainingMins = Math.max(0, Math.ceil((p.readyAt - now) / 60000));
            return `**Ô ${idx + 1}:** ${p.herbName} - ${isReady ? '✅ **ĐÃ CHÍN (Sẵn sàng thu hoạch)**' : `⏳ Đang lớn (còn ${remainingMins} phút)`}`;
          }).join('\n');

      const embed = createTuTienEmbed(player.realm_id)
        .setTitle('🌿 Dược Viên Động Phủ')
        .setDescription(
          `Dược Viên là nơi trồng linh thảo quý giá để làm nguyên liệu luyện đan đột phá!\n` +
          `• **Sức chứa:** ${garden.length}/${dongPhu.garden_slots} Ô đất\n\n` +
          `🌱 **Trạng Thái Các Ô Đất:**\n${gardenStatus}`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_harvest_garden')
          .setLabel('Thu Hoạch Tất Cả')
          .setEmoji('🌾')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('btn_plant_seed')
          .setLabel('Gieo Trồng Hạt Giống')
          .setEmoji('🌱')
          .setStyle(ButtonStyle.Primary)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row] });
      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      onComponentCollect(collector, async i => {
        if (i.customId === 'btn_harvest_garden') {
          collector.stop();
          await runComponentAction(
            i,
            async () => {
              const harvestRes = await harvestGarden(userId);
              return {
                embeds: [harvestRes.success
                  ? createSuccessEmbed('Thu Hoạch Hoàn Tất', harvestRes.message, player.realm_id)
                  : createErrorEmbed('Thu Hoạch Thất Bại', harvestRes.message)],
                components: []
              };
            },
            () => ({
              embeds: [createErrorEmbed('Thu Hoạch Thất Bại', 'Không thể thu hoạch Dược Viên lúc này. Vui lòng kiểm tra trạng thái vườn trước khi thử lại.')],
              components: []
            }),
            'thu hoạch Dược Viên'
          );
          return;
        }

        if (i.customId === 'btn_plant_seed') {
          // Menu chọn hạt giống
          const seedMenu = new StringSelectMenuBuilder()
            .setCustomId('select_seed_plant')
            .setPlaceholder('Chọn loại hạt giống cần gieo trồng...')
            .addOptions(
              Object.entries(SEEDS).map(([k, s]) => ({
                label: s.name,
                description: `Thời gian lớn: ${s.growMinutes} phút -> Cho ra ${s.herbName}`,
                value: k
              }))
            );
          const seedRow = new ActionRowBuilder().addComponents(seedMenu);
          return i.update({ content: 'Hãy chọn hạt giống muốn gieo:', components: [seedRow] });
        }

        if (i.customId === 'select_seed_plant') {
          collector.stop();
          const selectedSeed = i.values[0];
          await runComponentAction(
            i,
            async () => {
              const plantRes = await plantSeed(userId, selectedSeed);
              return {
                content: null,
                embeds: [plantRes.success
                  ? createSuccessEmbed('Gieo Trồng Thành Công', plantRes.message, player.realm_id)
                  : createErrorEmbed('Gieo Trồng Thất Bại', plantRes.message)],
                components: []
              };
            },
            () => ({
              embeds: [createErrorEmbed('Gieo Trồng Thất Bại', 'Không thể gieo hạt lúc này. Vui lòng kiểm tra lại Động Phủ trước khi thử lại.')],
              components: []
            }),
            'gieo trồng hạt giống'
          );
        }
      }, 'Dược Viên');
      return;
    }

    // 4. Luyện Đan
    if (sub === 'brew') {
      const helper = await getEquippedHelper(userId);
      const isLifeHelper = helper && helper.type === 'life';

      const embed = createTuTienEmbed(player.realm_id)
        .setTitle('🔥 Lò Luyện Đan Động Phủ')
        .setDescription(
          `Hãy chọn bài thuốc muốn luyện chế:\n` +
          (isLifeHelper ? `✨ *Trợ Thủ Sinh Hoạt [${helper.name}] tăng thêm +15% tỷ lệ thành công!*\n\n` : '\n') +
          Object.entries(PILL_RECIPES).map(([k, r]) => 
            `• **${r.name}**\n` +
            `  *Công dụng:* ${r.desc}\n` +
            `  *Cần:* ${Object.entries(r.requiredHerbs).map(([h, q]) => `${q}x ${h}`).join(', ')} + ${r.silverCost.toLocaleString()} Bạc`
          ).join('\n\n')
        );

      const menu = new StringSelectMenuBuilder()
        .setCustomId('select_pill_recipe')
        .setPlaceholder('Chọn đan dược muốn luyện...')
        .addOptions(
          Object.entries(PILL_RECIPES).map(([k, r]) => ({
            label: r.name,
            description: r.desc.substring(0, 100),
            value: k
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);
      const msg = await interaction.reply({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      onComponentCollect(collector, async i => {
        if (i.customId === 'select_pill_recipe') {
          collector.stop();
          const recipeKey = i.values[0];
          await runComponentAction(
            i,
            async () => {
              const res = await refinePill(userId, recipeKey);
              return {
                embeds: [res.success
                  ? createSuccessEmbed('Luyện Đan Thành Công', res.message, player.realm_id)
                  : createErrorEmbed('Luyện Đan Thất Bại', res.message)],
                components: []
              };
            },
            () => ({
              embeds: [createErrorEmbed('Luyện Đan Thất Bại', 'Không thể luyện đan lúc này. Vui lòng kiểm tra lại nguyên liệu và Ngân Lượng trước khi thử lại.')],
              components: []
            }),
            'luyện đan'
          );
        }
      }, 'luyện đan');
      return;
    }

    // 5. Lò Rèn
    if (sub === 'forge') {
      const res = await forgeWeapon(userId);
      if (!res.success) {
        return interaction.reply({
          embeds: [createErrorEmbed('Rèn Thất Bại', res.message)],
          ephemeral: true
        });
      }

      return interaction.reply({
        embeds: [createSuccessEmbed('Rèn Khí Thành Công', res.message, player.realm_id)]
      });
    }
  }
};
