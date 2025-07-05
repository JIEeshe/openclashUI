/**
 * 🐛 调试日志记录器
 * 
 * 专门用于追踪 mainWindow 相关的操作和错误
 */

const fs = require('fs');
const path = require('path');

class DebugLogger {
  constructor() {
    this.logFile = path.join(__dirname, `debug_${new Date().toISOString().slice(0, 10)}.log`);
    this.initLogger();
  }

  initLogger() {
    // 创建日志文件头部
    const header = `
=== 🐛 MainWindow 调试日志 ===
开始时间: ${new Date().toISOString()}
进程ID: ${process.pid}
Electron版本: ${process.versions.electron}
Node版本: ${process.versions.node}
平台: ${process.platform}
架构: ${process.arch}
=====================================

`;
    fs.writeFileSync(this.logFile, header);
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      stack: new Error().stack.split('\n').slice(2, 5) // 获取调用栈
    };

    const logLine = `[${timestamp}] ${level.toUpperCase()}: ${message}\n`;
    
    // 写入文件
    fs.appendFileSync(this.logFile, logLine);
    
    // 如果有数据，也写入
    if (data) {
      fs.appendFileSync(this.logFile, `  数据: ${JSON.stringify(data, null, 2)}\n`);
    }
    
    // 控制台输出
    console.log(logLine.trim());
    if (data) {
      console.log('  数据:', data);
    }
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }

  debug(message, data) {
    this.log('DEBUG', message, data);
  }

  // 专门用于追踪 mainWindow 状态
  trackMainWindow(action, windowState = null) {
    const state = windowState || {
      exists: !!global.mainWindow,
      isDestroyed: global.mainWindow ? global.mainWindow.isDestroyed() : 'N/A',
      isVisible: global.mainWindow && !global.mainWindow.isDestroyed() ? global.mainWindow.isVisible() : 'N/A'
    };

    this.info(`MainWindow ${action}`, state);
  }

  // 记录函数调用
  logFunctionCall(functionName, args = []) {
    this.debug(`调用函数: ${functionName}`, { arguments: args });
  }

  // 记录异步操作
  logAsyncOperation(operationName, delay = 0) {
    this.info(`异步操作: ${operationName}`, { delay });
  }
}

// 创建全局实例
const debugLogger = new DebugLogger();

// 导出包装函数，用于增强现有函数
function wrapWithLogging(fn, functionName) {
  return function(...args) {
    debugLogger.logFunctionCall(functionName, args);
    
    try {
      const result = fn.apply(this, args);
      debugLogger.debug(`函数 ${functionName} 执行成功`);
      return result;
    } catch (error) {
      debugLogger.error(`函数 ${functionName} 执行失败`, { error: error.message, stack: error.stack });
      throw error;
    }
  };
}

// 导出包装 setTimeout 的函数
function wrapSetTimeout(callback, delay, operationName = 'unknown') {
  debugLogger.logAsyncOperation(operationName, delay);
  
  return setTimeout(() => {
    debugLogger.debug(`执行延迟操作: ${operationName}`);
    
    try {
      callback();
      debugLogger.debug(`延迟操作 ${operationName} 执行成功`);
    } catch (error) {
      debugLogger.error(`延迟操作 ${operationName} 执行失败`, { error: error.message, stack: error.stack });
    }
  }, delay);
}

module.exports = {
  debugLogger,
  wrapWithLogging,
  wrapSetTimeout
};
