const axios = require('axios');
const { NetworkError } = require('../../shared/errors');
const Logger = require('../../shared/utils/Logger');

class APIClient {
  constructor(baseURL, options = {}) {
    this.baseURL = baseURL;
    this.logger = Logger.getInstance('APIClient');
    this.timeout = options.timeout || 10000;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'IKE-Expedientes-Automation/1.0'
      }
    });
    
    this.setupInterceptors();
  }

  setupInterceptors() {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug('Making API request', {
          method: config.method,
          url: config.url,
          baseURL: config.baseURL
        });
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error', error);
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug('API response received', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('Response interceptor error', error);
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          return Promise.reject(NetworkError.fromAxiosError(error));
        }
        
        if (error.response) {
          return Promise.reject(NetworkError.fromAxiosError(error));
        }
        
        return Promise.reject(error);
      }
    );
  }

  async get(endpoint, config = {}) {
    try {
      const response = await this.axiosInstance.get(endpoint, config);
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error, 'GET', endpoint);
    }
  }

  async post(endpoint, data = {}, config = {}) {
    try {
      const response = await this.axiosInstance.post(endpoint, data, config);
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error, 'POST', endpoint);
    }
  }

  async put(endpoint, data = {}, config = {}) {
    try {
      const response = await this.axiosInstance.put(endpoint, data, config);
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error, 'PUT', endpoint);
    }
  }

  async delete(endpoint, config = {}) {
    try {
      const response = await this.axiosInstance.delete(endpoint, config);
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error, 'DELETE', endpoint);
    }
  }

  handleResponse(response) {
    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers
      };
    }
    
    return {
      success: false,
      error: response.data?.message || 'Request failed',
      status: response.status,
      data: response.data
    };
  }

  handleError(error, method, endpoint) {
    this.logger.error(`${method} ${endpoint} failed`, error);
    
    if (error instanceof NetworkError) {
      return {
        success: false,
        error: error.message,
        networkError: true,
        statusCode: error.statusCode
      };
    }
    
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      originalError: error
    };
  }

  setAuthToken(token) {
    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  removeAuthToken() {
    delete this.axiosInstance.defaults.headers.common['Authorization'];
  }

  setBaseURL(newBaseURL) {
    this.baseURL = newBaseURL;
    this.axiosInstance.defaults.baseURL = newBaseURL;
  }

  setTimeout(timeout) {
    this.timeout = timeout;
    this.axiosInstance.defaults.timeout = timeout;
  }
}

module.exports = APIClient;