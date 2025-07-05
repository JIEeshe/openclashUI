/**
 * 在线卡密验证管理器
 * 负责与服务器端进行卡密验证通信
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { app } = require('electron');
const os = require('os');
const logger = require('./online-verification-logger');

class OnlineLicenseManager {
  constructor() {
    // 服务器配置
    this.serverConfig = {
      host: process.env.LICENSE_SERVER_HOST || 'localhost',
      port: process.env.LICENSE_SERVER_PORT || 3001,
      protocol: process.env.LICENSE_SERVER_PROTOCOL || 'http',
      apiSecret: process.env.API_SECRET || 'LEIYU-MEDIA-API-SECRET-2025-CHANGE-THIS-IN-PRODUCTION'
    };

    this.baseUrl = `${this.serverConfig.protocol}://${this.serverConfig.host}:${this.serverConfig.port}/api`;
    
    // 客户端指纹
    this.clientFingerprint = this.generateClientFingerprint();
    
    console.log('🔧 在线卡密管理器初始化完成');
    console.log('📡 服务器地址:', this.baseUrl);
    console.log('🔍 客户端指纹:', this.clientFingerprint.substring(0, 16) + '...');
  }

  /**
   * 生成客户端指纹
   * 基于硬件和系统信息生成唯一标识
   */
  generateClientFingerprint() {
    const components = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model || 'unknown',
      os.totalmem().toString(),
      process.env.USERNAME || process.env.USER || 'unknown',
      // 使用统一的用户数据路径方法
      this.getUserDataPath()
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  /**
   * 检测是否在Electron环境中运行
   */
  isElectronEnvironment() {
    try {
      return typeof app !== 'undefined' && app.getPath;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取用户数据目录
   * 在Electron环境中使用app.getPath，否则使用临时目录
   */
  getUserDataPath() {
    if (this.isElectronEnvironment()) {
      return app.getPath('userData');
    } else {
      // 在Node.js环境中使用临时目录进行测试
      const path = require('path');
      return path.join(os.tmpdir(), 'openclash-manager-test');
    }
  }

  /**
   * 标准化JSON序列化
   * 确保客户端和服务器端生成相同的JSON字符串
   */
  normalizeJSON(obj) {
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj = {};
    sortedKeys.forEach(key => {
      sortedObj[key] = obj[key];
    });
    return JSON.stringify(sortedObj);
  }

  /**
   * 生成请求签名
   * 防止请求被篡改和重放攻击
   */
  generateRequestSignature(data, timestamp) {
    const normalizedJSON = this.normalizeJSON(data);
    const payload = `${normalizedJSON}|${timestamp}`;
    return crypto
      .createHmac('sha256', this.serverConfig.apiSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * 发送HTTP请求到服务器 - 优化版本
   */
  async makeRequest(endpoint, data, method = 'POST', retryCount = 0) {
    const maxRetries = 2; // 最大重试次数
    const baseTimeout = 8000; // 基础超时时间8秒
    const retryTimeout = baseTimeout + (retryCount * 2000); // 重试时增加超时时间

    return new Promise((resolve, reject) => {
      const timestamp = Date.now().toString();
      const signature = this.generateRequestSignature(data, timestamp);

      const postData = method === 'GET' ? '' : JSON.stringify(data);

      const options = {
        hostname: this.serverConfig.host,
        port: this.serverConfig.port,
        path: `/api${endpoint}`,
        method: method,
        headers: {
          'User-Agent': `LeiyuMediaClient/1.0 (${os.platform()}; ${os.arch()})`,
          'signature': signature,
          'timestamp': timestamp,
          'Connection': 'keep-alive', // 保持连接
          'Accept': 'application/json'
        },
        timeout: retryTimeout,
        // 添加 keepAlive 选项提高连接稳定性
        agent: new (require('http').Agent)({
          keepAlive: true,
          keepAliveMsecs: 30000,
          maxSockets: 5,
          timeout: retryTimeout
        })
      };

      // 只有非GET请求才设置Content-Type和Content-Length
      if (method !== 'GET') {
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const protocol = this.serverConfig.protocol === 'https' ? https : http;

      console.log(`🌐 发送${method}请求到 ${endpoint} (尝试 ${retryCount + 1}/${maxRetries + 1}, 超时: ${retryTimeout}ms)`);

      const req = protocol.request(options, (res) => {
        let responseData = '';
        const startTime = Date.now();

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          console.log(`📡 收到响应 (${responseTime}ms): 状态码 ${res.statusCode}`);

          try {
            const response = JSON.parse(responseData);
            resolve({
              success: res.statusCode === 200,
              statusCode: res.statusCode,
              data: response,
              responseTime: responseTime
            });
          } catch (error) {
            console.error('❌ 响应解析失败:', error.message);
            reject(new Error('服务器响应格式错误'));
          }
        });
      });

      req.on('error', async (error) => {
        console.error(`❌ 网络请求失败 (尝试 ${retryCount + 1}):`, error.message);

        // 如果还有重试机会且是网络错误，则重试
        if (retryCount < maxRetries && (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED')) {
          console.log(`🔄 ${error.code} 错误，${1000 * (retryCount + 1)}ms后重试...`);
          setTimeout(async () => {
            try {
              const result = await this.makeRequest(endpoint, data, method, retryCount + 1);
              resolve(result);
            } catch (retryError) {
              reject(retryError);
            }
          }, 1000 * (retryCount + 1));
        } else {
          reject(new Error(`网络连接失败: ${error.message}`));
        }
      });

      req.on('timeout', async () => {
        console.error(`⏰ 请求超时 (${retryTimeout}ms, 尝试 ${retryCount + 1})`);
        req.destroy();

        // 如果还有重试机会，则重试
        if (retryCount < maxRetries) {
          console.log(`🔄 超时重试，${2000 * (retryCount + 1)}ms后重试...`);
          setTimeout(async () => {
            try {
              const result = await this.makeRequest(endpoint, data, method, retryCount + 1);
              resolve(result);
            } catch (retryError) {
              reject(retryError);
            }
          }, 2000 * (retryCount + 1));
        } else {
          reject(new Error(`请求超时 (${retryTimeout}ms)，请检查网络连接`));
        }
      });

      // 只有非GET请求才发送请求体
      if (method !== 'GET' && postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  /**
   * 在线验证卡密 - 纯在线模式
   * 移除本地验证和离线验证，只使用在线验证服务器
   */
  async verifyLicenseOnline(licenseCode, maxRetries = 3) {
    try {
      console.log('🔍 开始纯在线验证卡密:', licenseCode);
      logger.logVerificationStart(licenseCode, this.clientFingerprint);

      // 首先检查网络连接
      const healthCheck = await this.checkServerHealth();
      if (!healthCheck.success) {
        console.error('❌ 无法连接到验证服务器，纯在线模式下验证失败');
        logger.logNetworkError(new Error('无法连接到验证服务器'), '/health');
        logger.logVerificationFailure(licenseCode, '网络连接失败', true);

        return {
          valid: false,
          message: '网络连接失败，无法验证授权码。请检查网络连接后重试。',
          online: false,
          networkError: true
        };
      }

      // 带重试机制的验证请求
      let lastError = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 验证尝试 ${attempt}/${maxRetries}`);

          // 如果不是第一次尝试，等待一段时间
          if (attempt > 1) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 指数退避，最大10秒
            console.log(`⏳ 等待 ${waitTime}ms 后重试...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }

          // 发送验证请求到服务器
          const response = await this.makeRequest('/verify-license', {
            licenseCode: licenseCode,
            clientFingerprint: this.clientFingerprint,
            clientInfo: {
              platform: os.platform(),
              arch: os.arch(),
              hostname: os.hostname(),
              version: this.isElectronEnvironment() ? app.getVersion() : '1.0.0-test'
            }
          });

          logger.logServerResponse('/verify-license', response, response.success && response.data.success);

          // 检查是否是429错误（请求过于频繁）
          if (!response.success && response.statusCode === 429) {
            const errorMsg = response.data?.error || '验证请求过于频繁，请稍后再试';
            console.log(`⚠️ 收到429错误 (尝试 ${attempt}/${maxRetries}):`, errorMsg);

            if (attempt < maxRetries) {
              lastError = errorMsg;
              continue; // 继续重试
            } else {
              // 最后一次尝试也失败了
              logger.logVerificationFailure(licenseCode, `${errorMsg} (重试${maxRetries}次后仍失败)`, false);
              return {
                valid: false,
                message: `${errorMsg}。已重试${maxRetries}次，请稍后再试。`,
                online: true,
                rateLimited: true,
                networkError: false
              };
            }
          }

          // 如果不是429错误，直接处理响应
          return this.processVerificationResponse(response, licenseCode);

        } catch (error) {
          console.error(`❌ 验证尝试 ${attempt} 发生错误:`, error.message);
          lastError = error.message;

          if (attempt < maxRetries) {
            continue; // 继续重试
          } else {
            throw error; // 最后一次尝试，抛出错误
          }
        }
      }

    } catch (error) {
      console.error('❌ 在线验证过程中发生错误:', error.message);
      logger.logNetworkError(error, '/verify-license');
      logger.logVerificationFailure(licenseCode, error.message, true);

      // 纯在线模式：网络错误时直接返回失败，不使用任何本地验证
      return {
        valid: false,
        message: '网络连接失败，无法验证授权码。请检查网络连接后重试。',
        originalMessage: error.message,
        online: false,
        networkError: true,
        verificationTime: new Date().toISOString()
      };
    }
  }

  /**
   * 处理验证响应
   */
  processVerificationResponse(response, licenseCode) {
    if (response.success && response.data.success) {
      console.log('✅ 在线验证成功');
      logger.logVerificationSuccess(licenseCode, response.data.data);

      // 清除任何旧的本地缓存，确保数据来源的纯净性
      this.clearCache();

      return {
        valid: true,
        message: response.data.message,
        data: response.data.data,
        online: true,
        verificationTime: new Date().toISOString()
      };
    } else {
      console.log('❌ 在线验证失败:', response.data?.error || '验证失败');
      logger.logVerificationFailure(licenseCode, response.data?.error || '验证失败', false);

      // 清除本地缓存，确保不会使用过期数据
      this.clearCache();

      // 处理错误消息的本地化
      const friendlyMessage = this.getFriendlyErrorMessage(response.data?.error || '验证失败');

      return {
        valid: false,
        message: friendlyMessage,
        originalMessage: response.data?.error,
        online: true,
        serverRejected: true,
        verificationTime: new Date().toISOString()
      };
    }
  }

  /**
   * 检查服务器健康状态
   */
  async checkServerHealth() {
    try {
      const response = await this.makeRequest('/health', {}, 'GET');

      // 添加调试信息
      console.log('🔍 健康检查响应调试:');
      console.log('   response.success:', response.success);
      console.log('   response.statusCode:', response.statusCode);
      console.log('   response.data:', JSON.stringify(response.data, null, 2));

      return {
        success: response.success && response.data.success,
        message: response.data.message || '服务器连接正常'
      };
    } catch (error) {
      console.log('🚨 健康检查异常:', error.message);
      return {
        success: false,
        message: '服务器连接失败'
      };
    }
  }

  /**
   * 清除本地缓存 - 纯在线模式下确保数据纯净性
   */
  clearCache() {
    try {
      const fs = require('fs');
      const path = require('path');

      const cacheDir = path.join(this.getUserDataPath(), 'cache');
      const cacheFile = path.join(cacheDir, 'license_cache.json');

      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
        console.log('🗑️ 本地缓存已清除');
      }
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  }

  /**
   * 实时验证授权码状态 - 每次都检查服务器
   * 确保授权码未被禁用或撤销
   */
  async verifyLicenseStatus(licenseCode) {
    try {
      console.log('🔍 检查授权码状态:', licenseCode);

      const response = await this.makeRequest('/check-license-status', {
        licenseCode: licenseCode,
        clientFingerprint: this.clientFingerprint
      });

      logger.logServerResponse('/check-license-status', response, response.success && response.data.success);

      if (response.success && response.data.success) {
        const status = response.data.status;
        console.log('📊 授权码状态:', status);
        logger.logStatusCheck(licenseCode, status);

        return {
          valid: status.isValid,
          status: status.status,
          message: status.message,
          data: status.data,
          online: true
        };
      } else {
        console.log('❌ 状态检查失败:', response.data.error);
        logger.logStatusCheck(licenseCode, { error: response.data.error });

        return {
          valid: false,
          message: response.data.error || '状态检查失败',
          online: true
        };
      }

    } catch (error) {
      console.error('❌ 状态检查过程中发生错误:', error.message);
      logger.logNetworkError(error, '/check-license-status');

      return {
        valid: false,
        message: '网络连接失败，无法检查授权码状态',
        online: false,
        networkError: true
      };
    }
  }

  /**
   * 加密数据
   */
  encryptData(text) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.serverConfig.apiSecret, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 将 IV 和加密数据组合
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密数据
   */
  decryptData(encryptedText) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.serverConfig.apiSecret, 'salt', 32);

      // 分离 IV 和加密数据
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('解密失败:', error);
      throw error;
    }
  }

  /**
   * 获取友好的错误消息
   * @param {string} originalMessage - 原始错误消息
   * @returns {string} 友好的错误消息
   */
  getFriendlyErrorMessage(originalMessage) {
    if (!originalMessage) return '验证失败';

    // 错误消息映射表
    const errorMappings = {
      '卡密不存在': '卡密不存在或已被删除',
      '卡密状态异常: expired': '卡密已过期',
      '卡密状态异常: used': '卡密已被使用',
      '卡密状态异常: disabled': '卡密已被禁用',
      '卡密已过期': '卡密已过期',
      '授权码已被使用': '卡密已被使用',
      '授权码已过期': '卡密已过期',
      '授权码已被禁用': '卡密已被禁用',
      '卡密已被其他设备使用': '卡密已被其他设备使用'
    };

    // 检查完全匹配
    if (errorMappings[originalMessage]) {
      return errorMappings[originalMessage];
    }

    // 检查部分匹配（处理 "卡密状态异常: xxx" 格式）
    for (const [pattern, friendlyMsg] of Object.entries(errorMappings)) {
      if (originalMessage.includes(pattern.split(':')[0])) {
        return friendlyMsg;
      }
    }

    // 如果没有匹配，返回原始消息
    return originalMessage;
  }

  /**
   * 清除本地缓存
   */
  clearCache() {
    try {
      const fs = require('fs');
      const path = require('path');

      const cacheDir = path.join(this.getUserDataPath(), 'cache');
      const cacheFile = path.join(cacheDir, 'license_cache.json');

      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
        console.log('🗑️ 本地缓存已清除');
      }

      // 同时清除整个缓存目录（如果为空）
      try {
        if (fs.existsSync(cacheDir)) {
          const files = fs.readdirSync(cacheDir);
          if (files.length === 0) {
            fs.rmdirSync(cacheDir);
            console.log('🗑️ 缓存目录已清除');
          }
        }
      } catch (dirError) {
        // 忽略目录删除错误
      }
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  }

  /**
   * 强制清除所有验证相关的本地数据
   */
  forceCleanup() {
    try {
      console.log('🧹 执行强制清理...');

      const fs = require('fs');
      const path = require('path');

      const userDataPath = this.getUserDataPath();
      const cacheDir = path.join(userDataPath, 'cache');

      // 删除所有缓存文件
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        files.forEach(file => {
          try {
            fs.unlinkSync(path.join(cacheDir, file));
            console.log(`🗑️ 已删除缓存文件: ${file}`);
          } catch (error) {
            console.warn(`删除文件失败: ${file}`, error.message);
          }
        });

        // 删除缓存目录
        try {
          fs.rmdirSync(cacheDir);
          console.log('🗑️ 缓存目录已删除');
        } catch (error) {
          console.warn('删除缓存目录失败:', error.message);
        }
      }

      console.log('✅ 强制清理完成');
      return true;
    } catch (error) {
      console.error('强制清理失败:', error);
      return false;
    }
  }

  /**
   * 获取网络状态
   */
  async getNetworkStatus() {
    try {
      const health = await this.checkServerHealth();
      return {
        online: health.success,
        serverReachable: health.success,
        message: health.message
      };
    } catch (error) {
      return {
        online: false,
        serverReachable: false,
        message: '网络连接失败'
      };
    }
  }

  /**
   * 检查服务器连接状态
   */
  async checkServerConnection() {
    try {
      const health = await this.checkServerHealth();
      return health.success;
    } catch (error) {
      console.log('服务器连接检查失败:', error.message);
      return false;
    }
  }
}

module.exports = OnlineLicenseManager;
