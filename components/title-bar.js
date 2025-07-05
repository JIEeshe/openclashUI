/**
 * 通用自定义标题栏组件
 * 为所有窗口提供统一的标题栏功能
 */

class CustomTitleBar {
    constructor(options = {}) {
        this.options = {
            title: options.title || '雷雨传媒网络配置管理工具',
            icon: options.icon || 'default',
            theme: options.theme || 'gradient',
            showMaximize: options.showMaximize !== false,
            showMinimize: options.showMinimize !== false,
            showClose: options.showClose !== false,
            ...options
        };
        
        this.ipcRenderer = null;
        
        // 尝试获取 ipcRenderer
        try {
            this.ipcRenderer = require('electron').ipcRenderer;
        } catch (error) {
            console.warn('无法获取 ipcRenderer，窗口控制功能将不可用');
        }
        
        this.init();
    }
    
    init() {
        this.createTitleBar();
        this.bindEvents();
        this.setupFocusHandling();
    }
    
    createTitleBar() {
        // 创建窗口容器
        const windowContainer = document.createElement('div');
        windowContainer.className = 'window-container';
        
        // 创建标题栏
        const titleBar = document.createElement('div');
        titleBar.className = `title-bar theme-${this.options.theme}`;
        
        // 创建标题区域
        const titleArea = document.createElement('div');
        titleArea.className = 'title-bar-title';
        
        // 添加图标
        const icon = this.createIcon();
        if (icon) {
            titleArea.appendChild(icon);
        }
        
        // 添加标题文本
        const titleText = document.createElement('span');
        titleText.textContent = this.options.title;
        titleArea.appendChild(titleText);
        
        // 创建控制按钮区域
        const controlsArea = document.createElement('div');
        controlsArea.className = 'title-bar-controls';
        
        // 添加控制按钮
        if (this.options.showMinimize) {
            const minimizeBtn = this.createButton('minimize', 'minimize-btn');
            controlsArea.appendChild(minimizeBtn);
        }
        
        if (this.options.showMaximize) {
            const maximizeBtn = this.createButton('maximize', 'maximize-btn');
            controlsArea.appendChild(maximizeBtn);
        }
        
        if (this.options.showClose) {
            const closeBtn = this.createButton('close', 'close-btn');
            controlsArea.appendChild(closeBtn);
        }
        
        // 组装标题栏
        titleBar.appendChild(titleArea);
        titleBar.appendChild(controlsArea);
        
        // 创建内容区域
        const contentArea = document.createElement('div');
        contentArea.className = 'content-area';
        
        // 移动现有内容到内容区域
        const bodyChildren = Array.from(document.body.children);
        bodyChildren.forEach(child => {
            if (child !== windowContainer) {
                contentArea.appendChild(child);
            }
        });

        // 组装窗口
        windowContainer.appendChild(titleBar);
        windowContainer.appendChild(contentArea);

        // 添加到页面
        document.body.appendChild(windowContainer);
        
        // 保存引用
        this.titleBar = titleBar;
        this.windowContainer = windowContainer;
        this.contentArea = contentArea;
    }
    
    createIcon() {
        const iconMap = {
            'default': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>`,
            'lock': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>`,
            'card': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>`,
            'loading': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>`
        };
        
        if (!iconMap[this.options.icon]) {
            return null;
        }
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'title-icon');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.innerHTML = iconMap[this.options.icon];
        
        return svg;
    }
    
    createButton(action, className) {
        const button = document.createElement('button');
        button.className = `title-bar-button ${className}`;
        button.setAttribute('data-action', action);
        return button;
    }
    
    bindEvents() {
        if (!this.ipcRenderer) return;
        
        // 绑定控制按钮事件
        const buttons = this.titleBar.querySelectorAll('.title-bar-button');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                this.handleButtonClick(action);
            });
        });
    }
    
    handleButtonClick(action) {
        if (!this.ipcRenderer) return;
        
        switch (action) {
            case 'close':
                this.ipcRenderer.send('window-control', 'close');
                break;
            case 'minimize':
                this.ipcRenderer.send('window-control', 'minimize');
                break;
            case 'maximize':
                this.ipcRenderer.send('window-control', 'maximize');
                break;
        }
    }
    
    setupFocusHandling() {
        // 处理窗口焦点状态
        window.addEventListener('focus', () => {
            this.windowContainer.classList.add('focused');
            this.windowContainer.classList.remove('unfocused');
        });
        
        window.addEventListener('blur', () => {
            this.windowContainer.classList.add('unfocused');
            this.windowContainer.classList.remove('focused');
        });
        
        // 初始状态
        this.windowContainer.classList.add('focused');
    }
    
    updateTitle(newTitle) {
        const titleText = this.titleBar.querySelector('.title-bar-title span');
        if (titleText) {
            titleText.textContent = newTitle;
        }
    }
    
    setTheme(theme) {
        this.titleBar.className = this.titleBar.className.replace(/theme-\w+/, `theme-${theme}`);
    }
}

// 自动初始化（如果在浏览器环境中）
if (typeof window !== 'undefined') {
    window.CustomTitleBar = CustomTitleBar;
}

// 导出（如果在 Node.js 环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CustomTitleBar;
}
