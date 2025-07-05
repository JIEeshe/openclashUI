/**
 * 数据库初始化脚本
 * 创建数据库和初始管理员账户
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🔧 开始初始化数据库...');
    
    // 连接到MySQL服务器（不指定数据库）
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('✅ 连接到MySQL服务器成功');

    // 创建数据库
    const dbName = process.env.DB_NAME || 'license_system';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ 数据库 ${dbName} 创建成功`);

    // 选择数据库
    await connection.execute(`USE \`${dbName}\``);

    // 创建卡密表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS licenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_code VARCHAR(20) UNIQUE NOT NULL,
        validity_days INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        used_at TIMESTAMP NULL,
        used_by_fingerprint VARCHAR(255) NULL,
        batch_id VARCHAR(50) NULL,
        batch_name VARCHAR(100) NULL,
        status ENUM('active', 'used', 'expired', 'disabled') DEFAULT 'active',
        INDEX idx_license_code (license_code),
        INDEX idx_status (status),
        INDEX idx_batch_id (batch_id)
      )
    `);
    console.log('✅ 卡密表创建成功');

    // 创建使用记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS license_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_code VARCHAR(20) NOT NULL,
        client_fingerprint VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verification_count INT DEFAULT 1,
        last_verification TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_license_code (license_code),
        INDEX idx_fingerprint (client_fingerprint)
      )
    `);
    console.log('✅ 使用记录表创建成功');

    // 创建验证日志表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS verification_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_code VARCHAR(20),
        client_fingerprint VARCHAR(255),
        ip_address VARCHAR(45),
        success BOOLEAN,
        error_message TEXT,
        request_signature VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_license_code (license_code),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log('✅ 验证日志表创建成功');

    // 创建管理员表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log('✅ 管理员表创建成功');

    // 创建默认管理员账户
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@leiyumedia.com';

    // 检查管理员是否已存在
    const [existingAdmin] = await connection.execute(
      'SELECT id FROM admins WHERE username = ?',
      [adminUsername]
    );

    if (existingAdmin.length === 0) {
      // 创建管理员账户
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await connection.execute(
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

    // 创建一些测试卡密（可选）
    console.log('🎫 创建测试卡密...');
    const testLicenses = [
      { code: 'TEST-1234-5678-9ABC', days: 7 },
      { code: 'TEST-2345-6789-ABCD', days: 30 },
      { code: 'TEST-3456-789A-BCDE', days: 90 }
    ];

    for (const license of testLicenses) {
      try {
        const expiresAt = new Date(Date.now() + license.days * 24 * 60 * 60 * 1000);
        await connection.execute(
          `INSERT IGNORE INTO licenses 
           (license_code, validity_days, expires_at, batch_id, batch_name) 
           VALUES (?, ?, ?, ?, ?)`,
          [license.code, license.days, expiresAt, 'test_batch', '测试批次']
        );
        console.log(`✅ 测试卡密创建: ${license.code} (${license.days}天)`);
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') {
          console.warn(`⚠️  创建测试卡密失败: ${license.code}`, error.message);
        }
      }
    }

    console.log('🎉 数据库初始化完成！');
    console.log('');
    console.log('📋 数据库信息:');
    console.log(`   数据库名: ${dbName}`);
    console.log(`   主机: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   用户: ${process.env.DB_USER || 'root'}`);
    console.log('');
    console.log('👤 管理员信息:');
    console.log(`   用户名: ${adminUsername}`);
    console.log(`   邮箱: ${adminEmail}`);
    console.log(`   密码: ${adminPassword}`);
    console.log('');
    console.log('🚀 现在可以启动服务器了:');
    console.log('   npm start');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
