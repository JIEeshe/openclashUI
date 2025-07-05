/**
 * 在线卡密验证服务器
 * 提供安全的卡密验证、管理和统计功能
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;

// 安全配置
const JWT_SECRET = process.env.JWT_SECRET || 'LEIYU-MEDIA-JWT-SECRET-2025';
const API_SECRET = process.env.API_SECRET || 'LEIYU-MEDIA-API-SECRET-2025';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'LEIYU-MEDIA-ENCRYPT-KEY-2025';

// 中间件配置
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100次请求
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api/', limiter);

// 验证速率限制（调整为更合理的限制）
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

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'license_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let db;

// 初始化数据库连接
async function initDatabase() {
  try {
    db = mysql.createPool(dbConfig);
    
    // 创建数据库表
    await createTables();
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
}

// 创建数据库表
async function createTables() {
  const tables = [
    // 卡密表
    `CREATE TABLE IF NOT EXISTS licenses (
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
    )`,
    
    // 使用记录表
    `CREATE TABLE IF NOT EXISTS license_usage (
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
    )`,
    
    // 验证日志表
    `CREATE TABLE IF NOT EXISTS verification_logs (
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
    )`,
    
    // 管理员表
    `CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      email VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP NULL,
      is_active BOOLEAN DEFAULT TRUE
    )`
  ];

  for (const table of tables) {
    await db.execute(table);
  }
}

// 工具函数
class SecurityUtils {
  // 生成客户端指纹
  static generateFingerprint(req) {
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

  // 验证请求签名
  static verifySignature(data, signature, timestamp) {
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    
    // 检查时间戳（5分钟内有效）
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return false;
    }

    // 生成期望的签名
    const expectedSignature = crypto
      .createHmac('sha256', API_SECRET)
      .update(`${JSON.stringify(data)}|${timestamp}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // 加密敏感数据
  static encrypt(text) {
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  // 解密敏感数据
  static decrypt(encryptedText) {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// 中间件：验证请求签名
function verifyRequestSignature(req, res, next) {
  const { signature, timestamp } = req.headers;
  
  if (!signature || !timestamp) {
    return res.status(401).json({
      success: false,
      error: '缺少安全验证信息'
    });
  }

  if (!SecurityUtils.verifySignature(req.body, signature, timestamp)) {
    return res.status(401).json({
      success: false,
      error: '请求签名验证失败'
    });
  }

  next();
}

// 中间件：记录验证日志
async function logVerification(licenseCode, fingerprint, ip, success, error = null) {
  try {
    await db.execute(
      `INSERT INTO verification_logs 
       (license_code, client_fingerprint, ip_address, success, error_message) 
       VALUES (?, ?, ?, ?, ?)`,
      [licenseCode, fingerprint, ip, success, error]
    );
  } catch (err) {
    console.error('记录验证日志失败:', err);
  }
}

// API路由

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// 卡密验证接口
app.post('/api/verify-license', verifyLimiter, verifyRequestSignature, async (req, res) => {
  const { licenseCode } = req.body;
  const clientFingerprint = SecurityUtils.generateFingerprint(req);
  const clientIP = req.ip;

  try {
    // 查询卡密信息
    const [rows] = await db.execute(
      'SELECT * FROM licenses WHERE license_code = ?',
      [licenseCode]
    );

    if (rows.length === 0) {
      await logVerification(licenseCode, clientFingerprint, clientIP, false, '卡密不存在');
      return res.json({
        success: false,
        error: '无效的授权码'
      });
    }

    const license = rows[0];

    // 检查卡密状态
    if (license.status !== 'active') {
      await logVerification(licenseCode, clientFingerprint, clientIP, false, `卡密状态: ${license.status}`);
      return res.json({
        success: false,
        error: license.status === 'used' ? '授权码已被使用' : 
               license.status === 'expired' ? '授权码已过期' : '授权码已被禁用'
      });
    }

    // 检查是否已过期
    if (new Date() > new Date(license.expires_at)) {
      // 更新状态为过期
      await db.execute(
        'UPDATE licenses SET status = ? WHERE license_code = ?',
        ['expired', licenseCode]
      );
      
      await logVerification(licenseCode, clientFingerprint, clientIP, false, '卡密已过期');
      return res.json({
        success: false,
        error: '授权码已过期'
      });
    }

    // 检查是否已被使用
    if (license.is_used) {
      // 检查是否是同一客户端
      if (license.used_by_fingerprint === clientFingerprint) {
        // 更新最后验证时间
        await db.execute(
          `UPDATE license_usage 
           SET verification_count = verification_count + 1, 
               last_verification = CURRENT_TIMESTAMP 
           WHERE license_code = ? AND client_fingerprint = ?`,
          [licenseCode, clientFingerprint]
        );

        await logVerification(licenseCode, clientFingerprint, clientIP, true);
        
        // 计算剩余时间
        const remainingMs = new Date(license.expires_at) - new Date();
        const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

        return res.json({
          success: true,
          message: '授权验证成功',
          data: {
            licenseCode: licenseCode,
            validityDays: license.validity_days,
            remainingDays: remainingDays,
            expiresAt: license.expires_at,
            isUsed: true,
            usedAt: license.used_at
          }
        });
      } else {
        await logVerification(licenseCode, clientFingerprint, clientIP, false, '卡密已被其他设备使用');
        return res.json({
          success: false,
          error: '授权码已被其他设备使用'
        });
      }
    }

    // 首次使用，标记为已使用
    await db.execute(
      `UPDATE licenses 
       SET is_used = TRUE, used_at = CURRENT_TIMESTAMP, 
           used_by_fingerprint = ?, status = 'used' 
       WHERE license_code = ?`,
      [clientFingerprint, licenseCode]
    );

    // 记录使用信息
    await db.execute(
      `INSERT INTO license_usage 
       (license_code, client_fingerprint, ip_address, user_agent) 
       VALUES (?, ?, ?, ?)`,
      [licenseCode, clientFingerprint, clientIP, req.get('User-Agent')]
    );

    await logVerification(licenseCode, clientFingerprint, clientIP, true);

    // 计算剩余时间
    const remainingMs = new Date(license.expires_at) - new Date();
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

    res.json({
      success: true,
      message: '授权验证成功',
      data: {
        licenseCode: licenseCode,
        validityDays: license.validity_days,
        remainingDays: remainingDays,
        expiresAt: license.expires_at,
        isUsed: true,
        usedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('验证卡密失败:', error);
    await logVerification(licenseCode, clientFingerprint, clientIP, false, error.message);

    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 检查授权码状态API - 用于实时状态验证
app.post('/api/check-license-status', async (req, res) => {
  const { licenseCode, clientFingerprint } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress;

  console.log('🔍 收到授权码状态检查请求:', {
    licenseCode: licenseCode,
    clientFingerprint: clientFingerprint?.substring(0, 16) + '...',
    clientIP: clientIP
  });

  if (!licenseCode || !clientFingerprint) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数'
    });
  }

  try {
    // 查询卡密信息
    const [rows] = await db.execute(
      'SELECT * FROM licenses WHERE license_code = ?',
      [licenseCode]
    );

    if (rows.length === 0) {
      await logVerification(licenseCode, clientFingerprint, clientIP, false, '状态检查: 卡密不存在');
      return res.json({
        success: true,
        status: {
          isValid: false,
          status: 'not_found',
          message: '授权码不存在'
        }
      });
    }

    const license = rows[0];

    // 检查卡密状态
    if (license.status !== 'active') {
      await logVerification(licenseCode, clientFingerprint, clientIP, false, `状态检查: 卡密状态异常 - ${license.status}`);
      return res.json({
        success: true,
        status: {
          isValid: false,
          status: license.status,
          message: license.status === 'used' ? '授权码已被使用' :
                   license.status === 'expired' ? '授权码已过期' : '授权码已被禁用'
        }
      });
    }

    // 检查是否已过期
    if (new Date() > new Date(license.expires_at)) {
      // 更新状态为过期
      await db.execute(
        'UPDATE licenses SET status = ? WHERE license_code = ?',
        ['expired', licenseCode]
      );

      await logVerification(licenseCode, clientFingerprint, clientIP, false, '状态检查: 卡密已过期');
      return res.json({
        success: true,
        status: {
          isValid: false,
          status: 'expired',
          message: '授权码已过期'
        }
      });
    }

    // 检查是否已被使用且不是同一设备
    if (license.is_used && license.used_by_fingerprint !== clientFingerprint) {
      await logVerification(licenseCode, clientFingerprint, clientIP, false, '状态检查: 卡密已被其他设备使用');
      return res.json({
        success: true,
        status: {
          isValid: false,
          status: 'used_by_other',
          message: '授权码已被其他设备使用'
        }
      });
    }

    // 状态正常
    await logVerification(licenseCode, clientFingerprint, clientIP, true, '状态检查: 正常');

    // 计算剩余时间
    const remainingMs = new Date(license.expires_at) - new Date();
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

    res.json({
      success: true,
      status: {
        isValid: true,
        status: 'active',
        message: '授权码状态正常',
        data: {
          licenseCode: license.license_code,
          validityDays: license.validity_days,
          remainingDays: remainingDays,
          expiresAt: license.expires_at,
          isUsed: license.is_used,
          usedAt: license.used_at
        }
      }
    });

  } catch (error) {
    console.error('检查授权码状态失败:', error);
    await logVerification(licenseCode, clientFingerprint, clientIP, false, '状态检查失败: ' + error.message);

    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 批量上传卡密接口
app.post('/api/upload-licenses', verifyRequestSignature, async (req, res) => {
  const { licenses, batchName, adminToken } = req.body;

  try {
    // 验证管理员权限
    if (!adminToken || !verifyAdminToken(adminToken)) {
      return res.status(403).json({
        success: false,
        error: '无权限执行此操作'
      });
    }

    const batchId = `batch_${Date.now()}`;
    const uploadedLicenses = [];
    const errors = [];

    for (const licenseData of licenses) {
      try {
        const { code, validityDays } = licenseData;
        const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

        await db.execute(
          `INSERT INTO licenses
           (license_code, validity_days, expires_at, batch_id, batch_name)
           VALUES (?, ?, ?, ?, ?)`,
          [code, validityDays, expiresAt, batchId, batchName]
        );

        uploadedLicenses.push({
          code: code,
          validityDays: validityDays,
          expiresAt: expiresAt
        });
      } catch (error) {
        errors.push({
          code: licenseData.code,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `成功上传 ${uploadedLicenses.length} 个卡密`,
      data: {
        batchId: batchId,
        uploaded: uploadedLicenses.length,
        errors: errors.length,
        details: { uploadedLicenses, errors }
      }
    });

  } catch (error) {
    console.error('上传卡密失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取卡密统计信息
app.get('/api/license-stats', async (req, res) => {
  try {
    const [totalResult] = await db.execute('SELECT COUNT(*) as total FROM licenses');
    const [usedResult] = await db.execute('SELECT COUNT(*) as used FROM licenses WHERE is_used = TRUE');
    const [expiredResult] = await db.execute('SELECT COUNT(*) as expired FROM licenses WHERE expires_at < NOW()');
    const [activeResult] = await db.execute('SELECT COUNT(*) as active FROM licenses WHERE status = "active"');

    res.json({
      success: true,
      data: {
        total: totalResult[0].total,
        used: usedResult[0].used,
        expired: expiredResult[0].expired,
        active: activeResult[0].active,
        available: totalResult[0].total - usedResult[0].used - expiredResult[0].expired
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

// 验证管理员令牌
function verifyAdminToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded && decoded.role === 'admin';
  } catch (error) {
    return false;
  }
}

// 启动服务器
async function startServer() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 卡密验证服务器启动成功`);
    console.log(`📡 服务地址: http://localhost:${PORT}`);
    console.log(`🔒 安全模式: ${process.env.NODE_ENV === 'production' ? '生产环境' : '开发环境'}`);
  });
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('🔄 正在关闭服务器...');
  if (db) {
    await db.end();
  }
  process.exit(0);
});

startServer().catch(console.error);

module.exports = app;
