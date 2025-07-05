const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露安全的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // 窗口控制
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  
  // 系统功能
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // 通知
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
  
  // 应用事件监听
  onAppUpdate: (callback) => ipcRenderer.on('app-update', callback),
  onNetworkStatus: (callback) => ipcRenderer.on('network-status', callback)
});

// 页面加载完成后的初始化
window.addEventListener('DOMContentLoaded', () => {
  // 添加桌面应用标识
  document.body.classList.add('electron-app');

  // 修改网页标题
  document.title = '雷雨传媒配置管理';

  // 强化标题替换功能
  function replaceTitle() {
    // 更全面的选择器列表
    const titleSelectors = [
      'h1', 'h2', 'h3', '.title', '.header-title', '.app-title',
      '[class*="title"]', '[class*="header"]', '[class*="brand"]',
      '.navbar-brand', '.logo-text', '.app-name', '.site-title',
      'span', 'div', 'p', 'a'  // 更广泛的元素类型
    ];

    titleSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const text = element.textContent.trim();
        if (text.includes('OpenClash') && text.includes('管理系统')) {
          element.textContent = '雷雨传媒配置管理';
          console.log('已替换标题:', element);
        }
      });
    });

    // 特殊处理：遍历所有文本节点
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.includes('OpenClash') && node.textContent.includes('管理系统')) {
        textNodes.push(node);
      }
    }

    textNodes.forEach(textNode => {
      textNode.textContent = textNode.textContent.replace(/OpenClash.*?管理系统/g, '雷雨传媒配置管理');
      console.log('已替换文本节点:', textNode.textContent);
    });
  }

  // 多次尝试替换，确保捕获动态加载的内容
  setTimeout(replaceTitle, 500);
  setTimeout(replaceTitle, 1000);
  setTimeout(replaceTitle, 2000);
  setTimeout(replaceTitle, 3000);
  setTimeout(replaceTitle, 5000);

  // 持续监听并替换
  setInterval(replaceTitle, 2000);

  // 增强的动态内容监听
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查新添加的元素及其子元素
            const elementsToCheck = [node, ...node.querySelectorAll('*')];
            elementsToCheck.forEach(element => {
              const text = element.textContent;
              if (text && text.includes('OpenClash') && text.includes('管理系统')) {
                element.textContent = text.replace(/OpenClash.*?管理系统/g, '雷雨传媒配置管理');
                console.log('动态替换标题:', element);
              }
            });
          }
        });
      }

      // 监听文本内容变化
      if (mutation.type === 'characterData') {
        const text = mutation.target.textContent;
        if (text && text.includes('OpenClash') && text.includes('管理系统')) {
          mutation.target.textContent = text.replace(/OpenClash.*?管理系统/g, '雷雨传媒配置管理');
          console.log('动态替换文本:', mutation.target.textContent);
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true  // 监听文本内容变化
  });

  // 添加CSS样式来强制隐藏原标题并显示新标题
  const style = document.createElement('style');
  style.textContent += `
    /* 强制替换特定的标题元素 */
    [class*="header"] *:contains("OpenClash"),
    [class*="title"] *:contains("OpenClash"),
    [class*="brand"] *:contains("OpenClash") {
      visibility: hidden !important;
    }

    /* 如果有特定的标题容器，可以添加伪元素 */
    .header-title::after,
    .app-title::after,
    .navbar-brand::after {
      content: "雷雨传媒配置管理" !important;
      visibility: visible !important;
    }
  `;
  document.head.appendChild(style);

  // 创建缩放指示器
  const zoomIndicator = document.createElement('div');
  zoomIndicator.className = 'zoom-indicator';
  zoomIndicator.textContent = '缩放: 85%';
  document.body.appendChild(zoomIndicator);

  // 显示缩放指示器的函数
  function showZoomIndicator(zoomLevel) {
    const percentage = Math.round(zoomLevel * 100);
    zoomIndicator.textContent = `缩放: ${percentage}%`;
    zoomIndicator.classList.add('show');

    // 2秒后隐藏
    setTimeout(() => {
      zoomIndicator.classList.remove('show');
    }, 2000);
  }

  // 初始显示缩放级别
  setTimeout(() => {
    showZoomIndicator(0.85); // 默认85%
  }, 1500);
  
  // 添加自定义样式
  const style = document.createElement('style');
  style.textContent = `
    /* 桌面应用专用样式 */
    .electron-app {
      user-select: none; /* 防止文本选择 */
    }

    .electron-app input,
    .electron-app textarea,
    .electron-app [contenteditable] {
      user-select: text; /* 输入框允许文本选择 */
    }

    /* 美化滚动条 */
    ::-webkit-scrollbar {
      width: 8px;
    }

    ::-webkit-scrollbar-track {
      background: rgba(0,0,0,0.1);
      border-radius: 8px;
    }

    ::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.3);
      border-radius: 8px;
      transition: background 0.2s ease;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: rgba(0,0,0,0.5);
    }

    /* 🎨 额外的圆弧效果增强 */
    /* 登录页面特定元素 */
    .login-container, .auth-container, .signin-form, .login-panel {
      border-radius: 24px !important;
      box-shadow:
        0 25px 50px rgba(0, 0, 0, 0.15) !important,
        0 12px 25px rgba(0, 0, 0, 0.1) !important,
        inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
      backdrop-filter: blur(20px) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }

    /* 图形验证码容器 */
    .captcha-container, .verification-container, .code-container {
      border-radius: 16px !important;
      overflow: hidden !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
    }

    /* 图形验证码图片 */
    .captcha-image, .verification-image, .code-image {
      border-radius: 12px !important;
    }

    /* 复选框和单选框美化 */
    input[type="checkbox"], input[type="radio"] {
      border-radius: 4px !important;
      transition: all 0.2s ease !important;
    }

    /* 链接美化 */
    a, .link {
      transition: all 0.2s ease !important;
      border-radius: 4px !important;
      padding: 2px 4px !important;
    }

    a:hover, .link:hover {
      background: rgba(102, 126, 234, 0.1) !important;
      transform: translateY(-1px) !important;
    }

    /* 标签和徽章 */
    .badge, .tag, .label, .chip {
      border-radius: 12px !important;
      padding: 4px 12px !important;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
    }

    /* 进度条 */
    .progress, .progress-bar {
      border-radius: 8px !important;
      overflow: hidden !important;
    }

    /* 分隔线 */
    hr, .divider, .separator {
      border-radius: 2px !important;
      border: none !important;
      height: 2px !important;
      background: linear-gradient(90deg, transparent, rgba(0,0,0,0.1), transparent) !important;
    }

    /* 桌面应用窗口优化 */
    body {
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }

    /* 隐藏可能的调试信息 */
    .electron-app .debug-info,
    .electron-app .dev-tools-hint {
      display: none !important;
    }

    /* 优化加载状态 */
    .electron-app .loading {
      background: linear-gradient(45deg, #f0f0f0, #e0e0e0);
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: 200px 0; }
    }

    /* 缩放指示器 */
    .zoom-indicator {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .zoom-indicator.show {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
  
  // 添加键盘快捷键支持
  document.addEventListener('keydown', (event) => {
    // Ctrl/Cmd + 滚轮缩放支持
    if (event.ctrlKey || event.metaKey) {
      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        // 通知主进程放大
        console.log('缩放：放大');
      } else if (event.key === '-') {
        event.preventDefault();
        // 通知主进程缩小
        console.log('缩放：缩小');
      } else if (event.key === '0') {
        event.preventDefault();
        // 通知主进程重置缩放
        console.log('缩放：重置');
      }
    }
  });

  // 添加鼠标滚轮缩放支持
  document.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (event.deltaY < 0) {
        console.log('滚轮缩放：放大');
      } else {
        console.log('滚轮缩放：缩小');
      }
    }
  }, { passive: false });

  // 添加桌面应用特有的功能提示
  console.log('🖥️ 雷雨传媒配置管理 - 桌面版已启动');
  console.log('💡 缩放快捷键: Ctrl/Cmd + +/- 或 Ctrl/Cmd + 滚轮');
});
