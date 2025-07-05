const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  console.error('Stack trace:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  console.error('Promise:', promise);
});

// 加载UI配置和授权管理器
console.log('📋 开始加载配置和模块...');

let config, LicenseManager, LicensePermissionManager, WEBSITE_URL, licenseManager, permissionManager;

try {
  config = require('./ui-config.js');
  console.log('✅ UI配置加载成功');

  LicenseManager = require('./license-manager.js');
  console.log('✅ 授权管理器模块加载成功');

  LicensePermissionManager = require('./license-permission-manager.js');
  console.log('✅ 权限管理器模块加载成功');

  WEBSITE_URL = config.websiteUrl;
  console.log('🌐 网站URL:', WEBSITE_URL);

  licenseManager = new LicenseManager();
  console.log('✅ 授权管理器初始化成功');

  permissionManager = new LicensePermissionManager();
  console.log('✅ 权限管理器初始化成功');

} catch (error) {
  console.error('❌ 模块加载失败:', error);
  process.exit(1);
}

// 保持对窗口对象的全局引用
let mainWindow;
let splashWindow;
let licenseWindow;
let isStartingMainApp = false; // 标记是否正在启动主应用

// 创建授权验证窗口
function createLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width: 520,
    height: 680,
    frame: false, // 移除默认边框
    resizable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: true,
    center: true,
    transparent: true, // 启用透明背景
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  });

  licenseWindow.loadFile(path.join(__dirname, 'license.html'));

  licenseWindow.once('ready-to-show', () => {
    licenseWindow.show();
  });

  licenseWindow.on('closed', () => {
    licenseWindow = null;
    // 如果授权窗口被关闭且没有验证成功，退出应用
    // 但是要排除正在启动主应用的情况
    if (!mainWindow && !isStartingMainApp) {
      app.quit();
    }
  });

  return licenseWindow;
}

// 创建启动画面
function createSplashWindow() {
  if (!config.splash.show) {
    return null;
  }

  splashWindow = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    alwaysOnTop: true,
    transparent: true, // 启用透明背景
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    center: true
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  splashWindow.once('ready-to-show', () => {
    if (config.splash.fadeAnimation) {
      // 淡入动画
      splashWindow.setOpacity(0);
      splashWindow.show();
      let opacity = 0;
      const fadeIn = setInterval(() => {
        opacity += 0.1;
        splashWindow.setOpacity(opacity);
        if (opacity >= 1) {
          clearInterval(fadeIn);
        }
      }, 20);
    } else {
      splashWindow.show();
    }
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });

  return splashWindow;
}

function createWindow() {
  console.log('🏗️ 开始创建主窗口...');

  try {
    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
      width: config.window.width,
      height: config.window.height,
      minWidth: config.window.minWidth,
      minHeight: config.window.minHeight,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: false,
        webSecurity: false // 临时禁用以便加载本地备用页面
      },
      icon: path.join(__dirname, 'assets', 'icon.png'),
      title: '雷雨传媒网络配置管理工具',
      show: false, // 先不显示，等加载完成后再显示
      frame: false, // 使用自定义标题栏
      transparent: true, // 启用透明背景
      backgroundColor: '#00000000', // 完全透明背景，移除白色边框
      resizable: config.window.resizable,
      maximizable: config.window.maximizable,
      minimizable: config.window.minimizable,
      closable: config.window.closable,
      alwaysOnTop: config.window.alwaysOnTop
    });

    console.log('✅ 主窗口创建成功');

    // 添加窗口事件监听器
    mainWindow.on('closed', () => {
      console.log('🔚 主窗口已关闭');
      mainWindow = null;
    });

    // ready-to-show 事件监听器在后面统一处理

    // 加载备用页面
    console.log('🔗 加载本地备用页面');
    loadFallbackPage();

  } catch (error) {
    console.error('❌ 创建主窗口时发生错误:', error);
    console.error('Stack trace:', error.stack);

    // 显示错误对话框
    dialog.showErrorBox('窗口创建错误', `无法创建主窗口: ${error.message}`);
  }

  // 设置默认缩放级别和标题替换
  mainWindow.webContents.once('dom-ready', () => {
    mainWindow.webContents.setZoomLevel(Math.log(config.window.defaultZoom) / Math.log(1.2));

    // 强制替换标题的JavaScript代码
    const titleReplaceScript = `
      (function() {
        function forceReplaceTitle() {
          // 查找所有可能包含标题的元素
          const allElements = document.querySelectorAll('*');
          allElements.forEach(element => {
            if (element.textContent && element.textContent.includes('OpenClash') && element.textContent.includes('管理系统')) {
              // 只替换直接文本内容，不影响子元素
              const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null,
                false
              );

              let textNode;
              while (textNode = walker.nextNode()) {
                if (textNode.textContent.includes('OpenClash') && textNode.textContent.includes('管理系统')) {
                  textNode.textContent = textNode.textContent.replace(/OpenClash.*?管理系统/g, '雷雨传媒配置管理');
                  console.log('强制替换标题:', textNode.textContent);
                }
              }
            }
          });
        }

        // 立即执行
        forceReplaceTitle();

        // 定期执行
        setInterval(forceReplaceTitle, 1000);

        // 监听DOM变化
        const observer = new MutationObserver(forceReplaceTitle);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });
      })();
    `;

    mainWindow.webContents.executeJavaScript(titleReplaceScript);
  });

  // 页面加载完成后再次执行标题替换
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      const finalReplaceScript = `
        // 最终的强制替换
        document.querySelectorAll('*').forEach(element => {
          if (element.textContent && element.textContent.includes('OpenClash') && element.textContent.includes('管理系统')) {
            if (element.children.length === 0) {
              // 叶子节点，直接替换
              element.textContent = '雷雨传媒配置管理';
            } else {
              // 有子元素，只替换文本节点
              Array.from(element.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('OpenClash')) {
                  node.textContent = node.textContent.replace(/OpenClash.*?管理系统/g, '雷雨传媒配置管理');
                }
              });
            }
          }
        });
        console.log('页面加载完成，执行最终标题替换');
      `;
      mainWindow.webContents.executeJavaScript(finalReplaceScript);

      // 如果是开发模式，加载调试脚本
      if (config.development.showConsoleLog) {
        console.log('开发模式：已启用控制台日志');
      }
    }, 2000);
  });

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    // 关闭启动画面
    if (splashWindow && config.splash.show) {
      if (config.splash.fadeAnimation) {
        // 淡出动画
        let opacity = 1;
        const fadeOut = setInterval(() => {
          opacity -= 0.1;
          splashWindow.setOpacity(opacity);
          if (opacity <= 0) {
            clearInterval(fadeOut);
            splashWindow.close();
            splashWindow = null;
          }
        }, 20);
      } else {
        splashWindow.close();
        splashWindow = null;
      }
    }

    // 延迟显示主窗口
    const showDelay = config.splash.show ? 200 : 0;
    setTimeout(() => {
      if (config.splash.fadeAnimation) {
        // 主窗口淡入动画
        mainWindow.setOpacity(0);
        mainWindow.show();
        let mainOpacity = 0;
        const mainFadeIn = setInterval(() => {
          mainOpacity += 0.1;
          mainWindow.setOpacity(mainOpacity);
          if (mainOpacity >= 1) {
            clearInterval(mainFadeIn);
          }
        }, 20);
      } else {
        mainWindow.show();
      }

      // 根据配置决定是否打开开发者工具
      if (config.development.openDevTools) {
        mainWindow.webContents.openDevTools();
      }

      // 重置启动标志
      isStartingMainApp = false;
    }, showDelay);
  });

  // 处理窗口关闭
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 根据配置处理外部导航
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const targetUrl = new URL(WEBSITE_URL);

    if (parsedUrl.origin !== targetUrl.origin) {
      if (config.security.blockNavigation) {
        event.preventDefault();
        if (config.security.allowExternalLinks) {
          shell.openExternal(navigationUrl);
        }
      }
    }
  });

  // 网络错误处理
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    if (errorCode === -106) { // 网络连接失败
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>连接失败</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0; 
              background: #f5f5f5;
            }
            .error-container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .error-icon { font-size: 48px; margin-bottom: 20px; }
            .error-title { font-size: 24px; margin-bottom: 10px; color: #333; }
            .error-message { color: #666; margin-bottom: 20px; }
            .retry-button {
              background: #007AFF;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 16px;
            }
            .retry-button:hover { background: #0056CC; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <div class="error-icon">🌐</div>
            <h1 class="error-title">无法连接到服务器</h1>
            <p class="error-message">请检查网络连接或稍后重试</p>
            <button class="retry-button" onclick="location.reload()">重新连接</button>
          </div>
        </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    }
  });
}

// 加载主网站函数 - 使用自定义浏览器容器
function loadMainSite() {
  console.log('🌐 准备加载自定义浏览器容器...');

  try {
    // 检查主窗口
    if (!mainWindow) {
      console.error('❌ 主窗口不存在，无法加载网站');
      return;
    }

    if (mainWindow.isDestroyed()) {
      console.error('❌ 主窗口已销毁，无法加载网站');
      return;
    }

    // 加载自定义浏览器容器页面
    const containerPath = path.join(__dirname, 'browser-container.html');
    console.log('📄 加载浏览器容器:', containerPath);

    mainWindow.loadFile(containerPath).then(() => {
      console.log('✅ 浏览器容器加载成功');
      mainWindow.show();
    }).catch(error => {
      console.error('❌ 浏览器容器加载失败:', error);
      loadFallbackPage();
    });

  } catch (error) {
    console.error('❌ 加载浏览器容器时发生错误:', error);
    console.error('Stack trace:', error.stack);
    loadFallbackPage();
  }
}

// 处理浏览器容器的IPC通信
function setupBrowserContainerIPC() {
  console.log('🔗 设置浏览器容器IPC通信...');

  // 浏览器容器准备就绪
  ipcMain.on('browser-container-ready', () => {
    console.log('✅ 浏览器容器准备就绪，开始加载目标网站');
    // 通知容器加载目标网站
    mainWindow.webContents.send('load-website', WEBSITE_URL);
  });

  // 重新加载网站请求
  ipcMain.on('retry-load-website', () => {
    console.log('🔄 收到重新加载网站请求');
    mainWindow.webContents.send('load-website', WEBSITE_URL);
  });

  // 窗口控制
  ipcMain.on('window-control', (event, action) => {
    console.log('🎛️ 收到窗口控制指令:', action);

    switch (action) {
      case 'close':
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.close();
        }
        break;
      case 'minimize':
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.minimize();
        }
        break;
      case 'maximize':
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
          } else {
            mainWindow.maximize();
          }
        }
        break;
    }
  });
}

// 注入自定义标题栏到网站页面 (已废弃 - 现在使用自定义浏览器容器)
function injectCustomTitleBar() {
  console.log('🎨 注入自定义标题栏...');

  try {
    // 读取标题栏CSS文件
    const titleBarCssPath = path.join(__dirname, 'components', 'title-bar.css');
    const titleBarCss = require('fs').readFileSync(titleBarCssPath, 'utf8');

    // 注入CSS
    mainWindow.webContents.insertCSS(titleBarCss);

    // 注入HTML和JavaScript
    const injectionScript = `
      (function() {
        // 检查是否已经注入过标题栏
        if (document.querySelector('.custom-title-bar-injected')) {
          return;
        }

        console.log('开始注入自定义标题栏...');

        // 强力修复：彻底移除所有白色边框和间距
        const borderFixStyle = document.createElement('style');
        borderFixStyle.textContent = \`
          /* 强制移除所有边框和间距 */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow-x: hidden !important;
          }

          /* 确保body填满整个窗口 */
          body {
            padding-top: 40px !important;
            min-width: 100vw !important;
            min-height: 100vh !important;
            box-sizing: border-box !important;
          }

          /* 标题栏样式 */
          .custom-title-bar-injected {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            height: 40px !important;
            z-index: 999999 !important;
            margin: 0 !important;
            padding: 0 16px !important;
            box-sizing: border-box !important;
          }

          /* 强制网站容器填满宽度 */
          body > * {
            max-width: none !important;
          }

          /* 移除可能的容器边距 */
          .container, .main-container, .app-container, .page-container {
            margin: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            max-width: none !important;
            width: 100% !important;
          }
        \`;
        document.head.appendChild(borderFixStyle);

        // 创建标题栏容器
        const titleBar = document.createElement('div');
        titleBar.className = 'title-bar theme-gradient custom-title-bar-injected';
        titleBar.innerHTML = \`
          <div class="title-bar-title">
            <svg class="title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            雷雨传媒网络配置管理工具
          </div>
          <div class="title-bar-controls">
            <button class="title-bar-button minimize-btn" id="injected-minimizeBtn"></button>
            <button class="title-bar-button maximize-btn" id="injected-maximizeBtn"></button>
            <button class="title-bar-button close-btn" id="injected-closeBtn"></button>
          </div>
        \`;

        // 只调整必要的布局，保持网站原有样式
        // 确保页面内容不被标题栏遮挡，但不改变其他样式

        // 标题栏样式通过CSS类控制，不需要额外的内联样式

        document.body.insertBefore(titleBar, document.body.firstChild);

        // 添加按钮事件监听器
        const { ipcRenderer } = require('electron');

        document.getElementById('injected-closeBtn').addEventListener('click', () => {
          ipcRenderer.send('window-control', 'close');
        });

        document.getElementById('injected-minimizeBtn').addEventListener('click', () => {
          ipcRenderer.send('window-control', 'minimize');
        });

        document.getElementById('injected-maximizeBtn').addEventListener('click', () => {
          ipcRenderer.send('window-control', 'maximize');
        });

        console.log('✅ 自定义标题栏注入成功');
      })();
    `;

    // 执行注入脚本
    mainWindow.webContents.executeJavaScript(injectionScript);

    console.log('✅ 标题栏注入完成');

  } catch (error) {
    console.error('❌ 标题栏注入失败:', error);
  }
}

// 加载备用页面
function loadFallbackPage() {
  console.log('📄 加载本地备用页面');
  const fallbackPath = path.join(__dirname, 'fallback.html');
  mainWindow.loadFile(fallbackPath).then(() => {
    console.log('✅ 备用页面加载成功');
    mainWindow.show();
  }).catch(error => {
    console.error('❌ 备用页面加载失败:', error);
    // 如果连备用页面都加载失败，显示一个简单的错误页面
    const errorHtml = `
      <html>
        <head><title>雷雨传媒配置管理工具</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>应用启动成功</h1>
          <p>网络连接异常，请检查网络设置</p>
          <button onclick="location.reload()">重试</button>
        </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    mainWindow.show();
  });
}

// 缩放控制函数
function zoomIn() {
  if (mainWindow) {
    const currentZoom = mainWindow.webContents.getZoomLevel();
    const newZoom = Math.min(currentZoom + Math.log(1 + config.window.zoomStep) / Math.log(1.2),
                            Math.log(config.window.maxZoom) / Math.log(1.2));
    mainWindow.webContents.setZoomLevel(newZoom);
  }
}

function zoomOut() {
  if (mainWindow) {
    const currentZoom = mainWindow.webContents.getZoomLevel();
    const newZoom = Math.max(currentZoom - Math.log(1 + config.window.zoomStep) / Math.log(1.2),
                            Math.log(config.window.minZoom) / Math.log(1.2));
    mainWindow.webContents.setZoomLevel(newZoom);
  }
}

function resetZoom() {
  if (mainWindow) {
    mainWindow.webContents.setZoomLevel(Math.log(config.window.defaultZoom) / Math.log(1.2));
  }
}

// 创建简化的应用菜单
function createMenu() {
  const template = [
    {
      label: '应用',
      submenu: [
        {
          label: '刷新',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        },
        {
          label: '强制刷新',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reloadIgnoringCache();
            }
          }
        },
        { type: 'separator' },
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+Plus',
          click: zoomIn
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          click: zoomOut
        },
        {
          label: '重置缩放',
          accelerator: 'CmdOrCtrl+0',
          click: resetZoom
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
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 检查授权并启动应用
function checkLicenseAndStart() {
  const licenseStatus = licenseManager.checkLocalLicense();

  if (licenseStatus.valid) {
    console.log('✅ 授权验证成功，剩余天数:', licenseStatus.remainingDays);

    // 设置当前许可证到权限管理器
    permissionManager.setCurrentLicense(licenseStatus.licenseCode);
    const permissions = permissionManager.getCurrentPermissions();
    console.log(`🎯 当前权限级别: ${permissions.name} ${permissions.icon}`);
    console.log('📋 可用功能:', permissions.features);

    startMainApplication();
  } else {
    console.log('❌ 需要授权验证:', licenseStatus.message);
    createLicenseWindow();
  }
}

// 启动主应用
function startMainApplication() {
  console.log('🚀 开始启动主应用...');

  try {
    // 设置浏览器容器IPC通信
    setupBrowserContainerIPC();

    // 根据配置决定是否显示启动画面
    if (config.splash.show) {
      console.log('🎬 显示启动画面');
      createSplashWindow();
      // 延迟创建主窗口
      setTimeout(() => {
        console.log('⏰ 启动画面延迟结束，创建主窗口');
        createWindow();
      }, config.splash.duration);
    } else {
      console.log('🏠 直接创建主窗口');
      createWindow();
    }

    // 根据配置决定是否创建菜单
    if (config.menu.show) {
      console.log('📋 创建应用菜单');
      createMenu();
    } else {
      console.log('🚫 隐藏应用菜单');
      Menu.setApplicationMenu(null);
    }

    // 根据配置检查更新
    if (config.updates.checkOnStartup) {
      console.log('🔄 检查应用更新');
      autoUpdater.checkForUpdatesAndNotify();
    }

    console.log('✅ 主应用启动流程完成');

  } catch (error) {
    console.error('❌ 启动主应用时发生错误:', error);
    console.error('Stack trace:', error.stack);

    // 显示错误对话框
    dialog.showErrorBox('启动错误', `应用启动失败: ${error.message}`);
  }
}

// IPC 处理程序 - 授权验证
ipcMain.handle('verify-license', async (event, licenseCode) => {
  try {
    const result = licenseManager.verifyLicense(licenseCode);

    if (result.valid) {
      // 标记授权码为已使用
      const markSuccess = licenseManager.markLicenseAsUsed(licenseCode, result.data);
      if (!markSuccess) {
        console.warn('⚠️ 标记授权码为已使用失败，但验证成功');
      }

      // 保存授权信息
      licenseManager.saveLicenseInfo(result.data);
      return { success: true, message: '授权验证成功', data: result };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error) {
    console.error('授权验证错误:', error);
    return { success: false, message: '验证过程中发生错误' };
  }
});

// IPC 处理程序 - 授权验证成功
ipcMain.on('license-verified', () => {
  console.log('🎉 收到授权验证成功信号');

  try {
    // 设置正在启动主应用的标志
    isStartingMainApp = true;

    if (licenseWindow) {
      console.log('🔚 关闭授权验证窗口');
      licenseWindow.close();
      licenseWindow = null;
    }

    console.log('🚀 启动主应用...');
    startMainApplication();

  } catch (error) {
    console.error('❌ 处理授权验证成功时发生错误:', error);
    console.error('Stack trace:', error.stack);

    // 重置标志
    isStartingMainApp = false;

    // 显示错误对话框
    dialog.showErrorBox('授权处理错误', `处理授权验证时发生错误: ${error.message}`);
  }
});

// IPC 处理程序 - 联系管理员
ipcMain.on('contact-admin', () => {
  dialog.showMessageBox(licenseWindow, {
    type: 'info',
    title: '联系管理员',
    message: '请联系系统管理员获取授权码',
    detail: '如果您需要授权码或遇到技术问题，请联系您的系统管理员。',
    buttons: ['确定']
  });
});

// IPC 处理程序 - 获取授权状态
ipcMain.handle('get-license-status', async () => {
  try {
    const licenseStatus = licenseManager.checkLocalLicense();
    return licenseStatus;
  } catch (error) {
    console.error('获取授权状态失败:', error);
    return { valid: false, message: '获取授权状态失败' };
  }
});

// IPC 处理程序 - 窗口控制
ipcMain.on('close-license-window', () => {
  if (licenseWindow) {
    licenseWindow.close();
  }
});

ipcMain.on('minimize-license-window', () => {
  if (licenseWindow) {
    licenseWindow.minimize();
  }
});

// 通用窗口控制处理程序
ipcMain.on('window-control', (event, action) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;

  switch (action) {
    case 'close':
      window.close();
      break;
    case 'minimize':
      window.minimize();
      break;
    case 'maximize':
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      break;
  }
});

// IPC 处理程序 - 重试主网站连接
ipcMain.on('retry-main-site', () => {
  console.log('🔄 用户请求重试主网站连接');
  if (mainWindow) {
    loadMainSite();
  }
});

// IPC 处理程序 - 打开网络设置
ipcMain.on('open-network-settings', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '网络设置',
    message: '网络配置说明',
    detail: '请确保您的网络连接正常，并且可以访问外部网站。如果您在企业网络环境中，可能需要配置代理设置。',
    buttons: ['确定']
  });
});

// IPC 处理程序 - 联系技术支持
ipcMain.on('contact-support', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '技术支持',
    message: '技术支持联系方式',
    detail: '如果您遇到技术问题，请联系技术支持团队获取帮助。',
    buttons: ['确定']
  });
});

// IPC 处理程序 - 获取当前权限信息
ipcMain.handle('get-current-permissions', () => {
  try {
    const permissions = permissionManager.getCurrentPermissions();
    const level = permissionManager.getCurrentLevel();

    return {
      success: true,
      level: level,
      permissions: permissions
    };
  } catch (error) {
    console.error('❌ 获取权限信息失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC 处理程序 - 验证功能访问权限
ipcMain.handle('validate-feature-access', (event, feature) => {
  try {
    const result = permissionManager.validateFeatureAccess(feature);
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('❌ 验证功能权限失败:', error);
    return {
      success: false,
      hasAccess: false,
      error: error.message
    };
  }
});

// IPC 处理程序 - 检查节点数量限制
ipcMain.handle('check-node-limit', (event, currentCount) => {
  try {
    const result = permissionManager.checkNodeLimit(currentCount);
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('❌ 检查节点限制失败:', error);
    return {
      success: false,
      canAdd: false,
      error: error.message
    };
  }
});

// IPC 处理程序 - 检查在线状态
ipcMain.handle('check-online-status', async () => {
  try {
    // 检查服务器是否在线
    const http = require('http');
    const serverUrl = 'http://localhost:3001/api/health';
    
    return new Promise((resolve) => {
      const request = http.get(serverUrl, (response) => {
        if (response.statusCode === 200) {
          resolve({
            success: true,
            online: true,
            serverUrl: serverUrl,
            message: '服务器连接正常'
          });
        } else {
          resolve({
            success: true,
            online: false,
            serverUrl: serverUrl,
            message: '服务器响应异常'
          });
        }
      });

      request.on('error', () => {
        resolve({
          success: true,
          online: false,
          serverUrl: serverUrl,
          message: '无法连接到服务器'
        });
      });

      request.setTimeout(5000, () => {
        request.destroy();
        resolve({
          success: true,
          online: false,
          serverUrl: serverUrl,
          message: '连接超时'
        });
      });
    });
  } catch (error) {
    console.error('❌ 检查在线状态失败:', error);
    return {
      success: false,
      online: false,
      error: error.message
    };
  }
});

// IPC 处理程序 - 在线验证授权码
ipcMain.handle('verify-license-online', async (event, licenseCode, deviceInfo) => {
  try {
    // 引入在线许可证管理器
    const onlineLicenseManager = require('./online-license-manager');
    
    const result = await onlineLicenseManager.verifyLicenseOnline(licenseCode, deviceInfo);
    
    if (result.success) {
      // 保存验证成功的授权信息
      licenseManager.saveLicenseInfo(result.data);
      return result;
    } else {
      return result;
    }
  } catch (error) {
    console.error('❌ 在线验证授权码失败:', error);
    return {
      success: false,
      message: '在线验证过程中发生错误: ' + error.message
    };
  }
});

// IPC 处理程序 - 生成设备指纹
ipcMain.handle('generate-device-fingerprint', async () => {
  try {
    const securityManager = require('./security-manager');
    const fingerprint = await securityManager.generateDeviceFingerprint();
    
    return {
      success: true,
      fingerprint: fingerprint
    };
  } catch (error) {
    console.error('❌ 生成设备指纹失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 应用准备就绪时启动
app.whenReady().then(() => {
  checkLicenseAndStart();
});

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS 特殊处理 - 点击 Dock 图标时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    checkLicenseAndStart();
  }
});

// 自动更新事件
autoUpdater.on('update-available', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '更新可用',
    message: '发现新版本，正在下载...',
    buttons: ['确定']
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '更新就绪',
    message: '更新已下载完成，重启应用以应用更新。',
    buttons: ['立即重启', '稍后重启']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});
