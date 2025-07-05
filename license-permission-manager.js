/**
 * 卡密权限管理器
 * 负责验证和管理不同级别卡密的权限
 */

class LicensePermissionManager {
  constructor() {
    // 权限配置
    this.permissionConfigs = {
      basic: {
        name: '基础版',
        icon: '🥉',
        maxNodes: 10,
        allowSync: false,
        allowFeedback: false,
        allowAdvancedMapping: false,
        allowPrioritySupport: false,
        features: [
          '基础配置管理',
          '最多10个节点',
          '基础网段映射'
        ],
        restrictions: [
          '不支持配置同步',
          '不支持反馈交流',
          '不支持高级网段映射'
        ]
      },
      professional: {
        name: '专业版',
        icon: '🥈',
        maxNodes: 100,
        allowSync: true,
        allowFeedback: true,
        allowAdvancedMapping: true,
        allowPrioritySupport: false,
        features: [
          '完整配置管理',
          '最多100个节点',
          '网段映射功能',
          '配置同步功能',
          '反馈交流功能'
        ],
        restrictions: [
          '不支持优先技术支持'
        ]
      },
      enterprise: {
        name: '企业版',
        icon: '🥇',
        maxNodes: -1, // -1 表示无限制
        allowSync: true,
        allowFeedback: true,
        allowAdvancedMapping: true,
        allowPrioritySupport: true,
        features: [
          '完整配置管理',
          '无限节点数量',
          '高级网段映射',
          '配置同步功能',
          '反馈交流功能',
          '优先技术支持'
        ],
        restrictions: []
      }
    };

    this.currentLicense = null;
  }

  /**
   * 设置当前授权信息
   * @param {string|object} licenseData - 授权数据（可以是卡密字符串或授权对象）
   */
  async setCurrentLicense(licenseData) {
    if (typeof licenseData === 'string') {
      // 如果是字符串，需要解析卡密获取级别信息
      const LicenseManager = require('./license-manager.js');
      const licenseManager = new LicenseManager();

      try {
        const verification = await licenseManager.verifyLicense(licenseData);

        if (verification.valid && verification.data) {
          this.currentLicense = {
            code: licenseData,
            data: verification.data
          };
        } else {
          console.warn('❌ 无效的卡密，使用基础版权限');
          this.currentLicense = {
            code: licenseData,
            data: { licenseLevel: 'basic' }
          };
        }
      } catch (error) {
        console.error('❌ 验证卡密时发生错误:', error);
        this.currentLicense = {
          code: licenseData,
          data: { licenseLevel: 'basic' }
        };
      }
    } else {
      this.currentLicense = licenseData;
    }
  }

  /**
   * 获取当前授权级别
   * @returns {string} 授权级别
   */
  getCurrentLevel() {
    if (!this.currentLicense || !this.currentLicense.data) {
      return 'basic'; // 默认基础版
    }
    return this.currentLicense.data.licenseLevel || 'professional';
  }

  /**
   * 获取当前级别的权限配置
   * @returns {object} 权限配置
   */
  getCurrentPermissions() {
    const level = this.getCurrentLevel();
    const config = this.permissionConfigs[level] || this.permissionConfigs.basic;

    // 添加nodeLimit属性以保持向后兼容
    return {
      ...config,
      nodeLimit: config.maxNodes === -1 ? '无限制' : config.maxNodes
    };
  }

  /**
   * 检查是否有特定权限
   * @param {string} permission - 权限名称
   * @returns {boolean} 是否有权限
   */
  hasPermission(permission) {
    const permissions = this.getCurrentPermissions();
    
    switch (permission) {
      case 'sync':
        return permissions.allowSync;
      case 'feedback':
        return permissions.allowFeedback;
      case 'advanced_mapping':
        return permissions.allowAdvancedMapping;
      case 'priority_support':
        return permissions.allowPrioritySupport;
      default:
        return false;
    }
  }

  /**
   * 检查节点数量限制
   * @param {number} nodeCount - 当前节点数量
   * @returns {object} 检查结果
   */
  checkNodeLimit(nodeCount) {
    const permissions = this.getCurrentPermissions();
    const maxNodes = permissions.maxNodes;

    if (maxNodes === -1) {
      return {
        success: true,
        canAdd: true,
        limit: '无限制',
        remaining: -1,
        message: '无限制'
      };
    }

    const canAdd = nodeCount <= maxNodes;
    const remaining = Math.max(0, maxNodes - nodeCount);

    return {
      success: true,
      canAdd: canAdd,
      limit: maxNodes,
      remaining: remaining,
      message: canAdd
        ? `还可添加 ${remaining} 个节点`
        : `已超出限制，最多允许 ${maxNodes} 个节点`,
      suggestion: !canAdd ? `请升级到更高级别以获得更多节点配额` : null
    };
  }

  /**
   * 获取权限摘要
   * @returns {object} 权限摘要
   */
  getPermissionSummary() {
    const level = this.getCurrentLevel();
    const permissions = this.getCurrentPermissions();
    
    return {
      level: level,
      levelName: permissions.name,
      icon: permissions.icon,
      maxNodes: permissions.maxNodes,
      features: permissions.features,
      restrictions: permissions.restrictions,
      permissions: {
        sync: permissions.allowSync,
        feedback: permissions.allowFeedback,
        advancedMapping: permissions.allowAdvancedMapping,
        prioritySupport: permissions.allowPrioritySupport
      }
    };
  }

  /**
   * 验证功能访问权限
   * @param {string} feature - 功能名称
   * @returns {object} 验证结果
   */
  validateFeatureAccess(feature) {
    const permissions = this.getCurrentPermissions();
    const level = this.getCurrentLevel();

    // 功能权限映射
    const featurePermissions = {
      // 基础功能 - 所有级别都支持
      'basic-generation': true,
      'node_management': true,
      'config_management': true,
      'segment_mapping': true,

      // 专业版及以上功能
      'batch-management': level === 'professional' || level === 'enterprise',
      'statistics': level === 'professional' || level === 'enterprise',
      'renewal-management': level === 'professional' || level === 'enterprise',
      'config_sync': permissions.allowSync,
      'feedback_system': permissions.allowFeedback,
      'advanced_mapping': permissions.allowAdvancedMapping,

      // 企业版专属功能
      'online-management': level === 'enterprise',
      'priority_support': permissions.allowPrioritySupport
    };

    const hasAccess = featurePermissions[feature] || false;

    let reason = '';
    if (!hasAccess) {
      if (level === 'basic' && ['batch-management', 'statistics', 'renewal-management'].includes(feature)) {
        reason = '需要专业版或企业版权限';
      } else if (level !== 'enterprise' && feature === 'online-management') {
        reason = '需要企业版权限';
      } else {
        reason = '权限不足';
      }
    }

    return {
      success: true,
      hasAccess: hasAccess,
      level: level,
      levelName: permissions.name,
      reason: reason,
      message: hasAccess
        ? `${permissions.name}支持此功能`
        : `${permissions.name}不支持此功能，${reason}`
    };
  }

  /**
   * 获取升级建议
   * @param {string} requestedFeature - 请求的功能
   * @returns {object} 升级建议
   */
  getUpgradeSuggestion(requestedFeature) {
    const currentLevel = this.getCurrentLevel();
    
    const featureRequirements = {
      'config_sync': 'professional',
      'feedback_system': 'professional', 
      'advanced_mapping': 'professional',
      'priority_support': 'enterprise',
      'unlimited_nodes': 'enterprise'
    };
    
    const requiredLevel = featureRequirements[requestedFeature];
    
    if (!requiredLevel || currentLevel === requiredLevel) {
      return null;
    }
    
    const requiredConfig = this.permissionConfigs[requiredLevel];
    
    return {
      currentLevel: currentLevel,
      requiredLevel: requiredLevel,
      requiredLevelName: requiredConfig.name,
      message: `此功能需要${requiredConfig.name}或更高级别的授权`
    };
  }

  /**
   * 生成权限报告
   * @returns {object} 权限报告
   */
  generatePermissionReport() {
    const summary = this.getPermissionSummary();
    const licenseInfo = this.currentLicense;
    
    return {
      timestamp: new Date().toISOString(),
      license: {
        level: summary.level,
        levelName: summary.levelName,
        icon: summary.icon,
        valid: licenseInfo ? licenseInfo.valid : false,
        remainingDays: licenseInfo ? licenseInfo.remainingDays : 0
      },
      permissions: summary.permissions,
      limits: {
        maxNodes: summary.maxNodes,
        nodeMessage: summary.maxNodes === -1 ? '无限制' : `最多 ${summary.maxNodes} 个节点`
      },
      features: summary.features,
      restrictions: summary.restrictions
    };
  }
}

module.exports = LicensePermissionManager;
