/**
 * Siyuan Notes 连接器
 * 提供简化的 API 接口和错误处理
 */

const http = require('http');
const https = require('https');

/**
 * 默认 TLS 配置
 * 默认情况下，仅允许 localhost 使用自签名证书
 * 生产环境建议设置 allowSelfSignedCerts: false
 */
const DEFAULT_TLS_CONFIG = {
  allowSelfSignedCerts: false,
  allowedHosts: ['localhost']
};

/**
 * SiyuanConnector 类
 * 处理与 Siyuan Notes API 的通信
 */
class SiyuanConnector {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.baseURL - API 基础地址
   * @param {string} options.token - API 令牌
   * @param {number} options.timeout - 请求超时时间（毫秒）
   * @param {number} options.maxRetries - 最大重试次数
   * @param {number} options.retryDelay - 重试延迟（毫秒）
   * @param {Object} options.tls - TLS 安全配置
   * @param {boolean} options.tls.allowSelfSignedCerts - 是否允许自签名证书（默认 false）
   * @param {string[]} options.tls.allowedHosts - 允许自签名证书的主机列表
   */
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://localhost:6806';
    this.token = options.token || '';
    this.timeout = options.timeout || 10000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // TLS 配置（支持 options.tlsConfig 和 options.tls 两种方式）
    const tlsConfig = options.tls || options.tlsConfig || {};
    this.tlsConfig = {
      allowSelfSignedCerts: tlsConfig.allowSelfSignedCerts ?? DEFAULT_TLS_CONFIG.allowSelfSignedCerts,
      allowedHosts: tlsConfig.allowedHosts || DEFAULT_TLS_CONFIG.allowedHosts
    };
    
    this.updateURL(this.baseURL);
  }
  
  /**
   * 发送 API 请求
   * @param {string} endpoint - API 端点
   * @param {Object} data - 请求数据
   * @returns {Promise<any>} 响应数据
   */
  async request(endpoint, data = {}) {
    let retryCount = 0;
    
    while (retryCount <= this.maxRetries) {
      try {
        return await this.makeRequest(endpoint, data);
      } catch (error) {
        // 检查是否应该重试
        const shouldRetry = retryCount < this.maxRetries && 
          (error.code === 'ECONNABORTED' || 
           error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' ||
           (error.statusCode && error.statusCode >= 500));
        
        if (shouldRetry) {
          retryCount++;
          const delay = this.retryDelay * retryCount;
          console.log(`请求失败，${delay}ms 后重试 (${retryCount}/${this.maxRetries}):`, endpoint);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          const businessErrors = ['tree not found', 'block not found', 'invalid ID argument', '未找到 ID 为'];
          const isBusinessError = businessErrors.some(e => error.message && error.message.includes(e));
          if (!isBusinessError) {
            console.error(`请求失败: ${endpoint}`, error.message);
          }
          throw this.formatError(error, endpoint, data);
        }
      }
    }
  }
  
  /**
   * 执行 HTTP 请求
   * @param {string} endpoint - API 端点
   * @param {Object} data - 请求数据
   * @returns {Promise<any>} 响应数据
   */
  makeRequest(endpoint, data) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.hostname,
        port: this.port,
        path: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SiyuanNotesSkill/1.0.0'
        },
        timeout: this.timeout
      };
      
      // 添加认证令牌
      if (this.token) {
        options.headers['Authorization'] = `Token ${this.token}`;
      }
      
      // 处理 HTTPS（仅对允许的主机使用自签名证书）
      let agent = null;
      if (this.protocol === 'https:') {
        const isAllowedHost = this.tlsConfig.allowedHosts.includes(this.hostname);
        const allowSelfSigned = this.tlsConfig.allowSelfSignedCerts && isAllowedHost;
        
        agent = new https.Agent({
          rejectUnauthorized: !allowSelfSigned
        });
        options.agent = agent;
      }
      
      const req = (this.protocol === 'https:' ? https : http).request(options, (res) => {
        let responseData = '';
        const statusCode = res.statusCode;
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            // 检查 HTTP 状态码
            if (statusCode < 200 || statusCode >= 300) {
              // 非 2xx 状态码，尝试提取错误信息
              let errorMessage = `HTTP ${statusCode}`;
              if (responseData) {
                // 尝试从 JSON 响应中提取错误信息
                try {
                  const errorData = JSON.parse(responseData);
                  if (errorData.msg) {
                    errorMessage = errorData.msg;
                  } else if (errorData.message) {
                    errorMessage = errorData.message;
                  } else {
                    errorMessage = `${statusCode}: ${responseData.substring(0, 200)}`;
                  }
                } catch {
                  // 不是 JSON，使用原始响应文本
                  errorMessage = `${statusCode}: ${responseData.substring(0, 200)}`;
                }
              }
              reject(new Error(errorMessage));
              return;
            }
            
            // 处理空响应
            if (!responseData) {
              resolve(null);
              return;
            }
            
            const parsedData = JSON.parse(responseData);
            
            // 检查响应格式
            if (parsedData.code !== undefined) {
              // 标准格式：{ code, data, msg }
              if (parsedData.code !== 0) {
                reject(new Error(parsedData.msg || `API错误: code=${parsedData.code}`));
              } else {
                resolve(parsedData.data);
              }
            } else {
              // 非标准格式：直接返回响应数据
              resolve(parsedData);
            }
          } catch (error) {
            console.error('JSON解析失败:', error.message);
            console.error('原始响应:', responseData.substring(0, 500));
            reject(new Error(`响应解析失败: ${error.message}`));
          }
        });
      });
      
      // 超时处理
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`请求超时 (${this.timeout}ms)`));
      });
      
      // 错误处理
      req.on('error', (error) => {
        reject(error);
      });
      
      // 发送请求数据
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
      
      req.write(postData);
      req.end();
    });
  }
  
  /**
   * 测试连接
   * @returns {Promise<boolean>} 连接是否成功
   */
  async testConnection() {
    try {
      const version = await this.request('/api/system/version');
      console.log('连接成功，Siyuan Notes 版本:', version);
      return true;
    } catch (error) {
      console.error('连接测试失败:', error.message);
      return false;
    }
  }
  
  /**
   * 获取系统信息
   * @returns {Promise<Object>} 系统信息
   */
  async getSystemInfo() {
    try {
      const version = await this.request('/api/system/version');
      const bootProgress = await this.request('/api/system/bootProgress');
      const currentTime = await this.request('/api/system/currentTime');
      
      return {
        version,
        bootProgress,
        currentTime,
        connected: true,
        baseURL: this.baseURL
      };
    } catch (error) {
      console.error('获取系统信息失败:', error);
      return {
        connected: false,
        error: error.message,
        baseURL: this.baseURL
      };
    }
  }
  
  /**
   * 设置超时时间
   * @param {number} timeout - 新的超时时间（毫秒）
   */
  setTimeout(timeout) {
    this.timeout = timeout;
    console.log('超时时间已更新:', timeout, 'ms');
  }
  
  /**
   * 更新 URL 解析
   * @param {string} url - 要解析的 URL
   */
  updateURL(url) {
    try {
      const parsedUrl = new URL(url);
      this.protocol = parsedUrl.protocol;
      this.hostname = parsedUrl.hostname;
      this.port = parsedUrl.port || (this.protocol === 'https:' ? 443 : 80);
    } catch (error) {
      console.error('URL解析失败:', error.message);
      throw new Error(`无效的URL: ${url}`);
    }
  }
  
  /**
   * 检测是否为 TLS 证书错误
   * @param {Error} error - 错误对象
   * @returns {Object|null} TLS 错误信息，如果不是 TLS 错误则返回 null
   */
  detectTlsError(error) {
    const msg = error.message || '';
    const code = error.code || '';
    
    const tlsErrorPatterns = [
      { pattern: /unable to verify the first certificate/i, type: '自签名/不可信证书' },
      { pattern: /UNABLE_TO_VERIFY_LEAF_SIGNATURE/i, type: '证书签名验证失败' },
      { pattern: /CERT_HAS_EXPIRED/i, type: '证书已过期' },
      { pattern: /DEPTH_ZERO_SELF_SIGNED_CERT/i, type: '自签名证书' },
      { pattern: /SELF_SIGNED_CERT_IN_CHAIN/i, type: '证书链中包含自签名证书' },
      { pattern: /ERR_TLS_CERT_ALTNAME_INVALID/i, type: '证书域名不匹配' },
      { pattern: /certificate/i, type: '证书验证失败' }
    ];
    
    for (const { pattern, type } of tlsErrorPatterns) {
      if (pattern.test(msg) || pattern.test(code)) {
        return {
          isTlsError: true,
          errorType: type,
          solution: this.getTlsSolution()
        };
      }
    }
    
    return null;
  }
  
  /**
   * 获取 TLS 错误的解决方案
   * @returns {string} 解决方案说明
   */
  getTlsSolution() {
    const host = this.hostname || 'your-host';
    return `TLS 证书验证失败。解决方案：

方法1 - 在 config.json 中添加 TLS 配置：
  "tls": {
    "allowSelfSignedCerts": true,
    "allowedHosts": ["localhost", "${host}"]
  }

方法2 - 设置环境变量：
  SIYUAN_TLS_ALLOW_SELF_SIGNED=true
  SIYUAN_TLS_ALLOWED_HOSTS=localhost,${host}`;
  }
  
  /**
   * 格式化错误信息
   * @param {Error} error - 原始错误
   * @param {string} endpoint - API 端点
   * @param {Object} data - 请求数据
   * @returns {Error} 格式化后的错误
   */
  formatError(error, endpoint, data) {
    const errorInfo = {
      message: error.message,
      endpoint,
      timestamp: new Date().toISOString()
    };
    
    if (data) {
      const safeData = { ...data };
      if (safeData.token) safeData.token = '***';
      if (safeData.password) safeData.password = '***';
      if (safeData.Authorization) safeData.Authorization = '***';
      if (safeData.apiKey) safeData.apiKey = '***';
      if (safeData.secret) safeData.secret = '***';
      errorInfo.requestData = safeData;
    }
    
    let formattedMessage = `Siyuan API 错误: ${error.message}`;
    
    const tlsError = this.detectTlsError(error);
    if (tlsError) {
      errorInfo.isTlsError = true;
      errorInfo.tlsErrorType = tlsError.errorType;
      formattedMessage = `TLS 证书错误 [${tlsError.errorType}]: ${error.message}\n\n${tlsError.solution}`;
    }
    
    const formattedError = new Error(formattedMessage);
    formattedError.details = errorInfo;
    formattedError.originalError = error;
    
    return formattedError;
  }
}

module.exports = SiyuanConnector;