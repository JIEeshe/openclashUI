/**
 * 在线验证日志记录器
 * 专门用于纯在线验证模式的调试和监控
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class OnlineVerificationLogger {
  constructor() {
    this.logDir = this.getLogDirectory();
    this.ensureLogDirectory();
    this.currentLogFile = this.getCurrentLogFile();
    
    console.log('📊 在线验证日志记录器初始化完成');
    console.log('📁 日志目录:', this.logDir);
    console.log('📄 当前日志文件:', this.currentLogFile);
  }

  /**
   * 获取日志目录
   */
  getLogDirectory() {
    try {
      if (typeof app !== 'undefined' && app.getPath) {
        return path.join(app.getPath('userData'), 'logs', 'online-verification');
      } else {
        // 在Node.js环境中使用临时目录
        const os = require('os');
        return path.join(os.tmpdir(), 'openclash-manager-logs', 'online-verification');
      }
    } catch (error) {
      console.error('获取日志目录失败:', error);
      return path.join(process.cwd(), 'logs', 'online-verification');
    }
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('创建日志目录失败:', error);
    }
  }

  /**
   * 获取当前日志文件路径
   */
  getCurrentLogFile() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `verification-${today}.log`);
  }

  /**
   * 写入日志
   */
  writeLog(level, category, message, data = null) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        category,
        message,
        data: data ? JSON.stringify(data, null, 2) : null,
        pid: process.pid
      };

      const logLine = `[${timestamp}] [${level}] [${category}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
      
      // 写入文件
      fs.appendFileSync(this.currentLogFile, logLine);
      
      // 同时输出到控制台
      const consoleMessage = `📊 [${category}] ${message}`;
      switch (level) {
        case 'ERROR':
          console.error(consoleMessage, data || '');
          break;
        case 'WARN':
          console.warn(consoleMessage, data || '');
          break;
        case 'INFO':
          console.log(consoleMessage, data || '');
          break;
        case 'DEBUG':
          console.debug(consoleMessage, data || '');
          break;
        default:
          console.log(consoleMessage, data || '');
      }
    } catch (error) {
      console.error('写入日志失败:', error);
    }
  }

  /**
   * 记录验证开始
   */
  logVerificationStart(licenseCode, clientFingerprint) {
    this.writeLog('INFO', 'VERIFICATION_START', '开始在线验证', {
      licenseCode: licenseCode,
      clientFingerprint: clientFingerprint?.substring(0, 16) + '...',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录验证成功
   */
  logVerificationSuccess(licenseCode, data) {
    this.writeLog('INFO', 'VERIFICATION_SUCCESS', '在线验证成功', {
      licenseCode: licenseCode,
      data: data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录验证失败
   */
  logVerificationFailure(licenseCode, reason, networkError = false) {
    this.writeLog('ERROR', 'VERIFICATION_FAILURE', '在线验证失败', {
      licenseCode: licenseCode,
      reason: reason,
      networkError: networkError,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录网络错误
   */
  logNetworkError(error, endpoint) {
    this.writeLog('ERROR', 'NETWORK_ERROR', '网络连接失败', {
      error: error.message,
      endpoint: endpoint,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录服务器响应
   */
  logServerResponse(endpoint, response, success) {
    this.writeLog(success ? 'INFO' : 'WARN', 'SERVER_RESPONSE', `服务器响应 - ${endpoint}`, {
      success: success,
      response: response,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录持续验证检查
   */
  logContinuousCheck(licenseCode, result) {
    this.writeLog('INFO', 'CONTINUOUS_CHECK', '持续验证检查', {
      licenseCode: licenseCode,
      result: result,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录授权撤销
   */
  logLicenseRevoked(licenseCode, reason) {
    this.writeLog('WARN', 'LICENSE_REVOKED', '授权已被撤销', {
      licenseCode: licenseCode,
      reason: reason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录状态检查
   */
  logStatusCheck(licenseCode, status) {
    this.writeLog('INFO', 'STATUS_CHECK', '授权码状态检查', {
      licenseCode: licenseCode,
      status: status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 清理旧日志文件（保留最近7天）
   */
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

      files.forEach(file => {
        if (file.startsWith('verification-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < sevenDaysAgo) {
            fs.unlinkSync(filePath);
            console.log('🗑️ 已清理旧日志文件:', file);
          }
        }
      });
    } catch (error) {
      console.error('清理旧日志文件失败:', error);
    }
  }

  /**
   * 获取日志统计信息
   */
  getLogStats() {
    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files.filter(file => file.startsWith('verification-') && file.endsWith('.log'));
      
      let totalSize = 0;
      logFiles.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      });

      return {
        fileCount: logFiles.length,
        totalSize: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        logDirectory: this.logDir
      };
    } catch (error) {
      console.error('获取日志统计失败:', error);
      return null;
    }
  }
}

// 创建全局实例
const logger = new OnlineVerificationLogger();

// 启动时清理旧日志
logger.cleanupOldLogs();

module.exports = logger;
