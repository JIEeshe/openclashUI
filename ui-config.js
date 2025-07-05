/**
 * UI配置文件
 * 修改这些设置来自定义桌面应用的外观和行为
 */

module.exports = {
  // 网站URL配置
  websiteUrl: 'http://openclash.aixiaobaozi.dpdns.org/',
  
  // 窗口配置
  window: {
    // 窗口尺寸 - 用户自定义尺寸
    width: 1200,          // 自定义宽度
    height: 1000,         // 自定义高度
    minWidth: 1000,       // 最小宽度确保内容可见
    minHeight: 700,       // 最小高度

    // 缩放配置
    defaultZoom: 0.85,    // 默认缩放级别 (85% 以显示更多内容)
    minZoom: 0.5,         // 最小缩放 (50%)
    maxZoom: 2.0,         // 最大缩放 (200%)
    zoomStep: 0.1,        // 缩放步长 (10%)
    
    // 窗口样式
    frame: true,           // false = 无边框窗口（更现代但失去系统标题栏）
    transparent: false,    // true = 透明窗口
    backgroundColor: '#ffffff',
    
    // 窗口行为
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    alwaysOnTop: false,    // true = 窗口置顶
    
    // macOS特有效果
    vibrancy: 'under-window', // macOS毛玻璃效果: 'under-window', 'dark', 'light', null
    titleBarStyle: 'default'  // 'default', 'hidden', 'hiddenInset'
  },
  
  // 菜单配置
  menu: {
    show: false,          // false = 完全隐藏菜单（推荐，更简洁）
    autoHide: true,       // true = 自动隐藏菜单（按Alt显示）

    // 菜单项配置
    items: {
      refresh: true,      // 显示刷新选项
      devTools: false,    // 显示开发者工具选项
      about: false,       // 显示关于选项
      zoom: false         // 显示缩放选项
    }
  },
  
  // 启动画面配置
  splash: {
    show: true,           // 是否显示启动画面
    duration: 2000,       // 启动画面显示时间（毫秒）
    fadeAnimation: true   // 是否使用淡入淡出动画
  },

  // 开发配置
  development: {
    openDevTools: false,  // 启动时打开开发者工具
    showConsoleLog: false  // 显示控制台日志
  },
  
  // 安全配置
  security: {
    allowExternalLinks: true,    // 允许打开外部链接
    blockNavigation: true,       // 阻止导航到外部网站
    webSecurity: true           // 启用web安全
  },
  
  // 更新配置
  updates: {
    checkOnStartup: true,       // 启动时检查更新
    autoDownload: true,         // 自动下载更新
    notifyUser: true           // 通知用户更新
  }
};

/**
 * 预设配置方案
 * 取消注释想要使用的方案，或者自定义上面的配置
 */

// 方案1: 极简模式 - 无菜单，无边框
/*
module.exports = {
  ...module.exports,
  window: {
    ...module.exports.window,
    frame: false,
    backgroundColor: '#f8f9fa'
  },
  menu: {
    show: false,
    autoHide: false
  }
};
*/

// 方案2: 现代模式 - 隐藏菜单，保留边框
/*
module.exports = {
  ...module.exports,
  window: {
    ...module.exports.window,
    backgroundColor: '#ffffff'
  },
  menu: {
    show: false,
    autoHide: true
  }
};
*/

// 方案3: 传统模式 - 显示所有功能
/*
module.exports = {
  ...module.exports,
  menu: {
    show: true,
    autoHide: false,
    items: {
      refresh: true,
      devTools: true,
      about: true,
      zoom: true
    }
  }
};
*/
