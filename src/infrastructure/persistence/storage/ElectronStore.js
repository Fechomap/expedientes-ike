const Store = require('electron-store');
const Logger = require('../../../shared/utils/Logger');

class ElectronStore {
  constructor(options = {}) {
    this.store = new Store(options);
    this.logger = Logger.getInstance('ElectronStore');
  }

  async get(key, defaultValue = null) {
    try {
      this.logger.debug('Getting value from store', { key });
      const value = this.store.get(key, defaultValue);
      return value;
    } catch (error) {
      this.logger.error('Error getting value from store', error, { key });
      throw error;
    }
  }

  async set(key, value) {
    try {
      this.logger.debug('Setting value in store', { key });
      this.store.set(key, value);
      return value;
    } catch (error) {
      this.logger.error('Error setting value in store', error, { key });
      throw error;
    }
  }

  async delete(key) {
    try {
      this.logger.debug('Deleting value from store', { key });
      this.store.delete(key);
      return true;
    } catch (error) {
      this.logger.error('Error deleting value from store', error, { key });
      throw error;
    }
  }

  async has(key) {
    try {
      return this.store.has(key);
    } catch (error) {
      this.logger.error('Error checking if key exists in store', error, { key });
      return false;
    }
  }

  async clear() {
    try {
      this.logger.debug('Clearing all values from store');
      this.store.clear();
      return true;
    } catch (error) {
      this.logger.error('Error clearing store', error);
      throw error;
    }
  }

  async getAll() {
    try {
      this.logger.debug('Getting all values from store');
      return this.store.store;
    } catch (error) {
      this.logger.error('Error getting all values from store', error);
      throw error;
    }
  }

  async size() {
    try {
      return this.store.size;
    } catch (error) {
      this.logger.error('Error getting store size', error);
      return 0;
    }
  }

  getPath() {
    return this.store.path;
  }

  openInEditor() {
    this.store.openInEditor();
  }
}

module.exports = ElectronStore;