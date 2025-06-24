const AppError = require('./AppError');

class NetworkError extends AppError {
  constructor(message, statusCode = null, url = null, originalError = null) {
    super(message, 'NETWORK_ERROR', originalError);
    this.statusCode = statusCode;
    this.url = url;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      statusCode: this.statusCode,
      url: this.url
    };
  }

  static fromAxiosError(error) {
    const statusCode = error.response?.status;
    const url = error.config?.url;
    const message = error.response?.data?.message || error.message;
    
    return new NetworkError(message, statusCode, url, error);
  }
}

module.exports = NetworkError;