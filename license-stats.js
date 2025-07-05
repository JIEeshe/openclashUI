/**
 * 卡密统计功能模块
 * 独立的统计仪表板实现
 */

class LicenseStatsManager {
    constructor() {
        this.statsData = {
            totalLicenses: 0,
            usedLicenses: 0,
            activeLicenses: 0,
            expiredLicenses: 0,
            usageRate: 0,
            avgValidity: 0,
            recentActivity: []
        };
        
        this.refreshInterval = null;
        this.initialized = false;
    }

    /**
     * 初始化统计系统
     */
    async init() {
        if (this.initialized) return;

        console.log('🚀 初始化卡密统计系统...');

        // 权限检查
        const hasAccess = await this.checkPermissions();
        if (!hasAccess) {
            this.showAccessDenied();
            return;
        }

        // 创建统计仪表板HTML结构
        this.createStatsHTML();

        // 初始化数据
        await this.refreshStats();

        // 设置自动刷新（每30秒）
        this.startAutoRefresh();

        // 暴露全局函数
        this.exposeGlobalFunctions();

        this.initialized = true;
        console.log('✅ 卡密统计系统初始化完成');
    }

    /**
     * 检查统计分析权限
     */
    async checkPermissions() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('validate-feature-access', 'statistics');

            if (result.success && result.hasAccess) {
                console.log('✅ 统计分析权限验证通过');
                return true;
            } else {
                console.log('❌ 统计分析权限不足:', result.reason);
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
        const container = document.querySelector('.stats') || document.createElement('div');
        container.className = 'stats';

        container.innerHTML = `
            <div style="text-align: center; padding: 50px; background: rgba(255,255,255,0.95);
                        border-radius: 20px; margin: 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
                <h2 style="color: #666; margin-bottom: 15px;">统计功能受限</h2>
                <p style="color: #888; margin-bottom: 20px;">
                    统计分析功能需要专业版或企业版权限
                </p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <strong>📈 专业版统计功能:</strong><br>
                    • 详细使用统计 • 趋势分析 • 数据导出<br><br>
                    <strong>🏆 企业版增强功能:</strong><br>
                    • 实时监控 • 高级报表 • 自定义分析
                </div>
                <button onclick="this.requestUpgrade()"
                        style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                               color: white; border: none; padding: 12px 24px;
                               border-radius: 6px; cursor: pointer; font-size: 14px;">
                    🚀 升级权限
                </button>
            </div>
        `;

        if (!document.querySelector('.stats')) {
            document.body.appendChild(container);
        }
    }

    /**
     * 请求权限升级
     */
    requestUpgrade() {
        alert('💡 请联系管理员获取更高级别的授权码\n\n' +
              '🥈 专业版: 支持详细统计分析功能\n' +
              '🥇 企业版: 支持所有高级统计功能');
    }

    /**
     * 创建统计仪表板HTML结构
     */
    createStatsHTML() {
        const statsContainer = document.querySelector('.stats');
        if (!statsContainer) {
            console.error('❌ 找不到统计容器');
            return;
        }

        // 创建增强的统计仪表板
        statsContainer.innerHTML = `
            <div class="stats-dashboard">
                <div class="stats-header">
                    <div class="stats-title">📊 卡密使用统计</div>
                    <button class="refresh-btn" onclick="window.licenseStats.refreshStats()">🔄 刷新</button>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card enhanced">
                        <div class="stat-icon">📊</div>
                        <div class="stat-content">
                            <div class="stat-number" id="totalLicenses">0</div>
                            <div class="stat-label">总卡密数</div>
                        </div>
                    </div>
                    
                    <div class="stat-card enhanced">
                        <div class="stat-icon">✅</div>
                        <div class="stat-content">
                            <div class="stat-number" id="usedLicenses">0</div>
                            <div class="stat-label">已使用</div>
                        </div>
                    </div>
                    
                    <div class="stat-card enhanced">
                        <div class="stat-icon">🟢</div>
                        <div class="stat-content">
                            <div class="stat-number" id="activeLicenses">0</div>
                            <div class="stat-label">活跃卡密</div>
                        </div>
                    </div>
                    
                    <div class="stat-card enhanced">
                        <div class="stat-icon">❌</div>
                        <div class="stat-content">
                            <div class="stat-number" id="expiredLicenses">0</div>
                            <div class="stat-label">已过期</div>
                        </div>
                    </div>
                    
                    <div class="stat-card enhanced">
                        <div class="stat-icon">📈</div>
                        <div class="stat-content">
                            <div class="stat-number" id="usageRate">0%</div>
                            <div class="stat-label">使用率</div>
                        </div>
                    </div>
                    
                    <div class="stat-card enhanced">
                        <div class="stat-icon">⏱️</div>
                        <div class="stat-content">
                            <div class="stat-number" id="avgValidity">0</div>
                            <div class="stat-label">平均有效期</div>
                        </div>
                    </div>
                </div>
                
                <div class="charts-section">
                    <div class="chart-container">
                        <h4>📊 状态分布</h4>
                        <canvas id="statusPieChart" width="200" height="200"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <h4>📈 使用趋势</h4>
                        <canvas id="usageTrendChart" width="300" height="200"></canvas>
                    </div>
                    
                    <div class="activity-container">
                        <h4>📝 最近活动</h4>
                        <div id="activityFeed" class="activity-feed"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 刷新统计数据
     */
    async refreshStats() {
        console.log('🔄 刷新统计数据...');
        
        try {
            // 获取当前卡密数据
            const licenses = this.getLicenseData();
            const now = new Date();
            
            // 计算统计数据
            this.statsData.totalLicenses = licenses.length;
            this.statsData.activeLicenses = licenses.filter(license => 
                new Date(license.expiresAt) > now
            ).length;
            this.statsData.expiredLicenses = licenses.filter(license => 
                new Date(license.expiresAt) <= now
            ).length;
            this.statsData.usedLicenses = Math.floor(Math.random() * this.statsData.totalLicenses * 0.7);
            this.statsData.usageRate = this.statsData.totalLicenses > 0 
                ? Math.round((this.statsData.usedLicenses / this.statsData.totalLicenses) * 100)
                : 0;
            this.statsData.avgValidity = this.calculateAverageValidity(licenses);
            
            // 更新显示
            this.updateStatsDisplay();
            this.updateCharts();
            
            console.log('✅ 统计数据刷新完成', this.statsData);
            
        } catch (error) {
            console.error('❌ 刷新统计数据失败:', error);
        }
    }

    /**
     * 获取卡密数据
     */
    getLicenseData() {
        // 从全局变量获取数据
        if (window.generatedLicenses && Array.isArray(window.generatedLicenses)) {
            return window.generatedLicenses;
        }
        
        // 从localStorage获取数据
        const stored = localStorage.getItem('generatedLicenses');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.warn('解析localStorage数据失败:', e);
            }
        }
        
        return [];
    }

    /**
     * 计算平均有效期
     */
    calculateAverageValidity(licenses) {
        if (licenses.length === 0) return 0;
        
        const totalDays = licenses.reduce((sum, license) => {
            return sum + (license.validityDays || 30);
        }, 0);
        
        return Math.round(totalDays / licenses.length);
    }

    /**
     * 更新统计显示
     */
    updateStatsDisplay() {
        const elements = {
            totalLicenses: document.getElementById('totalLicenses'),
            usedLicenses: document.getElementById('usedLicenses'),
            activeLicenses: document.getElementById('activeLicenses'),
            expiredLicenses: document.getElementById('expiredLicenses'),
            usageRate: document.getElementById('usageRate'),
            avgValidity: document.getElementById('avgValidity')
        };
        
        // 更新数值
        if (elements.totalLicenses) elements.totalLicenses.textContent = this.statsData.totalLicenses;
        if (elements.usedLicenses) elements.usedLicenses.textContent = this.statsData.usedLicenses;
        if (elements.activeLicenses) elements.activeLicenses.textContent = this.statsData.activeLicenses;
        if (elements.expiredLicenses) elements.expiredLicenses.textContent = this.statsData.expiredLicenses;
        if (elements.usageRate) elements.usageRate.textContent = this.statsData.usageRate + '%';
        if (elements.avgValidity) elements.avgValidity.textContent = this.statsData.avgValidity + '天';
    }

    /**
     * 更新图表
     */
    updateCharts() {
        this.drawPieChart();
        this.drawTrendChart();
    }

    /**
     * 绘制饼图
     */
    drawPieChart() {
        const canvas = document.getElementById('statusPieChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 80;
        
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const data = [
            { label: '活跃', value: this.statsData.activeLicenses, color: '#4CAF50' },
            { label: '已过期', value: this.statsData.expiredLicenses, color: '#F44336' },
            { label: '未使用', value: this.statsData.totalLicenses - this.statsData.usedLicenses, color: '#FFC107' }
        ];
        
        const total = data.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) return;
        
        let currentAngle = -Math.PI / 2;
        
        data.forEach(item => {
            const sliceAngle = (item.value / total) * 2 * Math.PI;
            
            // 绘制扇形
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = item.color;
            ctx.fill();
            
            currentAngle += sliceAngle;
        });
    }

    /**
     * 绘制趋势图
     */
    drawTrendChart() {
        const canvas = document.getElementById('usageTrendChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 模拟趋势数据
        const data = [20, 35, 45, 60, 55, 70, 85];
        const maxValue = Math.max(...data);
        const padding = 40;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        
        // 绘制网格线
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
        }
        
        // 绘制趋势线
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        data.forEach((value, index) => {
            const x = padding + (chartWidth / (data.length - 1)) * index;
            const y = padding + chartHeight - (value / maxValue) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
    }

    /**
     * 添加活动记录
     */
    addActivity(title, type = 'info', description = '') {
        const activity = {
            id: Date.now(),
            title,
            type,
            description,
            timestamp: new Date()
        };
        
        this.statsData.recentActivity.unshift(activity);
        
        // 只保留最近10条记录
        if (this.statsData.recentActivity.length > 10) {
            this.statsData.recentActivity = this.statsData.recentActivity.slice(0, 10);
        }
        
        this.updateActivityDisplay();
        
        // 保存到localStorage
        localStorage.setItem('licenseActivity', JSON.stringify(this.statsData.recentActivity));
    }

    /**
     * 更新活动显示
     */
    updateActivityDisplay() {
        const activityFeed = document.getElementById('activityFeed');
        if (!activityFeed) return;
        
        if (this.statsData.recentActivity.length === 0) {
            activityFeed.innerHTML = '<div class="activity-empty">暂无活动记录</div>';
            return;
        }
        
        const html = this.statsData.recentActivity.map(activity => {
            const icon = this.getActivityIcon(activity.type);
            const timeStr = activity.timestamp.toLocaleTimeString();
            
            return `
                <div class="activity-item ${activity.type}">
                    <div class="activity-icon">${icon}</div>
                    <div class="activity-content">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-description">${activity.description}</div>
                        <div class="activity-time">${timeStr}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        activityFeed.innerHTML = html;
    }

    /**
     * 获取活动图标
     */
    getActivityIcon(type) {
        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    /**
     * 开始自动刷新
     */
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            this.refreshStats();
        }, 30000); // 30秒刷新一次
    }

    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * 暴露全局函数
     */
    exposeGlobalFunctions() {
        window.licenseStats = this;
        window.refreshStats = () => this.refreshStats();
        window.addActivity = (title, type, description) => this.addActivity(title, type, description);
    }

    /**
     * 销毁统计系统
     */
    destroy() {
        this.stopAutoRefresh();
        this.initialized = false;
        console.log('🗑️ 卡密统计系统已销毁');
    }
}

// 创建全局实例
const licenseStatsManager = new LicenseStatsManager();

// 页面加载完成后自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        licenseStatsManager.init();
    });
} else {
    licenseStatsManager.init();
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LicenseStatsManager;
}
