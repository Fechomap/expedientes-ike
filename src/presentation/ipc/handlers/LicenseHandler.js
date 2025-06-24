const { ipcMain } = require('electron');
const Logger = require('../../../shared/utils/Logger');
const { ValidationError, NetworkError } = require('../../../shared/errors');

class LicenseHandler {
  constructor(licenseService, eventBus) {
    this.licenseService = licenseService;
    this.eventBus = eventBus;
    this.logger = Logger.getInstance('LicenseHandler');
    this.registerHandlers();
  }

  registerHandlers() {
    ipcMain.handle('license:validate', this.handleValidateLicense.bind(this));
    ipcMain.handle('license:getCurrent', this.handleGetCurrentLicense.bind(this));
    ipcMain.handle('license:revoke', this.handleRevokeLicense.bind(this));
    ipcMain.handle('license:refresh', this.handleRefreshLicense.bind(this));
    ipcMain.handle('license:getInfo', this.handleGetLicenseInfo.bind(this));
    ipcMain.handle('license:hasValid', this.handleHasValidLicense.bind(this));

    this.logger.info('License IPC handlers registered');
  }

  async handleValidateLicense(event, token) {
    try {
      this.logger.info('Handling license validation request');

      if (!token) {
        throw new ValidationError('Token is required', 'token', token);
      }

      const result = await this.licenseService.validateLicense(token);

      this.logger.info('License validation completed', { 
        valid: result.valid, 
        source: result.source 
      });

      return {
        success: true,
        data: result
      };

    } catch (error) {
      this.logger.error('Error handling license validation', error);

      if (error instanceof ValidationError) {
        return {
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR'
        };
      }

      if (error instanceof NetworkError) {
        return {
          success: false,
          error: 'Network error - please check your connection',
          code: 'NETWORK_ERROR',
          canUseOffline: true
        };
      }

      return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR'
      };
    }
  }

  async handleGetCurrentLicense(event) {
    try {
      this.logger.debug('Handling get current license request');

      const license = await this.licenseService.getCurrentLicense();

      return {
        success: true,
        data: license ? license.toJSON() : null
      };

    } catch (error) {
      this.logger.error('Error getting current license', error);

      return {
        success: false,
        error: error.message,
        code: 'GET_LICENSE_ERROR'
      };
    }
  }

  async handleRevokeLicense(event, token) {
    try {
      this.logger.info('Handling license revocation request');

      const result = await this.licenseService.revokeLicense(token);

      return {
        success: true,
        data: { revoked: result }
      };

    } catch (error) {
      this.logger.error('Error revoking license', error);

      return {
        success: false,
        error: error.message,
        code: 'REVOKE_ERROR'
      };
    }
  }

  async handleRefreshLicense(event) {
    try {
      this.logger.info('Handling license refresh request');

      const result = await this.licenseService.refreshLicense();

      return {
        success: true,
        data: result
      };

    } catch (error) {
      this.logger.error('Error refreshing license', error);

      if (error instanceof ValidationError) {
        return {
          success: false,
          error: error.message,
          code: 'NO_LICENSE_TO_REFRESH'
        };
      }

      return {
        success: false,
        error: error.message,
        code: 'REFRESH_ERROR'
      };
    }
  }

  async handleGetLicenseInfo(event) {
    try {
      this.logger.debug('Handling get license info request');

      const info = await this.licenseService.getLicenseInfo();

      return {
        success: true,
        data: info
      };

    } catch (error) {
      this.logger.error('Error getting license info', error);

      return {
        success: false,
        error: error.message,
        code: 'GET_INFO_ERROR'
      };
    }
  }

  async handleHasValidLicense(event) {
    try {
      this.logger.debug('Handling has valid license request');

      const hasValid = await this.licenseService.hasValidLicense();

      return {
        success: true,
        data: { hasValid }
      };

    } catch (error) {
      this.logger.error('Error checking valid license', error);

      return {
        success: false,
        error: error.message,
        code: 'CHECK_VALID_ERROR'
      };
    }
  }

  dispose() {
    ipcMain.removeAllListeners('license:validate');
    ipcMain.removeAllListeners('license:getCurrent');
    ipcMain.removeAllListeners('license:revoke');
    ipcMain.removeAllListeners('license:refresh');
    ipcMain.removeAllListeners('license:getInfo');
    ipcMain.removeAllListeners('license:hasValid');

    this.logger.info('License IPC handlers disposed');
  }
}

module.exports = LicenseHandler;