/**
 * 安全管理器
 * 实现客户端防破解和安全验证机制
 */

const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SecurityManager {
  constructor() {
    this.securityConfig = {
      // 安全密钥
      encryptionKey: 'LEIYU-MEDIA-SECURITY-2025',
      // 指纹组件权重
      fingerprintWeights: {
        hardware: 0.4,
        system: 0.3,
        user: 0.2,
        app: 0.1
      },
      // 验证间隔（毫秒）
      verificationInterval: 5 * 60 * 1000, // 5分钟
      // 最大验证失败次数
      maxFailures: 3
    };

    this.securityState = {
      lastVerification: 0,
      failureCount: 0,
      isSecure: false,
      fingerprint: null,
      sessionToken: null
    };

    this.init();
  }

  /**
   * 初始化安全管理器
   */
  async init() {
    try {
      console.log('🔒 初始化安全管理器...');
      
      // 生成设备指纹
      this.securityState.fingerprint = await this.generateDeviceFingerprint();
      
      // 生成会话令牌
      this.securityState.sessionToken = this.generateSessionToken();
      
      // 执行初始安全检查
      await this.performSecurityCheck();
      
      // 启动定期安全验证
      this.startPeriodicVerification();
      
      console.log('✅ 安全管理器初始化完成');
      console.log('🔍 设备指纹:', this.securityState.fingerprint.substring(0, 16) + '...');
      
    } catch (error) {
      console.error('❌ 安全管理器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 生成设备指纹
   * 基于硬件和系统信息生成唯一标识
   */
  async generateDeviceFingerprint() {
    try {
      const components = {
        // 硬件信息
        hardware: {
          cpus: os.cpus().map(cpu => ({
            model: cpu.model,
            speed: cpu.speed
          })),
          totalMemory: os.totalmem(),
          arch: os.arch(),
          platform: os.platform()
        },
        
        // 系统信息
        system: {
          hostname: os.hostname(),
          userInfo: os.userInfo(),
          networkInterfaces: this.getNetworkFingerprint(),
          osVersion: os.release()
        },
        
        // 用户环境
        user: {
          homeDir: os.homedir(),
          userData: app.getPath('userData'),
          username: process.env.USERNAME || process.env.USER || 'unknown'
        },
        
        // 应用信息
        app: {
          version: app.getVersion(),
          name: app.getName(),
          execPath: process.execPath
        }
      };

      // 生成加权哈希
      const fingerprint = this.generateWeightedHash(components);
      
      // 保存指纹到本地（加密存储）
      await this.saveFingerprint(fingerprint);
      
      return fingerprint;
      
    } catch (error) {
      console.error('生成设备指纹失败:', error);
      throw error;
    }
  }

  /**
   * 获取网络接口指纹
   */
  getNetworkFingerprint() {
    try {
      const interfaces = os.networkInterfaces();
      const fingerprint = {};
      
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (addrs) {
          fingerprint[name] = addrs
            .filter(addr => !addr.internal)
            .map(addr => ({
              family: addr.family,
              mac: addr.mac
            }));
        }
      }
      
      return fingerprint;
    } catch (error) {
      console.warn('获取网络指纹失败:', error);
      return {};
    }
  }

  /**
   * 生成加权哈希
   */
  generateWeightedHash(components) {
    const hashes = {};
    
    // 为每个组件生成哈希
    for (const [category, data] of Object.entries(components)) {
      const dataString = JSON.stringify(data, Object.keys(data).sort());
      hashes[category] = crypto
        .createHash('sha256')
        .update(dataString)
        .digest('hex');
    }
    
    // 根据权重组合哈希
    let weightedData = '';
    for (const [category, hash] of Object.entries(hashes)) {
      const weight = this.securityConfig.fingerprintWeights[category] || 0.1;
      const weightedHash = hash.substring(0, Math.floor(64 * weight));
      weightedData += weightedHash;
    }
    
    // 生成最终指纹
    return crypto
      .createHash('sha256')
      .update(weightedData + this.securityConfig.encryptionKey)
      .digest('hex');
  }

  /**
   * 保存指纹到本地
   */
  async saveFingerprint(fingerprint) {
    try {
      const securityDir = path.join(app.getPath('userData'), '.security');
      if (!fs.existsSync(securityDir)) {
        fs.mkdirSync(securityDir, { recursive: true });
      }

      const fingerprintFile = path.join(securityDir, 'device.fp');
      const encryptedFingerprint = this.encryptData(fingerprint);
      
      fs.writeFileSync(fingerprintFile, encryptedFingerprint);
      
      // 设置文件为隐藏和只读
      if (process.platform === 'win32') {
        try {
          require('child_process').execSync(`attrib +H +R "${fingerprintFile}"`);
        } catch (error) {
          console.warn('设置文件属性失败:', error.message);
        }
      }
      
    } catch (error) {
      console.warn('保存指纹失败:', error);
    }
  }

  /**
   * 验证设备指纹
   */
  async verifyDeviceFingerprint() {
    try {
      const currentFingerprint = await this.generateDeviceFingerprint();
      const storedFingerprint = await this.loadStoredFingerprint();
      
      if (!storedFingerprint) {
        console.warn('⚠️ 未找到存储的设备指纹');
        return false;
      }
      
      // 允许轻微的指纹变化（例如网络配置变更）
      const similarity = this.calculateFingerprintSimilarity(currentFingerprint, storedFingerprint);
      const threshold = 0.85; // 85%相似度阈值
      
      if (similarity >= threshold) {
        console.log(`✅ 设备指纹验证通过 (相似度: ${(similarity * 100).toFixed(1)}%)`);
        return true;
      } else {
        console.warn(`⚠️ 设备指纹验证失败 (相似度: ${(similarity * 100).toFixed(1)}%)`);
        return false;
      }
      
    } catch (error) {
      console.error('验证设备指纹失败:', error);
      return false;
    }
  }

  /**
   * 加载存储的指纹
   */
  async loadStoredFingerprint() {
    try {
      const fingerprintFile = path.join(app.getPath('userData'), '.security', 'device.fp');
      
      if (!fs.existsSync(fingerprintFile)) {
        return null;
      }
      
      const encryptedFingerprint = fs.readFileSync(fingerprintFile, 'utf8');
      return this.decryptData(encryptedFingerprint);
      
    } catch (error) {
      console.warn('加载存储指纹失败:', error);
      return null;
    }
  }

  /**
   * 计算指纹相似度
   */
  calculateFingerprintSimilarity(fp1, fp2) {
    if (fp1 === fp2) return 1.0;
    
    // 使用汉明距离计算相似度
    let matches = 0;
    const length = Math.min(fp1.length, fp2.length);
    
    for (let i = 0; i < length; i++) {
      if (fp1[i] === fp2[i]) {
        matches++;
      }
    }
    
    return matches / length;
  }

  /**
   * 生成会话令牌
   */
  generateSessionToken() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    const data = `${this.securityState.fingerprint}|${timestamp}|${random}`;
    
    return crypto
      .createHmac('sha256', this.securityConfig.encryptionKey)
      .update(data)
      .digest('hex');
  }

  /**
   * 执行安全检查
   */
  async performSecurityCheck() {
    try {
      console.log('🔍 执行安全检查...');
      
      // 检查设备指纹
      const fingerprintValid = await this.verifyDeviceFingerprint();
      
      // 检查进程完整性
      const processValid = this.checkProcessIntegrity();
      
      // 检查调试器
      const debuggerCheck = this.detectDebugger();
      
      // 检查虚拟机环境
      const vmCheck = this.detectVirtualMachine();
      
      const isSecure = fingerprintValid && processValid && !debuggerCheck && !vmCheck;
      
      this.securityState.isSecure = isSecure;
      this.securityState.lastVerification = Date.now();
      
      if (isSecure) {
        this.securityState.failureCount = 0;
        console.log('✅ 安全检查通过');
      } else {
        this.securityState.failureCount++;
        console.warn(`⚠️ 安全检查失败 (失败次数: ${this.securityState.failureCount})`);
        
        if (this.securityState.failureCount >= this.securityConfig.maxFailures) {
          await this.handleSecurityViolation();
        }
      }
      
      return isSecure;
      
    } catch (error) {
      console.error('安全检查异常:', error);
      return false;
    }
  }

  /**
   * 检查进程完整性
   */
  checkProcessIntegrity() {
    try {
      // 检查进程名称
      const expectedName = 'electron';
      const actualName = path.basename(process.execPath, '.exe').toLowerCase();
      
      if (!actualName.includes(expectedName)) {
        console.warn('⚠️ 进程名称异常:', actualName);
        return false;
      }
      
      // 检查命令行参数
      const suspiciousArgs = ['--inspect', '--debug', '--remote-debugging'];
      const hasDebugArgs = process.argv.some(arg => 
        suspiciousArgs.some(suspicious => arg.includes(suspicious))
      );
      
      if (hasDebugArgs) {
        console.warn('⚠️ 检测到调试参数');
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.warn('进程完整性检查失败:', error);
      return false;
    }
  }

  /**
   * 检测调试器
   */
  detectDebugger() {
    try {
      // 检查开发者工具
      if (process.env.NODE_ENV === 'development') {
        return false; // 开发环境跳过检查
      }
      
      // 检查调试端口
      const debugPorts = [9229, 9230, 5858];
      // 这里可以添加更多调试器检测逻辑
      
      return false; // 暂时返回false
      
    } catch (error) {
      console.warn('调试器检测失败:', error);
      return false;
    }
  }

  /**
   * 检测虚拟机环境
   */
  detectVirtualMachine() {
    try {
      const vmIndicators = [
        'vmware', 'virtualbox', 'qemu', 'xen', 'hyper-v',
        'parallels', 'kvm', 'bochs'
      ];
      
      const systemInfo = [
        os.hostname().toLowerCase(),
        os.userInfo().username.toLowerCase(),
        process.env.COMPUTERNAME?.toLowerCase() || '',
        process.env.USERNAME?.toLowerCase() || ''
      ].join(' ');
      
      const hasVmIndicator = vmIndicators.some(indicator => 
        systemInfo.includes(indicator)
      );
      
      if (hasVmIndicator) {
        console.warn('⚠️ 检测到虚拟机环境');
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.warn('虚拟机检测失败:', error);
      return false;
    }
  }

  /**
   * 处理安全违规
   */
  async handleSecurityViolation() {
    try {
      console.error('🚨 检测到安全违规，执行保护措施...');
      
      // 清除敏感数据
      this.clearSensitiveData();
      
      // 记录安全事件
      await this.logSecurityEvent('SECURITY_VIOLATION', {
        failureCount: this.securityState.failureCount,
        timestamp: new Date().toISOString(),
        fingerprint: this.securityState.fingerprint
      });
      
      // 显示安全警告
      const { dialog } = require('electron');
      dialog.showErrorBox(
        '安全警告',
        '检测到异常环境，应用将退出以保护数据安全。'
      );
      
      // 延迟退出，给用户时间看到警告
      setTimeout(() => {
        app.quit();
      }, 3000);
      
    } catch (error) {
      console.error('处理安全违规失败:', error);
      app.quit();
    }
  }

  /**
   * 清除敏感数据
   */
  clearSensitiveData() {
    try {
      // 清除内存中的敏感信息
      this.securityState.sessionToken = null;
      
      // 清除缓存文件
      const cacheDir = path.join(app.getPath('userData'), 'cache');
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      }
      
      console.log('🗑️ 敏感数据已清除');
      
    } catch (error) {
      console.error('清除敏感数据失败:', error);
    }
  }

  /**
   * 记录安全事件
   */
  async logSecurityEvent(eventType, data) {
    try {
      const logDir = path.join(app.getPath('userData'), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logFile = path.join(logDir, 'security.log');
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: eventType,
        data: data
      };
      
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
      
    } catch (error) {
      console.error('记录安全事件失败:', error);
    }
  }

  /**
   * 启动定期安全验证
   */
  startPeriodicVerification() {
    setInterval(async () => {
      const timeSinceLastCheck = Date.now() - this.securityState.lastVerification;
      
      if (timeSinceLastCheck >= this.securityConfig.verificationInterval) {
        console.log('🔄 执行定期安全验证...');
        await this.performSecurityCheck();
      }
    }, 60000); // 每分钟检查一次
  }

  /**
   * 加密数据
   */
  encryptData(text) {
    const cipher = crypto.createCipher('aes-256-cbc', this.securityConfig.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * 解密数据
   */
  decryptData(encryptedText) {
    const decipher = crypto.createDecipher('aes-256-cbc', this.securityConfig.encryptionKey);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * 获取安全状态
   */
  getSecurityStatus() {
    return {
      isSecure: this.securityState.isSecure,
      fingerprint: this.securityState.fingerprint,
      lastVerification: this.securityState.lastVerification,
      failureCount: this.securityState.failureCount,
      sessionToken: this.securityState.sessionToken
    };
  }
}

module.exports = SecurityManager;
