/**
 * 卡密状态一致性检查器
 * 用于检查和修复数据库中的状态不一致问题
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class StatusConsistencyChecker {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    /**
     * 连接数据库
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 关闭数据库连接
     */
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * 执行数据库查询
     */
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * 执行数据库更新
     */
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes, lastID: this.lastID });
                }
            });
        });
    }

    /**
     * 检查状态不一致的卡密
     */
    async findInconsistentLicenses() {
        const query = `
            SELECT 
                license_code,
                status,
                is_used,
                used_at,
                used_by_fingerprint,
                expires_at,
                created_at
            FROM licenses 
            WHERE (status = 'used' AND is_used = 0) 
               OR (status != 'used' AND is_used = 1 AND status != 'expired' AND status != 'disabled')
        `;

        return await this.query(query);
    }

    /**
     * 修复单个卡密的状态
     */
    async fixLicenseStatus(license) {
        const now = new Date();
        const expiresAt = new Date(license.expires_at);
        const isExpired = now > expiresAt;

        let newStatus = license.status;
        let setIsUsed = license.is_used;
        let clearUsageInfo = false;
        let action = '';

        if (license.status === 'used' && license.is_used === 0) {
            // 状态为used但is_used为0
            if (isExpired) {
                newStatus = 'expired';
                setIsUsed = 0;
                clearUsageInfo = true;
                action = '修复为expired（已过期）';
            } else {
                newStatus = 'active';
                setIsUsed = 0;
                clearUsageInfo = true;
                action = '修复为active';
            }
        } else if (license.status !== 'used' && license.is_used === 1) {
            // is_used为1但状态不是used
            if (isExpired) {
                newStatus = 'expired';
                setIsUsed = 1;
                clearUsageInfo = false;
                action = '修复为expired（已过期但已使用）';
            } else {
                newStatus = 'used';
                setIsUsed = 1;
                clearUsageInfo = false;
                action = '修复为used';
            }
        }

        let updateQuery;
        let params;

        if (clearUsageInfo) {
            updateQuery = `
                UPDATE licenses 
                SET status = ?, 
                    is_used = ?, 
                    used_at = NULL, 
                    used_by_fingerprint = NULL 
                WHERE license_code = ?
            `;
            params = [newStatus, setIsUsed, license.license_code];
        } else {
            updateQuery = `
                UPDATE licenses 
                SET status = ?, 
                    is_used = ? 
                WHERE license_code = ?
            `;
            params = [newStatus, setIsUsed, license.license_code];
        }

        await this.run(updateQuery, params);
        
        return {
            license_code: license.license_code,
            oldStatus: license.status,
            newStatus: newStatus,
            action: action
        };
    }

    /**
     * 执行完整的状态一致性检查和修复
     */
    async checkAndFix(silent = false) {
        try {
            await this.connect();
            
            if (!silent) {
                console.log('🔍 开始状态一致性检查...');
            }

            // 查找不一致的卡密
            const inconsistentLicenses = await this.findInconsistentLicenses();

            if (inconsistentLicenses.length === 0) {
                if (!silent) {
                    console.log('✅ 所有卡密状态一致，无需修复');
                }
                return { fixed: 0, total: 0 };
            }

            if (!silent) {
                console.log(`🚨 发现 ${inconsistentLicenses.length} 个状态不一致的卡密`);
            }

            // 修复每个不一致的卡密
            const fixResults = [];
            for (const license of inconsistentLicenses) {
                try {
                    const result = await this.fixLicenseStatus(license);
                    fixResults.push(result);
                    
                    if (!silent) {
                        console.log(`✅ ${result.license_code}: ${result.oldStatus} -> ${result.newStatus}`);
                    }
                } catch (error) {
                    if (!silent) {
                        console.error(`❌ 修复 ${license.license_code} 失败:`, error.message);
                    }
                }
            }

            if (!silent) {
                console.log(`✅ 状态一致性检查完成，修复了 ${fixResults.length} 个卡密`);
            }

            return {
                fixed: fixResults.length,
                total: inconsistentLicenses.length,
                results: fixResults
            };

        } catch (error) {
            if (!silent) {
                console.error('❌ 状态一致性检查失败:', error.message);
            }
            throw error;
        } finally {
            await this.close();
        }
    }

    /**
     * 获取状态统计
     */
    async getStatusStats() {
        try {
            await this.connect();
            
            const query = `
                SELECT 
                    status,
                    COUNT(*) as count,
                    SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_count
                FROM licenses 
                GROUP BY status
            `;

            const stats = await this.query(query);
            return stats;

        } finally {
            await this.close();
        }
    }
}

// 导出类
module.exports = StatusConsistencyChecker;

// 如果直接运行此文件，执行检查
if (require.main === module) {
    const dbPath = path.join(__dirname, 'data', 'license_system.db');
    const checker = new StatusConsistencyChecker(dbPath);
    
    checker.checkAndFix(false)
        .then(result => {
            console.log('\n📊 修复结果:', result);
            return checker.getStatusStats();
        })
        .then(stats => {
            console.log('\n📈 当前状态统计:');
            stats.forEach(stat => {
                const statusIcon = {
                    'active': '🟢',
                    'used': '🔴', 
                    'expired': '🟡',
                    'disabled': '⚫'
                }[stat.status] || '❓';
                
                console.log(`${statusIcon} ${stat.status}: ${stat.count} 个 (其中已使用: ${stat.used_count} 个)`);
            });
        })
        .catch(error => {
            console.error('❌ 执行失败:', error.message);
            process.exit(1);
        });
}
