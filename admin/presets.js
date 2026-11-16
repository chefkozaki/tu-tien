const { REALMS, RACES, SPIRIT_ROOTS, SPIRIT_GOLD_QUALITIES } = require('../src/config/constants');
const { PILL_RECIPES, SEEDS } = require('../src/services/dongPhuService');

// Danh mục vật phẩm có sẵn để ban phát nhanh
const ITEM_PRESETS = [
  // 1. Linh Kim 8 phẩm
  ...SPIRIT_GOLD_QUALITIES.map(g => ({
    category: 'Linh Kim',
    item_type: 'spirit_gold',
    item_key: g.id,
    item_name: `Linh Kim (Phẩm ${g.id})`,
    desc: `Dùng để đột phá cảnh giới (${g.realmTarget})`,
    defaultAmount: 50
  })),

  // 2. Đan Dược
  ...Object.entries(PILL_RECIPES).map(([key, pill]) => ({
    category: 'Đan Dược',
    item_type: 'pill',
    item_key: key,
    item_name: pill.name,
    desc: pill.desc,
    defaultAmount: 5
  })),
  {
    category: 'Đan Dược',
    item_type: 'pill',
    item_key: 'CuuChuyenHoanHonDan',
    item_name: 'Cửu Chuyển Hoàn Hồn Đan',
    desc: 'Thần đan nghịch chuyển càn khôn, cứu người chết sống lại, lập tức hồi đầy khí huyết',
    defaultAmount: 1
  },
  {
    category: 'Đan Dược',
    item_type: 'pill',
    item_key: 'ThaiAtChanDan',
    item_name: 'Thái Ất Chân Đan',
    desc: 'Tăng vĩnh viễn căn cơ và tăng 100,000 Linh Lực tức thì',
    defaultAmount: 2
  },

  // 3. Linh Thảo
  {
    category: 'Linh Thảo',
    item_type: 'herb',
    item_key: 'LinhThao',
    item_name: 'Linh Thảo',
    desc: 'Linh thảo sơ cấp phổ biến trong giới tu chân',
    defaultAmount: 50
  },
  {
    category: 'Linh Thảo',
    item_type: 'herb',
    item_key: 'TrucCoThao',
    item_name: 'Trúc Cơ Thảo',
    desc: 'Linh thảo chủ chốt để luyện chế Trúc Cơ Đan',
    defaultAmount: 30
  },
  {
    category: 'Linh Thảo',
    item_type: 'herb',
    item_key: 'ThienLinhThao',
    item_name: 'Thiên Linh Thảo',
    desc: 'Linh thảo cao cấp hấp thụ tinh hoa nhật nguyệt',
    defaultAmount: 20
  },
  {
    category: 'Linh Thảo',
    item_type: 'herb',
    item_key: 'CuuDiepChi',
    item_name: 'Cửu Diệp Chi Linh',
    desc: 'Tiên thảo ngàn năm hiếm có khó tìm',
    defaultAmount: 10
  },
  {
    category: 'Linh Thảo',
    item_type: 'herb',
    item_key: 'NganNguyetThao',
    item_name: 'Ngân Nguyệt Thảo',
    desc: 'Linh thảo phát sáng dưới ánh trăng, dùng tinh luyện đan dược',
    defaultAmount: 15
  },

  // 4. Hạt Giống
  ...Object.entries(SEEDS).map(([key, s]) => ({
    category: 'Hạt Giống',
    item_type: 'seed',
    item_key: key,
    item_name: s.name,
    desc: `Trồng tại Dược Viên, thu hoạch ${s.herbName} sau ${s.growMinutes} phút`,
    defaultAmount: 10
  })),

  // 5. Khoáng Thạch & Nguyên Liệu Rèn
  {
    category: 'Khoáng Thạch',
    item_type: 'material',
    item_key: 'HuyenThiet',
    item_name: 'Bách Luyện Huyền Thiết',
    desc: 'Khoáng thạch cứng rắn dùng để rèn đúc Linh Khí',
    defaultAmount: 20
  },
  {
    category: 'Khoáng Thạch',
    item_type: 'material',
    item_key: 'ThienNgoaiVanThiet',
    item_name: 'Thiên Ngoại Vẫn Thiết',
    desc: 'Thiên thạch rơi từ vũ trụ bao la, ẩn chứa linh lực khủng khiếp',
    defaultAmount: 10
  },
  {
    category: 'Khoáng Thạch',
    item_type: 'material',
    item_key: 'LongLanThach',
    item_name: 'Long Lân Thạch',
    desc: 'Đá kết tinh từ máu Chân Long thượng cổ',
    defaultAmount: 5
  },
  {
    category: 'Khoáng Thạch',
    item_type: 'material',
    item_key: 'ThaiCoThanThach',
    item_name: 'Thái Cổ Thần Thạch',
    desc: 'Thần thạch sinh ra từ thời hồng hoang hỗn độn',
    defaultAmount: 2
  }
];

// Danh mục Linh Thú có sẵn
const PET_PRESETS = [
  // Linh Thú Thượng Cổ
  {
    name: 'Cửu Vĩ Thiên Hồ',
    element: 'Hỏa',
    is_mythic: 0,
    star: 4,
    hp: 3200,
    atk: 620,
    def: 300,
    speed: 140,
    crit: 0.18,
    effect_desc: 'Mị hoặc thiên hạ: Giảm 25% công kích của đối phương trong 3 lượt đầu.'
  },
  {
    name: 'Côn Bằng Cổ Thú',
    element: 'Phong',
    is_mythic: 0,
    star: 4,
    hp: 3800,
    atk: 700,
    def: 380,
    speed: 190,
    crit: 0.15,
    effect_desc: 'Phù diêu cửu vạn dặm: Tăng cực đại tốc độ xuất chiêu và cơ hội né đòn.'
  },
  {
    name: 'Tử Tiêu Lôi Điểu',
    element: 'Lôi',
    is_mythic: 0,
    star: 3,
    hp: 2500,
    atk: 550,
    def: 250,
    speed: 155,
    crit: 0.22,
    effect_desc: 'Lôi đình vạn quân: Đòn đánh có 25% tỷ lệ làm tê liệt đối thủ.'
  },
  {
    name: 'Băng Sương Cự Long',
    element: 'Băng',
    is_mythic: 0,
    star: 3,
    hp: 2900,
    atk: 510,
    def: 360,
    speed: 125,
    crit: 0.10,
    effect_desc: 'Cực hàn lĩnh vực: Làm chậm tốc độ đối thủ và giảm 15% bạo kích của địch.'
  },
  {
    name: 'Hỏa Linh Điêu',
    element: 'Hỏa',
    is_mythic: 0,
    star: 1,
    hp: 400,
    atk: 60,
    def: 30,
    speed: 35,
    crit: 0.05,
    effect_desc: 'Linh thú sơ cấp đồng hành khởi đầu, tăng 5% sát thương Hỏa.'
  }
];

// Danh mục Linh Khí có sẵn
const WEAPON_PRESETS = [
  {
    name: 'Thanh Phong Kiếm (Phàm)',
    tier: 1,
    atk: 50,
    def: 20,
    effect_name: 'Kiếm Khí',
    effect_desc: 'Tăng 5% sát thương',
    is_natal: 1
  },
  {
    name: 'Xích Hỏa Đao (Tinh)',
    tier: 2,
    atk: 150,
    def: 70,
    effect_name: 'Hỏa Viêm',
    effect_desc: 'Đòn đánh kèm theo hiệu ứng thiêu đốt',
    is_natal: 0
  },
  {
    name: 'Huyền Thủy Trảm Long Thương (Linh)',
    tier: 3,
    atk: 320,
    def: 160,
    effect_name: 'Long Uy',
    effect_desc: 'Tăng 15% sát thương lên Linh Thú và Quái Bí Cảnh',
    is_natal: 0
  },
  {
    name: 'Càn Khôn Hỗn Nguyên Xích (Địa)',
    tier: 4,
    atk: 600,
    def: 300,
    effect_name: 'Càn Khôn Định Vị',
    effect_desc: 'Tăng 20% khả năng chống đỡ đòn chí mạng',
    is_natal: 0
  },
  {
    name: 'Hỗn Độn Chung (Thiên)',
    tier: 5,
    atk: 1200,
    def: 750,
    effect_name: 'Thần Chung Hộ Thể',
    effect_desc: 'Tạo lớp linh giáp hấp thụ 20% sát thương nhận vào',
    is_natal: 0
  },
  {
    name: 'Tru Tiên Cổ Kiếm (Thánh)',
    tier: 6,
    atk: 2800,
    def: 1200,
    effect_name: 'Tru Tiên Kiếm Khí',
    effect_desc: 'Tăng 40% sát thương bạo kích và bỏ qua 25% phòng thủ địch',
    is_natal: 1
  },
  {
    name: 'Hiên Viên Kiếm (Thần)',
    tier: 7,
    atk: 6500,
    def: 3000,
    effect_name: 'Thánh Đạo Thần Uy',
    effect_desc: 'Áp chế toàn bộ tà ma, tăng 60% sát thương lên mọi đối thủ',
    is_natal: 1
  },
  {
    name: 'Bàn Cổ Khai Thiên Phủ (Hỗn Độn)',
    tier: 7,
    atk: 15000,
    def: 8000,
    effect_name: 'Khai Thiên Tích Địa',
    effect_desc: 'Sát thương chuẩn phá tan mọi phòng ngự và kết giới',
    is_natal: 1
  }
];

// Danh mục Trợ Thủ có sẵn
const HELPER_PRESETS = [
  // Hộ Đạo Giả (Chiến đấu)
  {
    name: 'Cửu Kiếm Tôn Giả',
    type: 'combat',
    tier: 5,
    effect_desc: 'Khi chủ nhân vào trận, trợ thủ phóng xuất 9 luồng kiếm khí gây 150% sát thương diện rộng và tạo lá chắn kiếm khiên.'
  },
  {
    name: 'Hắc Ám Ma Tôn',
    type: 'combat',
    tier: 4,
    effect_desc: 'Trực tiếp xuất chiến cùng chủ nhân, tăng 25% sát thương Hút Máu và làm suy yếu công kích đối thủ.'
  },
  {
    name: 'Tiên Giới Chân Quân',
    type: 'combat',
    tier: 3,
    effect_desc: 'Hộ đạo hộ thể, hồi phục 15% sinh lực cho chủ nhân mỗi khi máu dưới 40%.'
  },
  // Đạo Đồng (Sinh hoạt)
  {
    name: 'Thanh Phong Đạo Đồng',
    type: 'life',
    tier: 4,
    effect_desc: 'Tăng 40% tài nguyên AFK khi trạng thái AFK đang bật, tăng 20% tỷ lệ luyện đan và giảm 20% giá mua đồ Chợ Đen.'
  },
  {
    name: 'Dược Linh Đồng Tử',
    type: 'life',
    tier: 3,
    effect_desc: 'Chăm sóc Dược Viên, giảm 30% thời gian trưởng thành của linh thảo và tăng 25% tỷ lệ đan dược đại thành.'
  },
  {
    name: 'Luyện Khí Đồng Tử',
    type: 'life',
    tier: 2,
    effect_desc: 'Phụ giúp rèn Linh Khí ở Lò Rèn, giảm 25% chi phí rèn và tăng tỷ lệ ra phẩm chất cao.'
  }
];

// Danh mục Kỹ Năng / Công Pháp có sẵn
const SKILL_PRESETS = [
  {
    name: 'Linh Khí Nhất Kích',
    type: 'active',
    element: 'Hỏa',
    damage_mult: 1.25,
    desc: 'Tụ linh lực giáng một đòn chí mạng cơ bản.'
  },
  {
    name: 'Liệt Diễm Toái Sơn Trảm',
    type: 'active',
    element: 'Hỏa',
    damage_mult: 1.85,
    desc: 'Lửa thiêng ngút trời, chém vỡ núi non, gây thêm hiệu ứng thiêu đốt kéo dài 3 hiệp.'
  },
  {
    name: 'Vạn Kiếm Quy Tông',
    type: 'active',
    element: 'Kim',
    damage_mult: 2.40,
    desc: 'Ngưng tụ vạn thanh linh kiếm phóng về phía kẻ địch, sát thương liên kích cực lớn.'
  },
  {
    name: 'Cửu Thiên Thần Lôi Quyết',
    type: 'active',
    element: 'Lôi',
    damage_mult: 2.80,
    desc: 'Triệu hồi Lôi Vân cửu trùng, giáng sét hủy diệt đối phương với 50% cơ hội làm choáng.'
  },
  {
    name: 'Hàn Băng Phong Ma Chưởng',
    type: 'active',
    element: 'Băng',
    damage_mult: 1.95,
    desc: 'Khí lạnh thấu xương đóng băng kinh mạch đối thủ, giảm 30% tốc độ xuất chiêu.'
  },
  {
    name: 'Hỗn Độn Khai Thiên Kình',
    type: 'active',
    element: 'Lôi',
    damage_mult: 3.50,
    desc: 'Tuyệt kỹ chí tôn mang uy lực khai thiên lập địa, hủy diệt sinh cơ đối thủ.'
  },
  {
    name: 'Bất Diệt Kim Thân Biến',
    type: 'passive',
    element: 'Kim',
    damage_mult: 1.00,
    desc: 'Nội công phòng ngự tối thượng, vĩnh viễn giảm 25% toàn bộ sát thương nhận vào.'
  }
];

// Boss Thế Giới Templates
const BOSS_PRESETS = [
  { name: 'Thôn Thiên Ma Thú (Thượng Cổ)', baseHp: 50000000 },
  { name: 'Cửu Đầu Thao Thiết', baseHp: 150000000 },
  { name: 'Viễn Cổ Hắc Long', baseHp: 500000000 },
  { name: 'Thái Sơ Hỗn Độn Ma Viên', baseHp: 2000000000 },
  { name: 'Thái Cổ Chu Tước Ma Thần', baseHp: 5000000000 }
];

module.exports = {
  ITEM_PRESETS,
  PET_PRESETS,
  WEAPON_PRESETS,
  HELPER_PRESETS,
  SKILL_PRESETS,
  BOSS_PRESETS
};
