/**
 * Siyuan Notes 连接器
 * 提供简化的 API 接口和错误处理
 */

const http = require('http');
const https = require('https');

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
   */
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://127.0.0.1:6806';
    this.token = options.token || '';
    this.timeout = options.timeout || 10000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // 解析 URL
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
          console.error(`请求失败: ${endpoint}`, error.message);
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
      
      // 处理 HTTPS
      let agent = null;
      if (this.protocol === 'https:') {
        agent = new https.Agent({
          rejectUnauthorized: false
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
            // 处理空响应
            if (!responseData) {
              // 对于某些API，空响应表示成功
              if (statusCode >= 200 && statusCode < 300) {
                resolve(null);
              } else {
                reject(new Error(`HTTP ${statusCode}: 空响应`));
              }
              return;
            }
            
            // 记录响应（调试用）
            if (process.env.DEBUG) {
              console.log(`API响应 [${statusCode}]:`, responseData.substring(0, 200) + (responseData.length > 200 ? '...' : ''));
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
   * 设置 API 令牌
   * @param {string} token - 新的 API 令牌
   */
  setToken(token) {
    this.token = token;
    console.log('API令牌已更新');
  }
  
  /**
   * 设置基础 URL
   * @param {string} url - 新的基础 URL
   */
  setBaseURL(url) {
    this.baseURL = url;
    this.updateURL(url);
    console.log('基础URL已更新:', url);
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
      baseURL: this.baseURL,
      timestamp: new Date().toISOString()
    };
    
    // 添加请求数据（敏感信息已过滤）
    if (data) {
      const safeData = { ...data };
      if (safeData.token) safeData.token = '***';
      if (safeData.password) safeData.password = '***';
      errorInfo.requestData = safeData;
    }
    
    const formattedError = new Error(`Siyuan API 错误: ${error.message}`);
    formattedError.details = errorInfo;
    formattedError.originalError = error;
    
    return formattedError;
  }
}

module.exports = SiyuanConnector;