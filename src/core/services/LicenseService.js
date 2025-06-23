const License = require('../domain/entities/License');
const Token = require('../domain/value-objects/Token');
const { ValidationError, NetworkError } = require('../../shared/errors');
const Logger = require('../../shared/utils/Logger');
const LicenseEvents = require('../../shared/events/events/LicenseEvents');
const os = require('os');

class LicenseService {
  constructor(licenseRepository, apiClient, eventBus) {
    this.licenseRepository = licenseRepository;
    this.apiClient = apiClient;
    this.eventBus = eventBus;
    this.logger = Logger.getInstance('LicenseService');
  }

  generateMachineId() {
    return `machine-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  getDeviceInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      type: os.type(),
      release: os.release()
    };
  }

  async validateLicense(tokenValue) {
    try {
      this.logger.info('Starting license validation');
      this.eventBus.publish(LicenseEvents.LICENSE_VALIDATION_STARTED, { token: tokenValue });

      const token = new Token(tokenValue);
      
      const localLicense = await this.licenseRepository.findByToken(token);
      
      if (localLicense && localLicense.isActive()) {
        this.logger.info('Valid license found locally');
        this.eventBus.publish(LicenseEvents.LICENSE_VALIDATED, { license: localLicense });
        return { valid: true, license: localLicense, source: 'local' };
      }

      const remoteValidation = await this.validateWithRemoteServer(token);
      
      if (remoteValidation.success) {
        const newLicense = License.fromAPIResponse({
          token: tokenValue,
          valid: true,
          ...remoteValidation.data
        });
        
        await this.licenseRepository.save(newLicense);
        this.eventBus.publish(LicenseEvents.LICENSE_VALIDATED, { license: newLicense });
        
        this.logger.info('License validated with remote server');
        return { valid: true, license: newLicense, source: 'remote' };
      }

      if (localLicense && this.canUseOfflineMode(localLicense)) {
        localLicense.enableOfflineMode();
        await this.licenseRepository.update(localLicense);
        
        this.logger.warn('Using offline mode for license validation');
        this.eventBus.publish(LicenseEvents.LICENSE_OFFLINE_MODE, { license: localLicense });
        
        return { valid: true, license: localLicense, source: 'offline' };
      }

      this.logger.warn('License validation failed');
      this.eventBus.publish(LicenseEvents.LICENSE_INVALID, { token: tokenValue });
      
      return { valid: false, error: remoteValidation.error || 'Invalid license' };
      
    } catch (error) {
      this.logger.error('Error during license validation', error);
      this.eventBus.publish(LicenseEvents.LICENSE_VALIDATION_FAILED, { 
        token: tokenValue, 
        error: error.message 
      });
      
      throw error;
    }
  }

  async validateWithRemoteServer(token) {
    try {
      this.logger.debug('Validating license with remote server');
      
      const response = await this.apiClient.validateLicense(token.value);
      
      if (response.success) {
        return {
          success: true,
          data: response.data
        };
      }
      
      return {
        success: false,
        error: response.error || 'Remote validation failed'
      };
      
    } catch (error) {
      this.logger.error('Error validating with remote server', error);
      
      if (error.code === 'NETWORK_ERROR') {
        return {
          success: false,
          error: 'Network error - server unreachable',
          networkError: true
        };
      }
      
      throw error;
    }
  }

  canUseOfflineMode(license) {
    if (!license) return false;
    
    const daysSinceLastValidation = this.getDaysSinceLastValidation(license);
    const maxOfflineDays = 7;
    
    return daysSinceLastValidation <= maxOfflineDays && !license.isExpired();
  }

  getDaysSinceLastValidation(license) {
    const now = new Date();
    const lastValidated = new Date(license.lastValidated);
    const diffInMs = now - lastValidated;
    return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  }

  async getCurrentLicense() {
    try {
      this.logger.debug('Getting current license');
      
      const license = await this.licenseRepository.findCurrent();
      
      if (!license) {
        this.logger.debug('No current license found');
        return null;
      }
      
      if (license.isExpired()) {
        this.logger.warn('Current license is expired');
        this.eventBus.publish(LicenseEvents.LICENSE_EXPIRED, { license });
        return null;
      }
      
      return license;
    } catch (error) {
      this.logger.error('Error getting current license', error);
      throw error;
    }
  }

  async revokeLicense(tokenValue) {
    try {
      this.logger.info('Revoking license');
      
      const token = new Token(tokenValue);
      const license = await this.licenseRepository.findByToken(token);
      
      if (license) {
        await this.licenseRepository.delete(token);
        this.eventBus.publish(LicenseEvents.LICENSE_REVOKED, { license });
        this.logger.info('License revoked successfully');
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error revoking license', error);
      throw error;
    }
  }

  async refreshLicense() {
    try {
      this.logger.info('Refreshing current license');
      
      const currentLicense = await this.getCurrentLicense();
      if (!currentLicense) {
        throw new ValidationError('No current license to refresh');
      }
      
      return await this.validateLicense(currentLicense.token);
    } catch (error) {
      this.logger.error('Error refreshing license', error);
      throw error;
    }
  }

  async hasValidLicense() {
    try {
      const license = await this.getCurrentLicense();
      return license !== null && license.isActive();
    } catch (error) {
      this.logger.error('Error checking valid license', error);
      return false;
    }
  }

  async checkInitialLicense() {
    try {
      this.logger.info('Checking initial license');
      
      // 1. Verificar si hay token almacenado localmente
      const storedLicense = await this.licenseRepository.findCurrent();
      
      if (!storedLicense) {
        this.logger.info('No stored license found');
        return {
          valid: false,
          message: 'No hay token almacenado',
          requiresToken: true
        };
      }

      this.logger.info('Stored license found, validating with server');
      
      // 2. Validar con servidor independientemente de la fecha local
      try {
        const serverValidation = await this.validateStoredLicenseWithServer(storedLicense);
        
        if (serverValidation.valid) {
          this.logger.info('Server confirms license is valid');
          
          // Si el servidor proporcionó nueva fecha de expiración, actualizar
          if (serverValidation.expiresAt) {
            storedLicense.expiresAt = new Date(serverValidation.expiresAt);
            storedLicense.lastValidated = new Date();
            await this.licenseRepository.update(storedLicense);
            this.logger.info('License updated with new expiration date');
          }
          
          return {
            valid: true,
            license: storedLicense,
            expiresAt: storedLicense.expiresAt
          };
        }
        
        // Si el servidor indica que el token no es válido
        this.logger.warn('Server indicates license is not valid');
        return {
          valid: false,
          message: 'La licencia no está activa. Por favor, renuévela.',
          requiresToken: true,
          token: storedLicense.token // Mantener para referencia
        };
        
      } catch (serverError) {
        // Error de conexión - usar modo offline si el token es válido localmente
        this.logger.warn('Server validation failed, checking offline mode', serverError);
        
        if (this.canUseOfflineMode(storedLicense)) {
          this.logger.info('Using offline mode');
          storedLicense.enableOfflineMode();
          await this.licenseRepository.update(storedLicense);
          
          return {
            valid: true,
            license: storedLicense,
            offlineMode: true,
            message: 'Modo sin conexión: Usando token local temporalmente'
          };
        }
        
        // Si no se puede usar modo offline, requerir token
        return {
          valid: false,
          message: 'Error al verificar la licencia y no se puede usar modo offline',
          requiresToken: true
        };
      }
      
    } catch (error) {
      this.logger.error('Error in checkInitialLicense', error);
      
      // Intentar usar token local como último recurso
      try {
        const storedLicense = await this.licenseRepository.findCurrent();
        if (storedLicense && storedLicense.token) {
          this.logger.info('Using stored license as last resort');
          return {
            valid: true,
            license: storedLicense,
            emergencyMode: true,
            message: 'Modo de emergencia: Usando token local'
          };
        }
      } catch (fallbackError) {
        this.logger.error('Fallback license check failed', fallbackError);
      }
      
      return {
        valid: false,
        message: error.message || 'Error al verificar la licencia',
        requiresToken: true
      };
    }
  }

  async validateStoredLicenseWithServer(license) {
    try {
      this.logger.debug('Validating stored license with server');
      
      // Usar endpoint de check-validity que no requiere machineId 
      const response = await this.apiClient.checkLicenseValidity(license.token);
      
      if (response.success) {
        return {
          valid: true,
          expiresAt: response.data.expiresAt,
          message: 'Token activo en servidor'
        };
      }
      
      return {
        valid: false,
        message: response.error || 'El token no está activo en el servidor'
      };
      
    } catch (error) {
      this.logger.error('Error validating stored license with server', error);
      throw error;
    }
  }

  async getLicenseInfo() {
    try {
      const license = await this.getCurrentLicense();
      
      if (!license) {
        return {
          hasLicense: false,
          isValid: false,
          isExpired: false,
          isOfflineMode: false
        };
      }
      
      return {
        hasLicense: true,
        isValid: license.isValid,
        isExpired: license.isExpired(),
        isOfflineMode: license.isOfflineMode,
        expiresAt: license.expiresAt,
        lastValidated: license.lastValidated,
        permissions: license.permissions
      };
    } catch (error) {
      this.logger.error('Error getting license info', error);
      throw error;
    }
  }
}

module.exports = LicenseService;