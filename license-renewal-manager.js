/**
 * 卡密续期管理模块
 * 提供卡密自动续期、批量续期、续期提醒等功能
 */

class LicenseRenewalManager {
    constructor() {
        this.renewalConfig = {
            // 续期提醒阈值（天）
            reminderThresholds: [30, 7, 3, 1], // 30天、7天、3天、1天前提醒
            // 自动检查间隔（毫秒）
            checkInterval: 60 * 60 * 1000, // 1小时检查一次
            // 续期选项（天数）
            renewalOptions: [30, 90, 180, 365],
            // 批量操作限制
            maxBatchSize: 100
        };
        
        this.renewalState = {
            expiringLicenses: new Map(), // 即将过期的卡密
            renewalHistory: [], // 续期历史记录
            lastCheck: 0, // 最后检查时间
            remindersSent: new Set(), // 已发送提醒的卡密
            isInitialized: false
        };
        
        this.checkTimer = null;
    }

    /**
     * 初始化续期管理器
     */
    async init() {
        if (this.renewalState.isInitialized) return;

        console.log('🔧 初始化卡密续期管理器...');

        // 权限检查
        const hasAccess = await this.checkPermissions();
        if (!hasAccess) {
            this.showAccessDenied();
            return;
        }

        try {
            // 创建续期管理界面
            this.createRenewalManagerHTML();

            // 绑定事件监听器
            this.bindEventListeners();

            // 加载续期历史
            await this.loadRenewalHistory();

            // 执行首次检查
            await this.checkExpiringLicenses();
            
            // 启动定期检查
            this.startPeriodicCheck();
            
            // 暴露全局函数
            this.exposeGlobalFunctions();
            
            this.renewalState.isInitialized = true;
            console.log('✅ 卡密续期管理器初始化完成');
            
        } catch (error) {
            console.error('❌ 续期管理器初始化失败:', error);
            this.showError('续期管理器初始化失败: ' + error.message);
        }
    }

    /**
     * 创建续期管理界面HTML
     */
    createRenewalManagerHTML() {
        const container = document.querySelector('.renewal-manager') || document.createElement('div');
        container.className = 'renewal-manager';
        
        container.innerHTML = `
            <div class="renewal-manager-header">
                <h3>🔄 卡密续期管理</h3>
                <div class="renewal-controls">
                    <button class="renewal-btn check-btn" onclick="checkExpiringLicenses()">
                        🔍 检查即将过期
                    </button>
                    <button class="renewal-btn refresh-btn" onclick="refreshRenewalData()">
                        🔄 刷新数据
                    </button>
                    <button class="renewal-btn history-btn" onclick="showRenewalHistory()">
                        📋 续期历史
                    </button>
                </div>
            </div>
            
            <div class="renewal-stats">
                <div class="renewal-stat-card urgent">
                    <div class="stat-number" id="urgentCount">0</div>
                    <div class="stat-label">紧急续期 (1天内)</div>
                </div>
                <div class="renewal-stat-card warning">
                    <div class="stat-number" id="warningCount">0</div>
                    <div class="stat-label">即将过期 (7天内)</div>
                </div>
                <div class="renewal-stat-card notice">
                    <div class="stat-number" id="noticeCount">0</div>
                    <div class="stat-label">提前提醒 (30天内)</div>
                </div>
                <div class="renewal-stat-card total">
                    <div class="stat-number" id="totalRenewed">0</div>
                    <div class="stat-label">已续期总数</div>
                </div>
            </div>
            
            <div class="renewal-content">
                <div class="expiring-licenses-panel">
                    <div class="panel-header">
                        <h4>⚠️ 即将过期的卡密</h4>
                        <div class="panel-controls">
                            <select id="expiringFilter">
                                <option value="all">全部</option>
                                <option value="urgent">紧急 (1天内)</option>
                                <option value="warning">警告 (7天内)</option>
                                <option value="notice">提醒 (30天内)</option>
                            </select>
                            <button class="renewal-btn batch-btn" onclick="showBatchRenewal()">
                                📦 批量续期
                            </button>
                        </div>
                    </div>
                    
                    <div class="expiring-list" id="expiringList">
                        <div class="renewal-loading">
                            <div class="loading-spinner"></div>
                            <div>正在检查即将过期的卡密...</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 续期操作模态框 -->
            <div class="renewal-modal" id="renewalModal" style="display: none;">
                <div class="renewal-modal-content">
                    <div class="renewal-modal-header">
                        <h4 id="renewalModalTitle">卡密续期</h4>
                        <button class="close-btn" onclick="closeRenewalModal()">&times;</button>
                    </div>
                    <div class="renewal-modal-body" id="renewalModalBody">
                        <!-- 动态内容 -->
                    </div>
                    <div class="renewal-modal-footer">
                        <button class="btn-secondary" onclick="closeRenewalModal()">取消</button>
                        <button class="btn-primary" id="confirmRenewalBtn">确认续期</button>
                    </div>
                </div>
            </div>
            
            <!-- 续期历史模态框 -->
            <div class="renewal-modal" id="historyModal" style="display: none;">
                <div class="renewal-modal-content large">
                    <div class="renewal-modal-header">
                        <h4>📋 续期历史记录</h4>
                        <button class="close-btn" onclick="closeHistoryModal()">&times;</button>
                    </div>
                    <div class="renewal-modal-body" id="historyModalBody">
                        <!-- 动态内容 -->
                    </div>
                    <div class="renewal-modal-footer">
                        <button class="btn-secondary" onclick="closeHistoryModal()">关闭</button>
                        <button class="btn-primary" onclick="exportRenewalHistory()">导出历史</button>
                    </div>
                </div>
            </div>
        `;
        
        // 如果容器不在DOM中，添加到适当位置
        if (!container.parentNode) {
            const targetContainer = document.querySelector('.results-panel') || document.body;
            targetContainer.appendChild(container);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        // 筛选器变化事件
        const filterSelect = document.getElementById('expiringFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => {
                this.renderExpiringLicenses();
            });
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.checkExpiringLicenses();
            }
        });
    }

    /**
     * 检查即将过期的卡密
     */
    async checkExpiringLicenses() {
        console.log('🔍 检查即将过期的卡密...');
        
        try {
            // 显示加载状态
            this.showLoading(true);
            
            // 获取所有卡密数据
            const allLicenses = await this.getAllLicenses();
            
            // 清空之前的数据
            this.renewalState.expiringLicenses.clear();
            
            const now = new Date();
            const maxThreshold = Math.max(...this.renewalConfig.reminderThresholds);
            const thresholdTime = new Date(now.getTime() + maxThreshold * 24 * 60 * 60 * 1000);
            
            // 筛选即将过期的卡密
            allLicenses.forEach(license => {
                const expiresAt = new Date(license.expiresAt);
                
                // 只处理未过期且在提醒阈值内的卡密
                if (expiresAt > now && expiresAt <= thresholdTime) {
                    const remainingMs = expiresAt.getTime() - now.getTime();
                    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
                    
                    // 确定优先级
                    let priority = 'notice'; // 默认提醒级别
                    if (remainingDays <= 1) {
                        priority = 'urgent';
                    } else if (remainingDays <= 7) {
                        priority = 'warning';
                    }
                    
                    const expiringLicense = {
                        ...license,
                        remainingDays,
                        priority,
                        checked: false // 用于批量操作
                    };
                    
                    this.renewalState.expiringLicenses.set(license.id, expiringLicense);
                }
            });
            
            // 更新统计信息
            this.updateRenewalStats();
            
            // 渲染即将过期的卡密列表
            this.renderExpiringLicenses();
            
            // 发送提醒通知
            this.sendRenewalReminders();
            
            // 更新最后检查时间
            this.renewalState.lastCheck = Date.now();
            
            console.log(`✅ 检查完成，发现 ${this.renewalState.expiringLicenses.size} 个即将过期的卡密`);
            
            // 添加活动记录
            if (window.addActivity) {
                window.addActivity('检查即将过期卡密', 'info', 
                    `发现 ${this.renewalState.expiringLicenses.size} 个即将过期的卡密`);
            }
            
        } catch (error) {
            console.error('❌ 检查即将过期卡密失败:', error);
            this.showError('检查即将过期卡密失败: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 获取所有卡密数据
     */
    async getAllLicenses() {
        const licenses = [];
        
        // 从localStorage获取数据
        try {
            const storedLicenses = JSON.parse(localStorage.getItem('generatedLicenses') || '[]');
            licenses.push(...storedLicenses);
        } catch (error) {
            console.warn('读取localStorage卡密数据失败:', error);
        }
        
        // 从全局变量获取数据
        if (window.generatedLicenses && Array.isArray(window.generatedLicenses)) {
            licenses.push(...window.generatedLicenses);
        }
        
        // 去重（基于卡密代码）
        const uniqueLicenses = [];
        const seenCodes = new Set();
        
        licenses.forEach(license => {
            if (license.code && !seenCodes.has(license.code)) {
                seenCodes.add(license.code);
                
                // 确保日期格式正确
                const licenseData = {
                    ...license,
                    generatedAt: license.generatedAt ? new Date(license.generatedAt) : new Date(),
                    expiresAt: license.expiresAt ? new Date(license.expiresAt) : 
                              new Date(Date.now() + (license.validityDays || 30) * 24 * 60 * 60 * 1000)
                };
                
                uniqueLicenses.push(licenseData);
            }
        });
        
        return uniqueLicenses;
    }

    /**
     * 更新续期统计信息
     */
    updateRenewalStats() {
        let urgentCount = 0;
        let warningCount = 0;
        let noticeCount = 0;
        
        this.renewalState.expiringLicenses.forEach(license => {
            switch (license.priority) {
                case 'urgent':
                    urgentCount++;
                    break;
                case 'warning':
                    warningCount++;
                    break;
                case 'notice':
                    noticeCount++;
                    break;
            }
        });
        
        // 更新DOM
        const elements = {
            urgentCount: document.getElementById('urgentCount'),
            warningCount: document.getElementById('warningCount'),
            noticeCount: document.getElementById('noticeCount'),
            totalRenewed: document.getElementById('totalRenewed')
        };
        
        if (elements.urgentCount) elements.urgentCount.textContent = urgentCount;
        if (elements.warningCount) elements.warningCount.textContent = warningCount;
        if (elements.noticeCount) elements.noticeCount.textContent = noticeCount;
        if (elements.totalRenewed) elements.totalRenewed.textContent = this.renewalState.renewalHistory.length;
    }

    /**
     * 渲染即将过期的卡密列表
     */
    renderExpiringLicenses() {
        const expiringList = document.getElementById('expiringList');
        if (!expiringList) return;
        
        // 获取筛选条件
        const filter = document.getElementById('expiringFilter')?.value || 'all';
        
        // 筛选数据
        const filteredLicenses = Array.from(this.renewalState.expiringLicenses.values())
            .filter(license => filter === 'all' || license.priority === filter)
            .sort((a, b) => a.remainingDays - b.remainingDays); // 按剩余天数排序
        
        if (filteredLicenses.length === 0) {
            expiringList.innerHTML = `
                <div class="renewal-empty">
                    <div class="empty-icon">✅</div>
                    <div class="empty-title">暂无即将过期的卡密</div>
                    <div class="empty-description">所有卡密都在有效期内</div>
                </div>
            `;
            return;
        }
        
        const licensesHTML = filteredLicenses.map(license => this.renderExpiringLicenseCard(license)).join('');
        expiringList.innerHTML = licensesHTML;
    }

    /**
     * 渲染单个即将过期的卡密卡片
     */
    renderExpiringLicenseCard(license) {
        const priorityClass = `priority-${license.priority}`;
        const priorityText = {
            urgent: '🚨 紧急',
            warning: '⚠️ 警告', 
            notice: '💡 提醒'
        }[license.priority];
        
        const expiresDate = license.expiresAt.toLocaleDateString();
        const expiresTime = license.expiresAt.toLocaleTimeString();
        
        return `
            <div class="expiring-license-card ${priorityClass}" data-license-id="${license.id}">
                <div class="license-card-header">
                    <div class="license-checkbox">
                        <input type="checkbox" id="check-${license.id}" 
                               onchange="toggleLicenseCheck('${license.id}')" />
                        <label for="check-${license.id}"></label>
                    </div>
                    <div class="license-priority">${priorityText}</div>
                    <div class="license-remaining">${license.remainingDays}天后过期</div>
                </div>
                
                <div class="license-info">
                    <div class="license-code">${license.code}</div>
                    <div class="license-details">
                        <span class="detail-item">📅 过期时间: ${expiresDate} ${expiresTime}</span>
                        <span class="detail-item">⏱️ 有效期: ${license.validityDays}天</span>
                        <span class="detail-item">📦 批次: ${license.batchName || '未命名'}</span>
                    </div>
                </div>
                
                <div class="license-actions">
                    <button class="action-btn renew-btn" onclick="renewSingleLicense('${license.id}')" title="续期">
                        🔄 续期
                    </button>
                    <button class="action-btn details-btn" onclick="viewLicenseDetails('${license.id}')" title="查看详情">
                        👁️ 详情
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 显示/隐藏加载状态
     */
    showLoading(show) {
        const expiringList = document.getElementById('expiringList');
        if (!expiringList) return;
        
        if (show) {
            expiringList.innerHTML = `
                <div class="renewal-loading">
                    <div class="loading-spinner"></div>
                    <div>正在检查即将过期的卡密...</div>
                </div>
            `;
        }
    }

    /**
     * 发送续期提醒通知
     */
    sendRenewalReminders() {
        this.renewalState.expiringLicenses.forEach(license => {
            const reminderKey = `${license.code}-${license.remainingDays}`;
            
            // 避免重复发送相同的提醒
            if (!this.renewalState.remindersSent.has(reminderKey)) {
                this.sendReminderNotification(license);
                this.renewalState.remindersSent.add(reminderKey);
            }
        });
    }

    /**
     * 发送单个提醒通知
     */
    sendReminderNotification(license) {
        const message = `卡密 ${license.code} 将在 ${license.remainingDays} 天后过期，请及时续期！`;
        
        // 浏览器通知（如果支持）
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('卡密续期提醒', {
                body: message,
                icon: 'favicon.ico'
            });
        }
        
        // 控制台日志
        console.log(`🔔 续期提醒: ${message}`);
        
        // 添加活动记录
        if (window.addActivity) {
            window.addActivity('续期提醒', 'warning', message);
        }
    }

    /**
     * 启动定期检查
     */
    startPeriodicCheck() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
        }
        
        this.checkTimer = setInterval(() => {
            console.log('⏰ 执行定期续期检查...');
            this.checkExpiringLicenses();
        }, this.renewalConfig.checkInterval);
        
        console.log(`✅ 已启动定期检查，间隔: ${this.renewalConfig.checkInterval / 1000 / 60} 分钟`);
    }

    /**
     * 停止定期检查
     */
    stopPeriodicCheck() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
            console.log('⏹️ 已停止定期检查');
        }
    }

    /**
     * 加载续期历史
     */
    async loadRenewalHistory() {
        try {
            const historyData = localStorage.getItem('renewalHistory');
            if (historyData) {
                this.renewalState.renewalHistory = JSON.parse(historyData);
                console.log(`📋 加载了 ${this.renewalState.renewalHistory.length} 条续期历史记录`);
            }
        } catch (error) {
            console.warn('加载续期历史失败:', error);
            this.renewalState.renewalHistory = [];
        }
    }

    /**
     * 保存续期历史
     */
    saveRenewalHistory() {
        try {
            localStorage.setItem('renewalHistory', JSON.stringify(this.renewalState.renewalHistory));
        } catch (error) {
            console.error('保存续期历史失败:', error);
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        console.error('❌', message);
        if (window.showErrorMessage) {
            window.showErrorMessage(message);
        } else {
            alert('错误: ' + message);
        }
    }

    /**
     * 显示成功信息
     */
    showSuccess(message) {
        console.log('✅', message);
        if (window.showSuccessMessage) {
            window.showSuccessMessage(message);
        } else {
            alert('成功: ' + message);
        }
    }

    /**
     * 暴露全局函数
     */
    exposeGlobalFunctions() {
        // 暴露主要功能函数到全局作用域
        window.renewalManager = this;
        window.checkExpiringLicenses = () => this.checkExpiringLicenses();
        window.refreshRenewalData = () => this.refreshRenewalData();
        window.showRenewalHistory = () => this.showRenewalHistory();
        window.showBatchRenewal = () => this.showBatchRenewal();
        window.renewSingleLicense = (licenseId) => this.renewSingleLicense(licenseId);
        window.viewLicenseDetails = (licenseId) => this.viewLicenseDetails(licenseId);
        window.toggleLicenseCheck = (licenseId) => this.toggleLicenseCheck(licenseId);
        window.closeRenewalModal = () => this.closeRenewalModal();
        window.closeHistoryModal = () => this.closeHistoryModal();
        window.exportRenewalHistory = () => this.exportRenewalHistory();
        
        console.log('✅ 续期管理全局函数已暴露');
    }

    /**
     * 刷新续期数据
     */
    async refreshRenewalData() {
        console.log('🔄 刷新续期数据...');
        await this.checkExpiringLicenses();
        this.showSuccess('续期数据已刷新');
    }

    /**
     * 续期单个卡密
     */
    async renewSingleLicense(licenseId) {
        const license = this.renewalState.expiringLicenses.get(licenseId);
        if (!license) {
            this.showError('未找到指定的卡密');
            return;
        }

        this.showRenewalModal([license]);
    }

    /**
     * 查看卡密详情
     */
    viewLicenseDetails(licenseId) {
        const license = this.renewalState.expiringLicenses.get(licenseId);
        if (!license) {
            this.showError('未找到指定的卡密');
            return;
        }

        const modal = document.getElementById('renewalModal');
        const title = document.getElementById('renewalModalTitle');
        const body = document.getElementById('renewalModalBody');

        title.textContent = '卡密详情';

        body.innerHTML = `
            <div class="license-details-view">
                <div class="detail-section">
                    <h5>基本信息</h5>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>卡密代码:</label>
                            <span class="license-code-display">${license.code}</span>
                        </div>
                        <div class="detail-item">
                            <label>有效期:</label>
                            <span>${license.validityDays} 天</span>
                        </div>
                        <div class="detail-item">
                            <label>生成时间:</label>
                            <span>${license.generatedAt.toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <label>过期时间:</label>
                            <span class="expire-time ${license.priority}">${license.expiresAt.toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <label>剩余时间:</label>
                            <span class="remaining-time ${license.priority}">${license.remainingDays} 天</span>
                        </div>
                        <div class="detail-item">
                            <label>批次名称:</label>
                            <span>${license.batchName || '未命名批次'}</span>
                        </div>
                        <div class="detail-item">
                            <label>优先级:</label>
                            <span class="priority-badge ${license.priority}">
                                ${license.priority === 'urgent' ? '🚨 紧急' :
                                  license.priority === 'warning' ? '⚠️ 警告' : '💡 提醒'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h5>续期选项</h5>
                    <div class="renewal-options">
                        ${this.renewalConfig.renewalOptions.map(days => `
                            <button class="renewal-option-btn" onclick="renewLicenseWithDays('${licenseId}', ${days})">
                                续期 ${days} 天
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // 隐藏确认按钮
        document.getElementById('confirmRenewalBtn').style.display = 'none';

        modal.style.display = 'flex';
    }

    /**
     * 切换卡密选中状态
     */
    toggleLicenseCheck(licenseId) {
        const license = this.renewalState.expiringLicenses.get(licenseId);
        if (license) {
            license.checked = !license.checked;
            console.log(`卡密 ${license.code} 选中状态: ${license.checked}`);
        }
    }

    /**
     * 显示批量续期界面
     */
    showBatchRenewal() {
        const selectedLicenses = Array.from(this.renewalState.expiringLicenses.values())
            .filter(license => license.checked);

        if (selectedLicenses.length === 0) {
            this.showError('请先选择要续期的卡密');
            return;
        }

        if (selectedLicenses.length > this.renewalConfig.maxBatchSize) {
            this.showError(`批量操作最多支持 ${this.renewalConfig.maxBatchSize} 个卡密`);
            return;
        }

        this.showRenewalModal(selectedLicenses);
    }

    /**
     * 显示续期模态框
     */
    showRenewalModal(licenses) {
        const modal = document.getElementById('renewalModal');
        const title = document.getElementById('renewalModalTitle');
        const body = document.getElementById('renewalModalBody');
        const confirmBtn = document.getElementById('confirmRenewalBtn');

        const isBatch = licenses.length > 1;
        title.textContent = isBatch ? `批量续期 (${licenses.length} 个卡密)` : '卡密续期';

        body.innerHTML = `
            <div class="renewal-form">
                <div class="renewal-licenses-preview">
                    <h5>${isBatch ? '选中的卡密:' : '卡密信息:'}</h5>
                    <div class="licenses-preview-list">
                        ${licenses.map(license => `
                            <div class="license-preview-item">
                                <span class="license-code">${license.code}</span>
                                <span class="license-expires">剩余 ${license.remainingDays} 天</span>
                                <span class="license-priority priority-${license.priority}">
                                    ${license.priority === 'urgent' ? '🚨' :
                                      license.priority === 'warning' ? '⚠️' : '💡'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="renewal-options-section">
                    <h5>选择续期时长:</h5>
                    <div class="renewal-options-grid">
                        ${this.renewalConfig.renewalOptions.map(days => `
                            <label class="renewal-option">
                                <input type="radio" name="renewalDays" value="${days}"
                                       ${days === 30 ? 'checked' : ''} />
                                <span class="option-label">
                                    <span class="option-days">${days} 天</span>
                                    <span class="option-desc">${this.getRenewalDescription(days)}</span>
                                </span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="custom-renewal-section">
                    <h5>自定义续期时长:</h5>
                    <div class="custom-renewal-input">
                        <input type="number" id="customRenewalDays" min="1" max="3650"
                               placeholder="输入天数" />
                        <label>
                            <input type="radio" name="renewalDays" value="custom" />
                            使用自定义天数
                        </label>
                    </div>
                </div>

                <div class="renewal-summary">
                    <h5>续期预览:</h5>
                    <div class="summary-content" id="renewalSummary">
                        <div class="summary-item">
                            <span>续期卡密数量:</span>
                            <span>${licenses.length} 个</span>
                        </div>
                        <div class="summary-item">
                            <span>续期时长:</span>
                            <span id="summaryDays">30 天</span>
                        </div>
                        <div class="summary-item">
                            <span>新的过期时间:</span>
                            <span id="summaryNewExpire">计算中...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 绑定续期选项变化事件
        const renewalOptions = body.querySelectorAll('input[name="renewalDays"]');
        const customInput = body.querySelector('#customRenewalDays');

        renewalOptions.forEach(option => {
            option.addEventListener('change', () => {
                this.updateRenewalSummary(licenses);
            });
        });

        customInput.addEventListener('input', () => {
            const customRadio = body.querySelector('input[value="custom"]');
            customRadio.checked = true;
            this.updateRenewalSummary(licenses);
        });

        // 设置确认按钮
        confirmBtn.style.display = 'block';
        confirmBtn.onclick = () => this.confirmRenewal(licenses);

        // 初始化摘要
        this.updateRenewalSummary(licenses);

        modal.style.display = 'flex';
    }

    /**
     * 获取续期描述
     */
    getRenewalDescription(days) {
        if (days <= 30) return '短期续期';
        if (days <= 90) return '季度续期';
        if (days <= 180) return '半年续期';
        return '年度续期';
    }

    /**
     * 更新续期摘要
     */
    updateRenewalSummary(licenses) {
        const selectedOption = document.querySelector('input[name="renewalDays"]:checked');
        if (!selectedOption) return;

        let renewalDays;
        if (selectedOption.value === 'custom') {
            const customInput = document.getElementById('customRenewalDays');
            renewalDays = parseInt(customInput.value) || 0;
        } else {
            renewalDays = parseInt(selectedOption.value);
        }

        // 更新摘要显示
        const summaryDays = document.getElementById('summaryDays');
        const summaryNewExpire = document.getElementById('summaryNewExpire');

        if (summaryDays) {
            summaryDays.textContent = `${renewalDays} 天`;
        }

        if (summaryNewExpire && renewalDays > 0) {
            // 计算新的过期时间（基于当前时间）
            const newExpireDate = new Date(Date.now() + renewalDays * 24 * 60 * 60 * 1000);
            summaryNewExpire.textContent = newExpireDate.toLocaleString();
        } else if (summaryNewExpire) {
            summaryNewExpire.textContent = '请输入有效天数';
        }
    }

    /**
     * 确认续期操作
     */
    async confirmRenewal(licenses) {
        const selectedOption = document.querySelector('input[name="renewalDays"]:checked');
        if (!selectedOption) {
            this.showError('请选择续期时长');
            return;
        }

        let renewalDays;
        if (selectedOption.value === 'custom') {
            const customInput = document.getElementById('customRenewalDays');
            renewalDays = parseInt(customInput.value);
            if (!renewalDays || renewalDays < 1 || renewalDays > 3650) {
                this.showError('请输入有效的续期天数 (1-3650)');
                return;
            }
        } else {
            renewalDays = parseInt(selectedOption.value);
        }

        try {
            // 执行续期操作
            await this.performRenewal(licenses, renewalDays);

            // 关闭模态框
            this.closeRenewalModal();

            // 刷新数据
            await this.checkExpiringLicenses();

            this.showSuccess(`成功续期 ${licenses.length} 个卡密，续期时长: ${renewalDays} 天`);

        } catch (error) {
            console.error('续期操作失败:', error);
            this.showError('续期操作失败: ' + error.message);
        }
    }

    /**
     * 执行续期操作
     */
    async performRenewal(licenses, renewalDays) {
        console.log(`🔄 开始续期操作: ${licenses.length} 个卡密，续期 ${renewalDays} 天`);

        const renewalTime = new Date();
        const renewalResults = [];

        for (const license of licenses) {
            try {
                // 计算新的过期时间
                const currentExpire = new Date(license.expiresAt);
                const newExpire = new Date(currentExpire.getTime() + renewalDays * 24 * 60 * 60 * 1000);

                // 更新卡密数据
                const updatedLicense = {
                    ...license,
                    expiresAt: newExpire,
                    validityDays: license.validityDays + renewalDays,
                    lastRenewal: renewalTime,
                    renewalCount: (license.renewalCount || 0) + 1
                };

                // 更新localStorage中的数据
                await this.updateLicenseInStorage(updatedLicense);

                // 记录续期历史
                const renewalRecord = {
                    id: Date.now() + Math.random(),
                    licenseCode: license.code,
                    licenseId: license.id,
                    renewalDays: renewalDays,
                    oldExpire: license.expiresAt,
                    newExpire: newExpire,
                    renewalTime: renewalTime,
                    batchName: license.batchName
                };

                this.renewalState.renewalHistory.push(renewalRecord);
                renewalResults.push(renewalRecord);

                console.log(`✅ 卡密 ${license.code} 续期成功`);

            } catch (error) {
                console.error(`❌ 卡密 ${license.code} 续期失败:`, error);
                throw new Error(`卡密 ${license.code} 续期失败: ${error.message}`);
            }
        }

        // 保存续期历史
        this.saveRenewalHistory();

        // 添加活动记录
        if (window.addActivity) {
            window.addActivity('卡密续期', 'success',
                `成功续期 ${licenses.length} 个卡密，续期时长: ${renewalDays} 天`);
        }

        console.log(`✅ 续期操作完成，共处理 ${renewalResults.length} 个卡密`);
        return renewalResults;
    }

    /**
     * 更新存储中的卡密数据
     */
    async updateLicenseInStorage(updatedLicense) {
        try {
            // 更新localStorage
            const storedLicenses = JSON.parse(localStorage.getItem('generatedLicenses') || '[]');
            const index = storedLicenses.findIndex(l => l.id === updatedLicense.id || l.code === updatedLicense.code);

            if (index !== -1) {
                storedLicenses[index] = updatedLicense;
                localStorage.setItem('generatedLicenses', JSON.stringify(storedLicenses));
            }

            // 更新全局变量
            if (window.generatedLicenses && Array.isArray(window.generatedLicenses)) {
                const globalIndex = window.generatedLicenses.findIndex(l => l.id === updatedLicense.id || l.code === updatedLicense.code);
                if (globalIndex !== -1) {
                    window.generatedLicenses[globalIndex] = updatedLicense;
                }
            }

        } catch (error) {
            console.error('更新卡密存储数据失败:', error);
            throw error;
        }
    }

    /**
     * 使用指定天数续期卡密
     */
    async renewLicenseWithDays(licenseId, days) {
        const license = this.renewalState.expiringLicenses.get(licenseId);
        if (!license) {
            this.showError('未找到指定的卡密');
            return;
        }

        try {
            await this.performRenewal([license], days);
            this.closeRenewalModal();
            await this.checkExpiringLicenses();
            this.showSuccess(`卡密 ${license.code} 续期成功，续期时长: ${days} 天`);
        } catch (error) {
            this.showError('续期失败: ' + error.message);
        }
    }

    /**
     * 显示续期历史
     */
    showRenewalHistory() {
        const modal = document.getElementById('historyModal');
        const body = document.getElementById('historyModalBody');

        if (this.renewalState.renewalHistory.length === 0) {
            body.innerHTML = `
                <div class="renewal-empty">
                    <div class="empty-icon">📋</div>
                    <div class="empty-title">暂无续期历史</div>
                    <div class="empty-description">还没有进行过卡密续期操作</div>
                </div>
            `;
        } else {
            const historyHTML = this.renewalState.renewalHistory
                .sort((a, b) => new Date(b.renewalTime) - new Date(a.renewalTime))
                .map(record => this.renderHistoryRecord(record))
                .join('');

            body.innerHTML = `
                <div class="renewal-history-list">
                    <div class="history-stats">
                        <div class="stat-item">
                            <span class="stat-label">总续期次数:</span>
                            <span class="stat-value">${this.renewalState.renewalHistory.length}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">最近续期:</span>
                            <span class="stat-value">${new Date(this.renewalState.renewalHistory[0]?.renewalTime).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="history-records">
                        ${historyHTML}
                    </div>
                </div>
            `;
        }

        modal.style.display = 'flex';
    }

    /**
     * 渲染历史记录项
     */
    renderHistoryRecord(record) {
        const renewalTime = new Date(record.renewalTime).toLocaleString();
        const oldExpire = new Date(record.oldExpire).toLocaleString();
        const newExpire = new Date(record.newExpire).toLocaleString();

        return `
            <div class="history-record">
                <div class="record-header">
                    <span class="record-license">${record.licenseCode}</span>
                    <span class="record-time">${renewalTime}</span>
                </div>
                <div class="record-details">
                    <div class="record-item">
                        <span class="label">续期时长:</span>
                        <span class="value">${record.renewalDays} 天</span>
                    </div>
                    <div class="record-item">
                        <span class="label">原过期时间:</span>
                        <span class="value">${oldExpire}</span>
                    </div>
                    <div class="record-item">
                        <span class="label">新过期时间:</span>
                        <span class="value">${newExpire}</span>
                    </div>
                    <div class="record-item">
                        <span class="label">批次:</span>
                        <span class="value">${record.batchName || '未命名'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 导出续期历史
     */
    exportRenewalHistory() {
        if (this.renewalState.renewalHistory.length === 0) {
            this.showError('暂无续期历史可导出');
            return;
        }

        try {
            const csvContent = this.generateHistoryCSV();
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');

            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `续期历史_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                this.showSuccess('续期历史导出成功');
            }
        } catch (error) {
            console.error('导出续期历史失败:', error);
            this.showError('导出失败: ' + error.message);
        }
    }

    /**
     * 生成历史记录CSV内容
     */
    generateHistoryCSV() {
        const headers = ['卡密代码', '续期时长(天)', '原过期时间', '新过期时间', '续期时间', '批次名称'];
        const rows = this.renewalState.renewalHistory.map(record => [
            record.licenseCode,
            record.renewalDays,
            new Date(record.oldExpire).toLocaleString(),
            new Date(record.newExpire).toLocaleString(),
            new Date(record.renewalTime).toLocaleString(),
            record.batchName || '未命名'
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        return '\uFEFF' + csvContent; // 添加BOM以支持中文
    }

    /**
     * 关闭续期模态框
     */
    closeRenewalModal() {
        const modal = document.getElementById('renewalModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 关闭历史模态框
     */
    closeHistoryModal() {
        const modal = document.getElementById('historyModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 检查续期管理权限
     */
    async checkPermissions() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('validate-feature-access', 'renewal-management');

            if (result.success && result.hasAccess) {
                console.log('✅ 续期管理权限验证通过');
                return true;
            } else {
                console.log('❌ 续期管理权限不足:', result.reason);
                return false;
            }
        } catch (error) {
            console.error('❌ 权限检查失败:', error);
            return false;
        }
    }

    /**
     * 显示访问被拒绝的界面
     */
    showAccessDenied() {
        const container = document.querySelector('.renewal-manager') || document.createElement('div');
        container.className = 'renewal-manager';

        container.innerHTML = `
            <div style="text-align: center; padding: 50px; background: rgba(255,255,255,0.95);
                        border-radius: 20px; margin: 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🔄</div>
                <h2 style="color: #666; margin-bottom: 15px;">续期功能受限</h2>
                <p style="color: #888; margin-bottom: 20px;">
                    续期管理功能需要专业版或企业版权限
                </p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <strong>🔄 专业版续期功能:</strong><br>
                    • 批量续期 • 续期提醒 • 续期历史<br><br>
                    <strong>🏆 企业版增强功能:</strong><br>
                    • 自动续期 • 高级提醒 • 续期策略
                </div>
                <button onclick="this.requestUpgrade()"
                        style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                               color: white; border: none; padding: 12px 24px;
                               border-radius: 6px; cursor: pointer; font-size: 14px;">
                    🚀 升级权限
                </button>
            </div>
        `;

        if (!document.querySelector('.renewal-manager')) {
            document.body.appendChild(container);
        }
    }

    /**
     * 请求权限升级
     */
    requestUpgrade() {
        alert('💡 请联系管理员获取更高级别的授权码\n\n' +
              '🥈 专业版: 支持续期管理功能\n' +
              '🥇 企业版: 支持所有高级续期功能');
    }

    /**
     * 销毁续期管理器
     */
    destroy() {
        this.stopPeriodicCheck();
        this.renewalState.isInitialized = false;
        console.log('🗑️ 续期管理器已销毁');
    }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', function() {
    // 延迟初始化，确保其他模块已加载
    setTimeout(() => {
        if (!window.renewalManager) {
            window.renewalManager = new LicenseRenewalManager();
            window.renewalManager.init();
        }
    }, 1500);
});

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LicenseRenewalManager;
}
