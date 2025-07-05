/**
 * 雷雨传媒卡密验证API服务器 (SQLite版本)
 * 提供在线卡密验证、管理和统计功能
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const StatusConsistencyChecker = require('./status-consistency-checker');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 数据库连接
const dbPath = path.join(__dirname, 'data', 'license_system.db');
const db = new sqlite3.Database(dbPath);

console.log('📊 连接到SQLite数据库:', dbPath);

// 数据库查询Promise包装
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

// 安全配置
const JWT_SECRET = process.env.JWT_SECRET || 'LEIYU-MEDIA-JWT-SECRET-2025';
const API_SECRET = process.env.API_SECRET || 'LEIYU-MEDIA-API-SECRET-2025';

// 中间件配置
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// 通用速率限制
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 限制每个IP 100个请求
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 验证接口专用速率限制（调整为更合理的限制）
const verifyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 5, // 每个IP每分钟最多5次验证请求
  message: { error: '验证请求过于频繁，请稍后再试' },
  standardHeaders: true, // 返回限流信息在 `RateLimit-*` headers
  legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
  // 跳过成功的请求，只计算失败的请求
  skipSuccessfulRequests: true,
  // 为每个客户端指纹单独计算限流
  keyGenerator: (req) => {
    // 优先使用客户端指纹，如果没有则使用IP
    return req.body?.clientFingerprint || req.ip;
  }
});

app.use(generalLimiter);

// 安全工具类
class SecurityUtils {
  // 标准化JSON序列化（确保与客户端一致）
  static normalizeJSON(obj) {
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj = {};
    sortedKeys.forEach(key => {
      sortedObj[key] = obj[key];
    });
    return JSON.stringify(sortedObj);
  }

  static generateClientFingerprint(req) {
    const components = [
      req.ip,
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || ''
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  static verifyRequestSignature(data, signature, timestamp) {
    try {
      const now = Date.now();
      const requestTime = parseInt(timestamp);

      console.log('🔍 签名验证调试信息:');
      console.log('   当前时间:', now);
      console.log('   请求时间:', requestTime);
      console.log('   时间差:', Math.abs(now - requestTime), 'ms');

      // 检查时间戳（允许5分钟误差）
      if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
        console.log('❌ 时间戳验证失败');
        return false;
      }

      // 使用标准化JSON验证签名
      const normalizedJSON = this.normalizeJSON(data);
      const payload = `${normalizedJSON}|${timestamp}`;

      console.log('   🔧 服务器端HMAC调试:');
      console.log('   API_SECRET:', API_SECRET);
      console.log('   API_SECRET长度:', API_SECRET.length);
      console.log('   原始数据:', JSON.stringify(data));
      console.log('   标准化JSON:', normalizedJSON);
      console.log('   数据载荷:', payload);
      console.log('   载荷长度:', payload.length);
      console.log('   载荷字节:', Buffer.from(payload, 'utf8'));

      const expectedSignature = crypto
        .createHmac('sha256', API_SECRET)
        .update(payload)
        .digest('hex');

      console.log('   期望签名:', expectedSignature);
      console.log('   收到签名:', signature);
      console.log('   签名匹配:', signature === expectedSignature);

      return signature === expectedSignature;
    } catch (error) {
      console.error('签名验证失败:', error);
      return false;
    }
  }
}

// 记录验证日志
async function logVerification(licenseCode, clientFingerprint, ipAddress, success, errorMessage = null, signature = null) {
  try {
    await dbRun(
      `INSERT INTO verification_logs 
       (license_code, client_fingerprint, ip_address, success, error_message, request_signature, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [licenseCode, clientFingerprint, ipAddress, success ? 1 : 0, errorMessage, signature]
    );
  } catch (error) {
    console.error('记录验证日志失败:', error);
  }
}

// API路由

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '雷雨传媒卡密验证服务器运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 卡密验证接口
app.post('/api/verify-license', verifyLimiter, async (req, res) => {
  try {
    console.log('🔍 收到卡密验证请求');
    console.log('📋 原始请求信息:');
    console.log('   方法:', req.method);
    console.log('   URL:', req.url);
    console.log('   Content-Type:', req.get('Content-Type'));
    console.log('   请求体类型:', typeof req.body);
    console.log('   请求体内容:', JSON.stringify(req.body));

    const { licenseCode, clientFingerprint } = req.body;
    console.log('   解析的licenseCode:', licenseCode);
    console.log('   解析的clientFingerprint:', clientFingerprint);

    // 尝试多种方式读取请求头
    const signature1 = req.get('signature');
    const timestamp1 = req.get('timestamp');
    const signature2 = req.headers['signature'];
    const timestamp2 = req.headers['timestamp'];
    const signature3 = req.headers['Signature'];
    const timestamp3 = req.headers['Timestamp'];

    console.log('📋 请求头读取测试:');
    console.log('   所有请求头:', JSON.stringify(req.headers, null, 2));
    console.log('   signature (req.get):', signature1);
    console.log('   timestamp (req.get):', timestamp1);
    console.log('   signature (headers[]):', signature2);
    console.log('   timestamp (headers[]):', timestamp2);
    console.log('   Signature (大写):', signature3);
    console.log('   Timestamp (大写):', timestamp3);

    // 使用最可靠的方式
    const signature = signature1 || signature2 || signature3;
    const timestamp = timestamp1 || timestamp2 || timestamp3;
    
    // 验证请求签名
    try {
      console.log('🔍 收到签名验证请求:');
      console.log('   签名:', signature);
      console.log('   时间戳:', timestamp);
      console.log('   请求体:', JSON.stringify(req.body));

      const signatureValid = SecurityUtils.verifyRequestSignature(req.body, signature, timestamp);
      console.log('   签名验证结果:', signatureValid);

      if (!signatureValid) {
        await logVerification(licenseCode, clientFingerprint, req.ip, false, '请求签名验证失败', signature);
        return res.status(400).json({
          success: false,
          error: '请求签名验证失败'
        });
      }
    } catch (error) {
      console.error('❌ 签名验证过程出错:', error);
      return res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
    
    // 查询卡密
    const license = await dbGet(
      'SELECT * FROM licenses WHERE license_code = ?',
      [licenseCode]
    );
    
    if (!license) {
      await logVerification(licenseCode, clientFingerprint, req.ip, false, '卡密不存在');
      return res.status(404).json({
        success: false,
        error: '卡密不存在'
      });
    }
    
    // 检查卡密状态
    if (license.status !== 'active') {
      await logVerification(licenseCode, clientFingerprint, req.ip, false, `卡密状态异常: ${license.status}`);
      return res.status(400).json({
        success: false,
        error: `卡密状态异常: ${license.status}`
      });
    }
    
    // 检查是否过期
    const now = new Date();
    const expiresAt = new Date(license.expires_at);
    if (now > expiresAt) {
      // 更新状态为过期
      await dbRun('UPDATE licenses SET status = ? WHERE id = ?', ['expired', license.id]);
      await logVerification(licenseCode, clientFingerprint, req.ip, false, '卡密已过期');
      return res.status(400).json({
        success: false,
        error: '卡密已过期'
      });
    }
    
    // 检查是否已被使用
    if (license.is_used) {
      // 检查是否是同一设备
      if (license.used_by_fingerprint === clientFingerprint) {
        // 更新验证记录
        await dbRun(
          `UPDATE license_usage SET 
           verification_count = verification_count + 1,
           last_verification = datetime('now')
           WHERE license_code = ? AND client_fingerprint = ?`,
          [licenseCode, clientFingerprint]
        );
        
        await logVerification(licenseCode, clientFingerprint, req.ip, true, '重复验证成功');
        
        return res.json({
          success: true,
          message: '卡密验证成功（重复验证）',
          data: {
            licenseCode: license.license_code,
            validityDays: license.validity_days,
            expiresAt: license.expires_at,
            isUsed: true,
            usedAt: license.used_at
          }
        });
      } else {
        await logVerification(licenseCode, clientFingerprint, req.ip, false, '卡密已被其他设备使用');
        return res.status(400).json({
          success: false,
          error: '卡密已被其他设备使用'
        });
      }
    }
    
    // 首次使用，标记为已使用
    await dbRun(
      `UPDATE licenses SET 
       is_used = 1, 
       used_at = datetime('now'), 
       used_by_fingerprint = ?,
       status = 'used'
       WHERE id = ?`,
      [clientFingerprint, license.id]
    );
    
    // 记录使用信息
    await dbRun(
      `INSERT INTO license_usage 
       (license_code, client_fingerprint, ip_address, user_agent, used_at, verification_count, last_verification) 
       VALUES (?, ?, ?, ?, datetime('now'), 1, datetime('now'))`,
      [licenseCode, clientFingerprint, req.ip, req.get('User-Agent') || '']
    );
    
    await logVerification(licenseCode, clientFingerprint, req.ip, true, '首次验证成功');
    
    console.log('✅ 卡密验证成功:', licenseCode);
    
    res.json({
      success: true,
      message: '卡密验证成功',
      data: {
        licenseCode: license.license_code,
        validityDays: license.validity_days,
        expiresAt: license.expires_at,
        isUsed: true,
        usedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('卡密验证失败:', error);
    await logVerification(req.body.licenseCode, req.body.clientFingerprint, req.ip, false, error.message);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 批量上传卡密接口
app.post('/api/upload-licenses', async (req, res) => {
  try {
    const { licenses, batchName, adminToken } = req.body;
    
    console.log(`📤 收到批量上传请求: ${licenses.length} 个卡密`);
    
    // 验证管理员权限（简化版本）
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: '需要管理员权限'
      });
    }
    
    let uploaded = 0;
    let errors = 0;
    const details = [];
    
    for (const license of licenses) {
      try {
        const expiresAt = new Date(Date.now() + (license.validityDays || 30) * 24 * 60 * 60 * 1000).toISOString();
        
        await dbRun(
          `INSERT OR IGNORE INTO licenses 
           (license_code, validity_days, expires_at, batch_id, batch_name, created_at) 
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [license.code, license.validityDays || 30, expiresAt, Date.now().toString(), batchName || '未命名批次']
        );
        
        uploaded++;
        details.push({ code: license.code, status: 'success' });
      } catch (error) {
        errors++;
        details.push({ code: license.code, status: 'error', error: error.message });
      }
    }
    
    console.log(`✅ 批量上传完成: 成功 ${uploaded} 个，失败 ${errors} 个`);
    
    res.json({
      success: true,
      message: `批量上传完成: 成功 ${uploaded} 个，失败 ${errors} 个`,
      data: {
        uploaded,
        errors,
        batchId: Date.now().toString(),
        details
      }
    });
    
  } catch (error) {
    console.error('批量上传失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取统计信息
app.get('/api/license-stats', async (req, res) => {
  try {
    const stats = await dbAll(`
      SELECT
        status,
        COUNT(*) as count
      FROM licenses
      GROUP BY status
    `);

    const totalLicenses = await dbGet('SELECT COUNT(*) as total FROM licenses');
    const usedLicenses = await dbGet('SELECT COUNT(*) as used FROM licenses WHERE is_used = 1');
    const recentVerifications = await dbGet(`
      SELECT COUNT(*) as recent
      FROM verification_logs
      WHERE created_at > datetime('now', '-24 hours')
    `);

    res.json({
      success: true,
      data: {
        totalLicenses: totalLicenses.total,
        usedLicenses: usedLicenses.used,
        recentVerifications: recentVerifications.recent,
        statusBreakdown: stats
      }
    });

  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取卡密列表
app.get('/api/licenses', async (req, res) => {
  try {
    const { limit = 100, offset = 0, status, batchId } = req.query;

    let query = 'SELECT * FROM licenses';
    let params = [];
    let conditions = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (batchId) {
      conditions.push('batch_id = ?');
      params.push(batchId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const licenses = await dbAll(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM licenses';
    let countParams = [];

    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
      countParams = params.slice(0, -2); // 移除 limit 和 offset
    }

    const totalResult = await dbGet(countQuery, countParams);

    res.json({
      success: true,
      data: licenses,
      total: totalResult.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('获取卡密列表失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 删除单个卡密
app.delete('/api/licenses/:licenseCode', async (req, res) => {
  try {
    const { licenseCode } = req.params;
    const { adminToken } = req.body;

    // 验证管理员权限
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: '需要管理员权限'
      });
    }

    console.log(`🗑️ 删除卡密: ${licenseCode}`);

    // 检查卡密是否存在
    const existingLicense = await dbGet(
      'SELECT * FROM licenses WHERE license_code = ?',
      [licenseCode]
    );

    if (!existingLicense) {
      return res.status(404).json({
        success: false,
        error: '卡密不存在'
      });
    }

    // 删除卡密
    await dbRun('DELETE FROM licenses WHERE license_code = ?', [licenseCode]);

    res.json({
      success: true,
      message: '卡密删除成功',
      data: {
        deletedLicense: existingLicense
      }
    });

  } catch (error) {
    console.error('删除卡密失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 批量删除卡密
app.delete('/api/licenses', async (req, res) => {
  try {
    const { licenseCodes, adminToken } = req.body;

    // 验证管理员权限
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: '需要管理员权限'
      });
    }

    if (!licenseCodes || !Array.isArray(licenseCodes) || licenseCodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供要删除的卡密列表'
      });
    }

    console.log(`🗑️ 批量删除 ${licenseCodes.length} 个卡密`);

    const placeholders = licenseCodes.map(() => '?').join(',');
    const deletedLicenses = await dbAll(
      `SELECT * FROM licenses WHERE license_code IN (${placeholders})`,
      licenseCodes
    );

    const result = await dbRun(
      `DELETE FROM licenses WHERE license_code IN (${placeholders})`,
      licenseCodes
    );

    res.json({
      success: true,
      message: `成功删除 ${result.changes} 个卡密`,
      data: {
        deletedCount: result.changes,
        deletedLicenses: deletedLicenses
      }
    });

  } catch (error) {
    console.error('批量删除卡密失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 更新卡密状态
app.put('/api/licenses/:licenseCode/status', async (req, res) => {
  try {
    const { licenseCode } = req.params;
    const { status, adminToken } = req.body;

    // 验证管理员权限
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: '需要管理员权限'
      });
    }

    // 验证状态值
    const validStatuses = ['active', 'used', 'expired', 'disabled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的状态值'
      });
    }

    console.log(`🔄 更新卡密状态: ${licenseCode} -> ${status}`);

    // 检查卡密是否存在
    const existingLicense = await dbGet(
      'SELECT * FROM licenses WHERE license_code = ?',
      [licenseCode]
    );

    if (!existingLicense) {
      return res.status(404).json({
        success: false,
        error: '卡密不存在'
      });
    }

    // 更新状态
    await dbRun(
      'UPDATE licenses SET status = ? WHERE license_code = ?',
      [status, licenseCode]
    );

    // 获取更新后的卡密信息
    const updatedLicense = await dbGet(
      'SELECT * FROM licenses WHERE license_code = ?',
      [licenseCode]
    );

    res.json({
      success: true,
      message: '卡密状态更新成功',
      data: {
        oldStatus: existingLicense.status,
        newStatus: status,
        license: updatedLicense
      }
    });

  } catch (error) {
    console.error('更新卡密状态失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 启动服务器
// 启动服务器前执行状态一致性检查
async function startServer() {
  try {
    console.log('🔍 启动前检查卡密状态一致性...');
    const checker = new StatusConsistencyChecker(dbPath);
    const result = await checker.checkAndFix(true); // 静默模式

    if (result.fixed > 0) {
      console.log(`✅ 修复了 ${result.fixed} 个状态不一致的卡密`);
    }

    // 启动服务器
    app.listen(PORT, () => {
      console.log('🚀 雷雨传媒卡密验证服务器启动成功！');
      console.log(`📡 服务器地址: http://localhost:${PORT}`);
      console.log(`📊 数据库: SQLite (${dbPath})`);
      console.log(`🔒 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('📋 可用接口:');
      console.log(`   GET  /api/health - 健康检查`);
      console.log(`   POST /api/verify-license - 验证卡密`);
      console.log(`   POST /api/upload-licenses - 上传卡密`);
      console.log(`   GET  /api/license-stats - 获取统计`);
      console.log('');
      console.log('🔄 按 Ctrl+C 停止服务器');
    });

  } catch (error) {
    console.error('❌ 启动前状态检查失败:', error.message);
    console.log('⚠️  继续启动服务器...');

    // 即使检查失败也启动服务器
    app.listen(PORT, () => {
      console.log('🚀 雷雨传媒卡密验证服务器启动成功！');
      console.log(`📡 服务器地址: http://localhost:${PORT}`);
      console.log(`📊 数据库: SQLite (${dbPath})`);
      console.log(`🔒 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('📋 可用接口:');
      console.log(`   GET  /api/health - 健康检查`);
      console.log(`   POST /api/verify-license - 验证卡密`);
      console.log(`   POST /api/upload-licenses - 上传卡密`);
      console.log(`   GET  /api/license-stats - 获取统计`);
      console.log('');
      console.log('🔄 按 Ctrl+C 停止服务器');
    });
  }
}

// 启动服务器
startServer();

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭服务器...');
  db.close((err) => {
    if (err) {
      console.error('关闭数据库连接失败:', err);
    } else {
      console.log('✅ 数据库连接已关闭');
    }
    process.exit(0);
  });
});
