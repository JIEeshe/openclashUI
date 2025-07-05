/**
 * 卡密批次管理模块
 * 提供批次查看、编辑、删除、筛选等功能
 */

class BatchManager {
    constructor() {
        this.batches = new Map(); // 批次数据缓存
        this.currentFilter = 'all'; // 当前筛选条件
        this.sortBy = 'generatedAt'; // 排序字段
        this.sortOrder = 'desc'; // 排序顺序
        this.isInitialized = false;
    }

    /**
     * 初始化批次管理器
     */
    async init() {
        if (this.isInitialized) return;

        console.log('🔧 初始化批次管理器...');

        // 权限检查
        const hasAccess = await this.checkPermissions();
        if (!hasAccess) {
            this.showAccessDenied();
            return;
        }

        // 创建批次管理界面
        this.createBatchManagerHTML();

        // 绑定事件监听器
        this.bindEventListeners();

        // 加载批次数据
        await this.loadBatchData();

        // 渲染批次列表
        this.renderBatchList();

        // 暴露全局函数
        this.exposeGlobalFunctions();

        this.isInitialized = true;
        console.log('✅ 批次管理器初始化完成');
    }

    /**
     * 检查批次管理权限
     */
    async checkPermissions() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('validate-feature-access', 'batch-management');

            if (result.success && result.hasAccess) {
                console.log('✅ 批次管理权限验证通过');
                return true;
            } else {
                console.log('❌ 批次管理权限不足:', result.reason);
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
        const container = document.querySelector('.batch-manager') || document.createElement('div');
        container.className = 'batch-manager';

        container.innerHTML = `
            <div style="text-align: center; padding: 50px; background: rgba(255,255,255,0.95);
                        border-radius: 20px; margin: 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🔒</div>
                <h2 style="color: #666; margin-bottom: 15px;">访问受限</h2>
                <p style="color: #888; margin-bottom: 20px;">
                    批次管理功能需要专业版或企业版权限
                </p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <strong>🎯 专业版功能:</strong><br>
                    • 批次管理 • 统计分析 • 高级筛选<br><br>
                    <strong>🏆 企业版功能:</strong><br>
                    • 所有专业版功能 • 在线管理 • 无限制生成
                </div>
                <button onclick="this.requestUpgrade()"
                        style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                               color: white; border: none; padding: 12px 24px;
                               border-radius: 6px; cursor: pointer; font-size: 14px;">
                    🚀 升级权限
                </button>
            </div>
        `;

        if (!document.querySelector('.batch-manager')) {
            document.body.appendChild(container);
        }
    }

    /**
     * 请求权限升级
     */
    requestUpgrade() {
        alert('💡 请联系管理员获取更高级别的授权码\n\n' +
              '🥈 专业版: 支持批次管理和统计分析\n' +
              '🥇 企业版: 支持所有高级功能');
    }

    /**
     * 创建批次管理界面HTML
     */
    createBatchManagerHTML() {
        const container = document.querySelector('.batch-manager') || document.createElement('div');
        container.className = 'batch-manager';
        
        container.innerHTML = `
            <div class="batch-manager-header">
                <h3>📦 批次管理</h3>
                <div class="batch-controls">
                    <div class="batch-search">
                        <input type="text" id="batchSearch" placeholder="搜索批次名称..." />
                        <button class="search-btn" onclick="searchBatches()">🔍</button>
                    </div>
                    <div class="batch-filters">
                        <select id="batchFilter" onchange="filterBatches()">
                            <option value="all">全部批次</option>
                            <option value="active">活跃批次</option>
                            <option value="expired">过期批次</option>
                            <option value="recent">最近7天</option>
                        </select>
                        <select id="batchSort" onchange="sortBatches()">
                            <option value="generatedAt-desc">按生成时间↓</option>
                            <option value="generatedAt-asc">按生成时间↑</option>
                            <option value="name-asc">按名称A-Z</option>
                            <option value="name-desc">按名称Z-A</option>
                            <option value="count-desc">按数量↓</option>
                            <option value="count-asc">按数量↑</option>
                        </select>
                    </div>
                    <button class="refresh-btn" onclick="refreshBatches()">🔄 刷新</button>
                </div>
            </div>
            
            <div class="batch-stats">
                <div class="batch-stat-card">
                    <div class="stat-number" id="totalBatches">0</div>
                    <div class="stat-label">总批次数</div>
                </div>
                <div class="batch-stat-card">
                    <div class="stat-number" id="activeBatches">0</div>
                    <div class="stat-label">活跃批次</div>
                </div>
                <div class="batch-stat-card">
                    <div class="stat-number" id="totalLicensesInBatches">0</div>
                    <div class="stat-label">总卡密数</div>
                </div>
                <div class="batch-stat-card">
                    <div class="stat-number" id="avgBatchSize">0</div>
                    <div class="stat-label">平均批次大小</div>
                </div>
            </div>
            
            <div class="batch-list" id="batchList">
                <div class="batch-loading">
                    <div class="loading-spinner"></div>
                    <div>正在加载批次数据...</div>
                </div>
            </div>
            
            <!-- 批次详情模态框 -->
            <div class="batch-modal" id="batchModal" style="display: none;">
                <div class="batch-modal-content">
                    <div class="batch-modal-header">
                        <h4 id="modalTitle">批次详情</h4>
                        <button class="close-btn" onclick="closeBatchModal()">&times;</button>
                    </div>
                    <div class="batch-modal-body" id="modalBody">
                        <!-- 动态内容 -->
                    </div>
                    <div class="batch-modal-footer">
                        <button class="btn-secondary" onclick="closeBatchModal()">关闭</button>
                        <button class="btn-primary" id="modalActionBtn">保存</button>
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
        // 搜索框实时搜索
        const searchInput = document.getElementById('batchSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.searchBatches();
            }, 300));
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                searchInput?.focus();
            }
        });
    }

    /**
     * 加载批次数据
     */
    async loadBatchData() {
        try {
            console.log('📊 加载批次数据...');
            
            // 从localStorage获取卡密数据
            const licenses = JSON.parse(localStorage.getItem('generatedLicenses') || '[]');
            
            // 从全局变量获取最新数据
            if (window.generatedLicenses && window.generatedLicenses.length > 0) {
                licenses.push(...window.generatedLicenses);
            }
            
            // 按批次分组
            this.batches.clear();
            
            licenses.forEach(license => {
                const batchId = license.batchId || 'unknown';
                const batchName = license.batchName || '未命名批次';
                
                if (!this.batches.has(batchId)) {
                    this.batches.set(batchId, {
                        id: batchId,
                        name: batchName,
                        licenses: [],
                        generatedAt: license.generatedAt ? new Date(license.generatedAt) : new Date(),
                        validityDays: license.validityDays || 30,
                        totalCount: 0,
                        activeCount: 0,
                        expiredCount: 0
                    });
                }
                
                const batch = this.batches.get(batchId);
                batch.licenses.push(license);
                batch.totalCount++;
                
                // 计算状态统计
                const now = new Date();
                const expiresAt = license.expiresAt ? new Date(license.expiresAt) : new Date(now.getTime() + license.validityDays * 24 * 60 * 60 * 1000);
                
                if (expiresAt > now) {
                    batch.activeCount++;
                } else {
                    batch.expiredCount++;
                }
            });
            
            console.log(`✅ 加载了 ${this.batches.size} 个批次，共 ${licenses.length} 个卡密`);
            
        } catch (error) {
            console.error('❌ 加载批次数据失败:', error);
            this.showError('加载批次数据失败: ' + error.message);
        }
    }

    /**
     * 渲染批次列表
     */
    renderBatchList() {
        const batchList = document.getElementById('batchList');
        if (!batchList) return;
        
        // 更新统计信息
        this.updateBatchStats();
        
        // 获取筛选和排序后的批次
        const filteredBatches = this.getFilteredBatches();
        
        if (filteredBatches.length === 0) {
            batchList.innerHTML = `
                <div class="batch-empty">
                    <div class="empty-icon">📦</div>
                    <div class="empty-title">暂无批次数据</div>
                    <div class="empty-description">生成卡密后将自动创建批次</div>
                </div>
            `;
            return;
        }
        
        const batchHTML = filteredBatches.map(batch => this.renderBatchCard(batch)).join('');
        batchList.innerHTML = batchHTML;
    }

    /**
     * 渲染单个批次卡片
     */
    renderBatchCard(batch) {
        const generatedDate = batch.generatedAt.toLocaleDateString();
        const generatedTime = batch.generatedAt.toLocaleTimeString();
        const activeRate = batch.totalCount > 0 ? Math.round((batch.activeCount / batch.totalCount) * 100) : 0;
        
        return `
            <div class="batch-card" data-batch-id="${batch.id}">
                <div class="batch-card-header">
                    <div class="batch-info">
                        <h4 class="batch-name">${batch.name}</h4>
                        <div class="batch-meta">
                            <span class="batch-id">ID: ${batch.id}</span>
                            <span class="batch-date">${generatedDate} ${generatedTime}</span>
                        </div>
                    </div>
                    <div class="batch-actions">
                        <button class="action-btn view-btn" onclick="viewBatchDetails('${batch.id}')" title="查看详情">
                            👁️
                        </button>
                        <button class="action-btn edit-btn" onclick="editBatch('${batch.id}')" title="编辑批次">
                            ✏️
                        </button>
                        <button class="action-btn export-btn" onclick="exportBatch('${batch.id}')" title="导出批次">
                            📤
                        </button>
                        <button class="action-btn delete-btn" onclick="deleteBatch('${batch.id}')" title="删除批次">
                            🗑️
                        </button>
                    </div>
                </div>
                
                <div class="batch-stats-row">
                    <div class="batch-stat">
                        <span class="stat-value">${batch.totalCount}</span>
                        <span class="stat-label">总数</span>
                    </div>
                    <div class="batch-stat">
                        <span class="stat-value">${batch.activeCount}</span>
                        <span class="stat-label">活跃</span>
                    </div>
                    <div class="batch-stat">
                        <span class="stat-value">${batch.expiredCount}</span>
                        <span class="stat-label">过期</span>
                    </div>
                    <div class="batch-stat">
                        <span class="stat-value">${activeRate}%</span>
                        <span class="stat-label">活跃率</span>
                    </div>
                    <div class="batch-stat">
                        <span class="stat-value">${batch.validityDays}天</span>
                        <span class="stat-label">有效期</span>
                    </div>
                </div>
                
                <div class="batch-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${activeRate}%"></div>
                    </div>
                    <div class="progress-text">${batch.activeCount}/${batch.totalCount} 活跃</div>
                </div>
            </div>
        `;
    }

    /**
     * 更新批次统计信息
     */
    updateBatchStats() {
        const totalBatches = this.batches.size;
        let activeBatches = 0;
        let totalLicenses = 0;
        
        this.batches.forEach(batch => {
            if (batch.activeCount > 0) activeBatches++;
            totalLicenses += batch.totalCount;
        });
        
        const avgBatchSize = totalBatches > 0 ? Math.round(totalLicenses / totalBatches) : 0;
        
        // 更新DOM
        const elements = {
            totalBatches: document.getElementById('totalBatches'),
            activeBatches: document.getElementById('activeBatches'),
            totalLicensesInBatches: document.getElementById('totalLicensesInBatches'),
            avgBatchSize: document.getElementById('avgBatchSize')
        };
        
        if (elements.totalBatches) elements.totalBatches.textContent = totalBatches;
        if (elements.activeBatches) elements.activeBatches.textContent = activeBatches;
        if (elements.totalLicensesInBatches) elements.totalLicensesInBatches.textContent = totalLicenses;
        if (elements.avgBatchSize) elements.avgBatchSize.textContent = avgBatchSize;
    }

    /**
     * 获取筛选和排序后的批次
     */
    getFilteredBatches() {
        let batches = Array.from(this.batches.values());
        
        // 应用筛选
        const filter = document.getElementById('batchFilter')?.value || this.currentFilter;
        const searchTerm = document.getElementById('batchSearch')?.value.toLowerCase() || '';
        
        batches = batches.filter(batch => {
            // 搜索筛选
            if (searchTerm && !batch.name.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            // 状态筛选
            switch (filter) {
                case 'active':
                    return batch.activeCount > 0;
                case 'expired':
                    return batch.expiredCount > 0 && batch.activeCount === 0;
                case 'recent':
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    return batch.generatedAt > weekAgo;
                default:
                    return true;
            }
        });
        
        // 应用排序
        const sortOption = document.getElementById('batchSort')?.value || `${this.sortBy}-${this.sortOrder}`;
        const [sortBy, sortOrder] = sortOption.split('-');
        
        batches.sort((a, b) => {
            let aValue, bValue;
            
            switch (sortBy) {
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'count':
                    aValue = a.totalCount;
                    bValue = b.totalCount;
                    break;
                case 'generatedAt':
                default:
                    aValue = a.generatedAt.getTime();
                    bValue = b.generatedAt.getTime();
                    break;
            }
            
            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
        
        return batches;
    }

    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        console.error('❌', message);
        // 这里可以添加更好的错误显示UI
        alert('错误: ' + message);
    }

    /**
     * 暴露全局函数
     */
    exposeGlobalFunctions() {
        // 暴露主要功能函数到全局作用域
        window.batchManager = this;
        window.refreshBatches = () => this.refreshBatches();
        window.searchBatches = () => this.searchBatches();
        window.filterBatches = () => this.filterBatches();
        window.sortBatches = () => this.sortBatches();
        window.viewBatchDetails = (batchId) => this.viewBatchDetails(batchId);
        window.editBatch = (batchId) => this.editBatch(batchId);
        window.deleteBatch = (batchId) => this.deleteBatch(batchId);
        window.exportBatch = (batchId) => this.exportBatch(batchId);
        window.closeBatchModal = () => this.closeBatchModal();
        
        console.log('✅ 批次管理全局函数已暴露');
    }

    /**
     * 刷新批次数据
     */
    async refreshBatches() {
        console.log('🔄 刷新批次数据...');
        await this.loadBatchData();
        this.renderBatchList();
        
        // 添加活动记录
        if (window.addActivity) {
            window.addActivity('刷新批次', 'info', '手动刷新批次管理数据');
        }
    }

    /**
     * 搜索批次
     */
    searchBatches() {
        this.renderBatchList();
    }

    /**
     * 筛选批次
     */
    filterBatches() {
        const filter = document.getElementById('batchFilter')?.value;
        this.currentFilter = filter || 'all';
        this.renderBatchList();
    }

    /**
     * 排序批次
     */
    sortBatches() {
        const sortOption = document.getElementById('batchSort')?.value;
        if (sortOption) {
            const [sortBy, sortOrder] = sortOption.split('-');
            this.sortBy = sortBy;
            this.sortOrder = sortOrder;
        }
        this.renderBatchList();
    }

    /**
     * 查看批次详情
     */
    viewBatchDetails(batchId) {
        const batch = this.batches.get(batchId);
        if (!batch) {
            this.showError('批次不存在');
            return;
        }
        
        console.log('👁️ 查看批次详情:', batchId);
        // 这里将在下一部分实现详细的模态框功能
        alert(`查看批次详情: ${batch.name}\n总数: ${batch.totalCount}\n活跃: ${batch.activeCount}\n过期: ${batch.expiredCount}`);
    }

    /**
     * 编辑批次
     */
    editBatch(batchId) {
        const batch = this.batches.get(batchId);
        if (!batch) {
            this.showError('批次不存在');
            return;
        }
        
        console.log('✏️ 编辑批次:', batchId);
        // 这里将在下一部分实现编辑功能
        const newName = prompt('请输入新的批次名称:', batch.name);
        if (newName && newName.trim() !== batch.name) {
            batch.name = newName.trim();
            this.renderBatchList();
            
            // 更新localStorage中的数据
            this.updateLicensesBatchName(batchId, newName.trim());
            
            if (window.addActivity) {
                window.addActivity('编辑批次', 'success', `批次 ${batchId} 名称已更新为 "${newName.trim()}"`);
            }
        }
    }

    /**
     * 删除批次
     */
    deleteBatch(batchId) {
        const batch = this.batches.get(batchId);
        if (!batch) {
            this.showError('批次不存在');
            return;
        }
        
        if (!confirm(`确定要删除批次 "${batch.name}" 吗？\n这将删除该批次下的 ${batch.totalCount} 个卡密，此操作不可恢复。`)) {
            return;
        }
        
        console.log('🗑️ 删除批次:', batchId);
        
        // 从内存中删除
        this.batches.delete(batchId);
        
        // 从localStorage中删除相关卡密
        this.removeLicensesByBatchId(batchId);
        
        // 重新渲染
        this.renderBatchList();
        
        if (window.addActivity) {
            window.addActivity('删除批次', 'warning', `已删除批次 "${batch.name}" 及其 ${batch.totalCount} 个卡密`);
        }
        
        // 刷新统计模块
        if (window.refreshStats) {
            window.refreshStats();
        }
    }

    /**
     * 导出批次
     */
    exportBatch(batchId) {
        const batch = this.batches.get(batchId);
        if (!batch) {
            this.showError('批次不存在');
            return;
        }
        
        console.log('📤 导出批次:', batchId);
        
        // 生成导出内容
        const content = batch.licenses.map(license => license.code).join('\n');
        const filename = `${batch.name}_${batch.id}.txt`;
        
        // 创建下载
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        if (window.addActivity) {
            window.addActivity('导出批次', 'success', `已导出批次 "${batch.name}" (${batch.totalCount} 个卡密)`);
        }
    }

    /**
     * 关闭模态框
     */
    closeBatchModal() {
        const modal = document.getElementById('batchModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 更新卡密的批次名称
     */
    updateLicensesBatchName(batchId, newName) {
        try {
            const licenses = JSON.parse(localStorage.getItem('generatedLicenses') || '[]');
            const updated = licenses.map(license => {
                if (license.batchId === batchId) {
                    license.batchName = newName;
                }
                return license;
            });
            localStorage.setItem('generatedLicenses', JSON.stringify(updated));
            
            // 同时更新全局变量
            if (window.generatedLicenses) {
                window.generatedLicenses.forEach(license => {
                    if (license.batchId === batchId) {
                        license.batchName = newName;
                    }
                });
            }
        } catch (error) {
            console.error('更新批次名称失败:', error);
        }
    }

    /**
     * 根据批次ID删除卡密
     */
    removeLicensesByBatchId(batchId) {
        try {
            const licenses = JSON.parse(localStorage.getItem('generatedLicenses') || '[]');
            const filtered = licenses.filter(license => license.batchId !== batchId);
            localStorage.setItem('generatedLicenses', JSON.stringify(filtered));
            
            // 同时更新全局变量
            if (window.generatedLicenses) {
                window.generatedLicenses = window.generatedLicenses.filter(license => license.batchId !== batchId);
            }
        } catch (error) {
            console.error('删除批次卡密失败:', error);
        }
    }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', function() {
    // 延迟初始化，确保其他模块已加载
    setTimeout(() => {
        if (!window.batchManager) {
            window.batchManager = new BatchManager();
            window.batchManager.init();
        }
    }, 1000);
});

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchManager;
}
