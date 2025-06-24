class AppError extends Error {
  constructor(message, code = 'APP_ERROR', originalError = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date();
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: this.originalError ? this.originalError.message : null
    };
  }

  static isAppError(error) {
    return error instanceof AppError;
  }
}

module.exports = AppError;