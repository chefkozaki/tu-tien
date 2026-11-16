const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.resolve(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`[CẢNH BÁO] Lệnh tại ${filePath} thiếu thuộc tính "data" hoặc "execute".`);
  }
}

const rest = new REST({ timeout: 15000 }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    console.log(`\n==============================================`);
    console.log(`🚀 BẮT ĐẦU QUÁ TRÌNH DEPLOY LỆNH SLASH (${commands.length} LỆNH)`);
    console.log(`==============================================\n`);

    // ==========================================
    // BƯỚC 1: XÓA SẠCH LỆNH CŨ
    // ==========================================
    console.log('🧹 [1/2] Đang xóa sạch các lệnh slash cũ...');

    if (guildId) {
      try {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        console.log(`  ✅ Đã xóa toàn bộ lệnh cũ trên Guild ID: ${guildId}`);
      } catch (err) {
        console.log(`  ℹ️ Bỏ qua Guild ID ${guildId} (${err.message})`);
      }
    }

    // Xóa toàn bộ lệnh Global cũ
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log('  ✅ Đã xóa toàn bộ lệnh cũ cấp Global (Toàn cục)');

    // ==========================================
    // BƯỚC 2: THÊM LỆNH MỚI
    // ==========================================
    console.log('\n📦 [2/2] Đang đăng ký danh sách lệnh mới...');

    if (guildId) {
      try {
        const guildData = await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commands }
        );
        console.log(`  🎉 Đã đăng ký thành công ${guildData.length} lệnh cho Guild ID: ${guildId}`);
      } catch (err) {
        console.log(`  ℹ️ Không thể đăng ký trực tiếp cho Guild ID ${guildId} (${err.message})`);
      }
    }

    // Đăng ký cấp Global
    const globalData = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log(`  🎉 Đã đăng ký thành công ${globalData.length} lệnh slash cấp Global!`);

    console.log(`\n==============================================`);
    console.log(`✅ HOÀN TẤT DEPLOY: Đã xóa lệnh cũ & nạp ${globalData.length} lệnh mới!`);
    console.log(`==============================================\n`);
  } catch (error) {
    console.error('❌ Lỗi deploy slash commands:', error);
    process.exit(1);
  }
})();
