/**
 * 时效性授权管理器
 * 负责授权码的生成、验证和时效性检查
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./online-verification-logger');

// 尝试导入electron，如果失败则在测试环境中运行
let app;
try {
  app = require('electron').app;
} catch (error) {
  // 在非Electron环境中运行，创建模拟的app对象
  app = {
    getPath: (name) => {
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'leiyuchuanmei-config-manager');
      }
      return __dirname;
    }
  };
}

class LicenseManager {
  constructor() {
    // 使用用户数据目录存储授权文件，确保可写入
    let userDataPath;
    try {
      userDataPath = app.getPath('userData');
    } catch (error) {
      // 在非Electron环境中使用系统临时目录
      userDataPath = path.join(os.tmpdir(), 'leiyuchuanmei-config-manager');
      console.log('⚠️ 运行在非Electron环境中，使用临时数据目录');
    }

    this.licenseFile = path.join(userDataPath, 'license.dat');
    this.usedLicensesFile = path.join(userDataPath, 'used-licenses.json');
    this.secretKey = 'LEIYU-MEDIA-2025-SECRET-KEY'; // 用于加密的密钥

    // 确保用户数据目录存在
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    // 确保已使用授权码文件存在
    this.initUsedLicensesFile();
  }

  /**
   * 初始化已使用授权码文件
   */
  initUsedLicensesFile() {
    try {
      console.log('🔧 初始化授权文件...');
      console.log('📁 用户数据目录:', app.getPath('userData'));
      console.log('📄 授权文件路径:', this.licenseFile);
      console.log('📄 使用记录文件路径:', this.usedLicensesFile);

      if (!fs.existsSync(this.usedLicensesFile)) {
        fs.writeFileSync(this.usedLicensesFile, JSON.stringify([], null, 2));
        console.log('📝 已创建授权码使用记录文件:', this.usedLicensesFile);
      } else {
        console.log('📂 授权码使用记录文件已存在:', this.usedLicensesFile);
      }
    } catch (error) {
      console.error('❌ 初始化授权码使用记录文件失败:', error);
      console.error('文件路径:', this.usedLicensesFile);
    }
  }

  /**
   * 检查授权码是否已被使用
   * @param {string} licenseCode - 授权码
   * @returns {boolean} 是否已被使用
   */
  isLicenseUsed(licenseCode) {
    try {
      const usedLicenses = this.getUsedLicenses();
      return usedLicenses.some(record => record.licenseCode === licenseCode);
    } catch (error) {
      console.error('❌ 检查授权码使用状态失败:', error);
      return false;
    }
  }

  /**
   * 获取已使用的授权码列表
   * @returns {array} 已使用的授权码记录
   */
  getUsedLicenses() {
    try {
      if (!fs.existsSync(this.usedLicensesFile)) {
        return [];
      }
      const data = fs.readFileSync(this.usedLicensesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ 读取已使用授权码列表失败:', error);
      return [];
    }
  }

  /**
   * 标记授权码为已使用
   * @param {string} licenseCode - 授权码
   * @param {object} licenseData - 授权数据
   * @returns {boolean} 是否标记成功
   */
  markLicenseAsUsed(licenseCode, licenseData) {
    try {
      const usedLicenses = this.getUsedLicenses();

      // 检查是否已经存在
      if (this.isLicenseUsed(licenseCode)) {
        console.log('⚠️ 授权码已被标记为使用');
        return true;
      }

      // 添加使用记录
      const usageRecord = {
        licenseCode: licenseCode,
        usedAt: new Date().toISOString(),
        usedTimestamp: Date.now(),
        licenseData: licenseData,
        userAgent: process.platform,
        version: '1.0'
      };

      usedLicenses.push(usageRecord);

      // 保存到文件
      fs.writeFileSync(this.usedLicensesFile, JSON.stringify(usedLicenses, null, 2));
      console.log('✅ 授权码已标记为使用:', licenseCode);
      return true;
    } catch (error) {
      console.error('❌ 标记授权码为已使用失败:', error);
      return false;
    }
  }

  /**
   * 生成授权码
   * @param {number} validDays - 有效天数
   * @param {string} licenseLevel - 授权级别 (basic, professional, enterprise)
   * @returns {string} 授权码
   */
  generateLicense(validDays = 30, licenseLevel = 'professional') {
    const now = Date.now();

    // 级别编码映射
    const levelCodes = {
      'basic': 'B',
      'professional': 'P',
      'enterprise': 'E'
    };

    // 简化的授权码生成逻辑
    // 使用简化的时间戳：当前时间除以1000后转36进制，只取6位
    const simplifiedTime = Math.floor(now / 1000); // 转为秒级时间戳
    const timeStr = simplifiedTime.toString(36).slice(-6).padStart(6, '0'); // 6位时间戳
    const daysStr = validDays.toString(36).padStart(2, '0'); // 2位有效期
    const levelCode = levelCodes[licenseLevel] || 'P'; // 1位级别码
    const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3位随机

    // 组合数据 - 确保总长度为12位 (6+2+1+3=12)
    const dataStr = (timeStr + daysStr + levelCode + randomStr).substring(0, 12).toUpperCase();

    // 生成校验码
    const checksum = this.generateChecksum(dataStr);

    // 组合成最终授权码 - 12位数据 + 4位校验码 = 16位
    const rawCode = dataStr + checksum;

    // 格式化为 XXXX-XXXX-XXXX-XXXX 格式
    return this.formatLicenseCode(rawCode);
  }

  /**
   * 在线验证授权码
   * @param {string} licenseCode - 授权码
   * @returns {object} 在线验证结果
   */
  async verifyLicenseOnline(licenseCode) {
    try {
      const OnlineLicenseManager = require('./online-license-manager');
      const onlineManager = new OnlineLicenseManager();
      return await onlineManager.verifyLicenseOnline(licenseCode);
    } catch (error) {
      console.log('在线验证模块加载失败:', error.message);
      return null;
    }
  }

  /**
   * 验证授权码 - 纯在线验证模式
   * @param {string} licenseCode - 授权码
   * @returns {object} 验证结果
   */
  async verifyLicense(licenseCode) {
    try {
      console.log('🔍 开始纯在线验证授权码:', licenseCode);

      // 基础格式验证
      const rawCode = licenseCode.replace(/-/g, '');
      if (rawCode.length !== 16) {
        return { valid: false, message: '授权码格式错误' };
      }

      // 分离数据和校验码进行基础校验
      const dataStr = rawCode.substring(0, 12);
      const checksum = rawCode.substring(12);

      // 验证校验码
      if (this.generateChecksum(dataStr) !== checksum) {
        return { valid: false, message: '授权码格式无效' };
      }

      // 执行在线验证 - 这是唯一的验证方式
      const onlineVerificationResult = await this.verifyLicenseOnline(licenseCode);

      if (!onlineVerificationResult) {
        return {
          valid: false,
          message: '在线验证服务不可用，请稍后重试'
        };
      }

      if (onlineVerificationResult.valid) {
        console.log('✅ 在线验证成功');
        return {
          valid: true,
          message: onlineVerificationResult.message,
          data: onlineVerificationResult.data,
          online: true,
          verificationTime: new Date().toISOString()
        };
      } else {
        console.log('❌ 在线验证失败:', onlineVerificationResult.message);
        return {
          valid: false,
          message: onlineVerificationResult.message,
          online: onlineVerificationResult.online || false,
          networkError: onlineVerificationResult.networkError || false
        };
      }

    } catch (error) {
      console.error('❌ 验证过程中发生错误:', error);
      return {
        valid: false,
        message: '验证过程中发生错误: ' + error.message
      };
    }
  }

  /**
   * 保存授权信息到本地
   * @param {object} licenseData - 授权数据
   * @param {string} licenseCode - 授权码（可选）
   */
  saveLicenseInfo(licenseData, licenseCode = null) {
    try {
      console.log('💾 正在保存授权信息到:', this.licenseFile);
      console.log('📊 授权数据:', licenseData);

      // 如果提供了授权码，将其包含在保存的数据中
      const dataToSave = {
        ...licenseData,
        savedAt: new Date().toISOString(), // 添加保存时间
        type: '在线授权' // 添加授权类型
      };

      if (licenseCode) {
        dataToSave.licenseCode = licenseCode;
        console.log('📝 包含授权码:', licenseCode);
      }

      console.log('📝 完整保存数据:', dataToSave);

      const encrypted = this.encrypt(JSON.stringify(dataToSave));
      fs.writeFileSync(this.licenseFile, encrypted);

      console.log('✅ 授权信息保存成功');

      // 验证文件是否真的被创建
      if (fs.existsSync(this.licenseFile)) {
        console.log('✅ 授权文件确认存在:', this.licenseFile);
      } else {
        console.error('❌ 授权文件保存后不存在!');
      }

      return true;
    } catch (error) {
      console.error('❌ 保存授权信息失败:', error);
      console.error('文件路径:', this.licenseFile);
      console.error('错误详情:', error.message);
      return false;
    }
  }

  /**
   * 从本地读取授权信息
   * @returns {object|null} 授权数据
   */
  loadLicenseInfo() {
    try {
      console.log('📖 正在读取授权信息从:', this.licenseFile);

      if (!fs.existsSync(this.licenseFile)) {
        console.log('❌ 授权文件不存在:', this.licenseFile);
        return null;
      }

      console.log('✅ 授权文件存在，正在读取...');
      const encrypted = fs.readFileSync(this.licenseFile, 'utf8');
      const decrypted = this.decrypt(encrypted);
      const licenseData = JSON.parse(decrypted);

      console.log('✅ 授权信息读取成功:', licenseData);

      // 标准化数据格式，确保日期字段正确映射
      const standardizedData = {
        ...licenseData,
        expiryDate: licenseData.expiresAt || licenseData.expiryDate || licenseData.expires || '未知',
        expires: licenseData.expiresAt || licenseData.expiryDate || licenseData.expires,
        type: licenseData.type || '在线授权'
      };

      console.log('📊 标准化后的数据:', standardizedData);
      return standardizedData;
    } catch (error) {
      console.error('❌ 读取授权信息失败:', error);
      console.error('文件路径:', this.licenseFile);
      return null;
    }
  }

  /**
   * 检查授权状态 - 纯在线验证模式
   * 不再依赖本地缓存，每次都进行在线验证
   * @param {string} licenseCode - 授权码
   * @returns {object} 授权状态
   */
  async checkLicenseStatus(licenseCode) {
    console.log('🔍 开始在线检查授权状态...');

    if (!licenseCode) {
      console.log('❌ 未提供授权码');
      return { valid: false, message: '未提供授权码' };
    }

    try {
      // 执行在线验证
      const onlineResult = await this.verifyLicenseOnline(licenseCode);

      if (!onlineResult) {
        return {
          valid: false,
          message: '在线验证服务不可用，请稍后重试'
        };
      }

      if (onlineResult.valid) {
        console.log('✅ 在线验证成功');

        // 计算剩余时间（基于服务器返回的数据）
        const data = onlineResult.data;
        let remainingDays = 0;
        let remainingMinutes = 0;
        let isMinuteLicense = false;

        if (data && data.expiresAt) {
          const now = Date.now();
          const expiresAt = new Date(data.expiresAt).getTime();
          const remainingMs = expiresAt - now;

          if (remainingMs > 0) {
            if (remainingMs < 24 * 60 * 60 * 1000) { // 小于24小时
              isMinuteLicense = true;
              remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
              remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
            } else {
              remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
            }
          }
        }

        return {
          valid: true,
          message: onlineResult.message,
          data: data,
          remainingDays: remainingDays,
          remainingMinutes: remainingMinutes,
          isMinuteLicense: isMinuteLicense,
          online: true,
          verificationTime: new Date().toISOString()
        };
      } else {
        console.log('❌ 在线验证失败:', onlineResult.message);
        return {
          valid: false,
          message: onlineResult.message,
          online: onlineResult.online || false,
          networkError: onlineResult.networkError || false
        };
      }

    } catch (error) {
      console.error('❌ 检查授权状态时发生错误:', error);
      return {
        valid: false,
        message: '检查授权状态时发生错误: ' + error.message
      };
    }
  }

  /**
   * 持续在线验证检查 - 纯在线模式
   * 定期检查授权码状态，确保未被禁用或撤销
   * @param {string} licenseCode - 授权码
   */
  async startContinuousOnlineCheck(licenseCode) {
    try {
      console.log('🔄 启动持续在线验证检查...');

      if (!licenseCode) {
        console.log('⚠️ 未提供授权码，无法启动持续验证');
        return;
      }

      // 立即执行一次验证
      const initialCheck = await this.verifyLicenseOnline(licenseCode);
      if (initialCheck && !initialCheck.valid) {
        console.log('🚨 初始验证失败:', initialCheck.message);

        // 通知主进程授权失效
        if (typeof process !== 'undefined' && process.emit) {
          process.emit('license-revoked', {
            reason: initialCheck.message,
            timestamp: new Date().toISOString()
          });
        }
        return;
      }

      // 设置定期验证（每5分钟验证一次）
      const verificationInterval = setInterval(async () => {
        try {
          console.log('🔍 执行定期在线验证检查...');

          const onlineResult = await this.verifyLicenseOnline(licenseCode);

          logger.logContinuousCheck(licenseCode, onlineResult);

          if (onlineResult && !onlineResult.valid) {
            console.log('🚨 定期验证失败，授权可能已被撤销:', onlineResult.message);
            logger.logLicenseRevoked(licenseCode, onlineResult.message);

            // 清除定时器
            clearInterval(verificationInterval);

            // 通知主进程授权已失效
            if (typeof process !== 'undefined' && process.emit) {
              process.emit('license-revoked', {
                reason: onlineResult.message,
                timestamp: new Date().toISOString(),
                continuous: true
              });
            }
          } else if (onlineResult && onlineResult.valid) {
            console.log('✅ 定期验证成功');
          }
        } catch (error) {
          console.log('⚠️ 定期验证失败（网络问题）:', error.message);
          // 网络问题不清除定时器，继续尝试
        }
      }, 5 * 60 * 1000); // 5分钟间隔

      // 保存定时器引用，以便后续清除
      this.verificationInterval = verificationInterval;

    } catch (error) {
      console.log('启动持续验证检查失败:', error.message);
    }
  }

  /**
   * 停止持续验证检查
   */
  stopContinuousOnlineCheck() {
    if (this.verificationInterval) {
      clearInterval(this.verificationInterval);
      this.verificationInterval = null;
      console.log('🛑 已停止持续在线验证检查');
    }
  }

  /**
   * 清除本地授权信息
   */
  clearLicenseInfo() {
    try {
      if (fs.existsSync(this.licenseFile)) {
        fs.unlinkSync(this.licenseFile);
      }
      return true;
    } catch (error) {
      console.error('清除授权信息失败:', error);
      return false;
    }
  }

  /**
   * 检查本地授权状态
   * @returns {object} 本地授权状态
   */
  checkLocalLicense() {
    try {
      console.log('🔍 检查本地授权状态...');

      const licenseInfo = this.getLicenseInfo();

      if (!licenseInfo) {
        console.log('❌ 本地未找到授权信息');
        return {
          valid: false,
          message: '未找到授权信息，请进行授权验证',
          requiresVerification: true
        };
      }

      // 检查授权是否过期
      if (licenseInfo.expiryDate) {
        const expiryDate = new Date(licenseInfo.expiryDate);
        const now = new Date();

        if (now > expiryDate) {
          console.log('❌ 本地授权已过期');
          return {
            valid: false,
            message: '授权已过期，请重新验证',
            requiresVerification: true,
            expired: true
          };
        }

        // 计算剩余时间
        const remainingTime = expiryDate.getTime() - now.getTime();
        const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
        const remainingMinutes = Math.ceil(remainingTime / (1000 * 60));

        // 判断是否为分钟级授权（剩余时间小于24小时）
        const isMinuteLicense = remainingTime < 24 * 60 * 60 * 1000;

        console.log('✅ 本地授权有效，剩余天数:', remainingDays, '剩余分钟:', remainingMinutes);
        return {
          valid: true,
          message: '授权有效',
          licenseCode: licenseInfo.licenseCode,
          expiryDate: licenseInfo.expiryDate,
          remainingDays: remainingDays,
          remainingMinutes: remainingMinutes,
          isMinuteLicense: isMinuteLicense,
          licenseInfo: licenseInfo
        };
      }

      // 如果没有过期时间信息，认为需要重新验证
      console.log('⚠️ 授权信息不完整，需要重新验证');
      return {
        valid: false,
        message: '授权信息不完整，请重新验证',
        requiresVerification: true
      };

    } catch (error) {
      console.error('❌ 检查本地授权状态失败:', error);
      return {
        valid: false,
        message: '检查授权状态时发生错误',
        requiresVerification: true,
        error: error.message
      };
    }
  }

  /**
   * 获取本地保存的授权信息
   * @returns {object|null} 授权信息对象，如果不存在则返回null
   */
  getLicenseInfo() {
    try {
      console.log('📋 正在读取本地授权信息:', this.licenseFile);

      if (!fs.existsSync(this.licenseFile)) {
        console.log('📝 本地授权文件不存在');
        return null;
      }

      const encryptedData = fs.readFileSync(this.licenseFile, 'utf8');
      const decryptedData = this.decrypt(encryptedData);
      const licenseInfo = JSON.parse(decryptedData);

      console.log('✅ 成功读取本地授权信息');

      // 标准化数据格式，兼容新旧格式
      const standardizedInfo = {
        licenseCode: licenseInfo.licenseCode || '未知',
        type: licenseInfo.type || '在线授权',
        expiryDate: licenseInfo.expiresAt || licenseInfo.expiryDate || licenseInfo.expires || '未知',
        savedAt: licenseInfo.savedAt || licenseInfo.usedAt || new Date().toISOString(),
        validityDays: licenseInfo.validityDays || 30,
        isUsed: licenseInfo.isUsed || false,
        usedAt: licenseInfo.usedAt || licenseInfo.savedAt,
        // 保留原始数据，确保 expiresAt 字段可用
        ...licenseInfo,
        // 确保 expires 和 expiresAt 字段都可用于前端显示
        expires: licenseInfo.expiresAt || licenseInfo.expiryDate || licenseInfo.expires
      };

      console.log('📊 标准化授权信息:', {
        licenseCode: standardizedInfo.licenseCode,
        type: standardizedInfo.type,
        expiryDate: standardizedInfo.expiryDate,
        savedAt: standardizedInfo.savedAt,
        validityDays: standardizedInfo.validityDays
      });

      return standardizedInfo;
    } catch (error) {
      console.error('❌ 读取本地授权信息失败:', error);
      return null;
    }
  }

  /**
   * 简化的数据编码（使用Base64编码）
   * @param {string} text - 要编码的文本
   * @returns {string} 编码后的文本
   */
  encrypt(text) {
    // 使用Base64编码，简单但有效
    return Buffer.from(text + '|' + this.secretKey).toString('base64');
  }

  /**
   * 简化的数据解码
   * @param {string} encoded - 编码的文本
   * @returns {string} 解码后的文本
   */
  decrypt(encoded) {
    try {
      // 使用Base64解码
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const parts = decoded.split('|');

      if (parts.length === 2 && parts[1] === this.secretKey) {
        return parts[0]; // 返回原始数据
      } else {
        throw new Error('Invalid license data');
      }
    } catch (error) {
      console.error('解码授权数据失败:', error);
      throw error;
    }
  }

  /**
   * 生成校验码
   * @param {string} data - 数据
   * @returns {string} 校验码
   */
  generateChecksum(data) {
    const hash = crypto.createHash('md5').update(data + this.secretKey).digest('hex');
    return hash.substring(0, 4).toUpperCase();
  }

  /**
   * 格式化授权码
   * @param {string} rawCode - 原始代码
   * @returns {string} 格式化的授权码
   */
  formatLicenseCode(rawCode) {
    // 确保是16位
    const code = rawCode.substring(0, 16).toUpperCase();
    return code.match(/.{1,4}/g).join('-');
  }

  /**
   * 生成预设的测试授权码
   * @returns {array} 测试授权码列表
   */
  generateTestLicenses() {
    return [
      this.generateLicense(7),   // 7天
      this.generateLicense(30),  // 30天
      this.generateLicense(90),  // 90天
      this.generateLicense(365)  // 1年
    ];
  }

  /**
   * 生成分钟级授权码（用于测试）
   * @param {number} validMinutes - 有效分钟数
   * @returns {string} 授权码
   */
  generateMinuteLicense(validMinutes = 2) {
    const now = Date.now();
    const expireTime = now + (validMinutes * 60 * 1000); // 分钟转毫秒

    // 创建自定义授权数据
    const licenseData = {
      issued: now,
      expires: expireTime,
      version: '1.0',
      product: 'LEIYU-MEDIA-CONFIG'
    };

    // 保存到本地文件用于验证
    this.saveLicenseInfo(licenseData);

    // 生成一个特殊的分钟级授权码
    // 使用特殊标识 'MIN' + 分钟数 + 时间戳
    const timeStr = now.toString(36).substring(-6).padStart(6, '0');
    const minuteStr = validMinutes.toString(36).padStart(2, '0');
    const specialFlag = 'MIN'; // 特殊标识，表示这是分钟级授权码

    // 组合数据
    const dataStr = (specialFlag + minuteStr + timeStr + '0').substring(0, 12).toUpperCase();

    // 生成校验码
    const checksum = this.generateChecksum(dataStr);

    // 组合成最终授权码
    const rawCode = dataStr + checksum;

    return this.formatLicenseCode(rawCode);
  }
}

module.exports = LicenseManager;
