const { REALMS, LEVEL_SUB_TITLES } = require('../config/constants');

/**
 * Định dạng số lớn (K, M, B, T, Q)
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  const n = typeof num === 'bigint' ? Number(num) : Number(num);

  if (isNaN(n)) return '0';
  if (n === Infinity) return 'Vô Hạn';

  const abs = Math.abs(n);
  if (abs >= 1e15) {
    return (n / 1e15).toFixed(2).replace(/\.00$/, '') + 'Q (Triệu Tỷ)';
  }
  if (abs >= 1e12) {
    return (n / 1e12).toFixed(2).replace(/\.00$/, '') + 'T (Nghìn Tỷ)';
  }
  if (abs >= 1e9) {
    return (n / 1e9).toFixed(2).replace(/\.00$/, '') + 'B (Tỷ)';
  }
  if (abs >= 1e6) {
    return (n / 1e6).toFixed(2).replace(/\.00$/, '') + 'M (Triệu)';
  }
  if (abs >= 1e3) {
    return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return n.toLocaleString('vi-VN');
}

/**
 * Tính lượng Linh Lực (XP) cần để lên cấp tiếp theo trong cảnh giới
 * Formula: minXp + (level - 1) * (maxXp - minXp) / 9
 */
function getXpRequired(realmId, level) {
  const realm = REALMS[realmId] || REALMS[0];
  if (realm.id === 8) {
    // Tối Thượng cảnh giới: Tích luỹ vô hạn, mỗi mốc 10.000T
    return 10000000000000000;
  }
  if (level >= 10) {
    return realm.maxXp;
  }
  const min = realm.minXp;
  const max = realm.maxXp;
  return Math.floor(min + ((level - 1) * (max - min)) / 9);
}

/**
 * Lấy tên đầy đủ của Cảnh Giới + Cấp
 * Ví dụ: Linh Sĩ Hạ Cấp (Cấp 1), Linh Tướng Trung Cấp (Cấp 5), Tối Thượng
 */
function getRealmDisplay(realmId, level = 1) {
  const realm = REALMS[realmId] || REALMS[0];
  if (realm.id === 8) {
    return '🌟 Tối Thượng';
  }
  const subTitle = LEVEL_SUB_TITLES[level] || 'Hạ Cấp';
  return `${realm.name} ${subTitle} (Cấp ${level})`;
}

/**
 * Tạo thanh tiến trình (Progress Bar)
 */
function createProgressBar(current, max, length = 10) {
  if (max === Infinity || max <= 0) {
    return '`[██████████]` 100%';
  }
  const ratio = Math.min(Math.max(current / max, 0), 1);
  const filledLength = Math.round(length * ratio);
  const emptyLength = length - filledLength;
  const percent = Math.floor(ratio * 100);

  const filledBar = '█'.repeat(filledLength);
  const emptyBar = '░'.repeat(emptyLength);

  return `\`[${filledBar}${emptyBar}]\` ${percent}%`;
}

module.exports = {
  formatNumber,
  getXpRequired,
  getRealmDisplay,
  createProgressBar
};
