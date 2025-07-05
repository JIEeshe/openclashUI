/**
 * 重置授权码状态工具
 * 用于将已使用的授权码重置为可用状态
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function resetLicenseStatus(licenseCode) {
  try {
    console.log('🔧 开始重置授权码状态...');
    console.log('📋 授权码:', licenseCode);
    
    // 连接到SQLite数据库
    const dbPath = path.join(__dirname, 'data', 'license_system.db');
    const db = new sqlite3.Database(dbPath);

    console.log('✅ 连接到SQLite数据库成功');

    // Promise包装函数
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

    const allQuery = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };

    // 查询当前授权码状态
    console.log('🔍 查询当前授权码状态...');
    const currentLicense = await getQuery(
      'SELECT * FROM licenses WHERE license_code = ?',
      [licenseCode]
    );

    if (!currentLicense) {
      console.log('❌ 未找到指定的授权码');
      db.close();
      return false;
    }

    console.log('📊 当前授权码信息:');
    console.log('   - 授权码:', currentLicense.license_code);
    console.log('   - 状态:', currentLicense.status);
    console.log('   - 是否已使用:', currentLicense.is_used);
    console.log('   - 使用时间:', currentLicense.used_at);
    console.log('   - 使用者指纹:', currentLicense.used_by_fingerprint);
    console.log('   - 有效期至:', currentLicense.expires_at);

    // 重置授权码状态
    console.log('🔄 重置授权码状态...');
    await runQuery(`
      UPDATE licenses 
      SET 
        status = 'active',
        is_used = FALSE,
        used_at = NULL,
        used_by_fingerprint = NULL
      WHERE license_code = ?
    `, [licenseCode]);

    console.log('✅ 授权码状态重置成功');

    // 删除使用记录
    console.log('🗑️ 清除使用记录...');
    await runQuery(
      'DELETE FROM license_usage WHERE license_code = ?',
      [licenseCode]
    );

    console.log('✅ 使用记录清除成功');

    // 验证重置结果
    const updatedLicense = await getQuery(
      'SELECT * FROM licenses WHERE license_code = ?',
      [licenseCode]
    );

    console.log('📊 重置后的授权码信息:');
    console.log('   - 授权码:', updatedLicense.license_code);
    console.log('   - 状态:', updatedLicense.status);
    console.log('   - 是否已使用:', updatedLicense.is_used);
    console.log('   - 使用时间:', updatedLicense.used_at);
    console.log('   - 使用者指纹:', updatedLicense.used_by_fingerprint);

    db.close();
    console.log('🎉 授权码重置完成！');
    return true;

  } catch (error) {
    console.error('❌ 重置授权码状态失败:', error);
    return false;
  }
}

// 查看所有授权码状态
async function listAllLicenses() {
  try {
    console.log('📋 查看所有授权码状态...');
    
    const dbPath = path.join(__dirname, 'data', 'license_system.db');
    const db = new sqlite3.Database(dbPath);

    const allQuery = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };

    const licenses = await allQuery('SELECT * FROM licenses ORDER BY created_at DESC');

    console.log(`\n📊 共找到 ${licenses.length} 个授权码:\n`);
    
    licenses.forEach((license, index) => {
      console.log(`${index + 1}. 授权码: ${license.license_code}`);
      console.log(`   状态: ${license.status}`);
      console.log(`   已使用: ${license.is_used ? '是' : '否'}`);
      console.log(`   有效期: ${license.validity_days} 天`);
      console.log(`   到期时间: ${license.expires_at}`);
      console.log(`   创建时间: ${license.created_at}`);
      if (license.used_at) {
        console.log(`   使用时间: ${license.used_at}`);
      }
      console.log('');
    });

    db.close();
    return licenses;

  } catch (error) {
    console.error('❌ 查看授权码列表失败:', error);
    return [];
  }
}

// 命令行参数处理
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('📋 授权码状态管理工具');
  console.log('');
  console.log('用法:');
  console.log('  node reset-license-status.js list                    # 查看所有授权码');
  console.log('  node reset-license-status.js reset <授权码>          # 重置指定授权码状态');
  console.log('');
  console.log('示例:');
  console.log('  node reset-license-status.js list');
  console.log('  node reset-license-status.js reset SYXN-VG0U-PKPB-A873');
  process.exit(0);
}

const command = args[0];

if (command === 'list') {
  listAllLicenses();
} else if (command === 'reset' && args[1]) {
  const licenseCode = args[1];
  resetLicenseStatus(licenseCode);
} else {
  console.log('❌ 无效的命令或缺少参数');
  console.log('使用 "node reset-license-status.js" 查看帮助');
}
