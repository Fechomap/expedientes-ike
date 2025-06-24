const log = require('electron-log');
const { AppError } = require('../errors');

class Logger {
  constructor(module = 'App') {
    this.module = module;
    this.setupLogger();
  }

  setupLogger() {
    log.transports.file.level = 'debug';
    log.transports.console.level = 'info';
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{processType}] {text}';
    log.transports.console.format = '[{h}:{i}:{s}] [{level}] [{processType}] {text}';
  }

  info(message, meta = {}) {
    this.logWithMeta('info', message, meta);
  }

  error(message, error = null, meta = {}) {
    const errorData = this.formatError(error);
    this.logWithMeta('error', message, { ...meta, error: errorData });
  }

  warn(message, meta = {}) {
    this.logWithMeta('warn', message, meta);
  }

  debug(message, meta = {}) {
    this.logWithMeta('debug', message, meta);
  }

  logWithMeta(level, message, meta) {
    const logData = {
      module: this.module,
      timestamp: new Date().toISOString(),
      message,
      ...meta
    };

    log[level](JSON.stringify(logData));
  }

  formatError(error) {
    if (!error) return null;

    if (AppError.isAppError(error)) {
      return error.toJSON();
    }

    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  createChild(childModule) {
    return new Logger(`${this.module}:${childModule}`);
  }

  static getInstance(module) {
    if (!Logger.instances) {
      Logger.instances = new Map();
    }

    if (!Logger.instances.has(module)) {
      Logger.instances.set(module, new Logger(module));
    }

    return Logger.instances.get(module);
  }
}

module.exports = Logger;