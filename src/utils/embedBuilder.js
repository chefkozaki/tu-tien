const { EmbedBuilder } = require('discord.js');
const { REALMS } = require('../config/constants');

/**
 * Tạo Embed Tu Tiên cơ bản với màu sắc theo cảnh giới
 */
function createTuTienEmbed(realmId = 0) {
  const realm = REALMS[realmId] || REALMS[0];
  const color = realm.color || '#3498db';

  return new EmbedBuilder()
    .setColor(color)
    .setTimestamp();
}

/**
 * Embed Thông báo Lỗi
 */
function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor('#e74c3c')
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Embed Thông báo Thành công
 */
function createSuccessEmbed(title, description, realmId = 0) {
  const realm = REALMS[realmId] || REALMS[0];
  return new EmbedBuilder()
    .setColor(realm.color || '#2ecc71')
    .setTitle(`✨ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

module.exports = {
  createTuTienEmbed,
  createErrorEmbed,
  createSuccessEmbed
};
