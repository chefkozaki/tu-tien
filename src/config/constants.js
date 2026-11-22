// ==========================================
// CẤU HÌNH HỆ THỐNG TU TIÊN
// ==========================================

// 1. Hệ Thống 9 Đại Cảnh Giới
// Linh Sĩ - Linh Úy - Linh Tá - Linh Tướng - Linh Vương - Linh Đế - Chúa Tể - Thần - Tối Thượng
const REALMS = [
  {
    id: 0,
    name: 'Linh Sĩ',
    title: 'Linh Sĩ',
    minXp: 100,
    maxXp: 1000,
    color: '#95a5a6', // Xám Bạc (Phàm)
    breakthrough: {
      spiritGoldQuality: 'Phàm',
      spiritGoldAmount: 10,
      extraDesc: '10 Linh Kim (Phẩm chất Phàm)',
      type: 'item_only'
    }
  },
  {
    id: 1,
    name: 'Linh Úy',
    title: 'Linh Úy',
    minXp: 5000,
    maxXp: 50000,
    color: '#2ecc71', // Xanh Lục (Tinh)
    breakthrough: {
      spiritGoldQuality: 'Tinh',
      spiritGoldAmount: 30,
      pillRequired: 'TrucCoDan',
      pillAmount: 1,
      pillName: 'Trúc Cơ Đan',
      extraDesc: '30 Linh Kim (Phẩm chất Tinh) + 1 Trúc Cơ Đan',
      type: 'item_pill'
    }
  },
  {
    id: 2,
    name: 'Linh Tá',
    title: 'Linh Tá',
    minXp: 200000,
    maxXp: 2000000,
    color: '#3498db', // Xanh Lam (Linh)
    breakthrough: {
      spiritGoldQuality: 'Linh',
      spiritGoldAmount: 100,
      extraDesc: '100 Linh Kim (Phẩm chất Linh) + Vượt Ải Tâm Ma',
      type: 'tam_ma' // Thử thách Tâm Ma
    }
  },
  {
    id: 3,
    name: 'Linh Tướng',
    title: 'Linh Tướng',
    minXp: 10000000,
    maxXp: 100000000,
    color: '#9b59b6', // Tím (Địa)
    breakthrough: {
      spiritGoldQuality: 'Địa',
      spiritGoldAmount: 300,
      weaponTierRequired: 3, // Cần 1 Linh Khí bậc Tướng (Tier >= 3)
      extraDesc: '300 Linh Kim (Phẩm chất Địa) + 1 Linh Khí bậc Tướng',
      type: 'weapon_check'
    }
  },
  {
    id: 4,
    name: 'Linh Vương',
    title: 'Linh Vương',
    minXp: 500000000,
    maxXp: 5000000000,
    color: '#f39c12', // Vàng Cam (Thiên)
    breakthrough: {
      spiritGoldQuality: 'Thiên',
      spiritGoldAmount: 1000,
      lightningCount: 3,
      extraDesc: '1.000 Linh Kim (Phẩm chất Thiên) + Độ Kiếp (3 đạo Lôi Kiếp)',
      type: 'loi_kiep'
    }
  },
  {
    id: 5,
    name: 'Linh Đế',
    title: 'Linh Đế',
    minXp: 30000000000,
    maxXp: 300000000000,
    color: '#e74c3c', // Đỏ Thánh (Thánh)
    breakthrough: {
      spiritGoldQuality: 'Thánh',
      spiritGoldAmount: 5000,
      lightningCount: 6,
      extraDesc: '5.000 Linh Kim (Phẩm chất Thánh) + Độ Kiếp (6 đạo Lôi Kiếp)',
      type: 'loi_kiep'
    }
  },
  {
    id: 6,
    name: 'Chúa Tể',
    title: 'Chúa Tể',
    minXp: 2000000000000,
    maxXp: 20000000000000,
    color: '#8e44ad', // Tím Thần Bí (Thần)
    breakthrough: {
      spiritGoldQuality: 'Thần',
      spiritGoldAmount: 20000,
      extraDesc: '20.000 Linh Kim (Phẩm chất Thần) + Lĩnh Ngộ Quy Tắc',
      type: 'quy_tac' // Lĩnh Ngộ Quy Tắc vũ trụ
    }
  },
  {
    id: 7,
    name: 'Thần',
    title: 'Thần',
    minXp: 150000000000000,
    maxXp: 1500000000000000,
    color: '#e056fd', // Hồng Tím Thần Tộc (Hỗn Độn)
    breakthrough: {
      spiritGoldQuality: 'Hỗn Độn',
      spiritGoldAmount: 100000,
      lightningCount: 9,
      extraDesc: '100.000 Linh Kim (Hỗn Độn) + Độ Kiếp (9 đạo Tử Tiêu Thần Lôi)',
      type: 'tu_tieu_loi'
    }
  },
  {
    id: 8,
    name: 'Tối Thượng',
    title: 'Tối Thượng',
    minXp: 0,
    maxXp: Infinity,
    color: '#ffd700', // Vàng Kim Tối Thượng
    breakthrough: {
      extraDesc: 'Đỉnh cao thế giới, tích lũy vô hạn, mở khóa bảng xếp hạng Thần Điện',
      type: 'ultimate'
    }
  }
];

// Phân cấp trong mỗi cảnh giới (1 - 10)
const LEVEL_SUB_TITLES = {
  1: 'Hạ Cấp',
  2: 'Hạ Cấp',
  3: 'Hạ Cấp',
  4: 'Trung Cấp',
  5: 'Trung Cấp',
  6: 'Trung Cấp',
  7: 'Thượng Cấp',
  8: 'Thượng Cấp',
  9: 'Thượng Cấp',
  10: 'Đỉnh Cấp'
};

// 2. Hệ Thống 6 Chủng Tộc
const RACES = {
  nhan_toc: {
    id: 'nhan_toc',
    name: 'Nhân Tộc',
    icon: '🧘',
    desc: 'Cân bằng & Ngộ tính cao vô thượng giữa trời đất.',
    passive: {
      name: 'Vạn Linh Chi Trưởng',
      desc: '+15% Tốc độ hấp thụ Linh Lực (XP) từ mọi nguồn.',
      xpBonus: 0.15
    },
    talent: {
      name: 'Ngộ Đạo Đột Phá',
      desc: 'Có thể trang bị thêm 1 ô Công Pháp / Kỹ Năng so với các tộc khác (4 ô kỹ năng).',
      extraSkillSlot: 1
    },
    baseStats: { hp: 1000, atk: 120, def: 80, speed: 100, crit: 0.05, critDmg: 1.5 }
  },
  long_toc: {
    id: 'long_toc',
    name: 'Long Tộc',
    icon: '🐉',
    desc: 'Bá đạo & Sinh tồn, mang dòng máu Chân Long cái thế.',
    passive: {
      name: 'Chân Long Chi Thể',
      desc: '+25% Sinh lực (HP) tối đa và +15% Kháng sát thương vật lý.',
      hpBonus: 0.25,
      physResist: 0.15
    },
    talent: {
      name: 'Long Uy',
      desc: 'Khi máu dưới 30%, tăng 40% sát thương gây ra và miễn nhiễm khống chế trong 5 lượt.',
      triggerHpPercent: 0.30,
      damageBoost: 0.40,
      ccImmuneTurns: 5
    },
    baseStats: { hp: 1350, atk: 130, def: 95, speed: 95, crit: 0.05, critDmg: 1.5 }
  },
  tien_toc: {
    id: 'tien_toc',
    name: 'Tiên Tộc',
    icon: '✨',
    desc: 'Pháp thuật & Tốc độ, thân thể thanh khiết hòa cùng thiên địa.',
    passive: {
      name: 'Tiên Khí Hộ Thể',
      desc: '+20% Sát thương phép thuật và +10% Tốc độ ra đòn / Giảm hồi chiêu.',
      magicDmgBonus: 0.20,
      speedBonus: 0.10
    },
    talent: {
      name: 'Vãng Sinh Tiên Pháp',
      desc: 'Đòn đánh và kỹ năng có 30% tỷ lệ hồi phục Linh lực tiêu hao và giải trừ hiệu ứng bất lợi.',
      purifyChance: 0.30
    },
    baseStats: { hp: 950, atk: 140, def: 75, speed: 115, crit: 0.08, critDmg: 1.6 }
  },
  ma_toc: {
    id: 'ma_toc',
    name: 'Ma Tộc',
    icon: '😈',
    desc: 'Bạo kích & Hút máu, ma đạo khát máu tung hoành tam giới.',
    passive: {
      name: 'Huyết Ma Quyết',
      desc: '+15% Tỷ lệ bạo kích và +10% Hút máu khi tấn công.',
      critBonus: 0.15,
      lifesteal: 0.10
    },
    talent: {
      name: 'Ma Khí Thôn Phệ',
      desc: 'Hạ gục kẻ địch sẽ hấp thụ Ma Khí, tăng vĩnh viễn +10% sát thương trong trận (cộng dồn tối đa 5 tầng = +50%).',
      stackPerKill: 0.10,
      maxStacks: 5
    },
    baseStats: { hp: 1050, atk: 135, def: 75, speed: 105, crit: 0.20, critDmg: 1.65 }
  },
  ro_toc: {
    id: 'ro_toc',
    name: 'Rợ Tộc',
    icon: '🪓',
    desc: 'Sức mạnh thuần túy & Kháng hiệu ứng, cuồng nộ bất khuất.',
    passive: {
      name: 'Man Hoang Chi Lực',
      desc: '+25% Tấn công vật lý và +30% Kháng hiệu ứng khống chế (choáng, trói).',
      atkBonus: 0.25,
      ccResist: 0.30
    },
    talent: {
      name: 'Cuồng Chiến Thần Uy',
      desc: 'Càng mất nhiều máu, tốc độ đánh và sát thương càng tăng (tối đa +50% khi còn 10% máu).',
      maxBerserkDmg: 0.50
    },
    baseStats: { hp: 1200, atk: 145, def: 85, speed: 90, crit: 0.05, critDmg: 1.5 }
  },
  ke_do_bo: {
    id: 'ke_do_bo',
    name: 'Kẻ Đổ Bộ',
    icon: '🛸',
    desc: 'Dị giới & Công nghệ / Quy tắc lạ, mang tri thức vượt ngoài tầm hiểu biết.',
    passive: {
      name: 'Khu Trục Quy Tắc',
      desc: 'Không bị ảnh hưởng bởi hiệu ứng giảm chỉ số môi trường ở bí cảnh, và +20% tỷ lệ rơi vật phẩm hiếm.',
      rareDropBonus: 0.20,
      envImmunity: true
    },
    talent: {
      name: 'Phân Tích & Giải Mã',
      desc: 'Có khả năng phân tích sao chép 1 kỹ năng bị động của đối thủ hoặc đòn đánh gây sát thương chuẩn (bỏ qua giáp).',
      trueDamage: true
    },
    baseStats: { hp: 1050, atk: 125, def: 80, speed: 110, crit: 0.10, critDmg: 1.55 }
  }
};

// 3. Hệ Thống Linh Căn
const SPIRIT_ROOTS = {
  kim: { name: 'Kim Linh Căn', element: 'Kim', icon: '⚔️', bonusDesc: '+10% Xuyên Giáp Vật Lý', counters: 'Mộc' },
  moc: { name: 'Mộc Linh Căn', element: 'Mộc', icon: '🌿', bonusDesc: '+10% Tự Hồi Phục Máu Mỗi Lượt', counters: 'Thổ' },
  thuy: { name: 'Thủy Linh Căn', element: 'Thủy', icon: '💧', bonusDesc: '+10% Hóa Giải Sát Thương', counters: 'Hỏa' },
  hoa: { name: 'Hỏa Linh Căn', element: 'Hỏa', icon: '🔥', bonusDesc: '+15% Sát Thương Bạo Kích', counters: 'Kim' },
  tho: { name: 'Thổ Linh Căn', element: 'Thổ', icon: '🛡️', bonusDesc: '+15% Phòng Thủ Toàn Phần', counters: 'Thủy' },
  loi: { name: 'Lôi Linh Căn', element: 'Lôi', icon: '⚡', bonusDesc: '+15% Tỷ Lệ Làm Choáng & Bạo Kích', counters: 'Phong' },
  phong: { name: 'Phong Linh Căn', element: 'Phong', icon: '🌪️', bonusDesc: '+15% Tốc Độ Xuất Chiêu & Né Tránh', counters: 'Thổ' },
  bang: { name: 'Băng Linh Căn', element: 'Băng', icon: '❄️', bonusDesc: '+12% Đóng Băng & Giảm Tốc Đối Thủ', counters: 'Hỏa' }
};

// 4. Phẩm Chất Linh Kim (Dùng Đột Phá)
const SPIRIT_GOLD_QUALITIES = [
  { id: 'Phàm', name: 'Linh Kim (Phẩm Phàm)', realmTarget: 'Linh Sĩ -> Linh Úy', price: 50 },
  { id: 'Tinh', name: 'Linh Kim (Phẩm Tinh)', realmTarget: 'Linh Úy -> Linh Tá', price: 200 },
  { id: 'Linh', name: 'Linh Kim (Phẩm Linh)', realmTarget: 'Linh Tá -> Linh Tướng', price: 1000 },
  { id: 'Địa', name: 'Linh Kim (Phẩm Địa)', realmTarget: 'Linh Tướng -> Linh Vương', price: 5000 },
  { id: 'Thiên', name: 'Linh Kim (Phẩm Thiên)', realmTarget: 'Linh Vương -> Linh Đế', price: 25000 },
  { id: 'Thánh', name: 'Linh Kim (Phẩm Thánh)', realmTarget: 'Linh Đế -> Chúa Tể', price: 120000 },
  { id: 'Thần', name: 'Linh Kim (Phẩm Thần)', realmTarget: 'Chúa Tể -> Thần', price: 600000 },
  { id: 'Hỗn Độn', name: 'Linh Kim (Hỗn Độn)', realmTarget: 'Thần -> Tối Thượng', price: 3000000 }
];

const SPIRIT_GOLD_CONVERT_CHOICES = SPIRIT_GOLD_QUALITIES.slice(0, -1).map((q, idx) => {
  const nextQ = SPIRIT_GOLD_QUALITIES[idx + 1];
  return {
    name: `${q.id} ➔ ${nextQ.id} (100 ${q.id} = 1 ${nextQ.id})`,
    value: q.id
  };
});

const SPIRIT_GOLD_DOWNGRADE_CHOICES = SPIRIT_GOLD_QUALITIES.slice(1).map((q, idx) => {
  const prevQ = SPIRIT_GOLD_QUALITIES[idx];
  return {
    name: `${q.id} ➔ ${prevQ.id} (1 ${q.id} = 10 ${prevQ.id})`,
    value: q.id
  };
});

// 5. Trận Pháp Linh Thú (Cộng Hưởng)
const PET_RESONANCES = {
  same_element_3: {
    name: 'Tam Tài Ngũ Hành Trận',
    desc: '3 Linh thú cùng hệ: Tăng 35% Công và +15% Kháng vật lý.',
    buff: {
      atkMultiplier: 1.35,
      hpMultiplier: 1,
      defMultiplier: 1,
      speedMultiplier: 1,
      critBonus: 0,
      physResistBonus: 0.15,
      hpRegenTurn: 0
    }
  }
};

// 6. Tàng Kinh Các • Hệ Thống Công Pháp & Thần Thông
const SKILL_TIERS = {
  1: { tier: 1, name: 'Phàm Giai', maxLevel: 5, salvageScrolls: 2, comprehendWeight: 38, buyPrice: 4000 },
  2: { tier: 2, name: 'Hoàng Giai', maxLevel: 5, salvageScrolls: 4, comprehendWeight: 28, buyPrice: 12000 },
  3: { tier: 3, name: 'Huyền Giai', maxLevel: 7, salvageScrolls: 8, comprehendWeight: 18, buyPrice: null },
  4: { tier: 4, name: 'Địa Giai', maxLevel: 7, salvageScrolls: 15, comprehendWeight: 10, buyPrice: null },
  5: { tier: 5, name: 'Thiên Giai', maxLevel: 10, salvageScrolls: 30, comprehendWeight: 4.5, buyPrice: null },
  6: { tier: 6, name: 'Tiên Giai', maxLevel: 10, salvageScrolls: 60, comprehendWeight: 1.5, buyPrice: null }
};

const SKILL_EFFECT_LABELS = {
  none: 'Không hiệu ứng phụ',
  burn: '🔥 Thiêu Đốt (gây thêm sát thương theo % máu địch trong 2 lượt)',
  stun: '⚡ Choáng / Khống Chế (làm choáng đối thủ 1 lượt)',
  armor_break: '💥 Phá Giáp (giảm 30% phòng thủ địch trong 2 lượt)',
  lifesteal: '🩸 Hút Huyết (hồi phục HP theo sát thương chiêu thức)',
  shield: '🛡️ Hộ Thuẫn (tạo lá chắn hấp thụ sát thương theo % Max HP)',
  true_dmg: '✨ Sát Thương Chuẩn (xuyên qua phòng thủ địch)',
  stat_hp: '❤️ Tâm Pháp Sinh Lực (+% HP tối đa)',
  stat_atk: '⚔️ Tâm Pháp Công Kích (+% Công)',
  stat_def: '🛡️ Tâm Pháp Hộ Thể (+% Thủ)',
  stat_crit: '🎯 Tâm Pháp Chí Mạng (+Tỷ lệ Bạo kích)',
  stat_lifesteal: '🩸 Tâm Pháp Huyết Ma (+Hút máu)',
  stat_dmg_reduction: '🧱 Tâm Pháp Kim Thân (+Giảm ST nhận vào)',
  stat_regen: '🌿 Tâm Pháp Hồi Nguyên (+Hồi % HP mỗi lượt)'
};

const SKILL_CATALOG = [
  // === TIER 1 (PHÀM GIAI — Có thể mua trực tiếp tại Tàng Kinh Các) ===
  { key: 'kim_quang_kiem', name: 'Kim Quang Kiếm Quyết', type: 'active', element: 'Kim', tier: 1, damage_mult: 1.35, effect_type: 'armor_break', effect_value: 0.20, cooldown: 2, desc: 'Phóng kiếm khí hệ Kim sắc bén, phá nhẹ phòng ngự địch.' },
  { key: 'hoa_cau_thuat', name: 'Liệt Hỏa Phần Tâm Chưởng', type: 'active', element: 'Hỏa', tier: 1, damage_mult: 1.35, effect_type: 'burn', effect_value: 0.04, cooldown: 2, desc: 'Chưởng lực hỏa diễm gây thiêu đốt kẻ địch trong 2 lượt.' },
  { key: 'thanh_moc_quyet', name: 'Thanh Mộc Trường Xuân Công', type: 'passive', element: 'Mộc', tier: 1, damage_mult: 1.0, effect_type: 'stat_regen', effect_value: 0.03, cooldown: 0, desc: 'Tâm pháp hệ Mộc giúp tự hồi phục 3% Max HP mỗi lượt.' },
  { key: 'hau_tho_ho_the', name: 'Hậu Thổ Hộ Thể Quyết', type: 'passive', element: 'Thổ', tier: 1, damage_mult: 1.0, effect_type: 'stat_def', effect_value: 0.12, cooldown: 0, desc: 'Nội công hệ Thổ gia tăng 12% Phòng Thủ toàn phần.' },

  // === TIER 2 (HOÀNG GIAI — Có thể mua trực tiếp tại Tàng Kinh Các) ===
  { key: 'han_bang_chuong', name: 'Hàn Băng Phá Mạch Chưởng', type: 'active', element: 'Băng', tier: 2, damage_mult: 1.50, effect_type: 'stun', effect_value: 0.25, cooldown: 2, desc: 'Chưởng khí băng hàn có 25% tỷ lệ đóng băng làm choáng đối thủ 1 lượt.' },
  { key: 'thuy_mac_ho_thuan', name: 'Thủy Mạc Lưu Ly Thuẫn', type: 'active', element: 'Thủy', tier: 2, damage_mult: 1.40, effect_type: 'shield', effect_value: 0.12, cooldown: 2, desc: 'Vừa đánh vừa tạo khiên nước hấp thụ 12% Max HP sát thương.' },
  { key: 'cuong_phong_bo', name: 'Tật Phong Liệt Ảnh Quyết', type: 'passive', element: 'Phong', tier: 2, damage_mult: 1.0, effect_type: 'stat_crit', effect_value: 0.08, cooldown: 0, desc: 'Tâm pháp hệ Phong tăng 8% tỷ lệ Bạo Kích.' },
  { key: 'huyet_sat_tam_kinh', name: 'Huyết Sát Tâm Kinh', type: 'passive', element: 'Hỏa', tier: 2, damage_mult: 1.0, effect_type: 'stat_lifesteal', effect_value: 0.06, cooldown: 0, desc: 'Nội công ma đạo giúp tăng thêm 6% Hút Máu.' },

  // === TIER 3 (HUYỀN GIAI — Lĩnh Ngộ / Tháp / Boss) ===
  { key: 'loi_dinh_khu_ma', name: 'Lôi Đình Khu Ma Chỉ', type: 'active', element: 'Lôi', tier: 3, damage_mult: 1.75, effect_type: 'stun', effect_value: 0.35, cooldown: 2, desc: 'Chỉ pháp lôi điện uy mãnh, 35% tỷ lệ gây tê liệt làm choáng 1 lượt.' },
  { key: 'huyet_ma_tram', name: 'Huyết Ma Đoạt Hồn Trảm', type: 'active', element: 'Hỏa', tier: 3, damage_mult: 1.70, effect_type: 'lifesteal', effect_value: 0.25, cooldown: 2, desc: 'Đao khí huyết sát hồi phục 25% sát thương gây ra thành Sinh Lực.' },
  { key: 'thai_co_luyen_the', name: 'Thái Cổ Luyện Thể Quyết', type: 'passive', element: 'Thổ', tier: 3, damage_mult: 1.0, effect_type: 'stat_hp', effect_value: 0.18, cooldown: 0, desc: 'Rèn luyện nhục thân cường hãn, tăng vĩnh viễn 18% HP tối đa.' },
  { key: 'pha_thien_chien_y', name: 'Phá Thiên Chiến Ý Quyết', type: 'passive', element: 'Kim', tier: 3, damage_mult: 1.0, effect_type: 'stat_atk', effect_value: 0.16, cooldown: 0, desc: 'Tâm pháp chiến ý tăng vĩnh viễn 16% Công Kích.' },

  // === TIER 4 (ĐỊA GIAI) ===
  { key: 'van_kiem_quy_tong', name: 'Vạn Kiếm Quy Tông', type: 'active', element: 'Kim', tier: 4, damage_mult: 2.05, effect_type: 'armor_break', effect_value: 0.30, cooldown: 3, desc: 'Ngưng tụ vạn thanh linh kiếm xuyên phá 30% phòng thủ địch trong 2 lượt.' },
  { key: 'phuong_hoang_niet_ban_hoa', name: 'Phượng Hoàng Niết Bàn Hỏa', type: 'active', element: 'Hỏa', tier: 4, damage_mult: 2.00, effect_type: 'burn', effect_value: 0.06, cooldown: 3, desc: 'Chân hỏa Phượng Hoàng thiêu đốt 6% máu địch mỗi lượt trong 2 lượt.' },
  { key: 'cuc_han_bang_vuc', name: 'Cực Hàn Băng Vực', type: 'active', element: 'Băng', tier: 4, damage_mult: 1.95, effect_type: 'shield', effect_value: 0.18, cooldown: 3, desc: 'Triệu hồi lĩnh vực băng sương gây sát thương và tạo khiên 18% Max HP.' },
  { key: 'bat_diet_kim_than', name: 'Bất Diệt Kim Thân Biến', type: 'passive', element: 'Kim', tier: 4, damage_mult: 1.0, effect_type: 'stat_dmg_reduction', effect_value: 0.10, cooldown: 0, desc: 'Nội công phòng ngự thượng thừa, vĩnh viễn giảm 10% sát thương nhận vào.' },

  // === TIER 5 (THIÊN GIAI) ===
  { key: 'cuu_thien_than_loi', name: 'Cửu Thiên Thần Lôi Quyết', type: 'active', element: 'Lôi', tier: 5, damage_mult: 2.45, effect_type: 'stun', effect_value: 0.45, cooldown: 3, desc: 'Triệu hồi Cửu Trùng Thần Lôi, sát thương cực đại kèm 45% làm choáng.' },
  { key: 'tru_tien_kiem_tran', name: 'Tru Tiên Tứ Kiếm Trận', type: 'active', element: 'Phong', tier: 5, damage_mult: 2.40, effect_type: 'true_dmg', effect_value: 1.0, cooldown: 3, desc: 'Kiếm trận thượng cổ gây sát thương chuẩn xuyên qua toàn bộ phòng ngự địch.' },
  { key: 'thai_so_truong_sinh_kinh', name: 'Thái Sơ Trường Sinh Kinh', type: 'passive', element: 'Mộc', tier: 5, damage_mult: 1.0, effect_type: 'stat_regen', effect_value: 0.06, cooldown: 0, desc: 'Tiên kinh sinh mệnh tự động hồi phục 6% Max HP mỗi lượt giao tranh.' },
  { key: 'ma_than_huyet_hai', name: 'Ma Thần Huyết Hải Quyết', type: 'passive', element: 'Hỏa', tier: 5, damage_mult: 1.0, effect_type: 'stat_atk', effect_value: 0.24, cooldown: 0, desc: 'Tâm pháp chí tôn gia tăng 24% Công Kích toàn diện.' },

  // === TIER 6 (TIÊN GIAI) ===
  { key: 'hon_don_khai_thien', name: 'Hỗn Độn Khai Thiên Kình', type: 'active', element: 'Lôi', tier: 6, damage_mult: 2.95, effect_type: 'true_dmg', effect_value: 1.0, cooldown: 3, desc: 'Tuyệt kỹ chí tôn khai thiên lập địa, gây sát thương chuẩn hủy thiên diệt địa.' },
  { key: 'van_co_bat_hoai_than', name: 'Vạn Cổ Bất Hoại Thần Công', type: 'passive', element: 'Thổ', tier: 6, damage_mult: 1.0, effect_type: 'stat_dmg_reduction', effect_value: 0.15, cooldown: 0, desc: 'Tiên giai hộ thể thần công, vĩnh viễn giảm 15% mọi sát thương nhận vào.' }
];

module.exports = {
  REALMS,
  LEVEL_SUB_TITLES,
  RACES,
  SPIRIT_ROOTS,
  SPIRIT_GOLD_QUALITIES,
  SPIRIT_GOLD_CONVERT_CHOICES,
  SPIRIT_GOLD_DOWNGRADE_CHOICES,
  PET_RESONANCES,
  SKILL_TIERS,
  SKILL_EFFECT_LABELS,
  SKILL_CATALOG
};
