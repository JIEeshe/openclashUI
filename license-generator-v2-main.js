/**
 * 卡密管理系统 V2 - 独立启动程序
 * 简化版本，专门用于批量生成和管理授权码
 */

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const LicenseManager = require('./license-manager.js');
const LicenseUploader = require('./license-uploader.js');

// 创建授权管理器和上传器实例
const licenseManager = new LicenseManager();
const licenseUploader = new LicenseUploader();

let mainWindow;

// 确保只有一个实例运行
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，将焦点放在主窗口上
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // 当 Electron 完成初始化时创建窗口
  app.whenReady().then(createWindow);
}

// 创建主窗口
function createWindow() {
  console.log('🚀 启动卡密管理系统 V2...');

  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: '雷雨传媒网络配置管理工具 - 卡密管理系统 V2',
    show: false, // 先不显示，等加载完成后再显示
  });

  // 加载 HTML 文件
  mainWindow.loadFile('license-generator-v2.html');

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('✅ 卡密管理系统 V2 启动成功');
    
    // 开发环境下打开开发者工具
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
  });

  // 窗口关闭时的处理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 设置菜单
  createMenu();
}

// 创建菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建批次',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.executeJavaScript('generateLicenses()');
          }
        },
        {
          label: '导出卡密',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.executeJavaScript('exportLicenses()');
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '工具',
      submenu: [
        {
          label: '生成测试卡密',
          click: () => {
            mainWindow.webContents.executeJavaScript('generateTestLicenses()');
          }
        },
        {
          label: '验证卡密',
          click: () => {
            mainWindow.webContents.executeJavaScript('verifyLicenseCode()');
          }
        },
        {
          label: '检查服务器状态',
          click: () => {
            mainWindow.webContents.executeJavaScript('checkServerStatus()');
          }
        },
        { type: 'separator' },
        {
          label: '重新加载',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.reload();
          }
        },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于卡密管理系统 V2',
              message: '雷雨传媒网络配置管理工具',
              detail: '卡密管理系统 V2.0.0\n\n简化版本，专注于核心功能。\n\n© 2025 雷雨传媒',
              buttons: ['确定']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC 处理程序

// 生成单个授权码
ipcMain.handle('generate-license', async (event, validityDays, licenseLevel = 'professional') => {
  try {
    const code = licenseManager.generateLicense(validityDays, licenseLevel);
    const verification = await licenseManager.verifyLicense(code);

    return {
      success: true,
      code: code,
      licenseLevel: licenseLevel,
      validityDays: validityDays,
      verification: verification
    };
  } catch (error) {
    console.error('生成授权码失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 批量生成授权码
ipcMain.handle('generate-batch-licenses', async (event, { licenseLevel, validityDays, quantity, batchName }) => {
  try {
    const licenses = [];
    const batchId = Date.now();

    // 级别配置
    const levelConfigs = {
      basic: { name: '基础版', icon: '🥉', maxNodes: 10 },
      professional: { name: '专业版', icon: '🥈', maxNodes: 100 },
      enterprise: { name: '企业版', icon: '🥇', maxNodes: -1 }
    };

    const levelConfig = levelConfigs[licenseLevel] || levelConfigs.professional;

    for (let i = 0; i < quantity; i++) {
      const code = licenseManager.generateLicense(validityDays, licenseLevel);
      const verification = await licenseManager.verifyLicense(code);

      licenses.push({
        id: `${batchId}-${i + 1}`,
        code: code,
        licenseLevel: licenseLevel || 'professional',
        levelName: levelConfig.name,
        levelIcon: levelConfig.icon,
        maxNodes: levelConfig.maxNodes,
        validityDays: validityDays,
        batchName: batchName || `批次-${batchId}`,
        batchId: batchId,
        generatedAt: new Date(),
        verification: verification
      });
    }

    return {
      success: true,
      licenses: licenses,
      batchId: batchId
    };
  } catch (error) {
    console.error('批量生成授权码失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 验证授权码
ipcMain.handle('verify-license-code', async (event, licenseCode) => {
  try {
    const result = await licenseManager.verifyLicense(licenseCode);
    return {
      success: true,
      result: result
    };
  } catch (error) {
    console.error('验证授权码失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 生成测试授权码
ipcMain.handle('generate-test-licenses', async (event) => {
  try {
    const testConfigs = [
      { days: 7, level: 'basic', name: '7天基础版' },
      { days: 30, level: 'professional', name: '30天专业版' },
      { days: 90, level: 'professional', name: '90天专业版' },
      { days: 365, level: 'enterprise', name: '365天企业版' }
    ];

    const testLicenses = testConfigs.map(config => {
      const code = licenseManager.generateLicense(config.days, config.level);
      return {
        code: code,
        licenseLevel: config.level,
        validityDays: config.days,
        name: config.name
      };
    });

    return {
      success: true,
      licenses: testLicenses
    };
  } catch (error) {
    console.error('生成测试授权码失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 获取已使用的授权码列表
ipcMain.handle('get-used-licenses', async (event) => {
  try {
    const usedLicenses = licenseManager.getUsedLicenses();
    return {
      success: true,
      usedLicenses: usedLicenses
    };
  } catch (error) {
    console.error('获取已使用授权码列表失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 检查授权码使用状态
ipcMain.handle('check-license-status', async (event, licenseCode) => {
  try {
    const isUsed = licenseManager.isLicenseUsed(licenseCode);
    const verification = await licenseManager.verifyLicense(licenseCode);

    return {
      success: true,
      licenseCode: licenseCode,
      isUsed: isUsed,
      verification: verification
    };
  } catch (error) {
    console.error('检查授权码状态失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 批量上传卡密到服务器
ipcMain.handle('upload-batch-licenses', async (event, { licenses, batchName }) => {
  try {
    console.log(`📤 开始批量上传 ${licenses.length} 个卡密...`);

    // 如果卡密数量较大，使用分批上传
    if (licenses.length > 100) {
      const result = await licenseUploader.uploadLargeDataset(licenses, 100, batchName);
      return result;
    } else {
      const result = await licenseUploader.uploadBatchLicenses(licenses, batchName);
      return result;
    }
  } catch (error) {
    console.error('批量上传卡密失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 检查服务器连接状态
ipcMain.handle('check-server-connection', async (event) => {
  try {
    const result = await licenseUploader.checkServerConnection();
    return result;
  } catch (error) {
    console.error('检查服务器连接失败:', error);
    return {
      success: false,
      message: '检查服务器连接失败: ' + error.message
    };
  }
});

// 获取服务器统计信息
ipcMain.handle('get-server-stats', async (event) => {
  try {
    const result = await licenseUploader.getServerStats();
    return result;
  } catch (error) {
    console.error('获取服务器统计信息失败:', error);
    return {
      success: false,
      message: '获取统计信息失败: ' + error.message
    };
  }
});

// 检查服务器健康状态
ipcMain.handle('check-server-health', async (event) => {
  try {
    const result = await licenseUploader.checkServerHealth();
    return result;
  } catch (error) {
    console.error('检查服务器健康状态失败:', error);
    return {
      success: false,
      online: false,
      message: '检查服务器健康状态失败: ' + error.message
    };
  }
});

// 获取服务器卡密列表
ipcMain.handle('get-server-licenses', async (event, options = {}) => {
  try {
    const result = await licenseUploader.getServerLicenses(options);
    return result;
  } catch (error) {
    console.error('获取服务器卡密列表失败:', error);
    return {
      success: false,
      message: '获取服务器卡密列表失败: ' + error.message
    };
  }
});

// 权限系统兼容处理（生成器本地始终为管理员）
ipcMain.handle('get-current-permissions', () => {
  return {
    success: true,
    level: 'admin',
    permissions: {
      name: '管理员',
      icon: '👑',
      features: ['全部功能', '卡密生成', '批量管理', '统计分析', '服务器同步'],
      restrictions: [] // 管理员无限制
    }
  };
});

// 删除单个卡密
ipcMain.handle('delete-license', async (event, licenseCode) => {
  try {
    const result = await licenseUploader.deleteLicense(licenseCode);
    return result;
  } catch (error) {
    console.error('删除卡密失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 批量删除卡密
ipcMain.handle('delete-batch-licenses', async (event, licenseCodes) => {
  try {
    const result = await licenseUploader.deleteBatchLicenses(licenseCodes);
    return result;
  } catch (error) {
    console.error('批量删除卡密失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 更新卡密状态
ipcMain.handle('update-license-status', async (event, { licenseCode, status }) => {
  try {
    const result = await licenseUploader.updateLicenseStatus(licenseCode, status);
    return result;
  } catch (error) {
    console.error('更新卡密状态失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 搜索卡密
ipcMain.handle('search-licenses', async (event, { searchTerm, options }) => {
  try {
    const result = await licenseUploader.searchLicenses(searchTerm, options);
    return result;
  } catch (error) {
    console.error('搜索卡密失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 应用程序事件处理
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // 在 macOS 上，当单击 dock 图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 处理证书错误
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // 在开发环境中忽略证书错误
  if (process.env.NODE_ENV === 'development') {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// 安全设置
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    // 阻止新窗口的创建，改为在默认浏览器中打开
    event.preventDefault();
    require('electron').shell.openExternal(navigationUrl);
  });
});

console.log('🎫 卡密管理系统 V2 初始化完成');
