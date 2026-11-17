const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { createTuTienEmbed } = require('./embedBuilder');
const { onComponentCollect } = require('./componentAction');

const EMBED_DESCRIPTION_PAGE_SIZE = 3500;

function splitTextIntoPages(text, pageSize = EMBED_DESCRIPTION_PAGE_SIZE) {
  const maxLength = Math.max(1, Math.min(pageSize, EMBED_DESCRIPTION_PAGE_SIZE));
  const pages = [];
  let page = '';

  for (const paragraph of String(text || '').split('\n\n')) {
    let remaining = paragraph;
    while (remaining.length > maxLength) {
      if (page) {
        pages.push(page);
        page = '';
      }

      let splitAt = remaining.lastIndexOf('\n', maxLength - 1);
      if (splitAt < maxLength * 0.6) splitAt = maxLength;
      if (
        splitAt < remaining.length &&
        splitAt > 0 &&
        remaining.charCodeAt(splitAt - 1) >= 0xD800 &&
        remaining.charCodeAt(splitAt - 1) <= 0xDBFF &&
        remaining.charCodeAt(splitAt) >= 0xDC00 &&
        remaining.charCodeAt(splitAt) <= 0xDFFF
      ) {
        splitAt--;
      }
      const nextStart = remaining[splitAt] === '\n' ? splitAt + 1 : splitAt;
      pages.push(remaining.slice(0, nextStart));
      remaining = remaining.slice(nextStart);
    }

    const separator = page ? '\n\n' : '';
    if (page.length + separator.length + remaining.length > maxLength) {
      if (page) pages.push(page);
      page = remaining;
    } else {
      page += `${separator}${remaining}`;
    }
  }

  if (page || pages.length === 0) pages.push(page || '*Không có nội dung.*');
  return pages;
}

function createTextEmbedPages(text, { title, realmId = 0, footer = null, pageSize } = {}) {
  const descriptions = splitTextIntoPages(text, pageSize);
  return descriptions.map((description, index) => {
    const embed = createTuTienEmbed(realmId)
      .setTitle(String(title || 'Thông tin').slice(0, 256))
      .setDescription(description);
    const footerText = [
      footer,
      descriptions.length > 1 ? `Trang ${index + 1}/${descriptions.length}` : null
    ].filter(Boolean).join(' • ');
    if (footerText) embed.setFooter({ text: footerText.slice(0, 2048) });
    return embed;
  });
}

async function replyWithEmbedPages(interaction, embeds, { ephemeral = false, customIdPrefix = 'embed_page' } = {}) {
  if (!embeds.length) throw new Error('At least one embed page is required.');
  if (embeds.length === 1) {
    const payload = {
      embeds,
      ...(interaction.deferred || interaction.replied ? {} : { ephemeral })
    };
    return interaction.deferred || interaction.replied
      ? interaction.editReply(payload)
      : interaction.reply(payload);
  }

  let pageIndex = 0;
  const controls = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_previous`)
      .setLabel('Trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_next`)
      .setLabel('Tiếp')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(pageIndex === embeds.length - 1)
  );
  const payload = {
    embeds: [embeds[pageIndex]],
    components: [controls()],
    ...(interaction.deferred || interaction.replied ? {} : { ephemeral })
  };
  const message = interaction.deferred || interaction.replied
    ? await interaction.editReply(payload)
    : await interaction.reply(payload).then(() => interaction.fetchReply());

  const collector = message.createMessageComponentCollector({
    filter: component => component.user.id === interaction.user.id,
    time: 120000
  });
  onComponentCollect(collector, async component => {
    pageIndex += component.customId === `${customIdPrefix}_next` ? 1 : -1;
    pageIndex = Math.max(0, Math.min(pageIndex, embeds.length - 1));
    await component.update({
      embeds: [embeds[pageIndex]],
      components: [controls()]
    });
  }, `phân trang ${customIdPrefix}`);

  collector.on('end', () => {
    message.edit({ components: [] }).catch(error => {
      console.error(`Không thể dọn nút phân trang ${customIdPrefix}:`, error);
    });
  });
  return message;
}

module.exports = {
  splitTextIntoPages,
  createTextEmbedPages,
  replyWithEmbedPages
};
