/**
 * 卡密上传管理器
 * 负责将生成的卡密上传到服务器
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const os = require('os');

class LicenseUploader {
  constructor() {
    // 服务器配置
    this.serverConfig = {
      host: process.env.LICENSE_SERVER_HOST || 'localhost',
      port: process.env.LICENSE_SERVER_PORT || 3001,
      protocol: process.env.LICENSE_SERVER_PROTOCOL || 'http',
      apiSecret: process.env.API_SECRET || 'LEIYU-MEDIA-API-SECRET-2025'
    };

    this.baseUrl = `${this.serverConfig.protocol}://${this.serverConfig.host}:${this.serverConfig.port}/api`;
    
    // 管理员令牌（需要从环境变量或配置文件获取）
    this.adminToken = process.env.ADMIN_TOKEN || this.generateAdminToken();
    
    console.log('📤 卡密上传管理器初始化完成');
    console.log('📡 服务器地址:', this.baseUrl);
  }

  /**
   * 生成管理员令牌（临时方案，生产环境应该从安全存储获取）
   */
  generateAdminToken() {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'LEIYU-MEDIA-JWT-SECRET-2025';
    
    return jwt.sign(
      { 
        role: 'admin', 
        username: 'license-generator',
        issued: Date.now()
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
  }

  /**
   * 生成请求签名
   */
  generateRequestSignature(data, timestamp) {
    const payload = `${JSON.stringify(data)}|${timestamp}`;
    return crypto
      .createHmac('sha256', this.serverConfig.apiSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * 发送HTTP请求到服务器
   */
  async makeRequest(endpoint, data, method = 'POST') {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now().toString();
      const signature = this.generateRequestSignature(data, timestamp);
      
      const postData = JSON.stringify(data);
      
      const options = {
        hostname: this.serverConfig.host,
        port: this.serverConfig.port,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': `LeiyuMediaLicenseGenerator/1.0 (${os.platform()}; ${os.arch()})`,
          'signature': signature,
          'timestamp': timestamp
        },
        timeout: 30000 // 30秒超时
      };

      const protocol = this.serverConfig.protocol === 'https' ? https : http;
      
      const req = protocol.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            resolve({
              success: res.statusCode === 200,
              statusCode: res.statusCode,
              data: response
            });
          } catch (error) {
            reject(new Error('服务器响应格式错误'));
          }
        });
      });

      req.on('error', (error) => {
        console.error('网络请求失败:', error);
        reject(new Error('网络连接失败，请检查网络设置'));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时，请稍后重试'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 检查服务器连接状态
   */
  async checkServerConnection() {
    try {
      const response = await this.makeRequest('/api/health', {}, 'GET');
      return {
        success: response.success && response.data.success,
        message: response.data.message || '服务器连接正常'
      };
    } catch (error) {
      return {
        success: false,
        message: '服务器连接失败: ' + error.message
      };
    }
  }

  /**
   * 上传单个卡密
   */
  async uploadSingleLicense(licenseData) {
    try {
      const uploadData = {
        licenses: [licenseData],
        batchName: `单个卡密-${Date.now()}`,
        adminToken: this.adminToken,
        uploadedBy: 'license-generator',
        uploadedAt: new Date().toISOString()
      };

      const response = await this.makeRequest('/api/upload-licenses', uploadData);
      
      if (response.success && response.data.success) {
        return {
          success: true,
          message: '卡密上传成功',
          data: response.data.data
        };
      } else {
        return {
          success: false,
          message: response.data.error || '上传失败'
        };
      }
    } catch (error) {
      console.error('上传单个卡密失败:', error);
      return {
        success: false,
        message: '上传失败: ' + error.message
      };
    }
  }

  /**
   * 批量上传卡密
   */
  async uploadBatchLicenses(licenses, batchName = null) {
    try {
      console.log(`📤 开始批量上传 ${licenses.length} 个卡密...`);
      
      // 检查服务器连接
      const connectionCheck = await this.checkServerConnection();
      if (!connectionCheck.success) {
        throw new Error(connectionCheck.message);
      }

      const uploadData = {
        licenses: licenses.map(license => ({
          code: license.code,
          validityDays: license.validityDays || license.validity_days || 30,
          generatedAt: license.generatedAt || new Date().toISOString()
        })),
        batchName: batchName || `批次-${Date.now()}`,
        adminToken: this.adminToken,
        uploadedBy: 'license-generator',
        uploadedAt: new Date().toISOString(),
        totalCount: licenses.length
      };

      console.log('📡 发送上传请求...');
      const response = await this.makeRequest('/api/upload-licenses', uploadData);
      
      if (response.success && response.data.success) {
        console.log('✅ 批量上传成功');
        return {
          success: true,
          message: `成功上传 ${response.data.data.uploaded} 个卡密`,
          data: {
            uploaded: response.data.data.uploaded,
            errors: response.data.data.errors,
            batchId: response.data.data.batchId,
            details: response.data.data.details
          }
        };
      } else {
        console.log('❌ 批量上传失败:', response.data.error);
        return {
          success: false,
          message: response.data.error || '批量上传失败'
        };
      }
    } catch (error) {
      console.error('❌ 批量上传异常:', error);
      return {
        success: false,
        message: '批量上传失败: ' + error.message
      };
    }
  }

  /**
   * 获取服务器统计信息
   */
  async getServerStats() {
    try {
      const response = await this.makeRequest('/api/license-stats', {}, 'GET');
      
      if (response.success && response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          message: '获取统计信息失败'
        };
      }
    } catch (error) {
      console.error('获取服务器统计信息失败:', error);
      return {
        success: false,
        message: '获取统计信息失败: ' + error.message
      };
    }
  }

  /**
   * 验证管理员权限
   */
  async verifyAdminPermission() {
    try {
      // 通过获取统计信息来验证管理员权限
      const stats = await this.getServerStats();
      return stats.success;
    } catch (error) {
      console.error('验证管理员权限失败:', error);
      return false;
    }
  }

  /**
   * 分批上传大量卡密（避免单次请求过大）
   */
  async uploadLargeDataset(licenses, batchSize = 100, batchName = null) {
    try {
      console.log(`📦 开始分批上传 ${licenses.length} 个卡密，每批 ${batchSize} 个...`);
      
      const results = [];
      const totalBatches = Math.ceil(licenses.length / batchSize);
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, licenses.length);
        const batch = licenses.slice(start, end);
        
        const currentBatchName = `${batchName || '大批量'}-第${i + 1}批`;
        console.log(`📤 上传第 ${i + 1}/${totalBatches} 批 (${batch.length} 个卡密)...`);
        
        const result = await this.uploadBatchLicenses(batch, currentBatchName);
        results.push({
          batchIndex: i + 1,
          batchSize: batch.length,
          result: result
        });
        
        // 批次间延迟，避免服务器压力过大
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // 统计总体结果
      const totalUploaded = results.reduce((sum, r) => 
        sum + (r.result.success ? r.result.data?.uploaded || 0 : 0), 0);
      const totalErrors = results.reduce((sum, r) => 
        sum + (r.result.success ? r.result.data?.errors || 0 : 0), 0);
      
      console.log(`✅ 分批上传完成: 成功 ${totalUploaded} 个，失败 ${totalErrors} 个`);
      
      return {
        success: true,
        message: `分批上传完成: 成功 ${totalUploaded} 个，失败 ${totalErrors} 个`,
        data: {
          totalUploaded: totalUploaded,
          totalErrors: totalErrors,
          batchResults: results
        }
      };
      
    } catch (error) {
      console.error('❌ 分批上传失败:', error);
      return {
        success: false,
        message: '分批上传失败: ' + error.message
      };
    }
  }

  /**
   * 检查服务器健康状态
   */
  async checkServerHealth() {
    try {
      console.log('🔍 检查服务器健康状态...');
      const response = await this.makeRequest('/api/health', {}, 'GET');

      if (response.success && response.data.success) {
        console.log('✅ 服务器健康检查通过');
        return {
          success: true,
          online: true,
          message: response.data.message || '服务器运行正常',
          timestamp: response.data.timestamp
        };
      } else {
        console.log('❌ 服务器健康检查失败');
        return {
          success: false,
          online: false,
          message: response.data?.error || '服务器响应异常'
        };
      }
    } catch (error) {
      console.error('❌ 服务器健康检查异常:', error);
      return {
        success: false,
        online: false,
        message: '无法连接到服务器: ' + error.message
      };
    }
  }

  /**
   * 获取服务器卡密列表
   */
  async getServerLicenses(options = {}) {
    try {
      console.log('📋 获取服务器卡密列表...');

      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (options.limit) queryParams.append('limit', options.limit);
      if (options.offset) queryParams.append('offset', options.offset);
      if (options.status) queryParams.append('status', options.status);
      if (options.batchId) queryParams.append('batchId', options.batchId);

      const endpoint = `/api/licenses${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await this.makeRequest(endpoint, {}, 'GET');

      if (response.success && response.data.success) {
        console.log(`✅ 获取到 ${response.data.data.length} 个卡密`);
        return {
          success: true,
          data: response.data.data,
          total: response.data.total || response.data.data.length
        };
      } else {
        console.log('❌ 获取服务器卡密列表失败:', response.data?.error);
        return {
          success: false,
          message: response.data?.error || '获取卡密列表失败'
        };
      }
    } catch (error) {
      console.error('❌ 获取服务器卡密列表异常:', error);
      return {
        success: false,
        message: '获取卡密列表失败: ' + error.message
      };
    }
  }

  /**
   * 检查服务器连接状态（简化版本）
   */
  async checkServerConnection() {
    return await this.checkServerHealth();
  }

  /**
   * 删除单个卡密
   */
  async deleteLicense(licenseCode) {
    try {
      console.log(`🗑️ 删除卡密: ${licenseCode}`);

      const deleteData = {
        adminToken: this.adminToken
      };

      const response = await this.makeRequest(`/api/licenses/${licenseCode}`, deleteData, 'DELETE');

      if (response.success && response.data.success) {
        console.log('✅ 卡密删除成功');
        return {
          success: true,
          message: response.data.message,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          message: response.data.error || '删除失败'
        };
      }
    } catch (error) {
      console.error('删除卡密失败:', error);
      return {
        success: false,
        message: '删除失败: ' + error.message
      };
    }
  }

  /**
   * 批量删除卡密
   */
  async deleteBatchLicenses(licenseCodes) {
    try {
      console.log(`🗑️ 批量删除 ${licenseCodes.length} 个卡密`);

      const deleteData = {
        licenseCodes: licenseCodes,
        adminToken: this.adminToken
      };

      const response = await this.makeRequest('/api/licenses', deleteData, 'DELETE');

      if (response.success && response.data.success) {
        console.log('✅ 批量删除成功');
        return {
          success: true,
          message: response.data.message,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          message: response.data.error || '批量删除失败'
        };
      }
    } catch (error) {
      console.error('批量删除失败:', error);
      return {
        success: false,
        message: '批量删除失败: ' + error.message
      };
    }
  }

  /**
   * 更新卡密状态
   */
  async updateLicenseStatus(licenseCode, status) {
    try {
      console.log(`🔄 更新卡密状态: ${licenseCode} -> ${status}`);

      const updateData = {
        status: status,
        adminToken: this.adminToken
      };

      const response = await this.makeRequest(`/api/licenses/${licenseCode}/status`, updateData, 'PUT');

      if (response.success && response.data.success) {
        console.log('✅ 状态更新成功');
        return {
          success: true,
          message: response.data.message,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          message: response.data.error || '状态更新失败'
        };
      }
    } catch (error) {
      console.error('状态更新失败:', error);
      return {
        success: false,
        message: '状态更新失败: ' + error.message
      };
    }
  }

  /**
   * 搜索卡密
   */
  async searchLicenses(searchTerm, options = {}) {
    try {
      console.log(`🔍 搜索卡密: ${searchTerm}`);

      const searchOptions = {
        ...options,
        search: searchTerm
      };

      return await this.getServerLicenses(searchOptions);
    } catch (error) {
      console.error('搜索卡密失败:', error);
      return {
        success: false,
        message: '搜索失败: ' + error.message
      };
    }
  }
}

module.exports = LicenseUploader;
