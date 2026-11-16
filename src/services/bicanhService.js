const { getPlayer, addSilver, addXp } = require('./playerService');
const { addItem } = require('./itemService');
const { getDb } = require('../config/database');

const EVENTS = [
  {
    id: 'old_beggar',
    title: 'Lão Ăn Mày Thần Bí',
    desc: 'Tại một góc cổ động hoang tàn, đạo hữu phát hiện một lão ăn mày cả người rách rưới, hơi thở yếu ớt, dường như đang bị trọng thương cần ngân lượng mua đan dược.',
    options: [
      {
        text: 'Cứu Giúp (Tốn 500 Ngân lượng)',
        action: async (userId, player) => {
          if (player.silver < 500) {
            return { success: false, message: 'Đạo hữu không đủ 500 Ngân lượng để cứu giúp lão!' };
          }
          await addSilver(userId, -500);

          const roll = Math.random();
          if (roll < 0.4) {
            // Tặng Trợ Thủ Hộ Đạo Giả hiếm!
            const db = getDb();
            await db.execute({
              sql: `INSERT INTO tutien_helpers (user_id, name, type, tier, effect_desc, is_equipped)
                VALUES (?, 'Vãng Sinh Kiếm Thánh (Hộ Đạo Giả)', 'combat', 2, 'Xuất chiến trợ công, tăng 35% sát thương và đỡ đòn', 0)`,
              args: [userId]
            });
            return {
              success: true,
              message: '✨ Lão ăn mày mỉm cười thần bí, hóa ra là một vị Ẩn Thế Tiên Tôn! Ngài ban cho đạo hữu một **Hộ Đạo Giả: Vãng Sinh Kiếm Thánh**!'
            };
          } else {
            // Tặng Linh Kim Địa Phẩm
            await addItem(userId, 'spirit_gold', 'Địa', 'Linh Kim (Phẩm Địa)', 10);
            return {
              success: true,
              message: '✨ Lão nhân cảm kích cúi đầu, trao lại cho đạo hữu **10x Linh Kim (Phẩm Địa)**!'
            };
          }
        }
      },
      {
        text: 'Bỏ Qua & Tiếp Tục Thám Hiểm',
        action: async (userId) => {
          return { success: true, message: 'Đạo hữu phất tay áo lạnh lùng rời đi, tránh được thị phi giang hồ.' };
        }
      }
    ]
  },
  {
    id: 'ancient_sealed_cave',
    title: 'Cổ Động Phủ Bị Phong Ấn',
    desc: 'Phía trước là cánh cửa đá ngập tràn phù văn cổ xưa, bên trong phát ra ánh hào quang chói lóa của kỳ trân dị bảo!',
    options: [
      {
        text: 'Dùng Linh Lực Phá Ấn',
        action: async (userId, player) => {
          const roll = Math.random();
          if (roll < 0.6) {
            await addItem(userId, 'spirit_gold', 'Thiên', 'Linh Kim (Phẩm Thiên)', 5);
            await addSilver(userId, 20000);
            return {
              success: true,
              message: '💥 Trận pháp vỡ tung! Đạo hữu đoạt được **5x Linh Kim (Phẩm Thiên)** và **20.000 Ngân lượng** cổ đại!'
            };
          } else {
            return {
              success: false,
              message: '⚡ Phong ấn phản phệ dữ dội! Đạo hữu bị thiên lôi giật bay ra xa, không thu hoạch được gì.'
            };
          }
        }
      },
      {
        text: 'Cẩn Trọng Lùi Bước',
        action: async () => {
          return { success: true, message: 'Đạo hữu cẩn trọng lui binh, bảo toàn đạo thân an khang.' };
        }
      }
    ]
  },
  {
    id: 'spirit_beast_encounter',
    title: 'Linh Thú Tranh Đoạt Thần Dược',
    desc: 'Một gốc Cố Bản Thảo nghìn năm đang tỏa hương thơm ngào ngạt, bên cạnh là một con Linh Điêu dị chủng đang ngủ say.',
    options: [
      {
        text: 'Thuần Hóa Linh Thú',
        action: async (userId) => {
          const roll = Math.random();
          if (roll < 0.5) {
            const db = getDb();
            await db.execute({
              sql: `INSERT INTO tutien_pets (user_id, name, element, is_mythic, star, hp, atk, def, speed, crit, effect_desc)
                VALUES (?, 'Băng Tinh Bạch Hổ', 'Băng', 1, 1, 600, 75, 45, 40, 0.08, 'Tăng sát thương Băng và đóng băng đối thủ')`,
              args: [userId]
            });
            return {
              success: true,
              message: '🐯 Đạo hữu dùng đạo tâm cảm hóa Linh Thú! Đã thu phục thành công **Băng Tinh Bạch Hổ**!'
            };
          } else {
            return {
              success: false,
              message: '🐾 Linh Thú tỉnh giấc gầm vang rồi phóng vụt vào rừng sâu mất hút!'
            };
          }
        }
      },
      {
        text: 'Lén Hái Thần Thảo',
        action: async (userId) => {
          await addItem(userId, 'herb', 'ThienLinhThao', 'Thiên Linh Thảo', 2);
          return {
            success: true,
            message: '🌿 Đạo hữu nhanh tay lẹ mắt hái được **2x Thiên Linh Thảo** rồi nhẹ nhàng rút lui an toàn!'
          };
        }
      }
    ]
  }
];

function getRandomEvent() {
  return EVENTS[Math.floor(Math.random() * EVENTS.length)];
}

module.exports = {
  EVENTS,
  getRandomEvent
};
