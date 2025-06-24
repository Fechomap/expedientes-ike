const IConfigRepository = require('../../../core/domain/repositories/IConfigRepository');
const { ValidationError } = require('../../../shared/errors');
const Logger = require('../../../shared/utils/Logger');

class ConfigRepository extends IConfigRepository {
  constructor(storage) {
    super();
    this.storage = storage;
    this.logger = Logger.getInstance('ConfigRepository');
  }

  async saveCredentials(username, password) {
    try {
      this.validateCredentials(username, password);
      
      this.logger.debug('Saving credentials', { username });
      
      const credentials = { username, password };
      await this.storage.set('credentials', credentials);
      await this.storage.set('isConfigured', true);
      
      this.logger.info('Credentials saved successfully');
      return credentials;
    } catch (error) {
      this.logger.error('Error saving credentials', error);
      throw error;
    }
  }

  async getCredentials() {
    try {
      this.logger.debug('Getting credentials');
      
      const credentials = await this.storage.get('credentials');
      if (!credentials) {
        this.logger.debug('No credentials found');
        return null;
      }
      
      return credentials;
    } catch (error) {
      this.logger.error('Error getting credentials', error);
      throw error;
    }
  }

  async isConfigured() {
    try {
      const configured = await this.storage.get('isConfigured', false);
      return Boolean(configured);
    } catch (error) {
      this.logger.error('Error checking configuration status', error);
      return false;
    }
  }

  async saveConfig(key, value) {
    try {
      this.validateConfigKey(key);
      
      this.logger.debug('Saving config', { key });
      await this.storage.set(key, value);
      
      return value;
    } catch (error) {
      this.logger.error('Error saving config', error, { key });
      throw error;
    }
  }

  async getConfig(key, defaultValue = null) {
    try {
      this.validateConfigKey(key);
      
      const value = await this.storage.get(key, defaultValue);
      return value;
    } catch (error) {
      this.logger.error('Error getting config', error, { key });
      throw error;
    }
  }

  async deleteConfig(key) {
    try {
      this.validateConfigKey(key);
      
      this.logger.debug('Deleting config', { key });
      await this.storage.delete(key);
      
      return true;
    } catch (error) {
      this.logger.error('Error deleting config', error, { key });
      throw error;
    }
  }

  async getAllConfig() {
    try {
      this.logger.debug('Getting all config');
      
      const allData = await this.storage.getAll();
      return allData || {};
    } catch (error) {
      this.logger.error('Error getting all config', error);
      throw error;
    }
  }

  async clearAllConfig() {
    try {
      this.logger.debug('Clearing all config');
      
      await this.storage.clear();
      
      this.logger.info('All config cleared successfully');
      return true;
    } catch (error) {
      this.logger.error('Error clearing all config', error);
      throw error;
    }
  }

  validateCredentials(username, password) {
    if (!username || typeof username !== 'string') {
      throw new ValidationError('Username is required and must be a string', 'username', username);
    }

    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required and must be a string', 'password', '[HIDDEN]');
    }

    if (username.length < 3) {
      throw new ValidationError('Username must be at least 3 characters long', 'username', username);
    }

    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long', 'password', '[HIDDEN]');
    }
  }

  validateConfigKey(key) {
    if (!key || typeof key !== 'string') {
      throw new ValidationError('Config key is required and must be a string', 'key', key);
    }

    if (key.trim() === '') {
      throw new ValidationError('Config key cannot be empty', 'key', key);
    }
  }
}

module.exports = ConfigRepository;