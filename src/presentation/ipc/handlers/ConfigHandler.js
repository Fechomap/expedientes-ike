const { ipcMain } = require('electron');
const Logger = require('../../../shared/utils/Logger');
const { ValidationError } = require('../../../shared/errors');

class ConfigHandler {
  constructor(configRepository) {
    this.configRepository = configRepository;
    this.logger = Logger.getInstance('ConfigHandler');
    this.registerHandlers();
  }

  registerHandlers() {
    ipcMain.handle('config:saveCredentials', this.handleSaveCredentials.bind(this));
    ipcMain.handle('config:getCredentials', this.handleGetCredentials.bind(this));
    ipcMain.handle('config:isConfigured', this.handleIsConfigured.bind(this));
    ipcMain.handle('config:save', this.handleSaveConfig.bind(this));
    ipcMain.handle('config:get', this.handleGetConfig.bind(this));
    ipcMain.handle('config:delete', this.handleDeleteConfig.bind(this));
    ipcMain.handle('config:getAll', this.handleGetAllConfig.bind(this));
    ipcMain.handle('config:clear', this.handleClearAllConfig.bind(this));

    this.logger.info('Config IPC handlers registered');
  }

  async handleSaveCredentials(event, { username, password }) {
    try {
      this.logger.info('Handling save credentials request', { username });

      const credentials = await this.configRepository.saveCredentials(username, password);

      // Set environment variables for compatibility
      process.env.IKE_USERNAME = username;
      process.env.IKE_PASSWORD = password;

      return {
        success: true,
        data: { username: credentials.username }
      };

    } catch (error) {
      this.logger.error('Error saving credentials', error);

      if (error instanceof ValidationError) {
        return {
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR',
          field: error.field
        };
      }

      return {
        success: false,
        error: error.message,
        code: 'SAVE_CREDENTIALS_ERROR'
      };
    }
  }

  async handleGetCredentials(event) {
    try {
      this.logger.debug('Handling get credentials request');

      const credentials = await this.configRepository.getCredentials();

      if (!credentials) {
        return {
          success: true,
          data: null
        };
      }

      return {
        success: true,
        data: { username: credentials.username }
      };

    } catch (error) {
      this.logger.error('Error getting credentials', error);

      return {
        success: false,
        error: error.message,
        code: 'GET_CREDENTIALS_ERROR'
      };
    }
  }

  async handleIsConfigured(event) {
    try {
      this.logger.debug('Handling is configured request');

      const isConfigured = await this.configRepository.isConfigured();

      return {
        success: true,
        data: { isConfigured }
      };

    } catch (error) {
      this.logger.error('Error checking configuration status', error);

      return {
        success: false,
        error: error.message,
        code: 'CHECK_CONFIG_ERROR'
      };
    }
  }

  async handleSaveConfig(event, { key, value }) {
    try {
      this.logger.debug('Handling save config request', { key });

      const savedValue = await this.configRepository.saveConfig(key, value);

      return {
        success: true,
        data: { key, value: savedValue }
      };

    } catch (error) {
      this.logger.error('Error saving config', error);

      if (error instanceof ValidationError) {
        return {
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR',
          field: error.field
        };
      }

      return {
        success: false,
        error: error.message,
        code: 'SAVE_CONFIG_ERROR'
      };
    }
  }

  async handleGetConfig(event, { key, defaultValue = null }) {
    try {
      this.logger.debug('Handling get config request', { key });

      const value = await this.configRepository.getConfig(key, defaultValue);

      return {
        success: true,
        data: { key, value }
      };

    } catch (error) {
      this.logger.error('Error getting config', error);

      return {
        success: false,
        error: error.message,
        code: 'GET_CONFIG_ERROR'
      };
    }
  }

  async handleDeleteConfig(event, { key }) {
    try {
      this.logger.debug('Handling delete config request', { key });

      const result = await this.configRepository.deleteConfig(key);

      return {
        success: true,
        data: { deleted: result }
      };

    } catch (error) {
      this.logger.error('Error deleting config', error);

      return {
        success: false,
        error: error.message,
        code: 'DELETE_CONFIG_ERROR'
      };
    }
  }

  async handleGetAllConfig(event) {
    try {
      this.logger.debug('Handling get all config request');

      const allConfig = await this.configRepository.getAllConfig();

      // Remove sensitive data
      const sanitizedConfig = { ...allConfig };
      if (sanitizedConfig.credentials) {
        sanitizedConfig.credentials = {
          username: sanitizedConfig.credentials.username
        };
      }

      return {
        success: true,
        data: sanitizedConfig
      };

    } catch (error) {
      this.logger.error('Error getting all config', error);

      return {
        success: false,
        error: error.message,
        code: 'GET_ALL_CONFIG_ERROR'
      };
    }
  }

  async handleClearAllConfig(event) {
    try {
      this.logger.info('Handling clear all config request');

      const result = await this.configRepository.clearAllConfig();

      // Clear environment variables
      delete process.env.IKE_USERNAME;
      delete process.env.IKE_PASSWORD;

      return {
        success: true,
        data: { cleared: result }
      };

    } catch (error) {
      this.logger.error('Error clearing all config', error);

      return {
        success: false,
        error: error.message,
        code: 'CLEAR_CONFIG_ERROR'
      };
    }
  }

  dispose() {
    ipcMain.removeAllListeners('config:saveCredentials');
    ipcMain.removeAllListeners('config:getCredentials');
    ipcMain.removeAllListeners('config:isConfigured');
    ipcMain.removeAllListeners('config:save');
    ipcMain.removeAllListeners('config:get');
    ipcMain.removeAllListeners('config:delete');
    ipcMain.removeAllListeners('config:getAll');
    ipcMain.removeAllListeners('config:clear');

    this.logger.info('Config IPC handlers disposed');
  }
}

module.exports = ConfigHandler;