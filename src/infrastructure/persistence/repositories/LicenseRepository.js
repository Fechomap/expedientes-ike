const ILicenseRepository = require('../../../core/domain/repositories/ILicenseRepository');
const License = require('../../../core/domain/entities/License');
const Token = require('../../../core/domain/value-objects/Token');
const Logger = require('../../../shared/utils/Logger');

class LicenseRepository extends ILicenseRepository {
  constructor(storage) {
    super();
    this.storage = storage;
    this.logger = Logger.getInstance('LicenseRepository');
  }

  async save(license) {
    try {
      this.logger.debug('Saving license', { token: license.token });
      
      const data = license.toJSON();
      await this.storage.set('license', data);
      await this.storage.set('currentToken', license.token);
      
      this.logger.info('License saved successfully');
      return license;
    } catch (error) {
      this.logger.error('Error saving license', error);
      throw error;
    }
  }

  async findByToken(tokenValue) {
    try {
      this.logger.debug('Finding license by token');
      
      const token = tokenValue instanceof Token ? tokenValue : new Token(tokenValue);
      const data = await this.storage.get('license');
      
      if (!data || data.token !== token.value) {
        this.logger.debug('License not found for token');
        return null;
      }
      
      const license = License.fromJSON(data);
      this.logger.debug('License found', { token: license.token });
      
      return license;
    } catch (error) {
      this.logger.error('Error finding license by token', error);
      throw error;
    }
  }

  async findCurrent() {
    try {
      this.logger.debug('Finding current license');
      
      const currentToken = await this.storage.get('currentToken');
      if (!currentToken) {
        this.logger.debug('No current token found');
        return null;
      }
      
      return await this.findByToken(currentToken);
    } catch (error) {
      this.logger.error('Error finding current license', error);
      throw error;
    }
  }

  async update(license) {
    try {
      this.logger.debug('Updating license', { token: license.token });
      
      const existingLicense = await this.findByToken(license.token);
      if (!existingLicense) {
        throw new Error('License not found for update');
      }
      
      return await this.save(license);
    } catch (error) {
      this.logger.error('Error updating license', error);
      throw error;
    }
  }

  async delete(tokenValue) {
    try {
      this.logger.debug('Deleting license');
      
      const token = tokenValue instanceof Token ? tokenValue : new Token(tokenValue);
      
      await this.storage.delete('license');
      await this.storage.delete('currentToken');
      
      this.logger.info('License deleted successfully');
      return true;
    } catch (error) {
      this.logger.error('Error deleting license', error);
      throw error;
    }
  }

  async exists(tokenValue) {
    try {
      const license = await this.findByToken(tokenValue);
      return license !== null;
    } catch (error) {
      this.logger.error('Error checking license existence', error);
      return false;
    }
  }
}

module.exports = LicenseRepository;