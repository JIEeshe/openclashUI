/**
 * SQLite数据库初始化脚本（用于测试）
 * 创建数据库和初始管理员账户
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function setupSQLiteDatabase() {
  try {
    console.log('🔧 开始初始化SQLite数据库...');
    
    // 创建数据库目录
    const dbDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // 连接到SQLite数据库
    const dbPath = path.join(dbDir, 'license_system.db');
    const db = new sqlite3.Database(dbPath);

    console.log('✅ 连接到SQLite数据库成功');

    // 创建表的Promise包装函数
    const runQuery = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    };

    const getQuery = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };

    // 创建卡密表
    await runQuery(`
      CREATE TABLE IF NOT EXISTS licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_code TEXT UNIQUE NOT NULL,
        validity_days INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        used_at DATETIME NULL,
        used_by_fingerprint TEXT NULL,
        batch_id TEXT NULL,
        batch_name TEXT NULL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'used', 'expired', 'disabled'))
      )
    `);
    console.log('✅ 卡密表创建成功');

    // 创建索引
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_license_code ON licenses(license_code)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_status ON licenses(status)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_batch_id ON licenses(batch_id)`);

    // 创建使用记录表
    await runQuery(`
      CREATE TABLE IF NOT EXISTS license_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_code TEXT NOT NULL,
        client_fingerprint TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        verification_count INTEGER DEFAULT 1,
        last_verification DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ 使用记录表创建成功');

    // 创建索引
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_license_code_usage ON license_usage(license_code)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_fingerprint ON license_usage(client_fingerprint)`);

    // 创建验证日志表
    await runQuery(`
      CREATE TABLE IF NOT EXISTS verification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_code TEXT,
        client_fingerprint TEXT,
        ip_address TEXT,
        success BOOLEAN,
        error_message TEXT,
        request_signature TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ 验证日志表创建成功');

    // 创建索引
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_license_code_logs ON verification_logs(license_code)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_created_at ON verification_logs(created_at)`);

    // 创建管理员表
    await runQuery(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME NULL,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log('✅ 管理员表创建成功');

    // 创建默认管理员账户
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@leiyumedia.com';

    // 检查管理员是否已存在
    const existingAdmin = await getQuery('SELECT id FROM admins WHERE username = ?', [adminUsername]);

    if (!existingAdmin) {
      // 创建管理员账户
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await runQuery(
        'INSERT INTO admins (username, password_hash, email) VALUES (?, ?, ?)',
        [adminUsername, passwordHash, adminEmail]
      );
      console.log(`✅ 默认管理员账户创建成功: ${adminUsername}`);
      console.log(`📧 管理员邮箱: ${adminEmail}`);
      console.log(`🔑 默认密码: ${adminPassword}`);
      console.log('⚠️  请及时修改默认密码！');
    } else {
      console.log('ℹ️  管理员账户已存在，跳过创建');
    }

    // 创建一些测试卡密
    console.log('🎫 创建测试卡密...');
    const testLicenses = [
      { code: 'TEST-1234-5678-9ABC', days: 7 },
      { code: 'TEST-2345-6789-ABCD', days: 30 },
      { code: 'TEST-3456-789A-BCDE', days: 90 }
    ];

    for (const license of testLicenses) {
      try {
        const expiresAt = new Date(Date.now() + license.days * 24 * 60 * 60 * 1000).toISOString();
        await runQuery(
          `INSERT OR IGNORE INTO licenses 
           (license_code, validity_days, expires_at, batch_id, batch_name) 
           VALUES (?, ?, ?, ?, ?)`,
          [license.code, license.days, expiresAt, 'test_batch', '测试批次']
        );
        console.log(`✅ 测试卡密创建: ${license.code} (${license.days}天)`);
      } catch (error) {
        console.warn(`⚠️  创建测试卡密失败: ${license.code}`, error.message);
      }
    }

    // 关闭数据库连接
    db.close();

    console.log('🎉 SQLite数据库初始化完成！');
    console.log('');
    console.log('📋 数据库信息:');
    console.log(`   数据库文件: ${dbPath}`);
    console.log('');
    console.log('👤 管理员信息:');
    console.log(`   用户名: ${adminUsername}`);
    console.log(`   邮箱: ${adminEmail}`);
    console.log(`   密码: ${adminPassword}`);
    console.log('');
    console.log('🚀 现在可以启动服务器了:');
    console.log('   npm start');

  } catch (error) {
    console.error('❌ SQLite数据库初始化失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  setupSQLiteDatabase();
}

module.exports = setupSQLiteDatabase;
