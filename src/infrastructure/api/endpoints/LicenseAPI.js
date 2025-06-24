const APIClient = require('../APIClient');
const Logger = require('../../../shared/utils/Logger');

class LicenseAPI extends APIClient {
  constructor(baseURL) {
    super(baseURL);
    this.logger = Logger.getInstance('LicenseAPI');
  }

  async validateLicense(token) {
    try {
      this.logger.info('Validating license with API');
      
      // Generate machineId and deviceInfo like legacy code
      const machineId = this.generateMachineId();
      const deviceInfo = this.getDeviceInfo();
      const deviceInfoString = JSON.stringify(deviceInfo);
      
      this.logger.debug('Sending validation request', { token, machineId });
      
      const response = await this.post('/api/validate', { 
        token, 
        machineId, 
        deviceInfo: deviceInfoString 
      });
      
      if (response.success) {
        this.logger.info('License validation successful');
        return {
          success: true,
          data: {
            valid: response.data.valid,
            expires_at: response.data.expires_at,
            user_id: response.data.user_id,
            permissions: response.data.permissions || []
          }
        };
      }
      
      this.logger.warn('License validation failed', { error: response.error });
      return {
        success: false,
        error: response.error || 'License validation failed'
      };
      
    } catch (error) {
      this.logger.error('Error validating license', error);
      throw error;
    }
  }

  generateMachineId() {
    return `machine-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  getDeviceInfo() {
    const os = require('os');
    const { app } = require('electron');
    
    try {
      return {
        platform: process.platform,
        hostname: os.hostname(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        osType: os.type(),
        osRelease: os.release(),
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        userDataPath: app.getPath('userData'),
        date: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error getting device info:', error);
      return {
        platform: 'unknown',
        hostname: 'unknown',
        arch: 'unknown',
        error: error.message
      };
    }
  }

  async refreshLicense(token) {
    try {
      this.logger.info('Refreshing license with API');
      
      const response = await this.post('/api/check-validity', { token });
      
      if (response.success) {
        this.logger.info('License refresh successful');
        return {
          success: true,
          data: response.data
        };
      }
      
      this.logger.warn('License refresh failed', { error: response.error });
      return {
        success: false,
        error: response.error || 'License refresh failed'
      };
      
    } catch (error) {
      this.logger.error('Error refreshing license', error);
      throw error;
    }
  }

  async revokeLicense(token) {
    try {
      this.logger.info('Revoking license with API');
      
      const response = await this.post('/api/redeem', { token });
      
      if (response.success) {
        this.logger.info('License revocation successful');
        return {
          success: true,
          data: response.data
        };
      }
      
      this.logger.warn('License revocation failed', { error: response.error });
      return {
        success: false,
        error: response.error || 'License revocation failed'
      };
      
    } catch (error) {
      this.logger.error('Error revoking license', error);
      throw error;
    }
  }

  async getLicenseInfo(token) {
    try {
      this.logger.info('Getting license info from API');
      
      const response = await this.get(`/api/license/info?token=${encodeURIComponent(token)}`);
      
      if (response.success) {
        this.logger.info('License info retrieved successfully');
        return {
          success: true,
          data: response.data
        };
      }
      
      this.logger.warn('Failed to get license info', { error: response.error });
      return {
        success: false,
        error: response.error || 'Failed to get license info'
      };
      
    } catch (error) {
      this.logger.error('Error getting license info', error);
      throw error;
    }
  }

  async checkLicenseValidity(token) {
    try {
      this.logger.info('Checking license validity with server');
      
      const response = await this.get(`/api/check-validity/${token}`);
      
      if (response.success) {
        this.logger.info('License validity check successful');
        return {
          success: true,
          data: {
            valid: response.data.valid,
            expiresAt: response.data.expiresAt,
            message: response.data.message
          }
        };
      }
      
      this.logger.warn('License validity check failed', { error: response.error });
      return {
        success: false,
        error: response.error || 'License validity check failed'
      };
      
    } catch (error) {
      this.logger.error('Error checking license validity', error);
      throw error;
    }
  }

  async checkServerStatus() {
    try {
      this.logger.debug('Checking license server status');
      
      const response = await this.get('/api/health');
      
      return {
        success: response.success,
        status: response.status,
        data: response.data
      };
      
    } catch (error) {
      this.logger.error('Error checking server status', error);
      return {
        success: false,
        error: error.message,
        networkError: true
      };
    }
  }
}

module.exports = LicenseAPI;